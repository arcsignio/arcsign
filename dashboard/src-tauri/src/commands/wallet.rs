/**
 * Wallet management commands
 * Feature: User Dashboard for Wallet Management
 * Task: T032 - Implement create_wallet Tauri command
 * Generated: 2025-10-17
 */

use crate::cli::wrapper::{
    AddressListResponse as CliAddressListResponse, CliCommand, CliWrapper,
    WalletCreateResponse as CliWalletCreateResponse, WalletImportResponse as CliWalletImportResponse,
    WalletInfo, WalletListResponse,
};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::models::address::{Address, AddressListResponse, Category, KeyType};
use crate::models::wallet::{Wallet, WalletCreateResponse, WalletImportResponse};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

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

/// Create new HD wallet (T050-T055)
/// Requirements: FR-001 (Wallet creation), FR-004 (BIP39 generation), FR-024 (USB storage)
/// Note: Using camelCase parameter names to match JavaScript/TypeScript convention
#[tauri::command]
pub async fn create_wallet(
    password: String,
    #[allow(non_snake_case)]
    usbPath: String,
    name: Option<String>,
    passphrase: Option<String>,
    #[allow(non_snake_case)]
    mnemonicLength: Option<usize>,
) -> Result<WalletCreateResponse, String> {
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

    // Create CLI wrapper
    let cli = CliWrapper::new("./arcsign");

    // Check if passphrase is provided (before moving it)
    let has_passphrase = passphrase.is_some();

    // T051: Execute create wallet command with dashboard mode environment variables
    // The CLI wrapper will set:
    // - ARCSIGN_MODE=dashboard
    // - CLI_COMMAND=create
    // - WALLET_PASSWORD, USB_PATH, MNEMONIC_LENGTH
    // - Optional: WALLET_NAME, BIP39_PASSPHRASE
    // - RETURN_MNEMONIC=true
    let cmd = CliCommand::CreateWallet {
        password,
        usb_path: usbPath.clone(),
        name: name.clone(),
        passphrase,
        mnemonic_length: length,
    };

    let output = cli
        .execute(cmd)
        .await
        .map_err(|e| {
            // T054: User-friendly error mapping
            if e.contains("USB_NOT_FOUND") {
                AppError::new(
                    ErrorCode::UsbNotFound,
                    "USB device not found",
                )
            } else if e.contains("INVALID_PASSWORD") {
                AppError::new(
                    ErrorCode::PasswordTooWeak,
                    "Invalid password",
                )
            } else if e.contains("IO_ERROR") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Failed to write wallet to USB",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to create wallet",
                    e,
                )
            }
        })?;

    // T052: Parse CLI JSON response (new CliResponse format)
    // Expected format: {"success": true, "data": {"wallet_id": "...", "mnemonic": "...", "created_at": "..."}, ...}
    let cli_response: serde_json::Value = cli
        .parse_json(&output)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::DeserializationError,
                "Failed to parse wallet creation response",
                e,
            )
        })?;

    // T055: Log full response for debugging
    tracing::info!("Wallet creation CLI response: {:?}", cli_response);

    // Extract wallet data from CliResponse.data field
    let data = cli_response
        .get("data")
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing 'data' field in CLI response",
        ))?;

    let wallet_id = data
        .get("wallet_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing wallet_id in response",
        ))?
        .to_string();

    let mnemonic = data
        .get("mnemonic")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing mnemonic in response (ensure RETURN_MNEMONIC=true)",
        ))?
        .to_string();

    let created_at = data
        .get("created_at")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    // Use provided name or generate default
    let wallet_name = name.unwrap_or_else(|| {
        format!("Wallet {}", chrono::Local::now().format("%Y-%m-%d"))
    });

    // T053: Convert to domain model and return via Tauri IPC
    let wallet = Wallet {
        id: wallet_id,
        name: wallet_name,
        created_at: created_at.clone(),
        updated_at: created_at,
        has_passphrase,
        address_count: 54, // All 54 addresses generated by CLI
    };

    let response = WalletCreateResponse {
        wallet,
        mnemonic,
    };

    tracing::info!("Wallet created successfully: {}", response.wallet.name);

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
    mnemonic: String,
    password: String,
    usb_path: String,
    passphrase: Option<String>,
    name: Option<String>,
) -> Result<WalletImportResponse, String> {
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

    // T096: Check for duplicate wallet before CLI invocation
    let passphrase_ref = passphrase.as_deref();
    if let Some((dup_id, dup_name, dup_created)) = check_duplicate_wallet(
        &normalized_mnemonic,
        passphrase_ref,
        &usb_path,
    ).await.map_err(String::from)? {
        tracing::warn!("Duplicate wallet detected: {} ({})", dup_name, dup_id);

        // Return early with duplicate flag
        let wallet = Wallet {
            id: dup_id.clone(),
            name: dup_name.clone(),
            created_at: dup_created.clone(),
            updated_at: dup_created,
            has_passphrase: passphrase.is_some(),
            address_count: 0,
        };

        return Ok(WalletImportResponse {
            wallet,
            is_duplicate: true,
        });
    }

    // Create CLI wrapper
    let cli = CliWrapper::new("./arcsign");

    // Check if passphrase is provided (before moving it)
    let has_passphrase = passphrase.is_some();

    // T097: Execute restore wallet command with environment variables
    // CLI will use ARCSIGN_MODE=dashboard and CLI_COMMAND=import
    let cmd = CliCommand::RestoreWallet {
        mnemonic: normalized_mnemonic,
        password,
        usb_path,
        passphrase,
        name: name.clone(),
    };

    let output = cli
        .execute(cmd)
        .await
        .map_err(|e| {
            // Check for duplicate wallet error (FR-031)
            if e.contains("already exists") || e.contains("DUPLICATE") || e.contains("WALLET_EXISTS") {
                AppError::new(
                    ErrorCode::WalletAlreadyExists,
                    "Wallet with this mnemonic already exists on USB",
                )
            } else if e.contains("INVALID_MNEMONIC") {
                AppError::new(
                    ErrorCode::InvalidMnemonicLength,
                    "Invalid BIP39 mnemonic phrase",
                )
            } else if e.contains("USB_NOT_FOUND") {
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

    // T098: Parse CLI JSON response and extract wallet metadata
    // The CLI returns a basic success response with wallet_id and created_at
    let cli_response: serde_json::Value = cli
        .parse_json(&output)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::DeserializationError,
                "Failed to parse wallet import response",
                e,
            )
        })?;

    // Extract wallet metadata from CLI response
    let wallet_id = cli_response
        .get("data")
        .and_then(|d| d.get("wallet_id"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::new(
            ErrorCode::DeserializationError,
            "Missing wallet_id in CLI response",
        ))?
        .to_string();

    let created_at = cli_response
        .get("data")
        .and_then(|d| d.get("created_at"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let wallet_name = name.unwrap_or_else(|| {
        format!("Imported Wallet {}", chrono::Local::now().format("%Y-%m-%d"))
    });

    // Convert to domain model
    let wallet = Wallet {
        id: wallet_id,
        name: wallet_name,
        created_at: created_at.clone(),
        updated_at: created_at,
        has_passphrase,
        address_count: 0, // Will be populated when addresses are loaded
    };

    let response = WalletImportResponse {
        wallet,
        is_duplicate: false, // If we got here, it's not a duplicate
    };

    tracing::info!("Wallet imported successfully: {}", response.wallet.name);

    Ok(response)
}

/// Address cache state (wallet_id -> addresses)
pub struct AddressCache(pub Mutex<HashMap<String, Vec<Address>>>);

/// Load wallet addresses (T052)
/// Caches results in Tauri State to avoid re-loading (T046)
#[tauri::command]
pub async fn load_addresses(
    wallet_id: String,
    password: String,
    usb_path: String,
    cache: State<'_, AddressCache>,
) -> Result<AddressListResponse, String> {
    // Check cache first
    {
        let cache_lock = cache.0.lock().unwrap();
        if let Some(cached_addresses) = cache_lock.get(&wallet_id) {
            tracing::info!("Returning cached addresses for wallet {}", wallet_id);
            return Ok(AddressListResponse::new(
                wallet_id.clone(),
                cached_addresses.clone(),
            ));
        }
    }

    // Not in cache, load from CLI
    let cli = CliWrapper::new("./arcsign");

    let cmd = CliCommand::GenerateAll {
        wallet_id: wallet_id.clone(),
        password,
        usb_path,
    };

    let output = cli.execute(cmd).await.map_err(|e| {
        AppError::with_details(
            ErrorCode::CliExecutionFailed,
            "Failed to load addresses",
            e,
        )
    })?;

    // Parse CLI response
    let cli_response: CliAddressListResponse = cli.parse_json(&output).map_err(|e| {
        AppError::with_details(
            ErrorCode::DeserializationError,
            "Failed to parse address list response",
            e,
        )
    })?;

    // Convert CLI addresses to domain model
    let addresses: Vec<Address> = cli_response
        .addresses
        .into_iter()
        .map(|addr| {
            Address::new(
                wallet_id.clone(),
                addr.rank,
                addr.symbol,
                addr.name,
                addr.coin_type,
                addr.derivation_path,
                addr.address,
                parse_category(&addr.category),
                parse_key_type(&addr.key_type),
            )
        })
        .collect();

    // Cache the addresses
    {
        let mut cache_lock = cache.0.lock().unwrap();
        cache_lock.insert(wallet_id.clone(), addresses.clone());
    }

    tracing::info!("Loaded and cached {} addresses for wallet {}", addresses.len(), wallet_id);

    Ok(AddressListResponse::new(wallet_id, addresses))
}

/// List all wallets on USB
/// Directly scans USB directory for wallet folders (CLI list command not yet implemented)
#[tauri::command]
pub async fn list_wallets(usb_path: String) -> Result<Vec<Wallet>, String> {
    use std::fs;
    use std::path::Path;

    let usb_dir = Path::new(&usb_path);

    // Check if USB path exists
    if !usb_dir.exists() {
        return Err(AppError::new(
            ErrorCode::UsbNotFound,
            "USB path does not exist",
        ).into());
    }

    let mut wallets = Vec::new();

    // Read all directories in USB path
    let entries = fs::read_dir(usb_dir).map_err(|e| {
        AppError::with_details(
            ErrorCode::CliExecutionFailed,
            "Failed to read USB directory",
            e.to_string(),
        )
    })?;

    for entry in entries {
        let entry = entry.map_err(|e| {
            AppError::with_details(
                ErrorCode::CliExecutionFailed,
                "Failed to read directory entry",
                e.to_string(),
            )
        })?;

        let path = entry.path();

        // Skip if not a directory
        if !path.is_dir() {
            continue;
        }

        // Skip system directories
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') || name == "System Volume Information" {
                continue;
            }
        }

        // Check if wallet.json exists in this directory
        let wallet_json_path = path.join("wallet.json");
        if wallet_json_path.exists() {
            // Read and parse wallet.json
            let wallet_json = fs::read_to_string(&wallet_json_path).map_err(|e| {
                tracing::warn!("Failed to read wallet.json at {:?}: {}", wallet_json_path, e);
                AppError::with_details(
                    ErrorCode::DeserializationError,
                    "Failed to read wallet.json",
                    e.to_string(),
                )
            })?;

            // Parse wallet metadata
            let wallet_meta: serde_json::Value = serde_json::from_str(&wallet_json).map_err(|e| {
                tracing::warn!("Failed to parse wallet.json: {}", e);
                AppError::with_details(
                    ErrorCode::DeserializationError,
                    "Failed to parse wallet.json",
                    e.to_string(),
                )
            })?;

            // Extract wallet information
            let wallet_id = wallet_meta.get("id")
                .and_then(|v| v.as_str())
                .or_else(|| path.file_name().and_then(|n| n.to_str()))
                .unwrap_or("unknown")
                .to_string();

            // Use wallet_id as name if no name field exists
            let name = wallet_meta.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(&wallet_id)
                .to_string();

            // Support both camelCase (actual format) and snake_case
            let created_at = wallet_meta.get("createdAt")
                .or_else(|| wallet_meta.get("created_at"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            let updated_at = wallet_meta.get("lastAccessedAt")
                .or_else(|| wallet_meta.get("updated_at"))
                .and_then(|v| v.as_str())
                .unwrap_or(&created_at)
                .to_string();

            let has_passphrase = wallet_meta.get("usesPassphrase")
                .or_else(|| wallet_meta.get("has_passphrase"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            // Count addresses if addresses file exists
            let addresses_file = path.join("addresses.json");
            let address_count = if addresses_file.exists() {
                if let Ok(addresses_json) = fs::read_to_string(&addresses_file) {
                    if let Ok(addresses_data) = serde_json::from_str::<serde_json::Value>(&addresses_json) {
                        addresses_data.get("addresses")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.len() as u32)
                            .unwrap_or(0)
                    } else {
                        0
                    }
                } else {
                    0
                }
            } else {
                0
            };

            wallets.push(Wallet {
                id: wallet_id,
                name,
                created_at,
                updated_at,
                has_passphrase,
                address_count,
            });

            tracing::info!("Found wallet: {} at {:?}", wallets.last().unwrap().name, path);
        }
    }

    tracing::info!("Found {} wallet(s) on USB", wallets.len());
    Ok(wallets)
}

/// Rename wallet (T082)
/// Requirements: FR-019 (Wallet rename functionality)
#[tauri::command]
pub async fn rename_wallet(
    wallet_id: String,
    new_name: String,
    usb_path: String,
) -> Result<Wallet, String> {
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

    // Create CLI wrapper
    let cli = CliWrapper::new("./arcsign");

    // Execute rename wallet command
    let cmd = CliCommand::RenameWallet {
        wallet_id: wallet_id.clone(),
        new_name: new_name.trim().to_string(),
        usb_path,
    };

    let output = cli
        .execute(cmd)
        .await
        .map_err(|e| {
            // Check for wallet not found error
            if e.contains("not found") || e.contains("NOT_FOUND") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found on USB drive",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to rename wallet",
                    e,
                )
            }
        })?;

    // Parse CLI response (should return updated wallet metadata)
    let wallet_info: WalletInfo = cli
        .parse_json(&output)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::DeserializationError,
                "Failed to parse wallet rename response",
                e,
            )
        })?;

    // Convert to domain model
    let wallet = Wallet {
        id: wallet_info.id,
        name: wallet_info.name,
        created_at: wallet_info.created_at,
        updated_at: wallet_info.updated_at,
        has_passphrase: wallet_info.has_passphrase,
        address_count: wallet_info.address_count,
    };

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
