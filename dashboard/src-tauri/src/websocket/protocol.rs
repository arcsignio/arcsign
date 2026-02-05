/**
 * WebSocket Protocol Definitions
 *
 * JSON-RPC style protocol for wallet communication.
 */

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// WebSocket request from client (mint-page)
#[derive(Debug, Clone, Deserialize)]
pub struct WsRequest {
    /// Request ID for correlation
    pub id: u64,
    /// Method name
    pub method: WsMethod,
    /// Optional parameters
    #[serde(default)]
    pub params: Value,
}

/// Available WebSocket methods
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WsMethod {
    /// Get available BSC addresses
    GetAccounts,
    /// Sign a transaction (requires USB + password)
    SignTransaction,
    /// Sign and broadcast a transaction
    SignAndBroadcast,
    /// Get USDT balance for an address
    GetBalance,
    /// Ping/health check
    Ping,

    // =========================================
    // Developer Mode Methods (for Hardhat/Foundry integration)
    // =========================================

    /// Sign transaction with developer context (script info, project path)
    DevSignTransaction,
    /// EIP-191 personal_sign for message signing
    PersonalSign,
    /// EIP-712 eth_signTypedData_v4 for structured data signing
    SignTypedDataV4,
    /// Get developer session status
    DevGetSession,
    /// Create a new developer session (for auto-signing testnets)
    DevCreateSession,
    /// End the current developer session
    DevEndSession,

    /// Get block explorer API key from developer settings
    GetExplorerApiKey,
}

/// WebSocket response to client
#[derive(Debug, Clone, Serialize)]
pub struct WsResponse {
    /// Request ID (correlates with request)
    pub id: u64,
    /// Success or error
    pub success: bool,
    /// Result data (on success)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    /// Error message (on failure)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl WsResponse {
    /// Create a success response
    pub fn success(id: u64, result: Value) -> Self {
        Self {
            id,
            success: true,
            result: Some(result),
            error: None,
        }
    }

    /// Create an error response
    pub fn error(id: u64, message: impl Into<String>) -> Self {
        Self {
            id,
            success: false,
            result: None,
            error: Some(message.into()),
        }
    }
}

/// Transaction request parameters
#[derive(Debug, Clone, Deserialize)]
pub struct SignTransactionParams {
    /// BSC address to sign with
    pub from: String,
    /// Destination address
    pub to: String,
    /// Transaction data (hex encoded)
    pub data: String,
    /// Value in wei (hex encoded)
    #[serde(default)]
    pub value: String,
    /// Gas limit
    #[serde(default)]
    pub gas: Option<String>,
    /// Gas price
    #[serde(default)]
    pub gas_price: Option<String>,
    /// Chain ID (default: 56 for BSC, 97 for testnet)
    #[serde(default = "default_chain_id")]
    pub chain_id: u64,
}

fn default_chain_id() -> u64 {
    56 // BSC Mainnet
}

/// Pending transaction request (for UI confirmation)
#[derive(Debug, Clone, Serialize)]
pub struct PendingTransaction {
    /// Request ID
    pub request_id: u64,
    /// Transaction details
    pub from: String,
    pub to: String,
    pub data: String,
    pub value: String,
    pub chain_id: u64,
    /// Gas limit (from Hardhat)
    pub gas: Option<String>,
    /// Gas price for legacy tx
    pub gas_price: Option<String>,
    /// Max fee per gas (EIP-1559)
    pub max_fee_per_gas: Option<String>,
    /// Max priority fee per gas (EIP-1559)
    pub max_priority_fee_per_gas: Option<String>,
    /// Transaction nonce
    pub nonce: Option<u64>,
    /// Human-readable description
    pub description: String,
    /// Source script name (e.g., "deploy.ts")
    pub script_name: Option<String>,
    /// Should broadcast after signing
    pub broadcast: bool,
}

/// Transaction result from UI confirmation
#[derive(Debug, Clone)]
pub struct TransactionResult {
    pub success: bool,
    pub tx_hash: Option<String>,
    pub signed_tx: Option<String>,
    pub error: Option<String>,
}

/// Pending transaction with response channel (internal use)
pub struct PendingTransactionWithChannel {
    pub transaction: PendingTransaction,
    pub response_sender: tokio::sync::oneshot::Sender<TransactionResult>,
}

// =========================================
// Developer Mode Types
// =========================================

/// Developer context sent with signing requests from Hardhat/Foundry
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DevContext {
    /// Source script name (e.g., "deploy.ts")
    #[serde(default)]
    pub script_name: Option<String>,
    /// Project directory path
    #[serde(default)]
    pub project_path: Option<String>,
    /// Description of the operation
    #[serde(default)]
    pub description: Option<String>,
    /// Whether using a dedicated dev wallet
    #[serde(default)]
    pub is_dev_wallet: bool,
}

/// Developer transaction request parameters (extends SignTransactionParams)
#[derive(Debug, Clone, Deserialize)]
pub struct DevSignTransactionParams {
    /// BSC address to sign with
    pub from: String,
    /// Destination address
    pub to: String,
    /// Transaction data (hex encoded)
    pub data: String,
    /// Value in wei (hex encoded)
    #[serde(default)]
    pub value: String,
    /// Gas limit
    #[serde(default)]
    pub gas: Option<String>,
    /// Gas price
    #[serde(default)]
    pub gas_price: Option<String>,
    /// Max fee per gas (EIP-1559)
    #[serde(default)]
    pub max_fee_per_gas: Option<String>,
    /// Max priority fee per gas (EIP-1559)
    #[serde(default)]
    pub max_priority_fee_per_gas: Option<String>,
    /// Chain ID (default: 56 for BSC)
    #[serde(default = "default_chain_id")]
    pub chain_id: u64,
    /// Nonce (optional, will be fetched if not provided)
    #[serde(default)]
    pub nonce: Option<u64>,
    /// Developer context
    #[serde(default)]
    pub context: Option<DevContext>,
}

/// EIP-191 personal_sign parameters
#[derive(Debug, Clone, Deserialize)]
pub struct PersonalSignParams {
    /// Address to sign with
    pub address: String,
    /// Message to sign (hex or utf-8 string)
    pub message: String,
    /// Developer context
    #[serde(default)]
    pub context: Option<DevContext>,
}

/// EIP-712 signTypedData_v4 parameters
#[derive(Debug, Clone, Deserialize)]
pub struct SignTypedDataParams {
    /// Address to sign with
    pub address: String,
    /// Typed data as JSON (EIP-712 format)
    pub typed_data: serde_json::Value,
    /// Developer context
    #[serde(default)]
    pub context: Option<DevContext>,
}

/// Developer session for auto-signing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevSession {
    /// Whether session is enabled
    pub enabled: bool,
    /// Wallet ID associated with session
    #[serde(default)]
    pub wallet_id: Option<String>,
    /// Session creation timestamp (unix ms)
    pub created_at: u64,
    /// Session expiration timestamp (unix ms)
    pub expires_at: u64,
    /// Networks that auto-sign is enabled for
    pub trusted_networks: Vec<String>,
    /// Maximum gas limit for auto-signing (wei)
    #[serde(default)]
    pub max_gas_limit: Option<String>,
    /// Number of signatures in this session
    pub sign_count: u32,
}

/// Developer session create request
#[derive(Debug, Clone, Deserialize)]
pub struct DevCreateSessionParams {
    /// Wallet ID to use for session
    pub wallet_id: String,
    /// Session duration in minutes (default: 30, max: 120)
    #[serde(default = "default_session_duration")]
    pub duration_minutes: u32,
    /// Networks to trust for auto-signing
    #[serde(default = "default_trusted_networks")]
    pub trusted_networks: Vec<String>,
    /// Maximum gas limit per transaction (wei)
    #[serde(default)]
    pub max_gas_limit: Option<String>,
}

fn default_session_duration() -> u32 {
    30 // 30 minutes
}

fn default_trusted_networks() -> Vec<String> {
    vec![
        "sepolia".to_string(),
        "goerli".to_string(),
        "bsc-testnet".to_string(),
        "mumbai".to_string(),
    ]
}

/// Pending developer request (for UI display)
#[derive(Debug, Clone, Serialize)]
pub struct PendingDevRequest {
    /// Request ID
    pub request_id: u64,
    /// Request type
    pub request_type: DevRequestType,
    /// Transaction details (for sign requests)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transaction: Option<PendingTransaction>,
    /// Message (for personal_sign)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Typed data (for signTypedData)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typed_data: Option<serde_json::Value>,
    /// Developer context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<DevContext>,
    /// Network identifier (e.g., "ethereum", "bsc", "sepolia")
    pub network: String,
    /// Chain ID
    pub chain_id: u64,
    /// Whether this can be auto-signed (testnet + session active)
    pub can_auto_sign: bool,
}

/// Type of developer request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DevRequestType {
    /// Contract deployment
    Deploy,
    /// Contract method call
    Call,
    /// Personal message signing
    PersonalSign,
    /// Typed data signing (EIP-712)
    TypedData,
}

/// Parameters for get_explorer_api_key request
#[derive(Debug, Clone, Deserialize)]
pub struct GetExplorerApiKeyParams {
    /// Explorer type: etherscan, bscscan, polygonscan, arbiscan, optimism, basescan, snowtrace
    pub explorer: String,
    /// USB path where settings are stored (optional, uses server's stored path if not provided)
    #[serde(default)]
    pub usb_path: Option<String>,
}
