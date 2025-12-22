/**
 * Membership verification commands
 * Feature: ArcSign Pro NFT membership verification on BSC
 *
 * This module queries the BSC blockchain directly via JSON-RPC
 * to check if a user holds a valid ArcSign Pro NFT.
 */

use serde::{Deserialize, Serialize};

use crate::error::Error;

/// BSC Mainnet RPC endpoint
const BSC_RPC_URL: &str = "https://bsc-dataseed.binance.org/";

/// ArcSign Pro NFT contract address (update after deployment)
/// This is a placeholder - will be updated with actual deployed address
const ARCSIGN_PRO_CONTRACT: &str = "0x0000000000000000000000000000000000000000";

/// Membership status response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MembershipStatus {
    /// Whether the user is a valid Pro member
    pub is_pro: bool,
    /// Number of NFTs owned
    pub nft_count: u64,
    /// Token IDs owned (if any)
    pub token_ids: Vec<u64>,
    /// Expiration timestamps for each token (Unix timestamp)
    pub expirations: Vec<u64>,
    /// Days until earliest expiration (0 if expired or no NFT)
    pub days_remaining: u64,
    /// Wallet limits based on membership
    pub wallet_limit: Option<u64>,
}

/// Check membership input
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckMembershipInput {
    /// BSC wallet address to check
    pub address: String,
}

/// JSON-RPC request structure
#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    method: &'static str,
    params: Vec<serde_json::Value>,
    id: u64,
}

/// JSON-RPC response structure
#[derive(Debug, Deserialize)]
struct JsonRpcResponse {
    result: Option<String>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    message: String,
}

/// Encode address for contract call (pad to 32 bytes)
fn encode_address(address: &str) -> String {
    let addr = address.trim_start_matches("0x").to_lowercase();
    format!("{:0>64}", addr)
}

/// Create eth_call request for isValidMember(address)
fn create_is_valid_member_call(contract: &str, address: &str) -> serde_json::Value {
    // Function selector for isValidMember(address): 0x9e3a7a77
    // keccak256("isValidMember(address)")[:4]
    let selector = "9e3a7a77";
    let encoded_addr = encode_address(address);
    let data = format!("0x{}{}", selector, encoded_addr);

    serde_json::json!({
        "to": contract,
        "data": data
    })
}

/// Create eth_call request for balanceOf(address)
fn create_balance_of_call(contract: &str, address: &str) -> serde_json::Value {
    // Function selector for balanceOf(address): 0x70a08231
    let selector = "70a08231";
    let encoded_addr = encode_address(address);
    let data = format!("0x{}{}", selector, encoded_addr);

    serde_json::json!({
        "to": contract,
        "data": data
    })
}

/// Create eth_call request for getMemberships(address)
/// Returns (uint256[] tokenIds, uint256[] expirations, bool[] valid)
fn create_get_memberships_call(contract: &str, address: &str) -> serde_json::Value {
    // Function selector for getMemberships(address): calculate keccak256
    // getMemberships(address) => 0x29a8e2cf (approximation, needs verification)
    let selector = "29a8e2cf";
    let encoded_addr = encode_address(address);
    let data = format!("0x{}{}", selector, encoded_addr);

    serde_json::json!({
        "to": contract,
        "data": data
    })
}

/// Parse boolean result from eth_call
fn parse_bool_result(hex: &str) -> bool {
    let hex = hex.trim_start_matches("0x");
    if hex.is_empty() {
        return false;
    }
    // Boolean is encoded as 32 bytes, last byte is 0 or 1
    u64::from_str_radix(&hex[hex.len().saturating_sub(2)..], 16).unwrap_or(0) == 1
}

/// Parse uint256 result from eth_call
fn parse_uint256_result(hex: &str) -> u64 {
    let hex = hex.trim_start_matches("0x");
    if hex.is_empty() {
        return 0;
    }
    // Take last 16 chars (64 bits) to fit in u64
    let len = hex.len();
    let start = if len > 16 { len - 16 } else { 0 };
    u64::from_str_radix(&hex[start..], 16).unwrap_or(0)
}

/// Check if address is a valid Pro member (Tauri command)
#[tauri::command]
pub async fn check_membership(
    input: CheckMembershipInput,
) -> Result<MembershipStatus, Error> {
    tracing::info!("check_membership: address={}", input.address);

    // Validate address format
    if !input.address.starts_with("0x") || input.address.len() != 42 {
        return Err(Error::new(
            crate::error::ErrorCode::InvalidInput,
            "Invalid BSC address format".to_string(),
        ));
    }

    // If contract is not deployed yet (placeholder address), return free tier
    if ARCSIGN_PRO_CONTRACT == "0x0000000000000000000000000000000000000000" {
        tracing::warn!("NFT contract not deployed yet, returning free tier status");
        return Ok(MembershipStatus {
            is_pro: false,
            nft_count: 0,
            token_ids: vec![],
            expirations: vec![],
            days_remaining: 0,
            wallet_limit: Some(5), // Free tier: 5 wallets
        });
    }

    // Create HTTP client
    let client = reqwest::Client::new();

    // Call isValidMember(address)
    let is_valid_request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            create_is_valid_member_call(ARCSIGN_PRO_CONTRACT, &input.address),
            serde_json::json!("latest"),
        ],
        id: 1,
    };

    let response = client
        .post(BSC_RPC_URL)
        .json(&is_valid_request)
        .send()
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::NetworkError,
            format!("Failed to query BSC: {}", e),
        ))?;

    let rpc_response: JsonRpcResponse = response
        .json()
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::SerializationError,
            format!("Failed to parse RPC response: {}", e),
        ))?;

    if let Some(error) = rpc_response.error {
        return Err(Error::new(
            crate::error::ErrorCode::ContractError,
            format!("Contract call failed: {}", error.message),
        ));
    }

    let is_pro = rpc_response
        .result
        .map(|r| parse_bool_result(&r))
        .unwrap_or(false);

    // Call balanceOf(address) to get NFT count
    let balance_request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            create_balance_of_call(ARCSIGN_PRO_CONTRACT, &input.address),
            serde_json::json!("latest"),
        ],
        id: 2,
    };

    let balance_response = client
        .post(BSC_RPC_URL)
        .json(&balance_request)
        .send()
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::NetworkError,
            format!("Failed to query NFT balance: {}", e),
        ))?;

    let balance_rpc: JsonRpcResponse = balance_response
        .json()
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::SerializationError,
            format!("Failed to parse balance response: {}", e),
        ))?;

    let nft_count = balance_rpc
        .result
        .map(|r| parse_uint256_result(&r))
        .unwrap_or(0);

    // For now, we'll use simplified logic
    // In production, we'd call getMemberships to get full details
    let (token_ids, expirations, days_remaining) = if is_pro && nft_count > 0 {
        // Placeholder: would need to call getMemberships for real data
        (vec![], vec![], 365u64)
    } else {
        (vec![], vec![], 0u64)
    };

    Ok(MembershipStatus {
        is_pro,
        nft_count,
        token_ids,
        expirations,
        days_remaining,
        wallet_limit: if is_pro { None } else { Some(5) }, // Pro: unlimited, Free: 5
    })
}

/// Get membership tier name
#[tauri::command]
pub fn get_membership_tier(is_pro: bool) -> String {
    if is_pro {
        "Pro".to_string()
    } else {
        "Free".to_string()
    }
}

/// Check if wallet creation is allowed based on membership
#[tauri::command]
pub fn can_create_wallet(current_wallet_count: u64, is_pro: bool) -> bool {
    if is_pro {
        true // Pro members: unlimited wallets
    } else {
        current_wallet_count < 5 // Free tier: max 5 wallets
    }
}

/// Get wallet limit for membership tier
#[tauri::command]
pub fn get_wallet_limit(is_pro: bool) -> Option<u64> {
    if is_pro {
        None // Unlimited
    } else {
        Some(5) // Free tier limit
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_address() {
        let addr = "0x1234567890abcdef1234567890abcdef12345678";
        let encoded = encode_address(addr);
        assert_eq!(encoded.len(), 64);
        assert!(encoded.ends_with("1234567890abcdef1234567890abcdef12345678"));
    }

    #[test]
    fn test_parse_bool_result() {
        assert!(parse_bool_result("0x0000000000000000000000000000000000000000000000000000000000000001"));
        assert!(!parse_bool_result("0x0000000000000000000000000000000000000000000000000000000000000000"));
    }

    #[test]
    fn test_parse_uint256_result() {
        assert_eq!(parse_uint256_result("0x0000000000000000000000000000000000000000000000000000000000000005"), 5);
        assert_eq!(parse_uint256_result("0x0000000000000000000000000000000000000000000000000000000000000000"), 0);
    }

    #[test]
    fn test_can_create_wallet() {
        // Pro: always allowed
        assert!(can_create_wallet(0, true));
        assert!(can_create_wallet(100, true));

        // Free: max 5
        assert!(can_create_wallet(0, false));
        assert!(can_create_wallet(4, false));
        assert!(!can_create_wallet(5, false));
        assert!(!can_create_wallet(10, false));
    }

    #[test]
    fn test_get_wallet_limit() {
        assert_eq!(get_wallet_limit(true), None);
        assert_eq!(get_wallet_limit(false), Some(5));
    }
}
