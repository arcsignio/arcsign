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

/// Create new HD wallet
#[tauri::command]
pub async fn create_wallet(
    password: String,
    usb_path: String,
    name: Option<String>,
    passphrase: Option<String>,
    mnemonic_length: Option<usize>,
) -> Result<WalletCreateResponse, String> {
    // Validate password
    validate_password(&password).map_err(|e| e.into())?;

    // Validate mnemonic length
    let length = mnemonic_length.unwrap_or(24);
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

    // Execute create wallet command
    let cmd = CliCommand::CreateWallet {
        password,
        usb_path,
        name,
        passphrase,
        mnemonic_length: length,
    };

    let output = cli
        .execute(cmd)
        .await
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::CliExecutionFailed,
                "Failed to create wallet",
                e,
            )
        })?;

    // Parse CLI response
    let cli_response: CliWalletCreateResponse = cli
        .parse_json(&output)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::DeserializationError,
                "Failed to parse wallet creation response",
                e,
            )
        })?;

    // Convert to domain model
    let wallet = Wallet::new(
        cli_response.wallet_id.clone(),
        cli_response.wallet_id.clone(), // Use ID as default name for now
        cli_response.created_at,
        passphrase.is_some(),
    );

    let response = WalletCreateResponse {
        wallet,
        mnemonic: cli_response.mnemonic,
    };

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

/// Import/restore wallet from mnemonic (T067)
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
    validate_password(&password).map_err(|e| e.into())?;

    // Normalize mnemonic (FR-030)
    let normalized_mnemonic = normalize_mnemonic(&mnemonic);

    // Validate mnemonic length
    validate_mnemonic_length(&normalized_mnemonic).map_err(|e| e.into())?;

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

    // Execute restore wallet command
    let cmd = CliCommand::RestoreWallet {
        mnemonic: normalized_mnemonic,
        password,
        usb_path,
        passphrase,
        name,
    };

    let output = cli
        .execute(cmd)
        .await
        .map_err(|e| {
            // Check for duplicate wallet error (FR-031)
            if e.contains("already exists") || e.contains("DUPLICATE") {
                AppError::new(
                    ErrorCode::WalletAlreadyExists,
                    "Wallet with this mnemonic already exists on USB",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to import wallet",
                    e,
                )
            }
        })?;

    // Parse CLI response
    let cli_response: CliWalletImportResponse = cli
        .parse_json(&output)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::DeserializationError,
                "Failed to parse wallet import response",
                e,
            )
        })?;

    // Convert to domain model
    let wallet = Wallet::new(
        cli_response.wallet_id.clone(),
        cli_response.wallet_id.clone(), // Use ID as default name for now
        cli_response.created_at,
        passphrase.is_some(),
    );

    let response = WalletImportResponse {
        wallet,
        is_duplicate: cli_response.is_duplicate,
    };

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
#[tauri::command]
pub async fn list_wallets(usb_path: String) -> Result<Vec<Wallet>, String> {
    let cli = CliWrapper::new("./arcsign");

    let cmd = CliCommand::ListWallets {
        usb_path,
    };

    let output = cli.execute(cmd).await.map_err(|e| {
        AppError::with_details(
            ErrorCode::CliExecutionFailed,
            "Failed to list wallets",
            e,
        )
    })?;

    // Parse CLI response
    let cli_response: WalletListResponse = cli.parse_json(&output).map_err(|e| {
        AppError::with_details(
            ErrorCode::DeserializationError,
            "Failed to parse wallet list response",
            e,
        )
    })?;

    // Convert to domain model
    let wallets: Vec<Wallet> = cli_response
        .wallets
        .into_iter()
        .map(|info| Wallet {
            id: info.id,
            name: info.name,
            created_at: info.created_at,
            updated_at: info.updated_at,
            has_passphrase: info.has_passphrase,
            address_count: info.address_count,
        })
        .collect();

    Ok(wallets)
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
