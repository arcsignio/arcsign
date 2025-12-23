/**
 * WebSocket Message Handler
 *
 * Processes incoming WebSocket requests and routes to appropriate handlers.
 */

use super::protocol::{
    WsRequest, WsResponse, WsMethod, SignTransactionParams, PendingTransaction,
    TransactionResult, PendingTransactionWithChannel,
};
use serde_json::{json, Value};
use tokio::sync::{mpsc, oneshot};

/// Channel for sending pending transactions to the UI (with response channel)
pub type PendingTxSender = mpsc::UnboundedSender<PendingTransactionWithChannel>;
pub type PendingTxReceiver = mpsc::UnboundedReceiver<PendingTransactionWithChannel>;

/// Handler context with access to app state
pub struct HandlerContext {
    /// Channel to send pending transactions to UI
    pub pending_tx_sender: PendingTxSender,
    /// BSC addresses from the wallet
    pub accounts: Vec<String>,
}

impl HandlerContext {
    pub fn new(pending_tx_sender: PendingTxSender, accounts: Vec<String>) -> Self {
        Self {
            pending_tx_sender,
            accounts,
        }
    }
}

/// Handle incoming WebSocket request
pub async fn handle_request(
    request: WsRequest,
    context: &HandlerContext,
) -> WsResponse {
    tracing::info!("WebSocket request: {:?}", request.method);

    match request.method {
        WsMethod::Ping => handle_ping(request.id),

        WsMethod::GetAccounts => handle_get_accounts(request.id, context),

        WsMethod::GetBalance => handle_get_balance(request.id, request.params).await,

        WsMethod::SignTransaction => {
            handle_sign_transaction(request.id, request.params, context, false).await
        }

        WsMethod::SignAndBroadcast => {
            handle_sign_transaction(request.id, request.params, context, true).await
        }
    }
}

/// Handle ping request
fn handle_ping(id: u64) -> WsResponse {
    WsResponse::success(id, json!({
        "status": "ok",
        "version": "1.0.0",
        "wallet": "ArcSign"
    }))
}

/// Handle get_accounts request
fn handle_get_accounts(id: u64, context: &HandlerContext) -> WsResponse {
    if context.accounts.is_empty() {
        return WsResponse::error(id, "No BSC addresses available. Please unlock the wallet first.");
    }

    WsResponse::success(id, json!({
        "accounts": context.accounts,
        "chainId": 56  // BSC Mainnet
    }))
}

/// Handle get_balance request
async fn handle_get_balance(id: u64, params: Value) -> WsResponse {
    let address = match params.get("address").and_then(|v| v.as_str()) {
        Some(addr) => addr,
        None => return WsResponse::error(id, "Missing 'address' parameter"),
    };

    let token = params.get("token").and_then(|v| v.as_str()).unwrap_or("BNB");

    // TODO: Implement actual balance query via RPC
    // For now, return placeholder
    WsResponse::success(id, json!({
        "address": address,
        "token": token,
        "balance": "0",
        "formatted": "0.00"
    }))
}

/// Handle sign_transaction or sign_and_broadcast request
async fn handle_sign_transaction(
    id: u64,
    params: Value,
    context: &HandlerContext,
    broadcast: bool,
) -> WsResponse {
    // Parse transaction parameters
    let tx_params: SignTransactionParams = match serde_json::from_value(params) {
        Ok(p) => p,
        Err(e) => return WsResponse::error(id, format!("Invalid transaction parameters: {}", e)),
    };

    // Verify the 'from' address is in our wallet
    if !context.accounts.iter().any(|a| a.eq_ignore_ascii_case(&tx_params.from)) {
        return WsResponse::error(id, format!(
            "Address {} is not in the wallet",
            tx_params.from
        ));
    }

    // Parse transaction data to create human-readable description
    let description = parse_transaction_description(&tx_params);

    // Create pending transaction for UI confirmation
    let pending_tx = PendingTransaction {
        request_id: id,
        from: tx_params.from.clone(),
        to: tx_params.to.clone(),
        data: tx_params.data.clone(),
        value: tx_params.value.clone(),
        chain_id: tx_params.chain_id,
        description,
        broadcast,
    };

    // Create oneshot channel for receiving the result from UI
    let (response_sender, response_receiver) = oneshot::channel::<TransactionResult>();

    // Create pending transaction with channel
    let pending_with_channel = PendingTransactionWithChannel {
        transaction: pending_tx,
        response_sender,
    };

    // Send to UI for confirmation
    if let Err(e) = context.pending_tx_sender.send(pending_with_channel) {
        return WsResponse::error(id, format!("Failed to queue transaction: {}", e));
    }

    tracing::info!("Transaction {} queued for user confirmation, waiting...", id);

    // Wait for user confirmation (with 5 minute timeout)
    match tokio::time::timeout(
        std::time::Duration::from_secs(300),
        response_receiver,
    ).await {
        Ok(Ok(result)) => {
            if result.success {
                tracing::info!("Transaction {} confirmed by user", id);
                WsResponse::success(id, json!({
                    "status": "success",
                    "tx_hash": result.tx_hash,
                    "signed_tx": result.signed_tx,
                }))
            } else {
                tracing::info!("Transaction {} rejected by user: {:?}", id, result.error);
                WsResponse::error(id, result.error.unwrap_or_else(|| "Transaction rejected".to_string()))
            }
        }
        Ok(Err(_)) => {
            tracing::warn!("Transaction {} response channel closed", id);
            WsResponse::error(id, "Transaction cancelled")
        }
        Err(_) => {
            tracing::warn!("Transaction {} timed out waiting for user confirmation", id);
            WsResponse::error(id, "Transaction confirmation timed out (5 minutes)")
        }
    }
}

/// Parse transaction data to create human-readable description
fn parse_transaction_description(tx: &SignTransactionParams) -> String {
    // Check if it's a known contract method
    if tx.data.len() >= 10 {
        let method_id = &tx.data[0..10];

        match method_id {
            // ERC20 approve(address,uint256)
            "0x095ea7b3" => {
                return format!("Approve token spending to {}", short_address(&tx.to));
            }
            // ERC20 transfer(address,uint256)
            "0xa9059cbb" => {
                return format!("Transfer token to {}", short_address(&tx.to));
            }
            // ArcSignPro mint()
            "0x1249c58b" => {
                return "Mint ArcSign Pro NFT (30 USDT)".to_string();
            }
            // ArcSignProTestnet mint() - payable
            "0x1249c58b" if !tx.value.is_empty() && tx.value != "0x0" => {
                return "Mint ArcSign Pro NFT (0.001 tBNB)".to_string();
            }
            _ => {}
        }
    }

    // Default description
    if tx.value.is_empty() || tx.value == "0x0" || tx.value == "0" {
        format!("Contract interaction with {}", short_address(&tx.to))
    } else {
        format!("Send {} wei to {}", tx.value, short_address(&tx.to))
    }
}

/// Shorten address for display
fn short_address(addr: &str) -> String {
    if addr.len() >= 10 {
        format!("{}...{}", &addr[0..6], &addr[addr.len() - 4..])
    } else {
        addr.to_string()
    }
}
