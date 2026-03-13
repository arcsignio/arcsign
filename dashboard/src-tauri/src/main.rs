#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

/**
 * Tauri application main entry point
 * Feature: User Dashboard for Wallet Management
 * Task: T022 - Register all Tauri commands
 * Updated: 2025-10-25 - T039-T042: Startup optimization
 * Updated: 2025-10-25 - T068: Add feature flag for FFI toggle
 */

// T068: Feature flag for FFI vs CLI fallback
// Set to false to revert to CLI subprocess behavior
// Go shared library is now built and ready (libarcsign.dylib)
const USE_FFI: bool = true;

// Module declarations
mod commands;
mod error;
mod ffi;  // T017: Add FFI module
mod models;
mod websocket;  // WebSocket server for mint-page integration

use commands::app::{is_first_time_setup, initialize_app, unlock_app};
use commands::membership::{
    check_membership, check_all_memberships, get_membership_tier, can_create_wallet, get_wallet_limit,
    get_device_membership_status, get_device_membership_status_with_token,
    add_device_membership_binding, remove_device_membership_binding,
    sync_membership_binding_with_token, remove_membership_binding_with_token,
};
use commands::security::{
    clear_sensitive_memory, disable_screenshot_protection, enable_screenshot_protection,
};
use commands::transaction::{
    build_transaction, sign_transaction, broadcast_transaction,
    query_transaction_status, estimate_fee, sign_message, sign_typed_data,
    dev_mode_sign,
};
use commands::swap::{
    get_swap_quote, build_swap_transaction, get_swap_approval,
    check_swap_allowance, get_native_token_address, get_swap_tokens,
};
use commands::usb::detect_usb;
use commands::wallet::{create_wallet, import_wallet, list_wallets, load_addresses, rename_wallet, delete_wallet, export_backup, import_backup, export_all_backups, import_all_backups, get_token_balances, get_nfts, get_token_approvals, validate_passphrase, update_websocket_accounts, update_websocket_usb_path, AddressCache};
use commands::provider::{set_provider_config, get_provider_config, list_provider_configs, delete_provider_config, get_asset_transfers};
use commands::websocket_commands::{
    get_pending_transaction, respond_to_transaction, cancel_pending_transaction,
    get_pending_message_sign, respond_to_message_sign, cancel_pending_message_sign,
    PendingTxReceiverState, CurrentPendingTxState,
    PendingMsgReceiverState, CurrentPendingMsgState,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant; // T045: Startup time logging
use ffi::{WalletLibrary, LazyWalletQueue};  // T017: Import FFI types (use LazyWalletQueue)
use tauri::Manager;  // For app.manage() in setup hook

/// Rust-side session token backup. Token is stored here in addition to JS Zustand state
/// so that WebSocket handlers can access it without depending on the frontend.
/// Security: Mutex-protected, cleared on revoke/logout.
pub struct SessionTokenState(pub Mutex<Option<String>>);
use websocket::WebSocketServer;  // WebSocket server for external connections
use tokio::sync::mpsc;

fn main() {
    // T045: Start startup timer
    let startup_start = Instant::now();

    // Initialize tracing for logging
    tracing_subscriber::fmt::init();

    tracing::info!("=== arcSign Dashboard Starting ===");

    // T068: Check feature flag
    if !USE_FFI {
        tracing::warn!("FFI disabled via feature flag - using CLI subprocess fallback");
        tracing::warn!("To enable FFI, set USE_FFI = true in main.rs");
    }

    // T017: Load Go shared library at startup (if FFI enabled)
    // T019: Block app if library load fails (FR-007)
    // T039: Library validation (verify function symbols)
    // T040: Library version check
    // T068: Only load library if USE_FFI is true
    let library_load_start = Instant::now();
    let library: Option<Arc<WalletLibrary>> = if USE_FFI {
        match WalletLibrary::load() {
        Ok(lib) => {
            let library_load_duration = library_load_start.elapsed();
            tracing::info!(
                "Successfully loaded wallet library (took {:?})",
                library_load_duration
            );

            // T040: Verify library version compatibility
            let version_check_start = Instant::now();
            match lib.get_version() {
                Ok(version_data) => {
                    let version = version_data
                        .get("version")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown");

                    tracing::info!(
                        "Wallet library version: {} (verified in {:?})",
                        version,
                        version_check_start.elapsed()
                    );

                    // T040: Check version compatibility (expecting 0.2.0)
                    if version != "0.2.0" {
                        tracing::warn!(
                            "Library version mismatch: expected 0.2.0, got {}",
                            version
                        );
                        eprintln!("========================================");
                        eprintln!("WARNING: Library Version Mismatch");
                        eprintln!("========================================");
                        eprintln!("Expected: 0.2.0");
                        eprintln!("Found: {}", version);
                        eprintln!("The application may not function correctly.");
                        eprintln!("Consider reinstalling the application.");
                        eprintln!("========================================");
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to verify library version: {}", e);
                    eprintln!("========================================");
                    eprintln!("ERROR: Library Version Check Failed");
                    eprintln!("========================================");
                    eprintln!("Could not verify library version: {}", e);
                    eprintln!("The library may be corrupted.");
                    eprintln!("========================================");

                    std::process::exit(1);
                }
            }

            Some(Arc::new(lib))
        }
        Err(e) => {
            tracing::error!("FATAL: Failed to load wallet library: {}", e);

            // T043: Error dialog for library load failure
            eprintln!("========================================");
            eprintln!("FATAL ERROR: Wallet Library Not Found");
            eprintln!("========================================");
            eprintln!("");
            eprintln!("The wallet library could not be loaded:");
            eprintln!("{}", e);
            eprintln!("");
            eprintln!("Possible causes:");
            eprintln!("  - Library file missing from application directory");
            eprintln!("  - Antivirus software blocking the library");
            eprintln!("  - Incorrect file permissions");
            eprintln!("  - Corrupted installation");
            eprintln!("");
            eprintln!("Solutions:");
            eprintln!("  1. Reinstall the application");
            eprintln!("  2. Add exception in antivirus software");
            eprintln!("  3. Check that libarcsign.dll/dylib/so exists");
            eprintln!("  4. Verify file permissions (should be readable/executable)");
            eprintln!("");
            eprintln!("Application will now exit.");
            eprintln!("========================================");

            std::process::exit(1);
        }
        }
    } else {
        // T068: FFI disabled - create dummy/fallback state
        tracing::warn!("Running in CLI subprocess mode (FFI disabled)");
        tracing::warn!("This mode has higher latency (~300ms vs <100ms)");

        // Return None to skip FFI initialization
        // Commands will need to check if queue is available
        None
    };

    // T045: Log library load time
    let library_load_duration = startup_start.elapsed();
    tracing::info!(
        "=== Library loaded (took {:?}) ===",
        library_load_duration
    );

    // Clone library for use in setup closure
    let library_for_setup = library.clone();

    tauri::Builder::default()
        .manage(AddressCache(Mutex::new(HashMap::new())))
        .manage(SessionTokenState(Mutex::new(None)))
        .setup(move |app| {
            // T018: Initialize LazyWalletQueue (defers actual initialization until first use)
            // T042: Symbol caching is already implemented in WalletLibrary::load()
            // T068: Only create queue if library loaded successfully
            let wallet_queue: Option<LazyWalletQueue> = if let Some(lib) = library_for_setup {
                // Create lazy queue - actual WalletQueue will be initialized on first use from async context
                let queue = LazyWalletQueue::new(lib);
                app.manage(queue.clone());
                tracing::info!("✓ Lazy queue registered (will initialize on first use from async context)");
                Some(queue)
            } else {
                tracing::warn!("⚠ FFI queue not available - commands will use CLI fallback");
                None
            };

            // Start WebSocket server for mint-page integration
            let (pending_tx_sender, pending_tx_receiver) = mpsc::unbounded_channel();
            let (pending_msg_sender, pending_msg_receiver) = mpsc::unbounded_channel();

            // Store receiver in app state for UI to receive pending transactions
            let receiver_state: PendingTxReceiverState = Arc::new(Mutex::new(pending_tx_receiver));
            app.manage(receiver_state);

            // Store current pending transaction state (for response channel)
            let current_pending_state: CurrentPendingTxState = Arc::new(Mutex::new(None));
            app.manage(current_pending_state);

            // Store message sign receiver in app state
            let msg_receiver_state: PendingMsgReceiverState = Arc::new(Mutex::new(pending_msg_receiver));
            app.manage(msg_receiver_state);

            // Store current pending message sign state
            let current_msg_state: CurrentPendingMsgState = Arc::new(Mutex::new(None));
            app.manage(current_msg_state);

            // Create and start WebSocket server (with wallet queue for session-based auto-signing)
            let ws_server = Arc::new(tokio::sync::RwLock::new(
                if let Some(queue) = wallet_queue {
                    WebSocketServer::with_wallet_queue(pending_tx_sender, pending_msg_sender, queue)
                } else {
                    WebSocketServer::new(pending_tx_sender, pending_msg_sender)
                }
            ));
            app.manage(ws_server.clone());

            // Start WebSocket server in background
            tauri::async_runtime::spawn(async move {
                let mut server = ws_server.write().await;
                if let Err(e) = server.start().await {
                    tracing::error!("Failed to start WebSocket server: {}", e);
                } else {
                    tracing::info!("✓ WebSocket server successfully started on ws://127.0.0.1:9527");
                }
            });

            // T045: Log total startup time
            let startup_duration = startup_start.elapsed();
            tracing::info!(
                "=== arcSign Dashboard Ready (total startup: {:?}) ===",
                startup_duration
            );

            // T045: Warn if startup took longer than 3 seconds (FR requirement)
            if startup_duration.as_secs() >= 3 {
                tracing::warn!(
                    "Startup took longer than 3 seconds: {:?}",
                    startup_duration
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // USB commands
            detect_usb,
            // App-level authentication commands
            is_first_time_setup,
            initialize_app,
            unlock_app,
            // Session management commands
            commands::auth::create_session,
            commands::auth::validate_session,
            commands::auth::revoke_session,
            // Wallet session management commands
            commands::auth::create_wallet_session,
            commands::auth::validate_wallet_session,
            commands::auth::revoke_wallet_session,
            // Wallet commands
            create_wallet,
            import_wallet,
            list_wallets,
            load_addresses,
            rename_wallet,
            delete_wallet,
            export_backup,
            import_backup,
            export_all_backups,
            import_all_backups,
            get_token_balances,
            get_nfts,
            get_token_approvals,
            validate_passphrase,
            update_websocket_accounts,
            update_websocket_usb_path,
            // Security commands
            enable_screenshot_protection,
            disable_screenshot_protection,
            clear_sensitive_memory,
            // Provider configuration commands
            set_provider_config,
            get_provider_config,
            list_provider_configs,
            delete_provider_config,
            // Asset transfers (transaction history)
            get_asset_transfers,
            // Transaction commands (ChainAdapter)
            build_transaction,
            sign_transaction,
            broadcast_transaction,
            query_transaction_status,
            estimate_fee,
            // Developer mode signing (bypasses buildTransaction, uses Hardhat params directly)
            dev_mode_sign,
            // WalletConnect signing commands
            sign_message,
            sign_typed_data,
            // Swap commands (DEX Aggregator)
            get_swap_quote,
            build_swap_transaction,
            get_swap_approval,
            check_swap_allowance,
            get_native_token_address,
            get_swap_tokens,
            // Membership commands (NFT verification)
            check_membership,
            check_all_memberships,
            get_membership_tier,
            can_create_wallet,
            get_wallet_limit,
            // Device membership commands (USB identity binding)
            get_device_membership_status,
            get_device_membership_status_with_token,
            add_device_membership_binding,
            remove_device_membership_binding,
            sync_membership_binding_with_token,
            remove_membership_binding_with_token,
            // WebSocket commands (pending transactions from mint-page)
            get_pending_transaction,
            respond_to_transaction,
            cancel_pending_transaction,
            // WebSocket commands (pending message sign requests)
            get_pending_message_sign,
            respond_to_message_sign,
            cancel_pending_message_sign,
            // WalletConnect commands (session persistence)
            commands::walletconnect::save_wc_sessions,
            commands::walletconnect::load_wc_sessions,
            commands::walletconnect::delete_wc_session,
            commands::walletconnect::delete_all_wc_sessions,
            // Developer mode signing history commands
            commands::dev_history::load_dev_signing_history,
            commands::dev_history::append_dev_signing_history,
            commands::dev_history::clear_dev_signing_history,
            // Developer mode settings commands
            commands::dev_settings::load_dev_settings,
            commands::dev_settings::save_dev_settings,
            // Developer mode session commands
            // Guarded by dev-mode feature flag in Go library build tags.
            // Rust side always registers them but Go FFI functions only exist
            // when library is built with -tags dev.
            commands::dev_session::create_dev_session,
            commands::dev_session::get_dev_session,
            commands::dev_session::dev_session_sign,
            commands::dev_session::end_dev_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
