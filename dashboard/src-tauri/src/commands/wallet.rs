/**
 * Wallet management commands
 * Feature: User Dashboard for Wallet Management
 * Task: T032 - Implement create_wallet Tauri command (updated for FFI)
 * Updated: 2025-10-25 - T032.1: Migrated to FFI queue
 */

use crate::error::{AppError, AppResult, ErrorCode};
use crate::ffi::LazyWalletQueue; // T032: Add FFI queue import (using LazyWalletQueue for deferred initialization)
use crate::models::address::{Address, AddressListResponse, Category, KeyType};
use crate::models::wallet::{Wallet, WalletAddress, WalletCreateResponse, WalletImportResponse};
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
    // Go will generate the mnemonic based on wordCount
    let mut params = json!({
        "walletName": wallet_name,
        "password": password,
        "usbPath": usbPath,
        "wordCount": length,
    });

    // Add passphrase if provided
    if let Some(ref pp) = passphrase {
        params["passphrase"] = json!(pp);
    }

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

    // Extract mnemonic from FFI response (Go generates it)
    let mnemonic = ffi_response
        .get("mnemonic")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing mnemonic in FFI response",
        ))?
        .to_string();

    // T053: Convert to domain model and return via Tauri IPC
    let wallet = Wallet {
        id: wallet_id,
        name: wallet_name.clone(),
        created_at: created_at.clone(),
        updated_at: created_at,
        has_passphrase,
        address_count: 54, // All 54 addresses will be generated
        addresses: None, // Addresses loaded separately
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

    // T093: Read all addresses.json files from USB
    // TODO: Implement actual duplicate detection by deriving Bitcoin address and comparing
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
            addresses: None,
        };

        return Ok(WalletImportResponse {
            wallet,
            is_duplicate: true,
        });
    }

    // Check if passphrase is provided (before moving it)
    let has_passphrase = passphrase.is_some();
    let passphrase_value = passphrase.as_deref().unwrap_or("");

    let wallet_name = name.clone().unwrap_or_else(|| {
        format!("Imported Wallet {}", chrono::Local::now().format("%Y-%m-%d"))
    });

    // T032.2: Build JSON params for FFI call
    let params = json!({
        "walletName": wallet_name,
        "mnemonic": normalized_mnemonic,
        "password": password,
        "usbPath": usb_path,
        "passphrase": passphrase_value,  // 傳遞 BIP39 passphrase
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
        addresses: None,
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

        // Read hasPassphrase from FFI response
        let has_passphrase = wallet_data
            .get("hasPassphrase")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // Parse addresses from FFI response (public data, no password needed)
        let addresses: Option<Vec<WalletAddress>> = wallet_data
            .get("addresses")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|addr| {
                        Some(WalletAddress {
                            symbol: addr.get("symbol")?.as_str()?.to_string(),
                            coin_name: addr.get("coinName")?.as_str()?.to_string(),
                            coin_type: addr.get("coinType")?.as_u64()? as u32,
                            address: addr.get("address")?.as_str()?.to_string(),
                            derivation_path: addr.get("derivationPath")?.as_str()?.to_string(),
                            category: addr.get("category")?.as_str()?.to_string(),
                        })
                    })
                    .collect()
            });

        let address_count = addresses.as_ref().map(|a| a.len() as u32).unwrap_or(0);

        wallets.push(Wallet {
            id: wallet_id,
            name: name.clone(),
            created_at,
            updated_at,
            has_passphrase,
            address_count,
            addresses,
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
        addresses: None,
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

/// Delete a wallet from USB storage
/// Requirements: FR-020 (Delete wallet with confirmation)
/// Deletes the wallet directory and all associated files
#[tauri::command]
pub async fn delete_wallet(
    queue: State<'_, LazyWalletQueue>,
    wallet_id: String,
    password: String,
    usb_path: String,
) -> Result<(), String> {
    let start = Instant::now();

    // Validate password
    validate_password(&password).map_err(String::from)?;

    // Validate wallet_id format (basic UUID validation)
    if wallet_id.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidWalletId,
            "Wallet ID cannot be empty",
        ).into());
    }

    // Build JSON params for FFI call
    let params = json!({
        "walletId": wallet_id,
        "password": password,
        "usbPath": usb_path,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // Call FFI to delete wallet (this will verify password first)
    queue
        .delete_wallet(params_json)
        .await
        .map_err(|e| {
            if e.contains("INCORRECT_PASSWORD") || e.contains("password") {
                AppError::new(
                    ErrorCode::InvalidPassword,
                    "Incorrect password",
                )
            } else if e.contains("WALLET_NOT_FOUND") || e.contains("not found") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found on USB",
                )
            } else if e.contains("USB_NOT_FOUND") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to delete wallet",
                    e,
                )
            }
        })?;

    let elapsed = start.elapsed();
    tracing::info!(
        "Wallet deleted successfully: {} (took {:?})",
        wallet_id,
        elapsed
    );

    Ok(())
}

/// Export wallet as encrypted .arcsign backup file
/// No password required — mnemonic.enc inside is already AES-256-GCM encrypted
#[tauri::command]
pub async fn export_backup(
    queue: State<'_, LazyWalletQueue>,
    wallet_id: String,
    usb_path: String,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();

    if wallet_id.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidWalletId,
            "Wallet ID cannot be empty",
        ).into());
    }

    let params = json!({
        "walletId": wallet_id,
        "usbPath": usb_path,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    let result = queue
        .export_wallet(params_json)
        .await
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::CliExecutionFailed,
                "Failed to export backup",
                e,
            )
        })?;

    let elapsed = start.elapsed();
    tracing::info!("Backup exported successfully: {} (took {:?})", wallet_id, elapsed);

    Ok(result)
}

/// Import wallet from encrypted .arcsign backup file
/// Password required to verify ownership (decrypt mnemonic)
#[tauri::command]
pub async fn import_backup(
    queue: State<'_, LazyWalletQueue>,
    backup_data: String,
    mut password: String,
    usb_path: String,
    name: Option<String>,
) -> Result<WalletImportResponse, String> {
    let start = Instant::now();

    // Validate password
    validate_password(&password).map_err(String::from)?;

    if backup_data.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Backup data cannot be empty",
        ).into());
    }

    let params = json!({
        "backupData": backup_data,
        "password": password,
        "usbPath": usb_path,
        "walletName": name.unwrap_or_default(),
    });

    // Zeroize password immediately after building params
    password.zeroize();

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    let result = queue
        .import_backup_wallet(params_json)
        .await
        .map_err(|e| {
            if e.contains("wrong password") || e.contains("INVALID_PASSWORD") {
                AppError::new(
                    ErrorCode::InvalidPassword,
                    "Incorrect password",
                )
            } else if e.contains("BACKUP_INVALID") || e.contains("invalid backup") {
                AppError::new(
                    ErrorCode::InvalidInput,
                    "Invalid .arcsign backup file",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to import backup",
                    e,
                )
            }
        })?;

    // Parse response into WalletImportResponse
    let data = result.get("data").ok_or_else(|| "Missing data in response".to_string())?;
    let wallet_id = data.get("walletId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let wallet_name = data.get("walletName").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let imported_at = data.get("importedAt").and_then(|v| v.as_str()).unwrap_or("").to_string();

    let wallet = Wallet::new(
        wallet_id.clone(),
        wallet_name,
        imported_at,
        false,
    );

    let elapsed = start.elapsed();
    tracing::info!("Backup imported successfully: {} (took {:?})", wallet_id, elapsed);

    Ok(WalletImportResponse {
        wallet,
        is_duplicate: false,
    })
}

/// Export all wallets as encrypted .arcsign-bundle file (Pro feature)
/// Password required to encrypt the outer layer (Argon2id + AES-256-GCM)
#[tauri::command]
pub async fn export_all_backups(
    queue: State<'_, LazyWalletQueue>,
    mut password: String,
    usb_path: String,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();

    validate_password(&password).map_err(String::from)?;

    let params = json!({
        "password": password,
        "usbPath": usb_path,
    });

    // Zeroize password immediately after building params
    password.zeroize();

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    let result = queue
        .export_all_wallets(params_json)
        .await
        .map_err(|e| {
            if e.contains("wrong password") || e.contains("INVALID_PASSWORD") {
                AppError::new(
                    ErrorCode::InvalidPassword,
                    "Incorrect password",
                )
            } else if e.contains("no wallets") {
                AppError::new(
                    ErrorCode::InvalidInput,
                    "No wallets to export",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to export all backups",
                    e,
                )
            }
        })?;

    let elapsed = start.elapsed();
    tracing::info!("All backups exported successfully (took {:?})", elapsed);

    Ok(result)
}

/// Import all wallets from encrypted .arcsign-bundle file (Pro feature)
/// Password required to decrypt the outer layer
#[tauri::command]
pub async fn import_all_backups(
    queue: State<'_, LazyWalletQueue>,
    bundle_data: String,
    mut password: String,
    usb_path: String,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();

    validate_password(&password).map_err(String::from)?;

    if bundle_data.trim().is_empty() {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "Bundle data cannot be empty",
        ).into());
    }

    let params = json!({
        "bundleData": bundle_data,
        "password": password,
        "usbPath": usb_path,
    });

    // Zeroize password immediately after building params
    password.zeroize();

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    let result = queue
        .import_all_wallets(params_json)
        .await
        .map_err(|e| {
            if e.contains("wrong password") || e.contains("INVALID_PASSWORD") {
                AppError::new(
                    ErrorCode::InvalidPassword,
                    "Incorrect password",
                )
            } else if e.contains("BUNDLE_INVALID") || e.contains("invalid bundle") {
                AppError::new(
                    ErrorCode::InvalidInput,
                    "Invalid .arcsign-bundle file",
                )
            } else if e.contains("BUNDLE_CORRUPTED") || e.contains("corrupted bundle") {
                AppError::new(
                    ErrorCode::InvalidInput,
                    "Bundle file is corrupted",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to import bundle",
                    e,
                )
            }
        })?;

    let elapsed = start.elapsed();
    tracing::info!("All backups imported successfully (took {:?})", elapsed);

    Ok(result)
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

/// Get token balances across multiple chains using Alchemy API
/// Requirements: Asset management, multi-chain balance queries
#[tauri::command]
pub async fn get_token_balances(
    queue: State<'_, LazyWalletQueue>,
    wallet_id: String,
    mut password: String,
    usb_path: String,
    session_token: Option<String>,  // ✅ PREFERRED: Session token for provider key access
    app_password: Option<String>,   // DEPRECATED: For backward compatibility
    include_testnets: Option<bool>,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!("get_token_balances called for wallet_id: {}", wallet_id);

    // Build JSON params for FFI call
    let params = json!({
        "walletId": wallet_id,
        "password": password,
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),  // ✅ Pass session token to backend
        "appPassword": app_password.unwrap_or_default(),    // DEPRECATED: Fallback
        "includeTestnets": include_testnets.unwrap_or(false),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| {
            tracing::error!("Failed to serialize params: {}", e);
            format!("Failed to serialize params: {}", e)
        })?;

    tracing::info!("Calling FFI queue.get_token_balances");

    // Call FFI queue
    let ffi_response = queue
        .get_token_balances(params_json)
        .await
        .map_err(|e| {
            tracing::error!("FFI call failed with error: {}", e);
            if e.contains("WALLET_NOT_FOUND") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found on USB",
                )
            } else if e.contains("INVALID_PASSWORD") || e.contains("DECRYPTION_ERROR") {
                AppError::new(
                    ErrorCode::PasswordTooWeak,
                    "Invalid password",
                )
            } else if e.contains("USB_NOT_FOUND") || e.contains("STORAGE_ERROR") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else if e.contains("PROVIDER_NOT_FOUND") || e.contains("API_KEY") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Alchemy provider not configured or API key missing",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to get token balances",
                    e,
                )
            }
        })?;

    // Zero sensitive data
    password.zeroize();

    let elapsed = start.elapsed();
    
    // Log the response details for debugging
    tracing::info!("FFI Response received: {}", serde_json::to_string_pretty(&ffi_response).unwrap_or_else(|_| "Failed to serialize".to_string()));
    
    // Check if response has expected structure
    if let Some(obj) = ffi_response.as_object() {
        tracing::info!("Response keys: {:?}", obj.keys().collect::<Vec<_>>());
        
        if let Some(tokens) = obj.get("tokens") {
            if let Some(arr) = tokens.as_array() {
                tracing::info!("Number of tokens: {}", arr.len());
                
                // Log first few tokens
                for (idx, token) in arr.iter().take(3).enumerate() {
                    tracing::info!("Token {}: {}", idx + 1, serde_json::to_string_pretty(token).unwrap_or_else(|_| "Failed to serialize".to_string()));
                }
            } else {
                tracing::warn!("tokens field is not an array: {:?}", tokens);
            }
        } else {
            tracing::warn!("No 'tokens' field in response");
        }
        
        if let Some(total_usd) = obj.get("totalUsd") {
            tracing::info!("Total USD: {}", total_usd);
        }
    } else {
        tracing::warn!("Response is not a JSON object: {:?}", ffi_response);
    }
    
    tracing::info!(
        "Retrieved token balances for wallet {} (took {:?})",
        wallet_id,
        elapsed
    );

    Ok(ffi_response)
}

/// Get NFTs owned by a wallet across multiple chains using Alchemy API
/// Requirements: NFT Gallery display
#[tauri::command]
pub async fn get_nfts(
    queue: State<'_, LazyWalletQueue>,
    wallet_id: String,
    mut password: String,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!("get_nfts called for wallet_id: {}", wallet_id);

    let params = json!({
        "walletId": wallet_id,
        "password": password,
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| {
            tracing::error!("Failed to serialize params: {}", e);
            format!("Failed to serialize params: {}", e)
        })?;

    let ffi_response = queue
        .get_nfts(params_json)
        .await
        .map_err(|e| {
            tracing::error!("FFI get_nfts call failed: {}", e);
            if e.contains("WALLET_NOT_FOUND") {
                AppError::new(ErrorCode::WalletNotFound, "Wallet not found on USB")
            } else if e.contains("INVALID_PASSWORD") || e.contains("DECRYPTION_ERROR") {
                AppError::new(ErrorCode::PasswordTooWeak, "Invalid password")
            } else if e.contains("INVALID_INPUT") || e.contains("Alchemy API key") || e.contains("NodeReal") {
                // Actionable backend messages must reach the user verbatim.
                // The FFI string is "CODE: message" — strip the leading code.
                let msg = e.splitn(2, ": ").nth(1).unwrap_or(&e).to_string();
                AppError::new(ErrorCode::InvalidInput, msg)
            } else {
                // Surface the real FFI message rather than a generic title.
                let msg = e.splitn(2, ": ").nth(1).unwrap_or(&e).to_string();
                AppError::with_details(ErrorCode::CliExecutionFailed, msg, e)
            }
        })?;

    password.zeroize();

    tracing::info!(
        "Retrieved NFTs for wallet {} (took {:?})",
        wallet_id,
        start.elapsed()
    );

    Ok(ffi_response)
}

/// Get active ERC-20 token approvals for a wallet's EVM addresses.
///
/// Queries Approval events via eth_getLogs and verifies current allowance on-chain.
/// Returns: { "approvals": [...], "totalCount": N }
#[tauri::command]
pub async fn get_token_approvals(
    queue: State<'_, LazyWalletQueue>,
    wallet_id: String,
    mut password: String,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!("get_token_approvals called for wallet_id: {}", wallet_id);

    let params = json!({
        "walletId": wallet_id,
        "password": password,
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| {
            tracing::error!("Failed to serialize params: {}", e);
            format!("Failed to serialize params: {}", e)
        })?;

    let ffi_response = queue
        .get_token_approvals(params_json)
        .await
        .map_err(|e| {
            tracing::error!("FFI get_token_approvals call failed: {}", e);
            if e.contains("WALLET_NOT_FOUND") {
                AppError::new(ErrorCode::WalletNotFound, "Wallet not found on USB")
            } else if e.contains("INVALID_PASSWORD") || e.contains("DECRYPTION_ERROR") {
                AppError::new(ErrorCode::PasswordTooWeak, "Invalid password")
            } else if e.contains("INVALID_INPUT") || e.contains("Alchemy API key") {
                // Actionable backend messages (e.g. "Alchemy API key not configured…")
                // must reach the user verbatim, not be flattened to a generic title.
                // The FFI string is "CODE: message" — strip the leading code.
                let msg = e.splitn(2, ": ").nth(1).unwrap_or(&e).to_string();
                AppError::new(ErrorCode::InvalidInput, msg)
            } else {
                // Surface the real FFI message rather than a generic title, so the
                // user sees what actually went wrong.
                let msg = e.splitn(2, ": ").nth(1).unwrap_or(&e).to_string();
                AppError::with_details(ErrorCode::CliExecutionFailed, msg, e)
            }
        })?;

    password.zeroize();

    tracing::info!(
        "Retrieved token approvals for wallet {} (took {:?})",
        wallet_id,
        start.elapsed()
    );

    Ok(ffi_response)
}

/// Run the txguard risk engine (blacklist + simulation) for a transaction.
/// Returns a risk assessment with threat level, flags, and simulation result.
#[tauri::command]
pub async fn check_transaction_security(
    queue: State<'_, LazyWalletQueue>,
    from: String,
    to: String,
    chain_id: String,
    value: Option<String>,
    data: Option<String>,
    usb_path: String,
    session_token: Option<String>,
    mut app_password: Option<String>,
    is_pro: bool,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!("check_transaction_security called from: {} to: {} chain: {}", from, to, chain_id);

    let params = json!({
        "from": from,
        "to": to,
        "chainId": chain_id,
        "value": value.unwrap_or_default(),
        "data": data.unwrap_or_default(),
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.as_deref().unwrap_or_default(),
        "isPro": is_pro,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| {
            tracing::error!("Failed to serialize params: {}", e);
            format!("Failed to serialize params: {}", e)
        })?;

    // Zeroize password immediately after building params
    if let Some(ref mut pw) = app_password {
        pw.zeroize();
    }

    let ffi_response = queue
        .check_transaction_security(params_json)
        .await
        .map_err(|e| {
            tracing::error!("FFI check_transaction_security failed: {}", e);
            // Advisory check: returns the raw FFI message intentionally (not an
            // AppError) — the caller treats any failure as "no security report"
            // and still allows signing, so structured error codes aren't needed.
            let msg = e.split_once(": ").map_or(e.clone(), |(_, v)| v.to_string());
            msg
        })?;

    tracing::info!(
        "check_transaction_security completed for to={} (took {:?})",
        to,
        start.elapsed()
    );

    Ok(ffi_response)
}

/// Look up a verified contract ABI in the per-USB encrypted ABI cache.
/// `params` is the pre-serialized JSON body expected by the Go FFI export
/// (chainId, address, usbPath, sessionToken, appPassword).
#[tauri::command]
pub async fn get_cached_abi(
    queue: State<'_, LazyWalletQueue>,
    params: String,
) -> Result<serde_json::Value, String> {
    queue
        .get_cached_abi(params)
        .await
        .map_err(|e| {
            tracing::error!("FFI get_cached_abi failed: {}", e);
            e.split_once(": ").map_or(e.clone(), |(_, v)| v.to_string())
        })
}

/// Store a verified contract ABI into the per-USB encrypted ABI cache.
/// `params` is the pre-serialized JSON body expected by the Go FFI export.
#[tauri::command]
pub async fn set_cached_abi(
    queue: State<'_, LazyWalletQueue>,
    params: String,
) -> Result<serde_json::Value, String> {
    queue
        .set_cached_abi(params)
        .await
        .map_err(|e| {
            tracing::error!("FFI set_cached_abi failed: {}", e);
            e.split_once(": ").map_or(e.clone(), |(_, v)| v.to_string())
        })
}

/// Clear the per-USB encrypted ABI cache.
/// `params` is the pre-serialized JSON body expected by the Go FFI export.
#[tauri::command]
pub async fn clear_abi_cache(
    queue: State<'_, LazyWalletQueue>,
    params: String,
) -> Result<serde_json::Value, String> {
    queue
        .clear_abi_cache(params)
        .await
        .map_err(|e| {
            tracing::error!("FFI clear_abi_cache failed: {}", e);
            e.split_once(": ").map_or(e.clone(), |(_, v)| v.to_string())
        })
}

#[tauri::command]
pub async fn list_contacts(
    queue: State<'_, LazyWalletQueue>,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    tracing::info!("list_contacts called");

    let params = json!({
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    queue.list_contacts(params_json).await
}

#[tauri::command]
pub async fn add_contact(
    queue: State<'_, LazyWalletQueue>,
    name: String,
    address: String,
    symbol: String,
    coin_name: String,
    notes: Option<String>,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    tracing::info!("add_contact called: name={}", name);

    let params = json!({
        "name": name,
        "address": address,
        "symbol": symbol,
        "coinName": coin_name,
        "notes": notes.unwrap_or_default(),
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    queue.add_contact(params_json).await
}

#[tauri::command]
pub async fn update_contact(
    queue: State<'_, LazyWalletQueue>,
    contact_id: String,
    name: String,
    address: String,
    symbol: String,
    coin_name: String,
    notes: Option<String>,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    tracing::info!("update_contact called: id={}", contact_id);

    let params = json!({
        "contactId": contact_id,
        "name": name,
        "address": address,
        "symbol": symbol,
        "coinName": coin_name,
        "notes": notes.unwrap_or_default(),
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    queue.update_contact(params_json).await
}

#[tauri::command]
pub async fn delete_contact(
    queue: State<'_, LazyWalletQueue>,
    contact_id: String,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    tracing::info!("delete_contact called: id={}", contact_id);

    let params = json!({
        "contactId": contact_id,
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    queue.delete_contact(params_json).await
}

#[tauri::command]
pub async fn set_transaction_label(
    queue: State<'_, LazyWalletQueue>,
    network: String,
    tx_hash: String,
    name: String,
    category: Option<String>,
    notes: Option<String>,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    tracing::info!("set_transaction_label called: {}:{}", network, tx_hash);

    let params = json!({
        "network": network,
        "txHash": tx_hash,
        "name": name,
        "category": category.unwrap_or_default(),
        "notes": notes.unwrap_or_default(),
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    queue.set_transaction_label(params_json).await
}

#[tauri::command]
pub async fn get_transaction_labels(
    queue: State<'_, LazyWalletQueue>,
    usb_path: String,
    network: Option<String>,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    tracing::info!("get_transaction_labels called");

    let params = json!({
        "usbPath": usb_path,
        "network": network.unwrap_or_default(),
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    queue.get_transaction_labels(params_json).await
}

#[tauri::command]
pub async fn delete_transaction_label(
    queue: State<'_, LazyWalletQueue>,
    network: String,
    tx_hash: String,
    usb_path: String,
    session_token: Option<String>,
    app_password: Option<String>,
) -> Result<serde_json::Value, String> {
    tracing::info!("delete_transaction_label called: {}:{}", network, tx_hash);

    let params = json!({
        "network": network,
        "txHash": tx_hash,
        "usbPath": usb_path,
        "sessionToken": session_token.unwrap_or_default(),
        "appPassword": app_password.unwrap_or_default(),
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    queue.delete_transaction_label(params_json).await
}

/// Validate a BIP39 passphrase by comparing derived address with stored address.
///
/// This is used during wallet unlock to validate the passphrase before allowing
/// the user to proceed with transactions.
///
/// Returns: { "valid": bool, "derivedAddress": "0x...", "expectedAddress": "0x..." }
#[tauri::command]
pub async fn validate_passphrase(
    queue: State<'_, LazyWalletQueue>,
    wallet_id: String,
    mut password: String,
    mut passphrase: String,
    usb_path: String,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!("validate_passphrase called for wallet_id: {}", wallet_id);

    // Build JSON params for FFI call
    let params = json!({
        "walletId": wallet_id,
        "password": password,
        "passphrase": passphrase,
        "usbPath": usb_path,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // Call FFI queue
    let ffi_response = queue
        .validate_passphrase(params_json)
        .await
        .map_err(|e| {
            tracing::error!("validate_passphrase FFI error: {}", e);
            if e.contains("INVALID_PASSWORD") || e.contains("DECRYPTION_ERROR") {
                AppError::new(
                    ErrorCode::InvalidPassword,
                    "Invalid password",
                )
            } else if e.contains("WALLET_NOT_FOUND") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found on USB",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to validate passphrase",
                    e,
                )
            }
        })?;

    // Zero sensitive data
    password.zeroize();
    passphrase.zeroize();

    let elapsed = start.elapsed();
    tracing::info!(
        "Passphrase validation completed for wallet {} (took {:?})",
        wallet_id,
        elapsed
    );

    Ok(ffi_response)
}

/// Update WebSocket server with BSC addresses from wallets
/// Called by frontend after wallet list is loaded
#[tauri::command]
pub async fn update_websocket_accounts(
    accounts: Vec<String>,
    ws_server: State<'_, std::sync::Arc<tokio::sync::RwLock<crate::websocket::WebSocketServer>>>,
) -> Result<(), String> {
    tracing::info!("Updating WebSocket accounts with {} addresses", accounts.len());

    let server = ws_server.read().await;
    server.update_accounts(accounts).await;

    Ok(())
}

/// Update WebSocket server with USB device path
/// Called by frontend when USB device is connected/selected
#[tauri::command]
pub async fn update_websocket_usb_path(
    usb_path: Option<String>,
    ws_server: State<'_, std::sync::Arc<tokio::sync::RwLock<crate::websocket::WebSocketServer>>>,
) -> Result<(), String> {
    if let Some(ref path) = usb_path {
        tracing::info!("Updating WebSocket USB path to: {}", path);
    } else {
        tracing::info!("Clearing WebSocket USB path");
    }

    let server = ws_server.read().await;
    server.update_usb_path(usb_path).await;

    Ok(())
}
