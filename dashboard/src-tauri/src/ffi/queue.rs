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
    /// Delete a wallet from storage
    DeleteWallet {
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
    /// Check if this is first-time setup
    IsFirstTimeSetup {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Initialize app configuration
    InitializeApp {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Unlock app and load configuration
    UnlockApp {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Get token balances across multiple chains
    GetTokenBalances {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Get asset transfers (transaction history) for an address
    GetAssetTransfers {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    // ========================================================================
    // ChainAdapter Transaction Operations
    // ========================================================================
    /// Build an unsigned transaction for the specified chain
    BuildTransaction {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Sign an unsigned transaction with wallet password
    SignTransaction {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Broadcast a signed transaction to the blockchain network
    BroadcastTransaction {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Query the status of a transaction by hash
    QueryTransactionStatus {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Estimate transaction fees for the specified chain
    EstimateFee {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Validate a BIP39 passphrase by comparing derived address
    ValidatePassphrase {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    // ========================================================================
    // Swap/DEX Aggregator Operations
    // ========================================================================
    /// Get a swap quote from 1inch
    GetSwapQuote {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Build a swap transaction
    BuildSwapTransaction {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Get approval transaction for ERC-20
    GetSwapApproval {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Check token allowance
    CheckSwapAllowance {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Get native token address
    GetNativeTokenAddress {
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Get available swap tokens for a chain
    GetSwapTokens {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    // ========================================================================
    // Membership Management Operations
    // ========================================================================
    /// Get membership status (device ID, wallet limits, NFT bindings)
    GetMembershipStatus {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Add NFT membership binding
    AddMembershipBinding {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Remove NFT membership binding
    RemoveMembershipBinding {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Get device membership status using session token (no password required)
    GetDeviceMembershipStatusWithToken {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    // ========================================================================
    // Session Management Operations
    // ========================================================================
    /// Create a session token after validating credentials
    CreateSessionToken {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Validate a session token and get session info
    ValidateSessionToken {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Revoke (invalidate) a session token
    RevokeSessionToken {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Create a wallet session token after validating wallet password
    CreateWalletSessionToken {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Validate a wallet session token and get session info
    ValidateWalletSessionToken {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Revoke (invalidate) a wallet session token
    RevokeWalletSessionToken {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    // ========================================================================
    // WalletConnect Signing Operations
    // ========================================================================
    /// Sign a message using EIP-191 (personal_sign)
    SignMessage {
        params_json: String,
        respond_to: OneshotSender<Result<serde_json::Value, String>>,
    },
    /// Sign EIP-712 typed data (eth_signTypedData_v4)
    SignTypedData {
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
                WalletCommand::DeleteWallet { params_json, respond_to } => {
                    let result = library.delete_wallet(&params_json);
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
                WalletCommand::IsFirstTimeSetup { params_json, respond_to } => {
                    let result = library.is_first_time_setup(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::InitializeApp { params_json, respond_to } => {
                    let result = library.initialize_app(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::UnlockApp { params_json, respond_to } => {
                    let result = library.unlock_app(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GetTokenBalances { params_json, respond_to } => {
                    let result = library.get_token_balances(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GetAssetTransfers { params_json, respond_to } => {
                    let result = library.get_asset_transfers(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // ChainAdapter Transaction Operations
                WalletCommand::BuildTransaction { params_json, respond_to } => {
                    let result = library.build_transaction(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::SignTransaction { params_json, respond_to } => {
                    let result = library.sign_transaction(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::BroadcastTransaction { params_json, respond_to } => {
                    let result = library.broadcast_transaction(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::QueryTransactionStatus { params_json, respond_to } => {
                    let result = library.query_transaction_status(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::EstimateFee { params_json, respond_to } => {
                    let result = library.estimate_fee(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::ValidatePassphrase { params_json, respond_to } => {
                    let result = library.validate_passphrase(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // Swap/DEX Aggregator Operations
                WalletCommand::GetSwapQuote { params_json, respond_to } => {
                    let result = library.get_swap_quote(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::BuildSwapTransaction { params_json, respond_to } => {
                    let result = library.build_swap_transaction(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GetSwapApproval { params_json, respond_to } => {
                    let result = library.get_swap_approval(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::CheckSwapAllowance { params_json, respond_to } => {
                    let result = library.check_swap_allowance(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GetNativeTokenAddress { respond_to } => {
                    let result = library.get_native_token_address();
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GetSwapTokens { params_json, respond_to } => {
                    let result = library.get_swap_tokens(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // Membership Management Operations
                WalletCommand::GetMembershipStatus { params_json, respond_to } => {
                    let result = library.get_membership_status(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::AddMembershipBinding { params_json, respond_to } => {
                    let result = library.add_membership_binding(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::RemoveMembershipBinding { params_json, respond_to } => {
                    let result = library.remove_membership_binding(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::GetDeviceMembershipStatusWithToken { params_json, respond_to } => {
                    let result = library.get_device_membership_status_with_token(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // Session Management Operations
                WalletCommand::CreateSessionToken { params_json, respond_to } => {
                    let result = library.create_session_token(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::ValidateSessionToken { params_json, respond_to } => {
                    let result = library.validate_session_token(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::RevokeSessionToken { params_json, respond_to } => {
                    let result = library.revoke_session_token(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::CreateWalletSessionToken { params_json, respond_to } => {
                    let result = library.create_wallet_session_token(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::ValidateWalletSessionToken { params_json, respond_to } => {
                    let result = library.validate_wallet_session_token(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::RevokeWalletSessionToken { params_json, respond_to } => {
                    let result = library.revoke_wallet_session_token(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                // WalletConnect Signing Operations
                WalletCommand::SignMessage { params_json, respond_to } => {
                    let result = library.sign_message(&params_json);
                    let _ = respond_to.send(result);
                    metrics.record_dequeue(operation_start.elapsed());
                }
                WalletCommand::SignTypedData { params_json, respond_to } => {
                    let result = library.sign_typed_data(&params_json);
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

    /// Delete a wallet from storage.
    pub async fn delete_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::DeleteWallet {
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

    /// Check if this is first-time setup.
    pub async fn is_first_time_setup(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::IsFirstTimeSetup {
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

    /// Initialize app configuration.
    pub async fn initialize_app(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::InitializeApp {
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

    /// Unlock app and load configuration.
    pub async fn unlock_app(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::UnlockApp {
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

    /// Get token balances across multiple chains using Alchemy API.
    pub async fn get_token_balances(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetTokenBalances {
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

    /// Get asset transfers (transaction history) for an address using Alchemy API.
    pub async fn get_asset_transfers(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetAssetTransfers {
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

    // ========================================================================
    // ChainAdapter Transaction Operations
    // ========================================================================

    /// Build an unsigned transaction for the specified chain.
    pub async fn build_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::BuildTransaction {
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

    /// Sign an unsigned transaction with wallet password.
    pub async fn sign_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::SignTransaction {
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

    /// Broadcast a signed transaction to the blockchain network.
    pub async fn broadcast_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::BroadcastTransaction {
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

    /// Query the status of a transaction by hash.
    pub async fn query_transaction_status(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::QueryTransactionStatus {
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

    /// Estimate transaction fees for the specified chain.
    pub async fn estimate_fee(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::EstimateFee {
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

    /// Validate a BIP39 passphrase by comparing derived address with stored address.
    pub async fn validate_passphrase(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::ValidatePassphrase {
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

    // ========================================================================
    // Swap/DEX Aggregator Operations
    // ========================================================================

    /// Get a swap quote from 1inch DEX aggregator.
    pub async fn get_swap_quote(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetSwapQuote {
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

    /// Build a complete swap transaction.
    pub async fn build_swap_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::BuildSwapTransaction {
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

    /// Get approval transaction for ERC-20 token.
    pub async fn get_swap_approval(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetSwapApproval {
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

    /// Check token allowance for 1inch router.
    pub async fn check_swap_allowance(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::CheckSwapAllowance {
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

    /// Get native token address for 1inch API.
    pub async fn get_native_token_address(&self) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetNativeTokenAddress {
                respond_to: sender,
            })
            .map_err(|_| "Queue channel closed".to_string())?;

        tokio::task::spawn_blocking(move || {
            receiver.recv().map_err(|_| "Response channel closed".to_string())?
        })
        .await
        .map_err(|e| format!("Task join error: {}", e))?
    }

    /// Get all available swap tokens for a chain from 1inch API.
    pub async fn get_swap_tokens(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetSwapTokens {
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

    // ========================================================================
    // Membership Management Operations
    // ========================================================================

    /// Get membership status (device ID, wallet limits, NFT bindings).
    pub async fn get_membership_status(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetMembershipStatus {
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

    /// Add NFT membership binding.
    pub async fn add_membership_binding(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::AddMembershipBinding {
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

    /// Remove NFT membership binding.
    pub async fn remove_membership_binding(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::RemoveMembershipBinding {
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

    /// Get device membership status using session token (no password required).
    pub async fn get_device_membership_status_with_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::GetDeviceMembershipStatusWithToken {
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

    // ========================================================================
    // Session Management Operations
    // ========================================================================

    /// Create a session token after validating credentials.
    pub async fn create_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::CreateSessionToken {
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

    /// Validate a session token and get session info.
    pub async fn validate_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::ValidateSessionToken {
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

    /// Revoke (invalidate) a session token.
    pub async fn revoke_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::RevokeSessionToken {
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

    /// Create a wallet session token by validating wallet password.
    pub async fn create_wallet_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::CreateWalletSessionToken {
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

    /// Validate a wallet session token and get session info.
    pub async fn validate_wallet_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::ValidateWalletSessionToken {
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

    /// Revoke (invalidate) a wallet session token.
    pub async fn revoke_wallet_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::RevokeWalletSessionToken {
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

    // ========================================================================
    // WalletConnect Signing Operations
    // ========================================================================

    /// Sign a message using EIP-191 (personal_sign).
    pub async fn sign_message(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::SignMessage {
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

    /// Sign EIP-712 typed data (eth_signTypedData_v4).
    pub async fn sign_typed_data(&self, params_json: String) -> Result<serde_json::Value, String> {
        let (sender, receiver) = oneshot();

        self.metrics.record_enqueue();
        self.sender
            .send(WalletCommand::SignTypedData {
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

    /// Delete a wallet from storage
    pub async fn delete_wallet(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().delete_wallet(params_json).await
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

    /// Check if this is first-time setup
    pub async fn is_first_time_setup(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().is_first_time_setup(params_json).await
    }

    /// Initialize app configuration
    pub async fn initialize_app(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().initialize_app(params_json).await
    }

    /// Unlock app and load configuration
    pub async fn unlock_app(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().unlock_app(params_json).await
    }

    /// Get token balances across multiple chains
    pub async fn get_token_balances(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_token_balances(params_json).await
    }

    /// Get asset transfers (transaction history) for an address
    pub async fn get_asset_transfers(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_asset_transfers(params_json).await
    }

    /// Get library version
    pub async fn get_version(&self) -> Result<serde_json::Value, String> {
        self.get_or_init().get_version().await
    }

    // ========================================================================
    // ChainAdapter Transaction Operations
    // ========================================================================

    /// Build an unsigned transaction for the specified chain
    pub async fn build_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().build_transaction(params_json).await
    }

    /// Sign an unsigned transaction with wallet password
    pub async fn sign_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().sign_transaction(params_json).await
    }

    /// Broadcast a signed transaction to the blockchain network
    pub async fn broadcast_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().broadcast_transaction(params_json).await
    }

    /// Query the status of a transaction by hash
    pub async fn query_transaction_status(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().query_transaction_status(params_json).await
    }

    /// Estimate transaction fees for the specified chain
    pub async fn estimate_fee(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().estimate_fee(params_json).await
    }

    /// Validate a BIP39 passphrase by comparing derived address with stored address
    pub async fn validate_passphrase(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().validate_passphrase(params_json).await
    }

    // ========================================================================
    // Swap/DEX Aggregator Operations
    // ========================================================================

    /// Get a swap quote from 1inch DEX aggregator
    pub async fn get_swap_quote(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_swap_quote(params_json).await
    }

    /// Build a complete swap transaction
    pub async fn build_swap_transaction(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().build_swap_transaction(params_json).await
    }

    /// Get approval transaction for ERC-20 token
    pub async fn get_swap_approval(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_swap_approval(params_json).await
    }

    /// Check token allowance for 1inch router
    pub async fn check_swap_allowance(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().check_swap_allowance(params_json).await
    }

    /// Get native token address for 1inch API
    pub async fn get_native_token_address(&self) -> Result<serde_json::Value, String> {
        self.get_or_init().get_native_token_address().await
    }

    /// Get all available swap tokens for a chain from 1inch API
    pub async fn get_swap_tokens(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_swap_tokens(params_json).await
    }

    // ========================================================================
    // Membership Management Operations
    // ========================================================================

    /// Get membership status (device ID, wallet limits, NFT bindings)
    pub async fn get_membership_status(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_membership_status(params_json).await
    }

    /// Add NFT membership binding
    pub async fn add_membership_binding(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().add_membership_binding(params_json).await
    }

    /// Remove NFT membership binding
    pub async fn remove_membership_binding(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().remove_membership_binding(params_json).await
    }

    /// Get device membership status using session token (no password required)
    pub async fn get_device_membership_status_with_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().get_device_membership_status_with_token(params_json).await
    }

    // ========================================================================
    // Session Management Operations
    // ========================================================================

    /// Create a session token after validating credentials
    pub async fn create_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().create_session_token(params_json).await
    }

    /// Validate a session token and get session info
    pub async fn validate_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().validate_session_token(params_json).await
    }

    /// Revoke (invalidate) a session token
    pub async fn revoke_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().revoke_session_token(params_json).await
    }

    /// Create a wallet session token by validating wallet password
    pub async fn create_wallet_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().create_wallet_session_token(params_json).await
    }

    /// Validate a wallet session token and get session info
    pub async fn validate_wallet_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().validate_wallet_session_token(params_json).await
    }

    /// Revoke (invalidate) a wallet session token
    pub async fn revoke_wallet_session_token(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().revoke_wallet_session_token(params_json).await
    }

    // ========================================================================
    // WalletConnect Signing Operations
    // ========================================================================

    /// Sign a message using EIP-191 (personal_sign)
    pub async fn sign_message(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().sign_message(params_json).await
    }

    /// Sign EIP-712 typed data (eth_signTypedData_v4)
    pub async fn sign_typed_data(&self, params_json: String) -> Result<serde_json::Value, String> {
        self.get_or_init().sign_typed_data(params_json).await
    }
}
