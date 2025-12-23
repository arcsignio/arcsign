/**
 * Membership verification commands
 * Feature: ArcSign Pro NFT membership verification on BSC
 *
 * This module queries the BSC blockchain directly via JSON-RPC
 * to check if a user holds a valid ArcSign Pro NFT.
 */

use serde::{Deserialize, Serialize};

use crate::error::Error;

/// BSC Testnet RPC endpoint (for development)
const BSC_TESTNET_RPC_URL: &str = "https://bsc-testnet-rpc.publicnode.com";

/// BSC Mainnet RPC endpoint (for production)
const BSC_MAINNET_RPC_URL: &str = "https://bsc-dataseed.binance.org/";

/// Use testnet for now (switch to mainnet after NFT contract is deployed on mainnet)
const BSC_RPC_URL: &str = BSC_TESTNET_RPC_URL;

/// ArcSign Pro NFT contract address on BSC Testnet
/// Deployed: 2025-12-22
const ARCSIGN_PRO_CONTRACT: &str = "0x6CB59d29BE5b618eeca9Bc5374648477256f109A";

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

    tracing::info!("Checking membership on contract: {}", ARCSIGN_PRO_CONTRACT);

    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| Error::new(
            crate::error::ErrorCode::NetworkError,
            format!("Failed to create HTTP client: {}", e),
        ))?;

    // Call balanceOf(address) to check NFT ownership
    // This is simpler and more reliable than isValidMember
    let balance_request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            create_balance_of_call(ARCSIGN_PRO_CONTRACT, &input.address),
            serde_json::json!("latest"),
        ],
        id: 1,
    };

    tracing::info!("Sending balanceOf request to {}", BSC_RPC_URL);

    let response = client
        .post(BSC_RPC_URL)
        .json(&balance_request)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("RPC request failed: {}", e);
            Error::new(
                crate::error::ErrorCode::NetworkError,
                format!("Failed to query BSC testnet: {}", e),
            )
        })?;

    tracing::info!("RPC response status: {}", response.status());

    let rpc_response: JsonRpcResponse = response
        .json()
        .await
        .map_err(|e| {
            tracing::error!("Failed to parse RPC response: {}", e);
            Error::new(
                crate::error::ErrorCode::SerializationError,
                format!("Failed to parse RPC response: {}", e),
            )
        })?;

    tracing::info!("RPC response: result={:?}, error={:?}", rpc_response.result, rpc_response.error);

    if let Some(error) = rpc_response.error {
        tracing::error!("Contract call failed: {}", error.message);
        return Err(Error::new(
            crate::error::ErrorCode::ContractError,
            format!("Contract call failed: {}", error.message),
        ));
    }

    // Parse NFT balance
    let nft_count = rpc_response
        .result
        .as_ref()
        .map(|r| parse_uint256_result(r))
        .unwrap_or(0);

    tracing::info!("NFT balance for {}: {}", input.address, nft_count);

    // User is Pro if they own at least 1 NFT
    let is_pro = nft_count > 0;

    // For now, we'll use simplified logic
    // In production, we'd call getMemberships to get full details
    let days_remaining = if is_pro { 365u64 } else { 0u64 };

    tracing::info!("Membership check complete: is_pro={}, nft_count={}", is_pro, nft_count);

    // Calculate wallet limit based on NFT count
    // Free: 5 wallets
    // Pro: 5 + (nft_count * 5) wallets per NFT
    // e.g., 1 NFT = 10 wallets, 2 NFTs = 15 wallets
    let wallet_limit = 5 + (nft_count * 5);

    Ok(MembershipStatus {
        is_pro,
        nft_count,
        token_ids: vec![],
        expirations: vec![],
        days_remaining,
        wallet_limit: Some(wallet_limit), // Always has a limit now
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
/// Now uses nft_count to calculate limit: 5 + (nft_count * 5)
#[tauri::command]
pub fn can_create_wallet(current_wallet_count: u64, nft_count: u64) -> bool {
    let limit = 5 + (nft_count * 5);
    current_wallet_count < limit
}

/// Get wallet limit based on NFT count
/// Formula: 5 + (nft_count * 5)
#[tauri::command]
pub fn get_wallet_limit(nft_count: u64) -> u64 {
    5 + (nft_count * 5)
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
        // Free (0 NFTs): max 5
        assert!(can_create_wallet(0, 0));
        assert!(can_create_wallet(4, 0));
        assert!(!can_create_wallet(5, 0));
        assert!(!can_create_wallet(10, 0));

        // 1 NFT: max 10 (5 + 5)
        assert!(can_create_wallet(0, 1));
        assert!(can_create_wallet(9, 1));
        assert!(!can_create_wallet(10, 1));

        // 2 NFTs: max 15 (5 + 10)
        assert!(can_create_wallet(14, 2));
        assert!(!can_create_wallet(15, 2));
    }

    #[test]
    fn test_get_wallet_limit() {
        assert_eq!(get_wallet_limit(0), 5);   // Free: 5
        assert_eq!(get_wallet_limit(1), 10);  // 1 NFT: 10
        assert_eq!(get_wallet_limit(2), 15);  // 2 NFTs: 15
        assert_eq!(get_wallet_limit(5), 30);  // 5 NFTs: 30
    }
}
