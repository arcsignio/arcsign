//! Single-threaded operation queue for wallet FFI calls.
//!
//! Serializes all wallet operations through a standard thread to ensure
//! thread-safe access to the Go shared library.
//!
//! Architecture:
//! - All Tauri commands send requests to the queue
//! - Single worker thread processes requests sequentially
//! - Responses sent back via oneshot channels
//! - Uses std::sync primitives ONLY (no Tokio)
//!
//! Feature: 005-go-cli-shared
//! Created: 2025-10-25
//! Updated: 2025-10-30 - Complete rewrite using std::sync only

use std::sync::{Arc, Mutex, OnceLock, mpsc};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use std::thread;
use super::bindings::WalletLibrary;

/// Queue metrics for monitoring performance
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

    /// Record operation start (enqueued)
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

    /// Record operation completion (dequeued)
    fn record_dequeue(&self, wait_time: Duration) {
        self.current_depth.fetch_sub(1, Ordering::SeqCst);
        self.total_operations.fetch_add(1, Ordering::SeqCst);
        self.total_wait_time_ms.fetch_add(wait_time.as_millis() as u64, Ordering::SeqCst);
    }

    /// Get average wait time
    pub fn average_wait_time_ms(&self) -> f64 {
        let total_ops = self.total_operations.load(Ordering::SeqCst);
        if total_ops == 0 {
            return 0.0;
        }
        let total_wait = self.total_wait_time_ms.load(Ordering::SeqCst);
        total_wait as f64 / total_ops as f64
    }

    /// Log metrics
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

        // Warn if performance degrading
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

/// Oneshot channel for sending a single response
type OneshotSender<T> = std::sync::mpsc::Sender<T>;
type OneshotReceiver<T> = std::sync::mpsc::Receiver<T>;

fn oneshot<T>() -> (OneshotSender<T>, OneshotReceiver<T>) {
    mpsc::channel()
}

/// Command types for wallet operations
#[derive(Debug)]
pub enum WalletCommand {
    /// Get library version (for testing/health checks)
    GetVersion {
        /// Response channel
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Create a new HD wallet from mnemonic
    CreateWallet {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Import an existing wallet from mnemonic
    ImportWallet {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Authenticate and load wallet into memory
    UnlockWallet {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Derive addresses for specified blockchains
    GenerateAddresses {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Export wallet metadata without private keys
    ExportWallet {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Change wallet display name
    RenameWallet {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Enumerate all wallets on USB
    ListWallets {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Set blockchain provider configuration
    SetProviderConfig {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Get blockchain provider configuration
    GetProviderConfig {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// List all provider configurations
    ListProviderConfigs {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Delete a provider configuration
    DeleteProviderConfig {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
}

/// WalletQueue serializes all wallet operations through a single-threaded queue.
///
/// Uses ONLY std::sync primitives (no Tokio) to avoid macOS thread restrictions.
#[derive(Clone)]
pub struct WalletQueue {
    sender: mpsc::Sender<WalletCommand>,
    metrics: QueueMetrics,
}

impl WalletQueue {
    /// Create a new wallet queue with the given library.
    ///
    /// Spawns a background worker thread using std::thread.
    /// This is safe to call from any context (no Tokio required).
    pub fn new(library: Arc<WalletLibrary>) -> Self {
        let (sender, receiver) = mpsc::channel::<WalletCommand>();

        let metrics = QueueMetrics::new();
        let metrics_clone = metrics.clone();

        // Spawn worker thread using std::thread (NOT tokio::spawn)
        thread::Builder::new()
            .name("wallet-queue-worker".to_string())
            .spawn(move || {
                Self::worker_task(library, receiver, metrics_clone);
            })
            .expect("Failed to spawn wallet queue worker thread");

        tracing::info!("✓ Wallet queue worker thread started");

        WalletQueue { sender, metrics }
    }

    /// Get queue metrics for monitoring
    pub fn metrics(&self) -> &QueueMetrics {
        &self.metrics
    }

    /// Background worker task that processes wallet commands sequentially.
    ///
    /// This runs in a dedicated std::thread for the lifetime of the application.
    fn worker_task(
        library: Arc<WalletLibrary>,
        receiver: mpsc::Receiver<WalletCommand>,
        metrics: QueueMetrics,
    ) {
        tracing::info!("Wallet queue worker thread running");
        let mut operations_count = 0u64;

        // Block on receiving commands (this is a blocking thread, not async)
        while let Ok(cmd) = receiver.recv() {
            let operation_start = Instant::now();

            match cmd {
                WalletCommand::GetVersion { respond_to } => {
                    let result = library.get_version();
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::CreateWallet { params_json, respond_to } => {
                    let result = library.create_wallet(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::ImportWallet { params_json, respond_to } => {
                    let result = library.import_wallet(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::UnlockWallet { params_json, respond_to } => {
                    let result = library.unlock_wallet(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GenerateAddresses { params_json, respond_to } => {
                    let result = library.generate_addresses(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::ExportWallet { params_json, respond_to } => {
                    let result = library.export_wallet(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::RenameWallet { params_json, respond_to } => {
                    let result = library.rename_wallet(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::ListWallets { params_json, respond_to } => {
                    let result = library.list_wallets(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::SetProviderConfig { params_json, respond_to } => {
                    let result = library.set_provider_config(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GetProviderConfig { params_json, respond_to } => {
                    let result = library.get_provider_config(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::ListProviderConfigs { params_json, respond_to } => {
                    let result = library.list_provider_configs(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::DeleteProviderConfig { params_json, respond_to } => {
                    let result = library.delete_provider_config(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
            }

            operations_count += 1;

            // Log metrics every 100 operations
            if operations_count % 100 == 0 {
                metrics.log_metrics();
            }
        }

        tracing::info!("Wallet queue worker thread exiting");
    }

    /// Get library version (blocking wrapper for async context).
    pub async fn get_version(&self) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetVersion { respond_to: sender })
            .map_err(|_| "Queue channel closed".to_string())?;

        // Use tokio::task::spawn_blocking to await the sync channel
        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Create a new HD wallet from provided mnemonic.
    pub async fn create_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::CreateWallet {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Import an existing wallet from mnemonic.
    pub async fn import_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::ImportWallet {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Authenticate and load wallet into memory.
    pub async fn unlock_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::UnlockWallet {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Derive addresses for specified blockchains.
    pub async fn generate_addresses(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GenerateAddresses {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Export wallet metadata without private keys.
    pub async fn export_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::ExportWallet {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Change wallet display name.
    pub async fn rename_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::RenameWallet {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Enumerate all wallets on USB.
    pub async fn list_wallets(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::ListWallets {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Set blockchain provider configuration.
    pub async fn set_provider_config(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::SetProviderConfig {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Get blockchain provider configuration.
    pub async fn get_provider_config(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetProviderConfig {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// List all provider configurations.
    pub async fn list_provider_configs(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::ListProviderConfigs {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Delete a provider configuration.
    pub async fn delete_provider_config(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::DeleteProviderConfig {
                params_json,
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }
}

/// Lazy-initialized WalletQueue wrapper
/// Initializes the queue on first use
pub struct LazyWalletQueue {
    library: Arc<WalletLibrary>,
    queue: OnceLock<WalletQueue>,
}

impl LazyWalletQueue {
    /// Create a new lazy wallet queue
    pub fn new(library: Arc<WalletLibrary>) -> Self {
        Self {
            library,
            queue: OnceLock::new(),
        }
    }

    /// Get or initialize the queue
    fn get_or_init(&self) -> &WalletQueue {
        self.queue.get_or_init(|| {
            WalletQueue::new(self.library.clone())
        })
    }

    /// Create a new HD wallet from provided mnemonic
    pub async fn create_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().create_wallet(params_json).await
    }

    /// Import an existing wallet from mnemonic
    pub async fn import_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().import_wallet(params_json).await
    }

    /// Authenticate and load wallet into memory
    pub async fn unlock_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().unlock_wallet(params_json).await
    }

    /// Derive addresses for specified blockchains
    pub async fn generate_addresses(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().generate_addresses(params_json).await
    }

    /// Export wallet metadata without private keys
    pub async fn export_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().export_wallet(params_json).await
    }

    /// Change wallet display name
    pub async fn rename_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().rename_wallet(params_json).await
    }

    /// Enumerate all wallets on USB
    pub async fn list_wallets(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().list_wallets(params_json).await
    }

    /// Set blockchain provider configuration
    pub async fn set_provider_config(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().set_provider_config(params_json).await
    }

    /// Get blockchain provider configuration
    pub async fn get_provider_config(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_provider_config(params_json).await
    }

    /// List all provider configurations
    pub async fn list_provider_configs(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().list_provider_configs(params_json).await
    }

    /// Delete a provider configuration
    pub async fn delete_provider_config(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().delete_provider_config(params_json).await
    }

    /// Get library version
    pub async fn get_version(&self) -> Result<serde_json::Value, String> {
        self.get_or_init().get_version().await
    }
}
