//! Single-threaded operation queue for wallet FFI calls.
//!
//! Serializes all wallet operations through a Tokio channel to ensure
//! thread-safe access to the Go shared library.
//!
//! Architecture:
//! - All Tauri commands send requests to the queue
//! - Single worker task processes requests sequentially using spawn_blocking
//! - Responses sent back via oneshot channels
//!
//! Feature: 005-go-cli-shared
//! Created: 2025-10-25
//! Updated: 2025-10-25 - T057-T059: Added metrics, cancellation, backpressure

use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, oneshot};
use super::bindings::WalletLibrary;

/// T057: Queue metrics for monitoring performance
#[derive(Debug, Clone)]
pub struct QueueMetrics {
    /// Total operations processed
    pub total_operations: Arc<AtomicU64>,
    /// Current queue depth (pending operations)
    pub current_depth: Arc<AtomicUsize>,
    /// Peak queue depth observed
    pub peak_depth: Arc<AtomicUsize>,
    /// Total wait time (sum of all operation wait times)
    pub total_wait_time_ms: Arc<AtomicU64>,
}

impl QueueMetrics {
    fn new() -> Self {
        Self {
            total_operations: Arc::new(AtomicU64::new(0)),
            current_depth: Arc::new(AtomicUsize::new(0)),
            peak_depth: Arc::new(AtomicUsize::new(0)),
            total_wait_time_ms: Arc::new(AtomicU64::new(0)),
        }
    }

    /// T057: Record operation start (enqueued)
    fn record_enqueue(&self) {
        let depth = self.current_depth.fetch_add(1, Ordering::SeqCst) + 1;

        // Update peak depth if necessary
        let mut peak = self.peak_depth.load(Ordering::SeqCst);
        while depth > peak {
            match self.peak_depth.compare_exchange(
                peak,
                depth,
                Ordering::SeqCst,
                Ordering::SeqCst,
            ) {
                Ok(_) => break,
                Err(actual) => peak = actual,
            }
        }
    }

    /// T057: Record operation completion (dequeued)
    fn record_dequeue(&self, wait_time: Duration) {
        self.current_depth.fetch_sub(1, Ordering::SeqCst);
        self.total_operations.fetch_add(1, Ordering::SeqCst);
        self.total_wait_time_ms.fetch_add(wait_time.as_millis() as u64, Ordering::SeqCst);
    }

    /// T057: Get average wait time
    pub fn average_wait_time_ms(&self) -> f64 {
        let total_ops = self.total_operations.load(Ordering::SeqCst);
        if total_ops == 0 {
            return 0.0;
        }
        let total_wait = self.total_wait_time_ms.load(Ordering::SeqCst);
        total_wait as f64 / total_ops as f64
    }

    /// T057: Log metrics
    pub fn log_metrics(&self) {
        let total_ops = self.total_operations.load(Ordering::SeqCst);
        let current_depth = self.current_depth.load(Ordering::SeqCst);
        let peak_depth = self.peak_depth.load(Ordering::SeqCst);
        let avg_wait = self.average_wait_time_ms();

        tracing::info!(
            "Queue metrics: operations={}, depth={}, peak={}, avg_wait={:.2}ms",
            total_ops,
            current_depth,
            peak_depth,
            avg_wait
        );

        // T057: Warn if performance degrading
        if avg_wait > 10.0 {
            tracing::warn!(
                "Queue wait time elevated: {:.2}ms (target <10ms)",
                avg_wait
            );
        }

        if current_depth > 10 {
            tracing::warn!(
                "Queue depth high: {} operations pending",
                current_depth
            );
        }
    }
}

/// Command types for wallet operations.
/// Each variant represents a wallet operation that can be queued.
/// T030: Add all wallet operation command variants
#[derive(Debug)]
pub enum WalletCommand {
    /// Get library version (for testing/health checks)
    GetVersion {
        /// Response channel
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// Create a new HD wallet from mnemonic
    CreateWallet {
        params_json: String,
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// Import an existing wallet from mnemonic
    ImportWallet {
        params_json: String,
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// Authenticate and load wallet into memory
    UnlockWallet {
        params_json: String,
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// Derive addresses for specified blockchains
    GenerateAddresses {
        params_json: String,
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// Export wallet metadata without private keys
    ExportWallet {
        params_json: String,
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// Change wallet display name
    RenameWallet {
        params_json: String,
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
    /// Enumerate all wallets on USB
    ListWallets {
        params_json: String,
        respond_to: oneshot::Sender<Result<serde_json::Value, String>>,
    },
}

/// WalletQueue serializes all wallet operations through a single-threaded queue.
///
/// Design:
/// - Prevents concurrent FFI calls (Go library may not be thread-safe)
/// - Uses spawn_blocking to avoid blocking Tokio runtime
/// - Provides async interface for Tauri commands
/// - T057: Tracks operation metrics (queue depth, wait time)
/// - T059: Implements backpressure (bounded channel)
///
/// Example:
/// ```ignore
/// let queue = WalletQueue::new(library);
/// let version = queue.get_version().await?;
/// queue.metrics().log_metrics(); // T057
/// ```
#[derive(Clone)]
pub struct WalletQueue {
    sender: mpsc::Sender<WalletCommand>,
    metrics: QueueMetrics, // T057: Performance metrics
}

impl WalletQueue {
    /// T059: Maximum queue depth (backpressure limit)
    const MAX_QUEUE_DEPTH: usize = 100;

    /// Create a new wallet queue with the given library.
    ///
    /// Spawns a background worker task on the current Tokio runtime.
    /// IMPORTANT: This must be called from within an async context (Tokio runtime).
    ///
    /// Parameters:
    /// - `library`: The loaded WalletLibrary instance
    ///
    /// Returns:
    /// A WalletQueue handle that can be cloned and shared across threads.
    pub fn new(library: Arc<WalletLibrary>) -> Self {
        // T059: Bounded channel for backpressure
        let (sender, receiver) = mpsc::channel::<WalletCommand>(Self::MAX_QUEUE_DEPTH);

        let metrics = QueueMetrics::new();
        let metrics_clone = metrics.clone();

        // Spawn worker task on the current Tokio runtime
        // This requires being called from an async context
        tokio::spawn(Self::worker_task(library, receiver, metrics_clone));

        WalletQueue { sender, metrics }
    }

    /// T057: Get queue metrics for monitoring
    pub fn metrics(&self) -> &QueueMetrics {
        &self.metrics
    }

    /// T058: Check if queue has capacity (for cancellation/rejection logic)
    pub fn has_capacity(&self) -> bool {
        self.metrics.current_depth.load(Ordering::SeqCst) < Self::MAX_QUEUE_DEPTH
    }

    /// T059: Try to send command with backpressure handling
    async fn try_send_command(&self, cmd: WalletCommand) -> Result<(), String> {
        // T057: Record enqueue
        self.metrics.record_enqueue();

        // T059: Use try_send for immediate backpressure feedback
        match self.sender.try_send(cmd) {
            Ok(_) => Ok(()),
            Err(mpsc::error::TrySendError::Full(_)) => {
                // T059: Queue full, apply backpressure
                self.metrics.current_depth.fetch_sub(1, Ordering::SeqCst);
                tracing::warn!(
                    "Queue at capacity ({}), rejecting operation",
                    Self::MAX_QUEUE_DEPTH
                );
                Err(format!(
                    "Operation queue full ({} operations pending). Please try again.",
                    Self::MAX_QUEUE_DEPTH
                ))
            }
            Err(mpsc::error::TrySendError::Closed(_)) => {
                self.metrics.current_depth.fetch_sub(1, Ordering::SeqCst);
                Err("Queue is closed".to_string())
            }
        }
    }

    /// Background worker task that processes wallet commands sequentially.
    ///
    /// This task runs for the lifetime of the application.
    /// It uses spawn_blocking to execute FFI calls without blocking the async runtime.
    ///
    /// Architecture:
    /// 1. Receive command from channel
    /// 2. T057: Track wait time from enqueue to dequeue
    /// 3. Execute FFI call in spawn_blocking
    /// 4. T057: Record metrics
    /// 5. Send response back via oneshot channel
    /// 6. Repeat
    ///
    /// T057: Enhanced with metrics tracking
    async fn worker_task(
        library: Arc<WalletLibrary>,
        mut receiver: mpsc::Receiver<WalletCommand>,
        metrics: QueueMetrics,
    ) {
        let mut operations_count = 0u64;

        while let Some(cmd) = receiver.recv().await {
            // T057: Record operation start time (for wait time calculation)
            let operation_start = Instant::now();

            match cmd {
                WalletCommand::GetVersion { respond_to } => {
                    let lib = Arc::clone(&library);

                    // Execute FFI call in blocking context
                    let result = tokio::task::spawn_blocking(move || {
                        lib.get_version()
                    }).await;

                    // Handle task join errors
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };

                    // Send response (ignore if receiver dropped)
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // T030.1: Add CreateWallet command handler
                WalletCommand::CreateWallet { params_json, respond_to } => {
                    let lib = Arc::clone(&library);
                    let result = tokio::task::spawn_blocking(move || {
                        lib.create_wallet(&params_json)
                    }).await;
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // T030.2: Add ImportWallet command handler
                WalletCommand::ImportWallet { params_json, respond_to } => {
                    let lib = Arc::clone(&library);
                    let result = tokio::task::spawn_blocking(move || {
                        lib.import_wallet(&params_json)
                    }).await;
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // T030.3: Add UnlockWallet command handler
                WalletCommand::UnlockWallet { params_json, respond_to } => {
                    let lib = Arc::clone(&library);
                    let result = tokio::task::spawn_blocking(move || {
                        lib.unlock_wallet(&params_json)
                    }).await;
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // T030.4: Add GenerateAddresses command handler
                WalletCommand::GenerateAddresses { params_json, respond_to } => {
                    let lib = Arc::clone(&library);
                    let result = tokio::task::spawn_blocking(move || {
                        lib.generate_addresses(&params_json)
                    }).await;
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // T030.5: Add ExportWallet command handler
                WalletCommand::ExportWallet { params_json, respond_to } => {
                    let lib = Arc::clone(&library);
                    let result = tokio::task::spawn_blocking(move || {
                        lib.export_wallet(&params_json)
                    }).await;
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // T030.6: Add RenameWallet command handler
                WalletCommand::RenameWallet { params_json, respond_to } => {
                    let lib = Arc::clone(&library);
                    let result = tokio::task::spawn_blocking(move || {
                        lib.rename_wallet(&params_json)
                    }).await;
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // T030.7: Add ListWallets command handler
                WalletCommand::ListWallets { params_json, respond_to } => {
                    let lib = Arc::clone(&library);
                    let result = tokio::task::spawn_blocking(move || {
                        lib.list_wallets(&params_json)
                    }).await;
                    let response = match result {
                        Ok(ffi_result) => ffi_result,
                        Err(join_err) => Err(format!("Worker task panicked: {}", join_err)),
                    };
                    let _ = respond_to.send(response);

                    // T057: Record metrics
                    metrics.record_dequeue(operation_start.elapsed());
                }
            }
        }
    }

    /// Get library version (async wrapper).
    ///
    /// This method demonstrates the pattern for all wallet operations:
    /// 1. Create oneshot channel for response
    /// 2. Send command to queue (with backpressure handling)
    /// 3. Await response
    ///
    /// Example:
    /// ```ignore
    /// let version_data = queue.get_version().await?;
    /// println!("Version: {}", version_data["version"]);
    /// ```
    pub async fn get_version(&self) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();

        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::GetVersion { respond_to: sender }).await?;

        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }

    // ========================================================================
    // T031: Public async methods for wallet operations
    // ========================================================================

    /// Create a new HD wallet from provided mnemonic.
    pub async fn create_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();
        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::CreateWallet {
            params_json,
            respond_to: sender,
        }).await?;
        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }

    /// Import an existing wallet from mnemonic.
    pub async fn import_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();
        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::ImportWallet {
            params_json,
            respond_to: sender,
        }).await?;
        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }

    /// Authenticate and load wallet into memory.
    pub async fn unlock_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();
        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::UnlockWallet {
            params_json,
            respond_to: sender,
        }).await?;
        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }

    /// Derive addresses for specified blockchains.
    pub async fn generate_addresses(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();
        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::GenerateAddresses {
            params_json,
            respond_to: sender,
        }).await?;
        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }

    /// Export wallet metadata without private keys.
    pub async fn export_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();
        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::ExportWallet {
            params_json,
            respond_to: sender,
        }).await?;
        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }

    /// Change wallet display name.
    pub async fn rename_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();
        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::RenameWallet {
            params_json,
            respond_to: sender,
        }).await?;
        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }

    /// Enumerate all wallets on USB.
    pub async fn list_wallets(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot::channel();
        // T059: Use try_send_command for backpressure handling
        self.try_send_command(WalletCommand::ListWallets {
            params_json,
            respond_to: sender,
        }).await?;
        receiver
            .await
            .map_err(|_| "Response channel closed".to_string())?
    }
}

impl Default for WalletQueue {
    fn default() -> Self {
        // Create a dummy queue for testing/development
        // In production, use WalletQueue::new(library) instead
        let (sender, _receiver) = mpsc::channel(1);
        WalletQueue {
            sender,
            metrics: QueueMetrics::new(), // T057: Include metrics in default
        }
    }
}
