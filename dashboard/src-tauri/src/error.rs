/**
 * Error types for Tauri application
 * Feature: User Dashboard for Wallet Management
 * Task: T018 - Create error handling types
 * Updated: 2025-10-25 - T053-T054: Added FFI error code mapping
 */

use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::Instant; // T056: Error latency tracking

/// Application error types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    /// Error code for frontend handling
    pub code: ErrorCode,

    /// User-friendly error message (safe to display)
    pub message: String,

    /// Optional details (only for development/logging)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,

    /// T056: Optional timestamp for error latency tracking
    #[serde(skip)]
    pub created_at: Option<Instant>,
}

/// T053: Error code enumeration (enhanced with FFI error codes)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    // USB errors
    UsbNotFound,
    UsbNotWritable,
    UsbInsufficientSpace,

    // Wallet errors
    WalletNotFound,
    WalletAlreadyExists,
    InvalidWalletId,

    // Password errors
    InvalidPassword,
    PasswordTooWeak,
    PasswordMismatch,

    // Mnemonic errors
    InvalidMnemonic,
    InvalidMnemonicChecksum,
    InvalidMnemonicLength,

    // Address errors
    AddressGenerationFailed,
    AddressNotFound,

    // CLI errors (deprecated, kept for backward compatibility)
    CliExecutionFailed,
    CliTimeout,
    CliNotFound,

    // Export errors
    ExportFailed,
    InvalidExportFormat,

    // Security errors
    ScreenshotProtectionFailed,
    MemoryClearFailed,

    // T053: FFI error codes (matching Go error codes)
    FfiInvalidInput,      // INVALID_INPUT from Go
    FfiInvalidBlockchain, // INVALID_BLOCKCHAIN from Go
    FfiStorageError,      // STORAGE_ERROR from Go
    FfiEncryptionError,   // ENCRYPTION_ERROR from Go
    FfiLibraryPanic,      // LIBRARY_PANIC from Go

    // Internal errors
    InternalError,
    SerializationError,
    DeserializationError,
}

impl AppError {
    /// Create new error with code and message
    /// T056: Includes timestamp for latency tracking
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: Self::sanitize_message(message.into()),
            details: None,
            created_at: Some(Instant::now()), // T056: Track error creation time
        }
    }

    /// Create error with additional details (for logging)
    /// T056: Includes timestamp for latency tracking
    pub fn with_details(
        code: ErrorCode,
        message: impl Into<String>,
        details: impl Into<String>,
    ) -> Self {
        Self {
            code,
            message: Self::sanitize_message(message.into()),
            details: Some(details.into()),
            created_at: Some(Instant::now()), // T056: Track error creation time
        }
    }

    /// T056: Get error age (time since error was created)
    pub fn age(&self) -> Option<std::time::Duration> {
        self.created_at.map(|t| t.elapsed())
    }

    /// T056: Log error with latency information
    pub fn log_with_latency(&self, operation: &str) {
        if let Some(age) = self.age() {
            tracing::error!(
                "Error in {}: {} (code: {:?}, latency: {:?})",
                operation,
                self.message,
                self.code,
                age
            );

            // T056: Warn if error took too long to surface (>100ms per FR)
            if age.as_millis() > 100 {
                tracing::warn!(
                    "Error latency exceeded 100ms: {:?} for operation: {}",
                    age,
                    operation
                );
            }
        } else {
            tracing::error!(
                "Error in {}: {} (code: {:?})",
                operation,
                self.message,
                self.code
            );
        }
    }

    /// Sanitize error message to remove sensitive information (SEC-008)
    fn sanitize_message(message: String) -> String {
        // Remove potential file paths
        let sanitized = message
            .lines()
            .map(|line| {
                if line.contains('/') || line.contains('\\') {
                    "Error occurred (path details hidden for security)"
                } else {
                    line
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        // TODO: Add more sanitization rules
        // - Remove potential passwords (anything in quotes after "password")
        // - Remove mnemonic words
        // - Remove wallet IDs

        sanitized
    }

    /// Get user-friendly message for error code
    pub fn default_message_for_code(code: ErrorCode) -> &'static str {
        match code {
            ErrorCode::UsbNotFound => "No USB storage device detected. Please insert a USB drive.",
            ErrorCode::UsbNotWritable => "USB drive is read-only. Please check the write protection.",
            ErrorCode::UsbInsufficientSpace => "USB drive does not have enough free space (minimum 10MB required).",

            ErrorCode::WalletNotFound => "Wallet not found on USB drive.",
            ErrorCode::WalletAlreadyExists => "A wallet with this mnemonic already exists.",
            ErrorCode::InvalidWalletId => "Invalid wallet identifier.",

            ErrorCode::InvalidPassword => "Password does not meet security requirements.",
            ErrorCode::PasswordTooWeak => "Password must be at least 12 characters with uppercase, lowercase, and numbers.",
            ErrorCode::PasswordMismatch => "Passwords do not match.",

            ErrorCode::InvalidMnemonic => "Invalid mnemonic phrase. Please check the words and try again.",
            ErrorCode::InvalidMnemonicChecksum => "Mnemonic checksum validation failed. Please verify the phrase.",
            ErrorCode::InvalidMnemonicLength => "Mnemonic must be 12 or 24 words.",

            ErrorCode::AddressGenerationFailed => "Failed to generate cryptocurrency addresses.",
            ErrorCode::AddressNotFound => "Address not found for the specified blockchain.",

            ErrorCode::CliExecutionFailed => "Wallet operation failed. Please try again.",
            ErrorCode::CliTimeout => "Operation timed out. Please check USB connection and try again.",
            ErrorCode::CliNotFound => "Wallet service not found. Please reinstall the application.",

            ErrorCode::ExportFailed => "Failed to export addresses. Please check USB permissions.",
            ErrorCode::InvalidExportFormat => "Invalid export format. Use JSON or CSV.",

            ErrorCode::ScreenshotProtectionFailed => "Failed to enable screenshot protection.",
            ErrorCode::MemoryClearFailed => "Failed to clear sensitive data from memory.",

            // T053: FFI error code messages (user-friendly)
            ErrorCode::FfiInvalidInput => "Invalid input provided. Please check your data and try again.",
            ErrorCode::FfiInvalidBlockchain => "Unsupported blockchain. Please select a supported cryptocurrency.",
            ErrorCode::FfiStorageError => "Storage device not accessible. Please ensure your USB drive is properly connected.",
            ErrorCode::FfiEncryptionError => "Encryption operation failed. Your data is secure, but the operation could not complete.",
            ErrorCode::FfiLibraryPanic => "An unexpected error occurred in the wallet library. Please restart the application.",

            ErrorCode::InternalError => "An internal error occurred. Please contact support.",
            ErrorCode::SerializationError => "Data serialization error.",
            ErrorCode::DeserializationError => "Data parsing error.",
        }
    }

    /// T054: Map FFI error code string to ErrorCode enum
    pub fn from_ffi_error_code(ffi_code: &str) -> ErrorCode {
        match ffi_code {
            // Input validation errors
            "INVALID_INPUT" => ErrorCode::FfiInvalidInput,
            "INVALID_MNEMONIC" => ErrorCode::InvalidMnemonic,
            "INVALID_PASSWORD" => ErrorCode::InvalidPassword,
            "INVALID_BLOCKCHAIN" => ErrorCode::FfiInvalidBlockchain,

            // Resource errors
            "WALLET_NOT_FOUND" => ErrorCode::WalletNotFound,
            "WALLET_ALREADY_EXISTS" => ErrorCode::WalletAlreadyExists,

            // System errors
            "STORAGE_ERROR" => ErrorCode::FfiStorageError,
            "ENCRYPTION_ERROR" => ErrorCode::FfiEncryptionError,
            "LIBRARY_PANIC" => ErrorCode::FfiLibraryPanic,

            // Default to internal error for unknown codes
            _ => {
                tracing::warn!("Unknown FFI error code: {}", ffi_code);
                ErrorCode::InternalError
            }
        }
    }

    /// T054: Create AppError from FFI error response
    pub fn from_ffi_error(ffi_code: &str, message: String, context: Option<serde_json::Value>) -> Self {
        let code = Self::from_ffi_error_code(ffi_code);

        // Extract hint from context if available
        let details = context.and_then(|ctx| {
            ctx.get("hint")
                .and_then(|h| h.as_str())
                .map(|s| s.to_string())
        });

        if let Some(details_str) = details {
            Self::with_details(code, message, details_str)
        } else {
            Self::new(code, message)
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

/// Convert AppError to String for Tauri IPC
impl From<AppError> for String {
    fn from(error: AppError) -> String {
        // Serialize to JSON for structured error handling in frontend
        serde_json::to_string(&error).unwrap_or_else(|_| error.message.clone())
    }
}

/// Convert std::io::Error to AppError
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::with_details(
            ErrorCode::InternalError,
            "File system operation failed",
            error.to_string(),
        )
    }
}

/// Convert serde_json::Error to AppError
impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        AppError::with_details(
            ErrorCode::DeserializationError,
            "JSON parsing failed",
            error.to_string(),
        )
    }
}

/// Type alias for Result with AppError
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let error = AppError::new(ErrorCode::UsbNotFound, "No USB detected");
        assert_eq!(error.code, ErrorCode::UsbNotFound);
        assert_eq!(error.message, "No USB detected");
        assert!(error.details.is_none());
    }

    #[test]
    fn test_error_with_details() {
        let error = AppError::with_details(
            ErrorCode::CliExecutionFailed,
            "Command failed",
            "Exit code: 1",
        );
        assert_eq!(error.code, ErrorCode::CliExecutionFailed);
        assert_eq!(error.details, Some("Exit code: 1".to_string()));
    }

    #[test]
    fn test_error_sanitizes_paths() {
        let error = AppError::new(
            ErrorCode::InternalError,
            "Failed to read /home/user/secret/wallet.enc",
        );
        assert!(!error.message.contains("/home/user"));
        assert!(error.message.contains("security"));
    }

    #[test]
    fn test_error_serialization() {
        let error = AppError::new(ErrorCode::InvalidPassword, "Password too weak");
        let json = serde_json::to_string(&error).unwrap();

        assert!(json.contains("\"code\":\"INVALID_PASSWORD\""));
        assert!(json.contains("\"message\":\"Password too weak\""));
    }

    #[test]
    fn test_error_to_string_conversion() {
        let error = AppError::new(ErrorCode::WalletNotFound, "Wallet not found");
        let error_string: String = error.into();

        // Should be valid JSON
        let parsed: serde_json::Value = serde_json::from_str(&error_string).unwrap();
        assert!(parsed.is_object());
    }

    #[test]
    fn test_default_messages() {
        let msg = AppError::default_message_for_code(ErrorCode::UsbNotFound);
        assert!(!msg.is_empty());
        assert!(msg.contains("USB"));
    }

    #[test]
    fn test_error_from_io_error() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let app_error: AppError = io_error.into();

        assert_eq!(app_error.code, ErrorCode::InternalError);
        assert!(app_error.details.is_some());
    }

    #[test]
    fn test_error_from_json_error() {
        let json_error = serde_json::from_str::<serde_json::Value>("invalid json")
            .unwrap_err();
        let app_error: AppError = json_error.into();

        assert_eq!(app_error.code, ErrorCode::DeserializationError);
    }
}
