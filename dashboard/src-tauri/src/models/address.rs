/**
 * Address domain model
 * Feature: User Dashboard for Wallet Management
 * Task: T051 - Create Address model
 * Generated: 2025-10-17
 */

use serde::{Deserialize, Serialize};

/// Blockchain category classification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Base,
    Layer2,
    Regional,
    Cosmos,
    #[serde(rename = "alt_evm")]
    AltEvm,
    Specialized,
}

/// Cryptographic key type for address derivation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum KeyType {
    Secp256k1,
    Ed25519,
    Sr25519,
    Schnorr,
}

/// Derived cryptocurrency address for a specific blockchain
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Address {
    /// Parent wallet identifier
    pub wallet_id: String,

    /// Display order (1-54)
    pub rank: u32,

    /// Blockchain symbol (e.g., "BTC", "ETH")
    pub symbol: String,

    /// Human-readable blockchain name
    pub name: String,

    /// SLIP-44 coin type
    pub coin_type: u32,

    /// BIP44 derivation path
    pub derivation_path: String,

    /// Derived public address
    pub address: String,

    /// Blockchain category
    pub category: Category,

    /// Cryptographic key type
    pub key_type: KeyType,

    /// Optional testnet indicator
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_testnet: Option<bool>,
}

/// Response from load_addresses command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressListResponse {
    /// Wallet identifier
    pub wallet_id: String,

    /// Array of all 54 blockchain addresses
    pub addresses: Vec<Address>,

    /// Total address count (always 54 for v0.3.0)
    pub total_count: u32,
}

impl Address {
    /// Create new Address instance
    pub fn new(
        wallet_id: String,
        rank: u32,
        symbol: String,
        name: String,
        coin_type: u32,
        derivation_path: String,
        address: String,
        category: Category,
        key_type: KeyType,
    ) -> Self {
        Self {
            wallet_id,
            rank,
            symbol,
            name,
            coin_type,
            derivation_path,
            address,
            category,
            key_type,
            is_testnet: None,
        }
    }

    /// Set testnet flag
    pub fn with_testnet(mut self, is_testnet: bool) -> Self {
        self.is_testnet = Some(is_testnet);
        self
    }
}

impl AddressListResponse {
    /// Create new address list response
    pub fn new(wallet_id: String, addresses: Vec<Address>) -> Self {
        let total_count = addresses.len() as u32;
        Self {
            wallet_id,
            addresses,
            total_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_address_creation() {
        let address = Address::new(
            "wallet-1".to_string(),
            1,
            "BTC".to_string(),
            "Bitcoin".to_string(),
            0,
            "m/44'/0'/0'/0/0".to_string(),
            "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa".to_string(),
            Category::Base,
            KeyType::Secp256k1,
        );

        assert_eq!(address.wallet_id, "wallet-1");
        assert_eq!(address.rank, 1);
        assert_eq!(address.symbol, "BTC");
        assert_eq!(address.category, Category::Base);
        assert_eq!(address.key_type, KeyType::Secp256k1);
    }

    #[test]
    fn test_address_with_testnet() {
        let address = Address::new(
            "wallet-1".to_string(),
            1,
            "BTC".to_string(),
            "Bitcoin".to_string(),
            0,
            "m/44'/0'/0'/0/0".to_string(),
            "address".to_string(),
            Category::Base,
            KeyType::Secp256k1,
        )
        .with_testnet(true);

        assert_eq!(address.is_testnet, Some(true));
    }

    #[test]
    fn test_category_serialization() {
        let category = Category::Base;
        let json = serde_json::to_string(&category).unwrap();
        assert_eq!(json, "\"base\"");

        let category = Category::AltEvm;
        let json = serde_json::to_string(&category).unwrap();
        assert_eq!(json, "\"alt_evm\"");
    }

    #[test]
    fn test_key_type_serialization() {
        let key_type = KeyType::Secp256k1;
        let json = serde_json::to_string(&key_type).unwrap();
        assert_eq!(json, "\"secp256k1\"");

        let key_type = KeyType::Ed25519;
        let json = serde_json::to_string(&key_type).unwrap();
        assert_eq!(json, "\"ed25519\"");
    }

    #[test]
    fn test_address_list_response() {
        let addresses = vec![
            Address::new(
                "wallet-1".to_string(),
                1,
                "BTC".to_string(),
                "Bitcoin".to_string(),
                0,
                "m/44'/0'/0'/0/0".to_string(),
                "address1".to_string(),
                Category::Base,
                KeyType::Secp256k1,
            ),
            Address::new(
                "wallet-1".to_string(),
                2,
                "ETH".to_string(),
                "Ethereum".to_string(),
                60,
                "m/44'/60'/0'/0/0".to_string(),
                "address2".to_string(),
                Category::Base,
                KeyType::Secp256k1,
            ),
        ];

        let response = AddressListResponse::new("wallet-1".to_string(), addresses);

        assert_eq!(response.wallet_id, "wallet-1");
        assert_eq!(response.addresses.len(), 2);
        assert_eq!(response.total_count, 2);
    }
}
