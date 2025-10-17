/**
 * Common test utilities for Rust backend tests
 * Feature: User Dashboard for Wallet Management
 * Generated: 2025-10-17
 */

use std::path::PathBuf;
use tempfile::TempDir;

/// Test USB directory wrapper
/// Automatically cleans up on drop
pub struct TestUsb {
    pub temp_dir: TempDir,
    pub path: PathBuf,
}

impl TestUsb {
    /// Create a new temporary USB directory for testing
    pub fn new() -> Self {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let path = temp_dir.path().to_path_buf();

        Self { temp_dir, path }
    }

    /// Get USB path as string
    pub fn path_str(&self) -> &str {
        self.path.to_str().expect("Invalid UTF-8 in path")
    }

    /// Create subdirectories for wallet storage
    pub fn setup_wallet_structure(&self) -> std::io::Result<()> {
        std::fs::create_dir_all(self.path.join("wallets"))?;
        std::fs::create_dir_all(self.path.join("exports"))?;
        Ok(())
    }
}

/// Test wallet configuration
pub struct TestWallet {
    pub password: String,
    pub name: Option<String>,
    pub passphrase: Option<String>,
    pub mnemonic_length: Option<usize>,
}

impl TestWallet {
    /// Create default test wallet config
    pub fn new() -> Self {
        Self {
            password: "TestPassword123!".to_string(),
            name: None,
            passphrase: None,
            mnemonic_length: Some(24),
        }
    }

    /// Create test wallet with custom password
    pub fn with_password(password: &str) -> Self {
        Self {
            password: password.to_string(),
            name: None,
            passphrase: None,
            mnemonic_length: Some(24),
        }
    }

    /// Add wallet name
    pub fn with_name(mut self, name: &str) -> Self {
        self.name = Some(name.to_string());
        self
    }

    /// Add BIP39 passphrase
    pub fn with_passphrase(mut self, passphrase: &str) -> Self {
        self.passphrase = Some(passphrase.to_string());
        self
    }

    /// Set mnemonic length (12 or 24)
    pub fn with_mnemonic_length(mut self, length: usize) -> Self {
        self.mnemonic_length = Some(length);
        self
    }
}

impl Default for TestWallet {
    fn default() -> Self {
        Self::new()
    }
}

/// Known test mnemonic for deterministic testing
pub const TEST_MNEMONIC_24: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

pub const TEST_MNEMONIC_12: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

/// Assert wallet ID format (SHA-256 hash, 64 hex chars)
pub fn assert_valid_wallet_id(wallet_id: &str) {
    assert_eq!(wallet_id.len(), 64, "Wallet ID should be 64 characters (SHA-256)");
    assert!(wallet_id.chars().all(|c| c.is_ascii_hexdigit()), "Wallet ID should be hexadecimal");
}

/// Assert mnemonic format (12 or 24 words, space-separated)
pub fn assert_valid_mnemonic(mnemonic: &str) {
    let words: Vec<&str> = mnemonic.split_whitespace().collect();
    assert!(
        words.len() == 12 || words.len() == 24,
        "Mnemonic should have 12 or 24 words, got {}",
        words.len()
    );

    // Each word should be lowercase alphabetic
    for word in words {
        assert!(word.chars().all(|c| c.is_ascii_lowercase()), "Mnemonic word should be lowercase: {}", word);
    }
}

/// Assert timestamp format (ISO 8601)
pub fn assert_valid_timestamp(timestamp: &str) {
    // Basic check: should contain 'T' and end with 'Z' or timezone offset
    assert!(
        timestamp.contains('T') && (timestamp.ends_with('Z') || timestamp.contains('+') || timestamp.contains('-')),
        "Timestamp should be ISO 8601 format: {}",
        timestamp
    );
}

/// Wait for async operation with timeout
#[cfg(test)]
pub async fn wait_for_condition<F>(mut condition: F, timeout_secs: u64) -> bool
where
    F: FnMut() -> bool,
{
    use tokio::time::{sleep, Duration};

    let start = std::time::Instant::now();
    while start.elapsed().as_secs() < timeout_secs {
        if condition() {
            return true;
        }
        sleep(Duration::from_millis(100)).await;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_test_usb_creation() {
        let usb = TestUsb::new();
        assert!(usb.path.exists());
        assert!(!usb.path_str().is_empty());
    }

    #[test]
    fn test_test_wallet_builder() {
        let wallet = TestWallet::new()
            .with_name("Test Wallet")
            .with_passphrase("secret")
            .with_mnemonic_length(12);

        assert_eq!(wallet.password, "TestPassword123!");
        assert_eq!(wallet.name, Some("Test Wallet".to_string()));
        assert_eq!(wallet.passphrase, Some("secret".to_string()));
        assert_eq!(wallet.mnemonic_length, Some(12));
    }

    #[test]
    fn test_valid_wallet_id_assertion() {
        let valid_id = "a".repeat(64);
        assert_valid_wallet_id(&valid_id);
    }

    #[test]
    #[should_panic(expected = "Wallet ID should be 64 characters")]
    fn test_invalid_wallet_id_length() {
        assert_valid_wallet_id("short");
    }

    #[test]
    fn test_valid_mnemonic_assertion() {
        assert_valid_mnemonic(TEST_MNEMONIC_24);
        assert_valid_mnemonic(TEST_MNEMONIC_12);
    }

    #[test]
    #[should_panic(expected = "Mnemonic should have 12 or 24 words")]
    fn test_invalid_mnemonic_word_count() {
        assert_valid_mnemonic("word1 word2 word3");
    }

    #[test]
    fn test_valid_timestamp_assertion() {
        assert_valid_timestamp("2025-10-17T12:34:56Z");
        assert_valid_timestamp("2025-10-17T12:34:56+00:00");
    }

    #[test]
    #[should_panic(expected = "Timestamp should be ISO 8601 format")]
    fn test_invalid_timestamp() {
        assert_valid_timestamp("not-a-timestamp");
    }
}
