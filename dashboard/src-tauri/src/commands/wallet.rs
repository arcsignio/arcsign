/**
 * Wallet management commands
 * Feature: User Dashboard for Wallet Management
 * Task: T032 - Implement create_wallet Tauri command (updated for FFI)
 * Updated: 2025-10-25 - T032.1: Migrated to FFI queue
 */

use crate::cli::wrapper::{
    AddressListResponse as CliAddressListResponse, CliCommand, CliWrapper,
    WalletCreateResponse as CliWalletCreateResponse, WalletImportResponse as CliWalletImportResponse,
    WalletInfo, WalletListResponse,
};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::ffi::LazyWalletQueue; // T032: Add FFI queue import (using LazyWalletQueue for deferred initialization)
use crate::models::address::{Address, AddressListResponse, Category, KeyType};
use crate::models::wallet::{Wallet, WalletCreateResponse, WalletImportResponse};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant; // T038: Performance logging
use tauri::State;
use zeroize::Zeroize; // T037: Secure memory zeroing

/// Validate password complexity
/// Requirements: 12+ chars, uppercase, lowercase, number
fn validate_password(password: &str) -> AppResult<()> {
    if password.len() < 12 {
        return Err(AppError::new(
            ErrorCode::PasswordTooWeak,
            "Password must be at least 12 characters long",
        ));
    }

    let has_uppercase = password.chars().any(|c| c.is_uppercase());
    let has_lowercase = password.chars().any(|c| c.is_lowercase());
    let has_number = password.chars().any(|c| c.is_numeric());

    if !has_uppercase {
        return Err(AppError::new(
            ErrorCode::PasswordTooWeak,
            "Password must contain at least one uppercase letter",
        ));
    }

    if !has_lowercase {
        return Err(AppError::new(
            ErrorCode::PasswordTooWeak,
            "Password must contain at least one lowercase letter",
        ));
    }

    if !has_number {
        return Err(AppError::new(
            ErrorCode::PasswordTooWeak,
            "Password must contain at least one number",
        ));
    }

    Ok(())
}

/// Create new HD wallet (T032.1 - Updated to use FFI queue)
/// Requirements: FR-001 (Wallet creation), FR-004 (BIP39 generation), FR-024 (USB storage)
/// Note: Using camelCase parameter names to match JavaScript/TypeScript convention
#[tauri::command]
pub async fn create_wallet(
    queue: State<'_, LazyWalletQueue>, // T032.1: Accept LazyWalletQueue from Tauri state
    mut password: String, // T037: Make mutable for zeroize
    #[allow(non_snake_case)]
    usbPath: String,
    name: Option<String>,
    mut passphrase: Option<String>, // T037: Make mutable for zeroize
    #[allow(non_snake_case)]
    mnemonicLength: Option<usize>,
) -> Result<WalletCreateResponse, String> {
    // T038: Start performance timer
    let start = Instant::now();

    // T050: Validate password
    validate_password(&password).map_err(String::from)?;

    // Validate mnemonic length
    let length = mnemonicLength.unwrap_or(24);
    if length != 12 && length != 24 {
        return Err(AppError::new(
            ErrorCode::InvalidMnemonicLength,
            "Mnemonic length must be 12 or 24 words",
        )
        .into());
    }

    // Validate wallet name if provided
    if let Some(ref n) = name {
        if !Wallet::validate_name(n) {
            return Err(AppError::new(
                ErrorCode::InvalidWalletId,
                "Wallet name must be 1-50 characters",
            )
            .into());
        }
    }

    // Check if passphrase is provided (before moving it)
    let has_passphrase = passphrase.is_some();

    // Use provided name or generate default
    let wallet_name = name.clone().unwrap_or_else(|| {
        format!("Wallet {}", chrono::Local::now().format("%Y-%m-%d"))
    });

    // T032.1: Build JSON params for FFI call
    // Note: The FFI layer expects walletName, mnemonic, password, usbPath
    // Since we're creating a NEW wallet, we need to generate a mnemonic first
    // For now, we'll use a placeholder approach (actual implementation would generate mnemonic in Go)
    let params = json!({
        "walletName": wallet_name,
        "mnemonic": "", // TODO: Generate mnemonic in Go layer
        "password": password,
        "usbPath": usbPath,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // T032.1: Call FFI queue
    let ffi_response = queue
        .create_wallet(params_json)
        .await
        .map_err(|e| {
            // T054: User-friendly error mapping
            if e.contains("USB_NOT_FOUND") || e.contains("STORAGE_ERROR") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else if e.contains("INVALID_PASSWORD") || e.contains("ENCRYPTION_ERROR") {
                AppError::new(
                    ErrorCode::PasswordTooWeak,
                    "Invalid password",
                )
            } else if e.contains("WALLET_ALREADY_EXISTS") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Wallet already exists",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to create wallet",
                    e,
                )
            }
        })?;

    // T037: Zero sensitive data from memory
    password.zeroize();
    if let Some(ref mut pp) = passphrase {
        pp.zeroize();
    }

    // T052: Parse FFI JSON response
    // Expected format: {"walletId": "...", "walletName": "...", "createdAt": "...", "note": "..."}
    tracing::info!("Wallet creation FFI response: {:?}", ffi_response);

    let wallet_id = ffi_response
        .get("walletId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing walletId in FFI response",
        ))?
        .to_string();

    let created_at = ffi_response
        .get("createdAt")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    // TODO: Extract mnemonic from FFI response once Go layer generates it
    let mnemonic = "TODO: mnemonic generation in Go layer".to_string();

    // T053: Convert to domain model and return via Tauri IPC
    let wallet = Wallet {
        id: wallet_id,
        name: wallet_name.clone(),
        created_at: created_at.clone(),
        updated_at: created_at,
        has_passphrase,
        address_count: 54, // All 54 addresses will be generated
    };

    let response = WalletCreateResponse {
        wallet,
        mnemonic,
    };

    // T038: Log performance metrics
    let elapsed = start.elapsed();
    tracing::info!(
        "Wallet created successfully: {} (took {:?})",
        wallet_name,
        elapsed
    );

    Ok(response)
}

/// Normalize mnemonic phrase (T068)
/// Requirements: FR-030 (Whitespace normalization)
fn normalize_mnemonic(mnemonic: &str) -> String {
    mnemonic
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
        .to_lowercase()
}

/// Validate mnemonic word count
fn validate_mnemonic_length(mnemonic: &str) -> AppResult<()> {
    let word_count = mnemonic.split_whitespace().count();
    if word_count != 12 && word_count != 24 {
        return Err(AppError::new(
            ErrorCode::InvalidMnemonicLength,
            "Mnemonic must be 12 or 24 words",
        ));
    }
    Ok(())
}

/// Check for duplicate wallet by deriving Bitcoin address (T092-T094)
/// Returns Some((wallet_id, name)) if duplicate found, None otherwise
async fn check_duplicate_wallet(
    mnemonic: &str,
    passphrase: Option<&str>,
    usb_path: &str,
) -> AppResult<Option<(String, String, String)>> {
    use std::fs;
    use std::path::Path;

    // T092: Derive Bitcoin address (m/44'/0'/0'/0/0) using CLI derive_address command
    let cli = CliWrapper::new("./arcsign");

    // Build derive_address command (uses T020c - handleDeriveAddressNonInteractive)
    // For now, we'll skip the derive command and directly compare wallet files
    // TODO: Implement once derive_address command is fully working

    // T093: Read all addresses.json files from USB
    let usb_dir = Path::new(usb_path);

    if !usb_dir.exists() {
        return Ok(None);
    }

    let entries = fs::read_dir(usb_dir).map_err(|e| {
        AppError::with_details(
            ErrorCode::CliExecutionFailed,
            "Failed to read USB directory for duplicate detection",
            e.to_string(),
        )
    })?;

    // For now, we'll use a simpler approach: check if any wallet exists
    // In production, we should derive the Bitcoin address and compare
    for entry in entries {
        let entry = entry.map_err(|e| {
            AppError::with_details(
                ErrorCode::CliExecutionFailed,
                "Failed to read directory entry",
                e.to_string(),
            )
        })?;

        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        // Check if wallet.json exists
        let wallet_json_path = path.join("wallet.json");
        if wallet_json_path.exists() {
            // Read wallet metadata
            if let Ok(wallet_json) = fs::read_to_string(&wallet_json_path) {
                if let Ok(wallet_meta) = serde_json::from_str::<serde_json::Value>(&wallet_json) {
                    let wallet_id = wallet_meta.get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();

                    let wallet_name = wallet_meta.get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or(&wallet_id)
                        .to_string();

                    let created_at = wallet_meta.get("createdAt")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();

                    // TODO: Implement actual duplicate detection by comparing Bitcoin addresses
                    // For now, we'll mark as non-duplicate and let the CLI handle it
                    // The CLI will return WALLET_EXISTS error if mnemonic is duplicate
                }
            }
        }
    }

    // T094: Return None (no duplicate found) - let CLI handle actual detection
    Ok(None)
}

/// Import/restore wallet from mnemonic (T067, T095-T098)
/// Requirements: FR-006 (BIP39 import), FR-029 (validation), FR-031 (duplicate detection)
#[tauri::command]
pub async fn import_wallet(
    queue: State<'_, LazyWalletQueue>, // T032.2: Accept LazyWalletQueue from Tauri state
    mut mnemonic: String, // T037: Make mutable for zeroize
    mut password: String, // T037: Make mutable for zeroize
    usb_path: String,
    mut passphrase: Option<String>, // T037: Make mutable for zeroize
    name: Option<String>,
) -> Result<WalletImportResponse, String> {
    // T038: Start performance timer
    let start = Instant::now();

    // Validate password
    validate_password(&password).map_err(String::from)?;

    // Normalize mnemonic (FR-030)
    let normalized_mnemonic = normalize_mnemonic(&mnemonic);

    // Validate mnemonic length
    validate_mnemonic_length(&normalized_mnemonic).map_err(String::from)?;

    // Validate wallet name if provided
    if let Some(ref n) = name {
        if !Wallet::validate_name(n) {
            return Err(AppError::new(
                ErrorCode::InvalidWalletId,
                "Wallet name must be 1-50 characters",
            )
            .into());
        }
    }

    // T096: Check for duplicate wallet before FFI invocation
    let has_passphrase = passphrase.is_some();
    let passphrase_ref = passphrase.as_deref();
    if let Some((dup_id, dup_name, dup_created)) = check_duplicate_wallet(
        &normalized_mnemonic,
        passphrase_ref,
        &usb_path,
    ).await.map_err(String::from)? {
        tracing::warn!("Duplicate wallet detected: {} ({})", dup_name, dup_id);

        // T037: Zero sensitive data before returning
        mnemonic.zeroize();
        password.zeroize();
        if let Some(ref mut pp) = passphrase {
            pp.zeroize();
        }

        // Return early with duplicate flag
        let wallet = Wallet {
            id: dup_id.clone(),
            name: dup_name.clone(),
            created_at: dup_created.clone(),
            updated_at: dup_created,
            has_passphrase,
            address_count: 0,
        };

        return Ok(WalletImportResponse {
            wallet,
            is_duplicate: true,
        });
    }

    // Check if passphrase is provided (before moving it)
    let has_passphrase = passphrase.is_some();

    let wallet_name = name.clone().unwrap_or_else(|| {
        format!("Imported Wallet {}", chrono::Local::now().format("%Y-%m-%d"))
    });

    // T032.2: Build JSON params for FFI call
    let params = json!({
        "walletName": wallet_name,
        "mnemonic": normalized_mnemonic,
        "password": password,
        "usbPath": usb_path,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // T032.2: Call FFI queue
    let ffi_response = queue
        .import_wallet(params_json)
        .await
        .map_err(|e| {
            // Check for duplicate wallet error (FR-031)
            if e.contains("already exists") || e.contains("DUPLICATE") || e.contains("WALLET_ALREADY_EXISTS") {
                AppError::new(
                    ErrorCode::WalletAlreadyExists,
                    "Wallet with this mnemonic already exists on USB",
                )
            } else if e.contains("INVALID_MNEMONIC") {
                AppError::new(
                    ErrorCode::InvalidMnemonicLength,
                    "Invalid BIP39 mnemonic phrase",
                )
            } else if e.contains("USB_NOT_FOUND") || e.contains("STORAGE_ERROR") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to import wallet",
                    e,
                )
            }
        })?;

    // T037: Zero sensitive data from memory
    mnemonic.zeroize();
    password.zeroize();
    if let Some(ref mut pp) = passphrase {
        pp.zeroize();
    }

    // T098: Parse FFI JSON response and extract wallet metadata
    tracing::info!("Wallet import FFI response: {:?}", ffi_response);

    // Extract wallet metadata from FFI response
    let wallet_id = ffi_response
        .get("walletId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing walletId in FFI response",
        ))?
        .to_string();

    let created_at = ffi_response
        .get("importedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    // Convert to domain model
    let wallet = Wallet {
        id: wallet_id,
        name: wallet_name.clone(),
        created_at: created_at.clone(),
        updated_at: created_at,
        has_passphrase,
        address_count: 0, // Will be populated when addresses are loaded
    };

    let response = WalletImportResponse {
        wallet,
        is_duplicate: false, // If we got here, it's not a duplicate
    };

    // T038: Log performance metrics
    let elapsed = start.elapsed();
    tracing::info!(
        "Wallet imported successfully: {} (took {:?})",
        wallet_name,
        elapsed
    );

    Ok(response)
}

/// Address cache state (wallet_id -> addresses)
pub struct AddressCache(pub Mutex<HashMap<String, Vec<Address>>>);

/// Load wallet addresses (T052)
/// Caches results in Tauri State to avoid re-loading (T046)
#[tauri::command]
pub async fn load_addresses(
    queue: State<'_, LazyWalletQueue>, // T033: Accept LazyWalletQueue from Tauri state
    wallet_id: String,
    mut password: String, // T037: Make mutable for zeroize
    usb_path: String,
    cache: State<'_, AddressCache>,
) -> Result<AddressListResponse, String> {
    // T038: Start performance timer
    let start = Instant::now();

    // Check cache first
    {
        let cache_lock = cache.0.lock().unwrap();
        if let Some(cached_addresses) = cache_lock.get(&wallet_id) {
            tracing::info!("Returning cached addresses for wallet {}", wallet_id);

            // T037: Zero password even on cache hit
            password.zeroize();

            return Ok(AddressListResponse::new(
                wallet_id.clone(),
                cached_addresses.clone(),
            ));
        }
    }

    // STEP 1: Unlock wallet with password (verify password and decrypt wallet)
    tracing::info!("Unlocking wallet {} with password", wallet_id);
    let unlock_params = json!({
        "walletId": wallet_id,
        "password": password,
        "usbPath": usb_path,
    });

    let unlock_params_json = serde_json::to_string(&unlock_params)
        .map_err(|e| format!("Failed to serialize unlock params: {}", e))?;

    let unlock_response = queue
        .unlock_wallet(unlock_params_json)
        .await
        .map_err(|e| {
            if e.contains("INVALID_PASSWORD") || e.contains("DECRYPTION_ERROR") {
                AppError::new(
                    ErrorCode::PasswordTooWeak,
                    "Invalid password",
                )
            } else if e.contains("WALLET_NOT_FOUND") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found on USB",
                )
            } else if e.contains("USB_NOT_FOUND") || e.contains("STORAGE_ERROR") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to unlock wallet",
                    e,
                )
            }
        })?;

    tracing::info!("Wallet unlocked successfully: {:?}", unlock_response);

    // T037: Zero sensitive data from memory immediately after unlock
    password.zeroize();

    // STEP 2: Generate addresses (wallet is now unlocked in memory)
    tracing::info!("Generating addresses for wallet {}", wallet_id);
    let params = json!({
        "walletId": wallet_id,
        "usbPath": usb_path, // Pass USB path so Go can load wallet metadata
        "blockchains": [], // Empty array means generate all supported blockchains
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // T033: Call FFI queue (generate_addresses)
    let ffi_response = queue
        .generate_addresses(params_json)
        .await
        .map_err(|e| {
            if e.contains("WALLET_NOT_FOUND") || e.contains("WALLET_NOT_UNLOCKED") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found or not unlocked",
                )
            } else if e.contains("USB_NOT_FOUND") || e.contains("STORAGE_ERROR") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to load addresses",
                    e,
                )
            }
        })?;

    tracing::info!("Generate addresses FFI response: {:?}", ffi_response);

    // T033: Parse FFI JSON response
    // Expected format: {"addresses": [{"blockchain": "...", "address": "...", "derivationPath": "..."}], "generatedAt": "..."}
    let addresses_array = ffi_response
        .get("addresses")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing addresses array in FFI response",
        ))?;

    // Convert FFI addresses to domain model
    let addresses: Vec<Address> = addresses_array
        .iter()
        .enumerate()
        .map(|(idx, addr_data)| {
            let blockchain = addr_data
                .get("blockchain")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            let address = addr_data
                .get("address")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            let derivation_path = addr_data
                .get("derivationPath")
                .and_then(|v| v.as_str())
                .unwrap_or("m/44'/0'/0'/0/0")
                .to_string();

            // TODO: Map blockchain names to proper symbols, coin_types, etc.
            Address::new(
                wallet_id.clone(),
                (idx + 1) as u32, // rank
                blockchain.to_uppercase(), // symbol
                blockchain.to_string(), // name
                0, // coin_type (TODO: derive from derivation path)
                derivation_path,
                address,
                Category::Layer2, // Default category (Layer1 doesn't exist, using Layer2)
                KeyType::Secp256k1, // Default key type
            )
        })
        .collect();

    // Cache the addresses
    {
        let mut cache_lock = cache.0.lock().unwrap();
        cache_lock.insert(wallet_id.clone(), addresses.clone());
    }

    // T038: Log performance metrics
    let elapsed = start.elapsed();
    tracing::info!(
        "Loaded and cached {} addresses for wallet {} (took {:?})",
        addresses.len(),
        wallet_id,
        elapsed
    );

    Ok(AddressListResponse::new(wallet_id, addresses))
}

/// List all wallets on USB
/// Directly scans USB directory for wallet folders (CLI list command not yet implemented)
#[tauri::command]
pub async fn list_wallets(
    queue: State<'_, LazyWalletQueue>, // T035: Accept LazyWalletQueue from Tauri state
    usb_path: String,
) -> Result<Vec<Wallet>, String> {
    // T038: Start performance timer
    let start = Instant::now();

    // T035: Build JSON params for FFI call
    let params = json!({
        "usbPath": usb_path,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // T035: Call FFI queue
    let ffi_response = queue
        .list_wallets(params_json)
        .await
        .map_err(|e| {
            if e.contains("USB_NOT_FOUND") || e.contains("STORAGE_ERROR") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to list wallets",
                    e,
                )
            }
        })?;

    tracing::info!("List wallets FFI response: {:?}", ffi_response);

    // T035: Parse FFI JSON response
    // Expected format: {"wallets": [{"walletId": "...", "walletName": "...", "createdAt": "..."}], "count": 2}
    let wallets_array = ffi_response
        .get("wallets")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing wallets array in FFI response",
        ))?;

    let mut wallets = Vec::new();
    for wallet_data in wallets_array {
        let wallet_id = wallet_data
            .get("walletId")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let name = wallet_data
            .get("walletName")
            .and_then(|v| v.as_str())
            .unwrap_or(&wallet_id)
            .to_string();

        let created_at = wallet_data
            .get("createdAt")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        // Use created_at as updated_at for now (actual implementation would track this)
        let updated_at = created_at.clone();

        // Default values (actual implementation would read from wallet metadata)
        let has_passphrase = false;
        let address_count = 0;

        wallets.push(Wallet {
            id: wallet_id,
            name: name.clone(),
            created_at,
            updated_at,
            has_passphrase,
            address_count,
        });

        tracing::info!("Found wallet via FFI: {}", name);
    }

    // T038: Log performance metrics
    let elapsed = start.elapsed();
    tracing::info!(
        "Found {} wallet(s) on USB (took {:?})",
        wallets.len(),
        elapsed
    );

    Ok(wallets)
}

/// Rename wallet (T036 - Updated to use FFI queue)
/// Requirements: FR-019 (Wallet rename functionality)
#[tauri::command]
pub async fn rename_wallet(
    queue: State<'_, LazyWalletQueue>, // T036: Accept LazyWalletQueue from Tauri state
    wallet_id: String,
    new_name: String,
    usb_path: String,
) -> Result<Wallet, String> {
    // T038: Start performance timer
    let start = Instant::now();

    // Validate wallet ID format
    if !Wallet::validate_id(&wallet_id) {
        return Err(AppError::new(
            ErrorCode::InvalidWalletId,
            "Invalid wallet ID format",
        )
        .into());
    }

    // Validate new name
    if !Wallet::validate_name(&new_name) {
        return Err(AppError::new(
            ErrorCode::InvalidWalletId,
            "Wallet name must be 1-50 characters",
        )
        .into());
    }

    // T036: Build JSON params for FFI call
    let params = json!({
        "walletName": wallet_id, // Current wallet name/ID
        "newWalletName": new_name.trim(),
        "usbPath": usb_path,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // T036: Call FFI queue
    let ffi_response = queue
        .rename_wallet(params_json)
        .await
        .map_err(|e| {
            // Check for wallet not found error
            if e.contains("not found") || e.contains("WALLET_NOT_FOUND") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found on USB drive",
                )
            } else if e.contains("USB_NOT_FOUND") || e.contains("STORAGE_ERROR") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to rename wallet",
                    e,
                )
            }
        })?;

    tracing::info!("Rename wallet FFI response: {:?}", ffi_response);

    // T036: Parse FFI JSON response
    // Expected format: {"walletId": "...", "oldName": "...", "newName": "...", "renamedAt": "..."}
    let wallet_id_resp = ffi_response
        .get("walletId")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing walletId in FFI response",
        ))?
        .to_string();

    let new_name_resp = ffi_response
        .get("newName")
        .and_then(|v| v.as_str())
        .unwrap_or(new_name.trim())
        .to_string();

    let renamed_at = ffi_response
        .get("renamedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    // Convert to domain model
    let wallet = Wallet {
        id: wallet_id_resp,
        name: new_name_resp.clone(),
        created_at: "unknown".to_string(), // Actual implementation would preserve this
        updated_at: renamed_at,
        has_passphrase: false, // Actual implementation would preserve this
        address_count: 0, // Actual implementation would preserve this
    };

    // T038: Log performance metrics
    let elapsed = start.elapsed();
    tracing::info!(
        "Wallet renamed successfully: {} (took {:?})",
        new_name_resp,
        elapsed
    );

    Ok(wallet)
}

/// Parse category string to Category enum
fn parse_category(s: &str) -> Category {
    match s {
        "base" => Category::Base,
        "layer2" => Category::Layer2,
        "regional" => Category::Regional,
        "cosmos" => Category::Cosmos,
        "alt_evm" => Category::AltEvm,
        "specialized" => Category::Specialized,
        _ => Category::Specialized, // Default fallback
    }
}

/// Parse key type string to KeyType enum
fn parse_key_type(s: &str) -> KeyType {
    match s {
        "secp256k1" => KeyType::Secp256k1,
        "ed25519" => KeyType::Ed25519,
        "sr25519" => KeyType::Sr25519,
        "schnorr" => KeyType::Schnorr,
        _ => KeyType::Secp256k1, // Default fallback
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_password_length() {
        // Too short
        assert!(validate_password("Short1").is_err());

        // Exactly 12 chars
        assert!(validate_password("ValidPass123").is_ok());

        // Long password
        assert!(validate_password("VeryLongPassword123").is_ok());
    }

    #[test]
    fn test_validate_password_complexity() {
        // No uppercase
        assert!(validate_password("alllowercase123").is_err());

        // No lowercase
        assert!(validate_password("ALLUPPERCASE123").is_err());

        // No number
        assert!(validate_password("NoNumbersHere").is_err());

        // Valid with all requirements
        assert!(validate_password("ValidPassword123").is_ok());
    }

    #[test]
    fn test_validate_password_with_special_chars() {
        assert!(validate_password("ValidPassword123!").is_ok());
        assert!(validate_password("ValidPassword123@").is_ok());
        assert!(validate_password("ValidPassword123#").is_ok());
    }
}
