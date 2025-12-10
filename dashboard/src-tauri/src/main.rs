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

use commands::security::{
    clear_sensitive_memory, disable_screenshot_protection, enable_screenshot_protection,
};
use commands::usb::detect_usb;
use commands::wallet::{create_wallet, import_wallet, list_wallets, load_addresses, rename_wallet, AddressCache};
use commands::provider::{set_provider_config, get_provider_config, list_provider_configs, delete_provider_config};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant; // T045: Startup time logging
use ffi::{WalletLibrary, LazyWalletQueue};  // T017: Import FFI types (use LazyWalletQueue)
use tauri::Manager;  // For app.manage() in setup hook

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
        .setup(move |app| {
            // T018: Initialize LazyWalletQueue (defers actual initialization until first use)
            // T042: Symbol caching is already implemented in WalletLibrary::load()
            // T068: Only create queue if library loaded successfully
            if let Some(lib) = library_for_setup {
                // Create lazy queue - actual WalletQueue will be initialized on first use from async context
                let queue = LazyWalletQueue::new(lib);
                app.manage(queue);
                tracing::info!("✓ Lazy queue registered (will initialize on first use from async context)");
            } else {
                tracing::warn!("⚠ FFI queue not available - commands will use CLI fallback");
            }

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
            // Wallet commands
            create_wallet,
            import_wallet,
            list_wallets,
            load_addresses,
            rename_wallet,
            // Security commands
            enable_screenshot_protection,
            disable_screenshot_protection,
            clear_sensitive_memory,
            // Provider configuration commands
            set_provider_config,
            get_provider_config,
            list_provider_configs,
            delete_provider_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
