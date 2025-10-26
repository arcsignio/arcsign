//! FFI type definitions for data exchange between Rust and Go.
//!
//! All complex data is serialized as JSON strings across the FFI boundary.
//! These types mirror the Go FFIResponse and FFIError structures.
//!
//! Feature: 005-go-cli-shared
//! Created: 2025-10-25

use serde::{Deserialize, Serialize};

/// Standard response envelope for all FFI functions
#[derive(Debug, Deserialize)]
pub struct FFIResponse<T> {
    pub success: bool,
    #[serde(default)]
    pub data: Option<T>,
    #[serde(default)]
    pub error: Option<FFIError>,
}

/// Structured error from FFI functions
#[derive(Debug, Deserialize, Clone)]
pub struct FFIError {
    pub code: String,
    pub message: String,
}

/// Error codes matching Go ErrorCode constants
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErrorCode {
    InvalidInput,
    InvalidMnemonic,
    InvalidPassword,
    InvalidBlockchain,
    WalletNotFound,
    WalletAlreadyExists,
    StorageError,
    EncryptionError,
    LibraryPanic,
    Unknown(String),
}

impl From<String> for ErrorCode {
    fn from(s: String) -> Self {
        match s.as_str() {
            "INVALID_INPUT" => ErrorCode::InvalidInput,
            "INVALID_MNEMONIC" => ErrorCode::InvalidMnemonic,
            "INVALID_PASSWORD" => ErrorCode::InvalidPassword,
            "INVALID_BLOCKCHAIN" => ErrorCode::InvalidBlockchain,
            "WALLET_NOT_FOUND" => ErrorCode::WalletNotFound,
            "WALLET_ALREADY_EXISTS" => ErrorCode::WalletAlreadyExists,
            "STORAGE_ERROR" => ErrorCode::StorageError,
            "ENCRYPTION_ERROR" => ErrorCode::EncryptionError,
            "LIBRARY_PANIC" => ErrorCode::LibraryPanic,
            _ => ErrorCode::Unknown(s),
        }
    }
}
