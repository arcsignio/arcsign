/**
 * Export commands
 * Feature: User Dashboard for Wallet Management
 * Tasks: T088-T089 - Implement export_addresses with JSON/CSV formatting
 * Generated: 2025-10-17
 */

use crate::cli::wrapper::{CliCommand, CliWrapper, AddressListResponse as CliAddressListResponse};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::models::address::Address;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Export format options
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Json,
    Csv,
}

/// Export response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResponse {
    /// Path to exported file on USB
    pub file_path: String,

    /// Number of addresses exported
    pub address_count: usize,

    /// Export format used
    pub format: ExportFormat,

    /// Timestamp of export
    pub exported_at: String,
}

/// JSON export structure (FR-021)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonExport {
    wallet_id: String,
    exported_at: String,
    address_count: usize,
    addresses: Vec<JsonAddress>,
}

/// JSON address record
#[derive(Debug, Clone, Serialize, Deserialize)]
struct JsonAddress {
    rank: u32,
    symbol: String,
    name: String,
    category: String,
    coin_type: u32,
    key_type: String,
    derivation_path: String,
    address: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_testnet: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// Export addresses to JSON or CSV (T088, T089)
/// Requirements: FR-021 (Export functionality), SC-008 (Performance <5s), TC-010 (Permissions)
#[tauri::command]
pub async fn export_addresses(
    wallet_id: String,
    password: String,
    usb_path: String,
    format: ExportFormat,
) -> Result<ExportResponse, String> {
    // Create CLI wrapper
    let cli = CliWrapper::new("./arcsign");

    // Load addresses using generate-all command
    let cmd = CliCommand::GenerateAll {
        wallet_id: wallet_id.clone(),
        password,
        usb_path: usb_path.clone(),
    };

    let output = cli
        .execute(cmd)
        .await
        .map_err(|e| {
            if e.contains("not found") || e.contains("NOT_FOUND") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found on USB drive",
                )
            } else if e.contains("password") || e.contains("PASSWORD") {
                AppError::new(
                    ErrorCode::InvalidPassword,
                    "Invalid password",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to load addresses for export",
                    e,
                )
            }
        })?;

    // Parse CLI response
    let cli_response: CliAddressListResponse = cli
        .parse_json(&output)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::DeserializationError,
                "Failed to parse address list",
                e,
            )
        })?;

    // Generate timestamp for filename
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let exported_at = chrono::Utc::now().to_rfc3339();

    // Create export directory: {usb_path}/{wallet_id}/addresses/
    let export_dir = PathBuf::from(&usb_path)
        .join(&wallet_id)
        .join("addresses");

    std::fs::create_dir_all(&export_dir)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::ExportFailed,
                "Failed to create export directory",
                e.to_string(),
            )
        })?;

    // Generate file path and content based on format
    let (file_path, file_content) = match format {
        ExportFormat::Json => {
            let filename = format!("addresses-{}.json", timestamp);
            let path = export_dir.join(&filename);
            let content = generate_json_export(&wallet_id, &cli_response, &exported_at)?;
            (path, content)
        }
        ExportFormat::Csv => {
            let filename = format!("addresses-{}.csv", timestamp);
            let path = export_dir.join(&filename);
            let content = generate_csv_export(&cli_response)?;
            (path, content)
        }
    };

    // Write file
    std::fs::write(&file_path, file_content)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::ExportFailed,
                "Failed to write export file",
                e.to_string(),
            )
        })?;

    // Set file permissions to 0600 (TC-010)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let permissions = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&file_path, permissions)
            .map_err(|e| {
                AppError::with_details(
                    ErrorCode::ExportFailed,
                    "Failed to set file permissions",
                    e.to_string(),
                )
            })?;
    }

    let response = ExportResponse {
        file_path: file_path.to_string_lossy().to_string(),
        address_count: cli_response.addresses.len(),
        format,
        exported_at,
    };

    Ok(response)
}

/// Generate JSON export content (T089)
fn generate_json_export(
    wallet_id: &str,
    cli_response: &CliAddressListResponse,
    exported_at: &str,
) -> Result<String, String> {
    let json_addresses: Vec<JsonAddress> = cli_response
        .addresses
        .iter()
        .map(|addr| JsonAddress {
            rank: addr.rank,
            symbol: addr.symbol.clone(),
            name: addr.name.clone(),
            category: addr.category.clone(),
            coin_type: addr.coin_type,
            key_type: addr.key_type.clone(),
            derivation_path: addr.derivation_path.clone(),
            address: addr.address.clone(),
            is_testnet: None, // TODO: Add if available in CLI response
            error: None,      // TODO: Add if error tracking is implemented
        })
        .collect();

    let export = JsonExport {
        wallet_id: wallet_id.to_string(),
        exported_at: exported_at.to_string(),
        address_count: json_addresses.len(),
        addresses: json_addresses,
    };

    serde_json::to_string_pretty(&export)
        .map_err(|e| {
            AppError::with_details(
                ErrorCode::SerializationError,
                "Failed to serialize JSON export",
                e.to_string(),
            )
            .into()
        })
}

/// Generate CSV export content (T089)
fn generate_csv_export(cli_response: &CliAddressListResponse) -> Result<String, String> {
    let mut csv = String::new();

    // CSV Header (FR-021)
    csv.push_str("Rank,Symbol,Name,Category,Coin Type,Key Type,Derivation Path,Address,Error\n");

    // CSV Data rows
    for addr in &cli_response.addresses {
        // Escape fields that might contain commas or quotes
        let name = escape_csv_field(&addr.name);
        let derivation_path = escape_csv_field(&addr.derivation_path);
        let address = escape_csv_field(&addr.address);

        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{},\n",
            addr.rank,
            addr.symbol,
            name,
            addr.category,
            addr.coin_type,
            addr.key_type,
            derivation_path,
            address,
            // Error column (empty for now, TODO: add error tracking)
        ));
    }

    Ok(csv)
}

/// Escape CSV field (wrap in quotes if contains comma, newline, or quote)
fn escape_csv_field(field: &str) -> String {
    if field.contains(',') || field.contains('\n') || field.contains('"') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_csv_field_simple() {
        assert_eq!(escape_csv_field("simple"), "simple");
    }

    #[test]
    fn test_escape_csv_field_with_comma() {
        assert_eq!(escape_csv_field("hello, world"), "\"hello, world\"");
    }

    #[test]
    fn test_escape_csv_field_with_quotes() {
        assert_eq!(escape_csv_field("say \"hello\""), "\"say \"\"hello\"\"\"");
    }

    #[test]
    fn test_escape_csv_field_with_newline() {
        assert_eq!(escape_csv_field("line1\nline2"), "\"line1\nline2\"");
    }
}
