/**
 * CLI JSON response types matching Go CLI output
 * Feature: User Dashboard for Wallet Management
 * Task: T033 - Create Rust types matching CLI JSON responses
 */

use serde::{Deserialize, Serialize};

/// CLI error codes (matching internal/cli/errors.go)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CliErrorCode {
    InvalidPassword,
    UsbNotFound,
    WalletExists,
    CryptoError,
    IoError,
    Timeout,
    InvalidSchema,
    InvalidChecksum,
    InvalidMnemonic,
    InsufficientSpace,
}

/// Error object within CliError response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorObject {
    /// Machine-readable error code
    pub code: CliErrorCode,

    /// Human-readable error message (sanitized, no sensitive data)
    pub message: String,
}

/// Successful CLI response structure (matching internal/cli/types.go)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliResponse<T> {
    /// Always true for successful operations
    pub success: bool,

    /// Response data (type varies by command)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,

    /// Wallet object (for create/import/list operations)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wallet: Option<WalletMetadata>,

    /// BIP39 mnemonic (only if RETURN_MNEMONIC=true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mnemonic: Option<String>,

    /// Unique request identifier for tracing
    pub request_id: String,

    /// CLI semantic version
    pub cli_version: String,

    /// Operation duration in milliseconds
    pub duration_ms: u64,

    /// Non-fatal warning messages
    pub warnings: Vec<String>,
}

/// Error CLI response structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliError {
    /// Always false for error responses
    pub success: bool,

    /// Structured error information
    pub error: ErrorObject,

    /// Request identifier for tracing
    pub request_id: String,

    /// CLI version
    pub cli_version: String,

    /// Time elapsed before failure (milliseconds)
    pub duration_ms: u64,
}

/// Wallet metadata (matching internal/wallet/types.go)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletMetadata {
    /// Unique wallet identifier (UUID)
    pub id: String,

    /// User-assigned wallet name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Wallet creation timestamp (RFC3339)
    pub created_at: String,

    /// Whether BIP39 passphrase was used
    pub uses_passphrase: bool,

    /// Relative path to addresses.json file
    pub addresses_file_path: String,
}

/// Address category for filtering
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AddressCategory {
    #[serde(rename = "base")]
    BaseChains,

    #[serde(rename = "layer2")]
    Layer2,

    #[serde(rename = "regional")]
    Regional,

    #[serde(rename = "cosmos")]
    Cosmos,

    #[serde(rename = "alt_evm")]
    AlternativeEvm,

    #[serde(rename = "specialized")]
    Specialized,
}

/// Cryptocurrency address (matching internal/wallet/types.go)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Address {
    /// Full blockchain name
    pub blockchain: String,

    /// Ticker symbol (uppercase)
    pub symbol: String,

    /// SLIP-44 coin type
    pub coin_type: u32,

    /// BIP44 account index
    pub account: u32,

    /// BIP44 change index
    pub change: u32,

    /// BIP44 address index
    pub index: u32,

    /// Derived address string
    pub address: String,

    /// Full derivation path
    pub path: String,

    /// Blockchain category
    pub category: AddressCategory,
}

/// derive_address command response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeriveAddressData {
    pub address: String,
    pub blockchain: String,
    pub symbol: String,
    pub coin_type: u32,
    pub path: String,
}

impl CliError {
    /// Create a generic CLI error from exit code
    pub fn from_exit_code(exit_code: i32) -> Self {
        Self {
            success: false,
            error: ErrorObject {
                code: CliErrorCode::IoError,
                message: format!("Wallet operation failed with exit code {}", exit_code),
            },
            request_id: "unknown".to_string(),
            cli_version: "unknown".to_string(),
            duration_ms: 0,
        }
    }

    /// Create a CLI error from raw stderr message
    pub fn from_stderr(stderr: String) -> Self {
        Self {
            success: false,
            error: ErrorObject {
                code: CliErrorCode::IoError,
                message: stderr.trim().to_string(),
            },
            request_id: "unknown".to_string(),
            cli_version: "unknown".to_string(),
            duration_ms: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deserialize_cli_response() {
        let json = r#"{
            "success": true,
            "data": {
                "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                "blockchain": "Bitcoin",
                "symbol": "BTC",
                "coin_type": 0,
                "path": "m/44'/0'/0'/0/0"
            },
            "request_id": "req-123",
            "cli_version": "0.1.0",
            "duration_ms": 250,
            "warnings": []
        }"#;

        let response: CliResponse<DeriveAddressData> = serde_json::from_str(json).unwrap();
        assert!(response.success);
        assert_eq!(response.request_id, "req-123");
        assert_eq!(response.data.as_ref().unwrap().symbol, "BTC");
    }

    #[test]
    fn test_deserialize_cli_error() {
        let json = r#"{
            "success": false,
            "error": {
                "code": "USB_NOT_FOUND",
                "message": "USB device not detected"
            },
            "request_id": "req-456",
            "cli_version": "0.1.0",
            "duration_ms": 100
        }"#;

        let error: CliError = serde_json::from_str(json).unwrap();
        assert!(!error.success);
        assert_eq!(error.error.code, CliErrorCode::UsbNotFound);
        assert_eq!(error.error.message, "USB device not detected");
    }

    #[test]
    fn test_error_from_exit_code() {
        let error = CliError::from_exit_code(1);
        assert!(!error.success);
        assert_eq!(error.error.code, CliErrorCode::IoError);
        assert!(error.error.message.contains("exit code 1"));
    }

    #[test]
    fn test_error_from_stderr() {
        let error = CliError::from_stderr("  Crypto error occurred  ".to_string());
        assert!(!error.success);
        assert_eq!(error.error.message, "Crypto error occurred");
    }
}
