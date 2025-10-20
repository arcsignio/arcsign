/**
 * Tauri application main entry point
 * Feature: User Dashboard for Wallet Management
 * Task: T022 - Register all Tauri commands
 * Generated: 2025-10-17
 */

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

// Module declarations
mod cli;
mod commands;
mod error;
mod models;

use commands::security::{
    clear_sensitive_memory, disable_screenshot_protection, enable_screenshot_protection,
};
use commands::usb::detect_usb;
use commands::wallet::{create_wallet, import_wallet, list_wallets, load_addresses, rename_wallet, AddressCache};
use std::collections::HashMap;
use std::sync::Mutex;

fn main() {
    // Initialize tracing for logging
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        .manage(AddressCache(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            // USB commands
            detect_usb,
            // Wallet commands
            create_wallet,
            import_wallet,
            list_wallets,
            load_addresses,
            rename_wallet,
            // Export commands
            // TODO: Uncomment when export commands are implemented (Phase 7)
            // commands::export::export_addresses,
            // Security commands
            enable_screenshot_protection,
            disable_screenshot_protection,
            clear_sensitive_memory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
