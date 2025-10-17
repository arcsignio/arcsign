/**
 * Wallet domain model
 * Feature: User Dashboard for Wallet Management
 * Task: T031 - Create Wallet model
 * Generated: 2025-10-17
 */

use serde::{Deserialize, Serialize};

/// Hierarchical Deterministic Wallet
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Wallet {
    /// Unique wallet identifier (SHA-256 hash of mnemonic)
    pub id: String,

    /// User-assigned wallet name (1-50 chars)
    pub name: String,

    /// Wallet creation timestamp (ISO 8601)
    pub created_at: String,

    /// Last modification timestamp (ISO 8601)
    pub updated_at: String,

    /// True if BIP39 passphrase (25th word) was used
    pub has_passphrase: bool,

    /// Number of derived addresses (always 54 for v0.3.0)
    pub address_count: u32,
}

/// Wallet creation response (includes mnemonic)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletCreateResponse {
    /// Created wallet metadata
    pub wallet: Wallet,

    /// BIP39 mnemonic phrase (12 or 24 words, space-separated)
    /// SECURITY: Never store in persistent state, only display once
    pub mnemonic: String,
}

/// Wallet import/restore response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletImportResponse {
    /// Imported wallet metadata
    pub wallet: Wallet,

    /// True if wallet with same ID already exists (FR-031)
    pub is_duplicate: bool,
}

impl Wallet {
    /// Create new Wallet instance
    pub fn new(
        id: String,
        name: String,
        created_at: String,
        has_passphrase: bool,
    ) -> Self {
        Self {
            id,
            name,
            created_at: created_at.clone(),
            updated_at: created_at,
            has_passphrase,
            address_count: 54, // Fixed for v0.3.0
        }
    }

    /// Validate wallet ID format (SHA-256 hash, 64 hex chars)
    pub fn validate_id(id: &str) -> bool {
        id.len() == 64 && id.chars().all(|c| c.is_ascii_hexdigit())
    }

    /// Validate wallet name (1-50 chars)
    pub fn validate_name(name: &str) -> bool {
        let trimmed = name.trim();
        !trimmed.is_empty() && trimmed.len() <= 50
    }

    /// Update wallet name
    pub fn rename(&mut self, new_name: String) {
        self.name = new_name;
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wallet_creation() {
        let wallet = Wallet::new(
            "a".repeat(64),
            "Test Wallet".to_string(),
            "2025-10-17T12:00:00Z".to_string(),
            false,
        );

        assert_eq!(wallet.id.len(), 64);
        assert_eq!(wallet.name, "Test Wallet");
        assert!(!wallet.has_passphrase);
        assert_eq!(wallet.address_count, 54);
    }

    #[test]
    fn test_validate_id() {
        // Valid ID (64 hex chars)
        assert!(Wallet::validate_id(&"a".repeat(64)));
        assert!(Wallet::validate_id(&"1234567890abcdef".repeat(4)));

        // Invalid IDs
        assert!(!Wallet::validate_id("short"));
        assert!(!Wallet::validate_id(&"a".repeat(63))); // Too short
        assert!(!Wallet::validate_id(&"a".repeat(65))); // Too long
        assert!(!Wallet::validate_id(&format!("{}g", "a".repeat(63)))); // Invalid char
    }

    #[test]
    fn test_validate_name() {
        // Valid names
        assert!(Wallet::validate_name("Valid Name"));
        assert!(Wallet::validate_name("A"));
        assert!(Wallet::validate_name(&"a".repeat(50)));

        // Invalid names
        assert!(!Wallet::validate_name(""));
        assert!(!Wallet::validate_name("   "));
        assert!(!Wallet::validate_name(&"a".repeat(51))); // Too long
    }

    #[test]
    fn test_wallet_rename() {
        let mut wallet = Wallet::new(
            "a".repeat(64),
            "Old Name".to_string(),
            "2025-10-17T12:00:00Z".to_string(),
            false,
        );

        let old_updated_at = wallet.updated_at.clone();

        wallet.rename("New Name".to_string());

        assert_eq!(wallet.name, "New Name");
        assert_ne!(wallet.updated_at, old_updated_at);
    }

    #[test]
    fn test_wallet_serialization() {
        let wallet = Wallet::new(
            "abc123".repeat(10) + &"abcd".to_string(),
            "Serialize Test".to_string(),
            "2025-10-17T12:00:00Z".to_string(),
            true,
        );

        let json = serde_json::to_string(&wallet).unwrap();
        let deserialized: Wallet = serde_json::from_str(&json).unwrap();

        assert_eq!(wallet, deserialized);
    }

    #[test]
    fn test_wallet_create_response() {
        let wallet = Wallet::new(
            "a".repeat(64),
            "Test".to_string(),
            "2025-10-17T12:00:00Z".to_string(),
            false,
        );

        let response = WalletCreateResponse {
            wallet: wallet.clone(),
            mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about".to_string(),
        };

        assert_eq!(response.wallet, wallet);
        assert_eq!(response.mnemonic.split_whitespace().count(), 12);
    }
}
