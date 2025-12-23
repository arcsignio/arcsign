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
    /// Human-readable description
    pub description: String,
    /// Should broadcast after signing
    pub broadcast: bool,
}
