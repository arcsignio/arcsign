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

/// Use mainnet for production
const BSC_RPC_URL: &str = BSC_MAINNET_RPC_URL;

/// ArcSign Pro NFT contract address on BSC Mainnet
/// Deployed: 2026-01-06 (Price: 30 USDT)
const ARCSIGN_PRO_CONTRACT: &str = "0x02EA7B4870Aa0553EF357Af6475727f1E01c7b2F";

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

/// Check membership input (single address)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckMembershipInput {
    /// BSC wallet address to check
    pub address: String,
}

/// Check membership input (multiple addresses)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckAllMembershipsInput {
    /// List of BSC wallet addresses to check
    pub addresses: Vec<String>,
    /// Device hash (keccak256 of device ID) for binding verification
    /// If provided, only NFTs bound to this device are counted as valid Pro membership
    #[serde(default)]
    pub device_hash: Option<String>,
}

/// Aggregated membership status for all wallets
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregatedMembershipStatus {
    /// Total NFTs owned across all addresses (regardless of binding)
    pub total_nft_count: u64,
    /// Total NFTs bound to this device
    pub bound_nft_count: u64,
    /// Whether user has valid Pro membership (requires device binding)
    pub is_pro: bool,
    /// Days until earliest expiration (0 if no NFT)
    pub days_remaining: u64,
    /// Wallet limit based on BOUND NFTs: 1 + (bound_nft_count * 3)
    pub wallet_limit: u64,
    /// Individual address NFT counts
    pub address_nft_counts: Vec<AddressNftCount>,
    /// Whether device hash was provided for binding check
    pub binding_required: bool,
}

/// NFT count for a single address
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressNftCount {
    pub address: String,
    /// Total NFTs owned by this address
    pub nft_count: u64,
    /// NFTs bound to this device
    pub bound_count: u64,
    /// Detailed token info (token ID, bound status, bound device hash)
    pub tokens: Vec<TokenInfo>,
}

/// Individual token info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenInfo {
    /// Token ID
    pub token_id: u64,
    /// Whether this token is bound to the queried device
    pub is_bound: bool,
    /// Device hash this token is bound to (0x00...00 if not bound)
    pub bound_device_hash: String,
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

/// Create eth_call request for tokenOfOwnerByIndex(address, uint256)
/// Returns uint256 tokenId
fn create_token_of_owner_by_index_call(contract: &str, address: &str, index: u64) -> serde_json::Value {
    // Function selector for tokenOfOwnerByIndex(address,uint256): 0x2f745c59
    // keccak256("tokenOfOwnerByIndex(address,uint256)")[:4]
    let selector = "2f745c59";
    let encoded_addr = encode_address(address);
    let encoded_index = format!("{:064x}", index);
    let data = format!("0x{}{}{}", selector, encoded_addr, encoded_index);

    serde_json::json!({
        "to": contract,
        "data": data
    })
}

/// Create eth_call request for deviceBindings(uint256)
/// Returns bytes32 deviceHash
fn create_device_bindings_call(contract: &str, token_id: u64) -> serde_json::Value {
    // Function selector for deviceBindings(uint256): 0xd6fd7d5c
    // keccak256("deviceBindings(uint256)")[:4]
    let selector = "d6fd7d5c";
    let encoded_token_id = format!("{:064x}", token_id);
    let data = format!("0x{}{}", selector, encoded_token_id);

    serde_json::json!({
        "to": contract,
        "data": data
    })
}

/// Parse bytes32 result from eth_call (for device hash)
fn parse_bytes32_result(hex: &str) -> String {
    let hex = hex.trim_start_matches("0x");
    if hex.is_empty() || hex.len() < 64 {
        return "0x0000000000000000000000000000000000000000000000000000000000000000".to_string();
    }
    format!("0x{}", &hex[..64])
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
    // Formula: 1 + (nft_count * 3)
    // - Free (0 NFT): 1 wallet
    // - Pro (1 NFT): 4 wallets
    // - Pro (n NFTs): 1 + (n * 3) wallets
    let wallet_limit = 1 + (nft_count * 3);

    Ok(MembershipStatus {
        is_pro,
        nft_count,
        token_ids: vec![],
        expirations: vec![],
        days_remaining,
        wallet_limit: Some(wallet_limit), // Always has a limit now
    })
}

/// Get NFT balance for a single address (internal helper)
async fn get_nft_balance(client: &reqwest::Client, address: &str) -> Result<u64, Error> {
    let balance_request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            create_balance_of_call(ARCSIGN_PRO_CONTRACT, address),
            serde_json::json!("latest"),
        ],
        id: 1,
    };

    let response = client
        .post(BSC_RPC_URL)
        .json(&balance_request)
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

    Ok(rpc_response
        .result
        .as_ref()
        .map(|r| parse_uint256_result(r))
        .unwrap_or(0))
}

/// Get token ID at index for an address (internal helper)
async fn get_token_of_owner_by_index(client: &reqwest::Client, address: &str, index: u64) -> Result<u64, Error> {
    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            create_token_of_owner_by_index_call(ARCSIGN_PRO_CONTRACT, address, index),
            serde_json::json!("latest"),
        ],
        id: 1,
    };

    let response = client
        .post(BSC_RPC_URL)
        .json(&request)
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

    Ok(rpc_response
        .result
        .as_ref()
        .map(|r| parse_uint256_result(r))
        .unwrap_or(0))
}

/// Get device binding hash for a token ID (internal helper)
async fn get_device_binding(client: &reqwest::Client, token_id: u64) -> Result<String, Error> {
    let request = JsonRpcRequest {
        jsonrpc: "2.0",
        method: "eth_call",
        params: vec![
            create_device_bindings_call(ARCSIGN_PRO_CONTRACT, token_id),
            serde_json::json!("latest"),
        ],
        id: 1,
    };

    let response = client
        .post(BSC_RPC_URL)
        .json(&request)
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

    Ok(rpc_response
        .result
        .as_ref()
        .map(|r| parse_bytes32_result(r))
        .unwrap_or_else(|| "0x0000000000000000000000000000000000000000000000000000000000000000".to_string()))
}

/// Get tokens with binding info for an address
/// Returns (bound_count, total_count, token_infos)
async fn get_tokens_with_binding(client: &reqwest::Client, address: &str, device_hash: &str) -> Result<(u64, u64, Vec<TokenInfo>), Error> {
    // Get total NFT balance
    let balance = get_nft_balance(client, address).await?;

    if balance == 0 {
        return Ok((0, 0, vec![]));
    }

    let mut bound_count = 0u64;
    let mut tokens = Vec::new();

    // Check each token's device binding
    for i in 0..balance {
        // Get token ID at index
        let token_id = get_token_of_owner_by_index(client, address, i).await?;

        // Get device binding for this token
        let binding = get_device_binding(client, token_id).await?;

        // Compare with our device hash (case-insensitive)
        let is_bound = binding.to_lowercase() == device_hash.to_lowercase();
        if is_bound {
            bound_count += 1;
            tracing::info!("Token {} is bound to this device", token_id);
        } else {
            tracing::info!("Token {} is NOT bound (binding: {}, device: {})", token_id, binding, device_hash);
        }

        tokens.push(TokenInfo {
            token_id,
            is_bound,
            bound_device_hash: binding,
        });
    }

    Ok((bound_count, balance, tokens))
}

/// Get tokens without binding verification (when no device hash provided)
async fn get_tokens_without_binding(client: &reqwest::Client, address: &str) -> Result<(u64, Vec<TokenInfo>), Error> {
    // Get total NFT balance
    let balance = get_nft_balance(client, address).await?;

    if balance == 0 {
        return Ok((0, vec![]));
    }

    let mut tokens = Vec::new();

    // Get each token's info
    for i in 0..balance {
        let token_id = get_token_of_owner_by_index(client, address, i).await?;
        let binding = get_device_binding(client, token_id).await?;

        tokens.push(TokenInfo {
            token_id,
            is_bound: false, // Can't verify without device hash
            bound_device_hash: binding,
        });
    }

    Ok((balance, tokens))
}

/// Check membership across ALL BSC addresses (Tauri command)
/// Returns aggregated NFT count and wallet limit
/// If device_hash is provided, only NFTs bound to this device are counted for Pro status
#[tauri::command]
pub async fn check_all_memberships(
    input: CheckAllMembershipsInput,
) -> Result<AggregatedMembershipStatus, Error> {
    tracing::info!("check_all_memberships: {} addresses, device_hash: {:?}",
        input.addresses.len(), input.device_hash.as_ref().map(|h| &h[..10.min(h.len())]));

    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| Error::new(
            crate::error::ErrorCode::NetworkError,
            format!("Failed to create HTTP client: {}", e),
        ))?;

    let mut total_nft_count = 0u64;
    let mut bound_nft_count = 0u64;
    let mut address_nft_counts = Vec::new();
    let binding_required = input.device_hash.is_some();

    // Check each address
    for address in &input.addresses {
        // Validate address format
        if !address.starts_with("0x") || address.len() != 42 {
            tracing::warn!("Skipping invalid address: {}", address);
            continue;
        }

        // If device_hash is provided, check binding; otherwise just count NFTs
        if let Some(ref device_hash) = input.device_hash {
            match get_tokens_with_binding(&client, address, device_hash).await {
                Ok((bound, total, tokens)) => {
                    tracing::info!("Address {} has {} NFTs ({} bound)", address, total, bound);
                    total_nft_count += total;
                    bound_nft_count += bound;
                    address_nft_counts.push(AddressNftCount {
                        address: address.clone(),
                        nft_count: total,
                        bound_count: bound,
                        tokens,
                    });
                }
                Err(e) => {
                    tracing::warn!("Failed to check address {}: {}", address, e);
                    address_nft_counts.push(AddressNftCount {
                        address: address.clone(),
                        nft_count: 0,
                        bound_count: 0,
                        tokens: vec![],
                    });
                }
            }
        } else {
            // No device hash - get tokens but can't verify binding to this device
            match get_tokens_without_binding(&client, address).await {
                Ok((nft_count, tokens)) => {
                    tracing::info!("Address {} has {} NFTs (binding not verified - no deviceHash)", address, nft_count);
                    total_nft_count += nft_count;
                    // Don't add to bound_nft_count - we can't verify without deviceHash
                    address_nft_counts.push(AddressNftCount {
                        address: address.clone(),
                        nft_count,
                        bound_count: 0, // Cannot verify binding without deviceHash
                        tokens,
                    });
                }
                Err(e) => {
                    tracing::warn!("Failed to check address {}: {}", address, e);
                    address_nft_counts.push(AddressNftCount {
                        address: address.clone(),
                        nft_count: 0,
                        bound_count: 0,
                        tokens: vec![],
                    });
                }
            }
        }
    }

    // Pro status requires bound NFTs when device_hash is provided
    let is_pro = bound_nft_count > 0;
    let days_remaining = if is_pro { 365u64 } else { 0u64 };
    // Formula: 1 + (bound_nft_count * 3)
    let wallet_limit = 1 + (bound_nft_count * 3);

    tracing::info!(
        "Aggregated membership: total_nft_count={}, bound_nft_count={}, is_pro={}, wallet_limit={}, binding_required={}",
        total_nft_count, bound_nft_count, is_pro, wallet_limit, binding_required
    );

    Ok(AggregatedMembershipStatus {
        total_nft_count,
        bound_nft_count,
        is_pro,
        days_remaining,
        wallet_limit,
        address_nft_counts,
        binding_required,
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
/// Formula: 1 + (nft_count * 3)
/// - Free (0 NFT): 1 wallet
/// - Pro (1 NFT): 4 wallets
/// - Pro (n NFTs): 1 + (n * 3) wallets
#[tauri::command]
pub fn can_create_wallet(current_wallet_count: u64, nft_count: u64) -> bool {
    let limit = 1 + (nft_count * 3);
    current_wallet_count < limit
}

/// Get wallet limit based on NFT count
/// Formula: 1 + (nft_count * 3)
/// - Free (0 NFT): 1 wallet
/// - Pro (1 NFT): 4 wallets
/// - Pro (n NFTs): 1 + (n * 3) wallets
#[tauri::command]
pub fn get_wallet_limit(nft_count: u64) -> u64 {
    1 + (nft_count * 3)
}

// ============================================================================
// FFI-based Membership Operations (USB Device Identity)
// ============================================================================

use tauri::State;
use crate::ffi::queue::LazyWalletQueue;

/// Device membership status from USB storage
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceMembershipStatus {
    /// Unique device ID (UUID) stored on USB
    pub device_id: String,
    /// keccak256(deviceId) for contract binding
    pub device_id_hash: String,
    /// Maximum wallets allowed (3 free + 5 per NFT)
    pub wallet_limit: u64,
    /// Current number of wallets
    pub wallet_count: u64,
    /// Whether user can create more wallets
    pub can_create_wallet: bool,
    /// List of NFT membership bindings
    pub memberships: Vec<MembershipBindingInfo>,
    /// IDs of wallets that are locked due to exceeding the limit
    /// Locked wallets can view balance but cannot send transactions
    #[serde(default)]
    pub locked_wallet_ids: Vec<String>,
}

/// NFT membership binding info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MembershipBindingInfo {
    pub nft_token_id: String,
    pub nft_contract: String,
    pub chain_id: String,
    pub bound_address: String,
    pub bound_at: i64,
    pub is_valid: bool,
    pub last_verified: i64,
}

/// Input for get_device_membership_status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDeviceMembershipInput {
    pub usb_path: String,
    pub app_password: String,
}

/// Input for get_device_membership_status_with_token (session-based)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDeviceMembershipWithTokenInput {
    pub token: String,
}

/// Input for add_device_membership_binding
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMembershipBindingInput {
    pub usb_path: String,
    pub app_password: String,
    pub nft_token_id: String,
    pub nft_contract: String,
    pub chain_id: String,
    pub bound_address: String,
    pub signature: String,
}

/// Input for remove_device_membership_binding
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveMembershipBindingInput {
    pub usb_path: String,
    pub app_password: String,
    pub nft_token_id: String,
    pub nft_contract: String,
}

/// Get device membership status from USB storage (Tauri command)
/// Returns device ID, device ID hash (for contract), wallet limits, and NFT bindings
#[tauri::command]
pub async fn get_device_membership_status(
    input: GetDeviceMembershipInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<DeviceMembershipStatus, Error> {
    tracing::info!("get_device_membership_status called");

    let params = serde_json::json!({
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
    });

    let result = queue
        .get_membership_status(params.to_string())
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::FfiStorageError,
            format!("Failed to get membership status: {}", e),
        ))?;

    // Parse the response
    let device_id = result["deviceId"].as_str().unwrap_or("").to_string();
    let device_id_hash = result["deviceIdHash"].as_str().unwrap_or("").to_string();
    let wallet_limit = result["walletLimit"].as_u64().unwrap_or(3);
    let wallet_count = result["walletCount"].as_u64().unwrap_or(0);
    let can_create = result["canCreateWallet"].as_bool().unwrap_or(true);

    // Parse memberships array
    let memberships: Vec<MembershipBindingInfo> = result["memberships"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|m| MembershipBindingInfo {
                    nft_token_id: m["nftTokenId"].as_str().unwrap_or("").to_string(),
                    nft_contract: m["nftContract"].as_str().unwrap_or("").to_string(),
                    chain_id: m["chainId"].as_str().unwrap_or("").to_string(),
                    bound_address: m["boundAddress"].as_str().unwrap_or("").to_string(),
                    bound_at: m["boundAt"].as_i64().unwrap_or(0),
                    is_valid: m["isValid"].as_bool().unwrap_or(false),
                    last_verified: m["lastVerified"].as_i64().unwrap_or(0),
                })
                .collect()
        })
        .unwrap_or_default();

    tracing::info!(
        "Device membership: id={}, hash={}, limit={}, count={}",
        device_id, device_id_hash, wallet_limit, wallet_count
    );

    Ok(DeviceMembershipStatus {
        device_id,
        device_id_hash,
        wallet_limit,
        wallet_count,
        can_create_wallet: can_create,
        memberships,
        // Note: This endpoint doesn't have session info, so locked wallets are not available
        // Use get_device_membership_status_with_token for locked wallet info
        locked_wallet_ids: vec![],
    })
}

/// Add NFT membership binding to USB device (Tauri command)
/// Call this after user has bound deviceId on the NFT contract
#[tauri::command]
pub async fn add_device_membership_binding(
    input: AddMembershipBindingInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!("add_device_membership_binding: tokenId={}", input.nft_token_id);

    let params = serde_json::json!({
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
        "nftTokenId": input.nft_token_id,
        "nftContract": input.nft_contract,
        "chainId": input.chain_id,
        "boundAddress": input.bound_address,
        "signature": input.signature,
    });

    let result = queue
        .add_membership_binding(params.to_string())
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::FfiStorageError,
            format!("Failed to add membership binding: {}", e),
        ))?;

    tracing::info!("Membership binding added successfully");
    Ok(result)
}

/// Remove NFT membership binding from USB device (Tauri command)
#[tauri::command]
pub async fn remove_device_membership_binding(
    input: RemoveMembershipBindingInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!("remove_device_membership_binding: tokenId={}", input.nft_token_id);

    let params = serde_json::json!({
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
        "nftTokenId": input.nft_token_id,
        "nftContract": input.nft_contract,
    });

    let result = queue
        .remove_membership_binding(params.to_string())
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::FfiStorageError,
            format!("Failed to remove membership binding: {}", e),
        ))?;

    tracing::info!("Membership binding removed successfully");
    Ok(result)
}

/// Get device membership status using session token (Tauri command)
/// This is the preferred API - no password needed, uses session token
#[tauri::command]
pub async fn get_device_membership_status_with_token(
    input: GetDeviceMembershipWithTokenInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<DeviceMembershipStatus, Error> {
    tracing::info!("get_device_membership_status_with_token called");

    let params = serde_json::json!({
        "token": input.token,
    });

    let result = queue
        .get_device_membership_status_with_token(params.to_string())
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::FfiStorageError,
            format!("Failed to get membership status: {}", e),
        ))?;

    // Parse the response
    let device_id = result["deviceId"].as_str().unwrap_or("").to_string();
    let device_id_hash = result["deviceIdHash"].as_str().unwrap_or("").to_string();
    let wallet_limit = result["walletLimit"].as_u64().unwrap_or(3);
    let wallet_count = result["walletCount"].as_u64().unwrap_or(0);
    let can_create = result["canCreateWallet"].as_bool().unwrap_or(true);

    // Parse memberships array
    let memberships: Vec<MembershipBindingInfo> = result["memberships"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .map(|m| MembershipBindingInfo {
                    nft_token_id: m["nftTokenId"].as_str().unwrap_or("").to_string(),
                    nft_contract: m["nftContract"].as_str().unwrap_or("").to_string(),
                    chain_id: m["chainId"].as_str().unwrap_or("").to_string(),
                    bound_address: m["boundAddress"].as_str().unwrap_or("").to_string(),
                    bound_at: m["boundAt"].as_i64().unwrap_or(0),
                    is_valid: m["isValid"].as_bool().unwrap_or(false),
                    last_verified: m["lastVerified"].as_i64().unwrap_or(0),
                })
                .collect()
        })
        .unwrap_or_default();

    // Parse locked wallet IDs from session
    let locked_wallet_ids: Vec<String> = result["lockedWalletIds"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|id| id.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    tracing::info!(
        "Device membership (token-based): id={}, hash={}, limit={}, count={}, locked={}",
        device_id, device_id_hash, wallet_limit, wallet_count, locked_wallet_ids.len()
    );

    Ok(DeviceMembershipStatus {
        device_id,
        device_id_hash,
        wallet_limit,
        wallet_count,
        can_create_wallet: can_create,
        memberships,
        locked_wallet_ids,
    })
}

/// Input for sync_membership_binding_with_token (session-based)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMembershipBindingWithTokenInput {
    pub token: String,
    pub nft_token_id: String,
    pub nft_contract: String,
    pub chain_id: String,
    pub bound_address: String,
}

/// Input for remove_membership_binding_with_token (session-based)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveMembershipBindingWithTokenInput {
    pub token: String,
    pub nft_token_id: String,
    pub nft_contract: String,
}

/// Sync NFT membership binding to USB using session token (Tauri command)
/// Used to sync on-chain binding state to USB storage without requiring password
#[tauri::command]
pub async fn sync_membership_binding_with_token(
    input: SyncMembershipBindingWithTokenInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!(
        "sync_membership_binding_with_token: tokenId={}, address={}",
        input.nft_token_id, input.bound_address
    );

    let params = serde_json::json!({
        "token": input.token,
        "nftTokenId": input.nft_token_id,
        "nftContract": input.nft_contract,
        "chainId": input.chain_id,
        "boundAddress": input.bound_address,
    });

    let result = queue
        .sync_membership_binding_with_token(params.to_string())
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::FfiStorageError,
            format!("Failed to sync membership binding: {}", e),
        ))?;

    tracing::info!("Membership binding synced successfully");
    Ok(result)
}

/// Remove NFT membership binding from USB using session token (Tauri command)
/// Used when on-chain binding no longer exists
#[tauri::command]
pub async fn remove_membership_binding_with_token(
    input: RemoveMembershipBindingWithTokenInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!(
        "remove_membership_binding_with_token: tokenId={}",
        input.nft_token_id
    );

    let params = serde_json::json!({
        "token": input.token,
        "nftTokenId": input.nft_token_id,
        "nftContract": input.nft_contract,
    });

    let result = queue
        .remove_membership_binding_with_token(params.to_string())
        .await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::FfiStorageError,
            format!("Failed to remove membership binding: {}", e),
        ))?;

    tracing::info!("Membership binding removed successfully");
    Ok(result)
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
        // Free (0 NFTs): max 1 wallet
        assert!(can_create_wallet(0, 0));
        assert!(!can_create_wallet(1, 0));
        assert!(!can_create_wallet(10, 0));

        // 1 NFT: max 4 wallets (1 + 3)
        assert!(can_create_wallet(0, 1));
        assert!(can_create_wallet(3, 1));
        assert!(!can_create_wallet(4, 1));

        // 2 NFTs: max 7 wallets (1 + 6)
        assert!(can_create_wallet(6, 2));
        assert!(!can_create_wallet(7, 2));
    }

    #[test]
    fn test_get_wallet_limit() {
        assert_eq!(get_wallet_limit(0), 1);   // Free: 1 wallet
        assert_eq!(get_wallet_limit(1), 4);   // 1 NFT: 4 wallets
        assert_eq!(get_wallet_limit(2), 7);   // 2 NFTs: 7 wallets
        assert_eq!(get_wallet_limit(5), 16);  // 5 NFTs: 16 wallets
    }
}
