/**
 * WebSocket Message Handler
 *
 * Processes incoming WebSocket requests and routes to appropriate handlers.
 */

use super::protocol::{
    WsRequest, WsResponse, WsMethod, SignTransactionParams, PendingTransaction,
    TransactionResult, PendingTransactionWithChannel,
    // Developer mode types (production-used)
    DevSession,
    // Message signing types (production-used)
    PendingMessageSignWithChannel,
};
// Developer-mode-only protocol types — only referenced inside `#[cfg(feature = "dev-mode")]`
// handlers, so they are unused (and would warn) in a production build.
#[cfg(feature = "dev-mode")]
use super::protocol::{
    DevSignTransactionParams, PersonalSignParams, SignTypedDataParams,
    DevCreateSessionParams, DevContext, PendingDevRequest, DevRequestType,
    GetExplorerApiKeyParams,
    PendingMessageSign, MessageSignResult, MessageSignType,
};
use crate::ffi::LazyWalletQueue;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, RwLock};

/// Channel for sending pending transactions to the UI (with response channel)
pub type PendingTxSender = mpsc::UnboundedSender<PendingTransactionWithChannel>;
pub type PendingTxReceiver = mpsc::UnboundedReceiver<PendingTransactionWithChannel>;

/// Channel for sending pending message sign requests to the UI
pub type PendingMsgSender = mpsc::UnboundedSender<PendingMessageSignWithChannel>;
pub type PendingMsgReceiver = mpsc::UnboundedReceiver<PendingMessageSignWithChannel>;

/// Handler context with access to app state
//
// Several fields (`pending_msg_sender`, `usb_path`, `dev_session`, `wallet_queue`) are
// only read inside `#[cfg(feature = "dev-mode")]` handlers. In a production build they are
// still constructed (server.rs) but never read, so allow the resulting dead-code noise
// without dropping the fields the dev build needs.
#[cfg_attr(not(feature = "dev-mode"), allow(dead_code))]
pub struct HandlerContext {
    /// Channel to send pending transactions to UI
    pub pending_tx_sender: PendingTxSender,
    /// Channel to send pending message sign requests to UI
    pub pending_msg_sender: PendingMsgSender,
    /// BSC addresses from the wallet
    pub accounts: Vec<String>,
    /// USB device path (for reading dev settings)
    pub usb_path: Option<String>,
    /// Developer session state (shared across connections)
    pub dev_session: Arc<RwLock<Option<DevSession>>>,
    /// FFI wallet queue for session-based auto-signing
    pub wallet_queue: Option<LazyWalletQueue>,
}

impl HandlerContext {
    pub fn new(
        pending_tx_sender: PendingTxSender,
        pending_msg_sender: PendingMsgSender,
        accounts: Vec<String>,
        usb_path: Option<String>,
    ) -> Self {
        Self {
            pending_tx_sender,
            pending_msg_sender,
            accounts,
            usb_path,
            dev_session: Arc::new(RwLock::new(None)),
            wallet_queue: None,
        }
    }

    /// Create with shared session state
    pub fn with_session(
        pending_tx_sender: PendingTxSender,
        pending_msg_sender: PendingMsgSender,
        accounts: Vec<String>,
        usb_path: Option<String>,
        dev_session: Arc<RwLock<Option<DevSession>>>,
    ) -> Self {
        Self {
            pending_tx_sender,
            pending_msg_sender,
            accounts,
            usb_path,
            dev_session,
            wallet_queue: None,
        }
    }

    /// Create with shared session state and wallet queue for auto-signing
    pub fn with_session_and_queue(
        pending_tx_sender: PendingTxSender,
        pending_msg_sender: PendingMsgSender,
        accounts: Vec<String>,
        usb_path: Option<String>,
        dev_session: Arc<RwLock<Option<DevSession>>>,
        wallet_queue: Option<LazyWalletQueue>,
    ) -> Self {
        Self {
            pending_tx_sender,
            pending_msg_sender,
            accounts,
            usb_path,
            dev_session,
            wallet_queue,
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

        // Developer Mode Methods
        #[cfg(feature = "dev-mode")]
        WsMethod::DevSignTransaction => {
            handle_dev_sign_transaction(request.id, request.params, context).await
        }
        #[cfg(not(feature = "dev-mode"))]
        WsMethod::DevSignTransaction => handle_dev_method_unavailable(request.id),

        #[cfg(feature = "dev-mode")]
        WsMethod::PersonalSign => {
            handle_personal_sign(request.id, request.params, context).await
        }
        #[cfg(not(feature = "dev-mode"))]
        WsMethod::PersonalSign => handle_dev_method_unavailable(request.id),

        #[cfg(feature = "dev-mode")]
        WsMethod::SignTypedDataV4 => {
            handle_sign_typed_data(request.id, request.params, context).await
        }
        #[cfg(not(feature = "dev-mode"))]
        WsMethod::SignTypedDataV4 => handle_dev_method_unavailable(request.id),

        #[cfg(feature = "dev-mode")]
        WsMethod::DevGetSession => {
            handle_dev_get_session(request.id, context).await
        }
        #[cfg(not(feature = "dev-mode"))]
        WsMethod::DevGetSession => handle_dev_method_unavailable(request.id),

        #[cfg(feature = "dev-mode")]
        WsMethod::DevCreateSession => {
            handle_dev_create_session(request.id, request.params, context).await
        }
        #[cfg(not(feature = "dev-mode"))]
        WsMethod::DevCreateSession => handle_dev_method_unavailable(request.id),

        #[cfg(feature = "dev-mode")]
        WsMethod::DevEndSession => {
            handle_dev_end_session(request.id, context).await
        }
        #[cfg(not(feature = "dev-mode"))]
        WsMethod::DevEndSession => handle_dev_method_unavailable(request.id),

        #[cfg(feature = "dev-mode")]
        WsMethod::GetExplorerApiKey => {
            handle_get_explorer_api_key(request.id, request.params, context).await
        }
        #[cfg(not(feature = "dev-mode"))]
        WsMethod::GetExplorerApiKey => handle_dev_method_unavailable(request.id),

        // Pairing handshake — wired in Task 9
        WsMethod::RequestPairing | WsMethod::VerifyPairing => {
            WsResponse::error(request.id, "pairing not yet implemented")
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
        gas: tx_params.gas.clone(),
        gas_price: tx_params.gas_price.clone(),
        max_fee_per_gas: None,  // Not supported in legacy SignTransactionParams
        max_priority_fee_per_gas: None,
        nonce: None,
        description,
        script_name: None,  // Not available in legacy mode
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

// =========================================
// Developer Mode Handlers
// =========================================

/// Map chain ID to network name
#[cfg(feature = "dev-mode")]
fn chain_id_to_network(chain_id: u64) -> String {
    match chain_id {
        1 => "ethereum".to_string(),
        5 => "goerli".to_string(),
        11155111 => "sepolia".to_string(),
        56 => "bsc".to_string(),
        97 => "bsc-testnet".to_string(),
        137 => "polygon".to_string(),
        80001 => "mumbai".to_string(),
        42161 => "arbitrum".to_string(),
        10 => "optimism".to_string(),
        8453 => "base".to_string(),
        _ => format!("chain-{}", chain_id),
    }
}

/// Check if network is a testnet
#[cfg(feature = "dev-mode")]
fn is_testnet(chain_id: u64) -> bool {
    matches!(chain_id, 5 | 11155111 | 97 | 80001 | 421613 | 420 | 84531)
}

/// Production builds (without the `dev-mode` feature) do not compile the
/// developer auto-sign methods. Reaching a dev method here means a developer
/// tool (e.g. the Hardhat plugin) connected to a production wallet build.
#[cfg(not(feature = "dev-mode"))]
fn handle_dev_method_unavailable(id: u64) -> WsResponse {
    WsResponse::error(
        id,
        "dev methods are not available in this production build; \
         install the ArcSign developer build to use the Hardhat plugin",
    )
}

/// Handle dev_sign_transaction request (developer mode)
#[cfg(feature = "dev-mode")]
async fn handle_dev_sign_transaction(
    id: u64,
    params: Value,
    context: &HandlerContext,
) -> WsResponse {
    // Parse developer transaction parameters
    let tx_params: DevSignTransactionParams = match serde_json::from_value(params) {
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

    let network = chain_id_to_network(tx_params.chain_id);
    let is_test = is_testnet(tx_params.chain_id);

    // Check if we can auto-sign (testnet + active session)
    let can_auto_sign = {
        let session = context.dev_session.read().await;
        let now = current_timestamp_ms();
        if let Some(ref s) = *session {
            tracing::info!(
                "Session check: enabled={}, expires_at={}, now={}, expired={}, network={}, trusted={:?}, in_trusted={}",
                s.enabled,
                s.expires_at,
                now,
                s.expires_at <= now,
                network,
                s.trusted_networks,
                s.trusted_networks.contains(&network)
            );
            s.enabled
                && s.expires_at > now
                && s.trusted_networks.contains(&network)
        } else {
            tracing::info!("No active session found in context");
            false
        }
    };

    // Determine request type (deploy or call)
    let request_type = if tx_params.to.is_empty() || tx_params.to == "0x" {
        DevRequestType::Deploy
    } else {
        DevRequestType::Call
    };

    // Create description from context or parse from data
    let description = tx_params
        .context
        .as_ref()
        .and_then(|c| c.description.clone())
        .unwrap_or_else(|| {
            // Try to parse method from data
            if request_type == DevRequestType::Deploy {
                "Deploy Contract".to_string()
            } else if tx_params.data.len() >= 10 {
                parse_method_name(&tx_params.data)
            } else {
                format!("Call {}", short_address(&tx_params.to))
            }
        });

    tracing::info!(
        "Dev transaction request: {} on {} (auto_sign={})",
        description,
        network,
        can_auto_sign
    );

    // If can auto-sign, proceed automatically using FFI
    if can_auto_sign {
        // Get session token for FFI call
        let session_token = {
            let session = context.dev_session.read().await;
            session.as_ref().and_then(|s| s.session_token.clone())
        };

        // Verify we have wallet queue and session token
        tracing::info!("Checking FFI requirements: wallet_queue={}, session_token={:?}",
            context.wallet_queue.is_some(),
            session_token.as_ref().map(|t| format!("{}...", &t[..8.min(t.len())]))
        );
        match (&context.wallet_queue, session_token) {
            (Some(queue), Some(token)) => {
                tracing::info!("Auto-signing transaction using session token");

                // Build sign params for FFI (Go expects camelCase)
                let sign_params = serde_json::json!({
                    "sessionToken": token,
                    "chainId": tx_params.chain_id,
                    "from": tx_params.from,
                    "to": tx_params.to,
                    "data": tx_params.data,
                    "value": tx_params.value,
                    "gas": tx_params.gas,
                    "gasPrice": tx_params.gas_price,
                    "maxFeePerGas": tx_params.max_fee_per_gas,
                    "maxPriorityFeePerGas": tx_params.max_priority_fee_per_gas,
                    "nonce": tx_params.nonce,
                });

                // Call FFI for signing
                match queue.dev_session_sign(sign_params.to_string()).await {
                    Ok(result_json) => {
                        // Check for error in result
                        if let Some(error) = result_json.get("error").and_then(|e| e.as_str()) {
                            tracing::error!("FFI signing error: {}", error);
                            return WsResponse::error(id, error.to_string());
                        }

                        // Update session sign count
                        {
                            let mut session = context.dev_session.write().await;
                            if let Some(ref mut s) = *session {
                                s.sign_count += 1;
                            }
                        }

                        // Note: Go FFI returns camelCase
                        let tx_hash = result_json.get("txHash").and_then(|v| v.as_str());
                        let signed_tx = result_json.get("signedTx").and_then(|v| v.as_str());

                        tracing::info!("Auto-sign successful: tx_hash={:?}", tx_hash);

                        return WsResponse::success(id, json!({
                            "status": "success",
                            "tx_hash": tx_hash,
                            "signed_tx": signed_tx,
                            "network": network,
                            "auto_signed": true,
                        }));
                    }
                    Err(e) => {
                        tracing::error!("FFI auto-sign failed: {}", e);
                        // Fall through to manual signing
                        tracing::info!("Falling back to manual signing");
                    }
                }
            }
            (None, _) => {
                tracing::warn!("Wallet queue not available for auto-signing, falling back to manual");
            }
            (_, None) => {
                tracing::warn!("Session token not available for auto-signing, falling back to manual");
            }
        }
    }

    // Extract script name from context
    let script_name = tx_params
        .context
        .as_ref()
        .and_then(|c| c.script_name.clone());

    // Create pending transaction for UI confirmation
    let pending_tx = PendingTransaction {
        request_id: id,
        from: tx_params.from.clone(),
        to: tx_params.to.clone(),
        data: tx_params.data.clone(),
        value: tx_params.value.clone(),
        chain_id: tx_params.chain_id,
        gas: tx_params.gas.clone(),
        gas_price: tx_params.gas_price.clone(),
        max_fee_per_gas: tx_params.max_fee_per_gas.clone(),
        max_priority_fee_per_gas: tx_params.max_priority_fee_per_gas.clone(),
        nonce: tx_params.nonce,
        description,
        script_name,
        broadcast: true, // Developer mode always broadcasts
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

    tracing::info!("Dev transaction {} queued for user confirmation", id);

    // Wait for user confirmation (with 5 minute timeout)
    match tokio::time::timeout(
        std::time::Duration::from_secs(300),
        response_receiver,
    ).await {
        Ok(Ok(result)) => {
            if result.success {
                tracing::info!("Dev transaction {} confirmed", id);
                WsResponse::success(id, json!({
                    "status": "success",
                    "tx_hash": result.tx_hash,
                    "signed_tx": result.signed_tx,
                    "network": network,
                }))
            } else {
                tracing::info!("Dev transaction {} rejected: {:?}", id, result.error);
                WsResponse::error(id, result.error.unwrap_or_else(|| "Transaction rejected".to_string()))
            }
        }
        Ok(Err(_)) => {
            tracing::warn!("Dev transaction {} response channel closed", id);
            WsResponse::error(id, "Transaction cancelled")
        }
        Err(_) => {
            tracing::warn!("Dev transaction {} timed out", id);
            WsResponse::error(id, "Transaction confirmation timed out (5 minutes)")
        }
    }
}

/// Handle personal_sign request (EIP-191)
#[cfg(feature = "dev-mode")]
async fn handle_personal_sign(
    id: u64,
    params: Value,
    context: &HandlerContext,
) -> WsResponse {
    let sign_params: PersonalSignParams = match serde_json::from_value(params) {
        Ok(p) => p,
        Err(e) => return WsResponse::error(id, format!("Invalid parameters: {}", e)),
    };

    // Verify address is in wallet
    if !context.accounts.iter().any(|a| a.eq_ignore_ascii_case(&sign_params.address)) {
        return WsResponse::error(id, format!(
            "Address {} is not in the wallet",
            sign_params.address
        ));
    }

    let description = sign_params
        .context
        .as_ref()
        .and_then(|c| c.description.clone())
        .unwrap_or_else(|| "Sign Message (EIP-191)".to_string());

    // Try to decode hex message to readable string
    let message_readable = decode_hex_message(&sign_params.message);

    tracing::info!(
        "Personal sign request: {} for {} (message: {})",
        description,
        short_address(&sign_params.address),
        message_readable.as_deref().unwrap_or(&sign_params.message)
    );

    // Create pending message sign request
    let pending_request = PendingMessageSign {
        request_id: id,
        address: sign_params.address.clone(),
        sign_type: MessageSignType::PersonalSign,
        message: Some(sign_params.message.clone()),
        message_readable,
        typed_data: None,
        context: sign_params.context.clone(),
        description,
    };

    // Create oneshot channel for receiving the result from UI
    let (response_sender, response_receiver) = oneshot::channel::<MessageSignResult>();

    // Create pending request with channel
    let pending_with_channel = PendingMessageSignWithChannel {
        request: pending_request,
        response_sender,
    };

    // Send to UI for confirmation
    if let Err(e) = context.pending_msg_sender.send(pending_with_channel) {
        return WsResponse::error(id, format!("Failed to queue sign request: {}", e));
    }

    tracing::info!("Personal sign request {} queued for user confirmation", id);

    // Wait for user confirmation (with 5 minute timeout)
    match tokio::time::timeout(
        std::time::Duration::from_secs(300),
        response_receiver,
    ).await {
        Ok(Ok(result)) => {
            if result.success {
                tracing::info!("Personal sign {} confirmed by user", id);
                WsResponse::success(id, json!({
                    "signature": result.signature,
                }))
            } else {
                tracing::info!("Personal sign {} rejected: {:?}", id, result.error);
                WsResponse::error(id, result.error.unwrap_or_else(|| "Sign request rejected".to_string()))
            }
        }
        Ok(Err(_)) => {
            tracing::warn!("Personal sign {} response channel closed", id);
            WsResponse::error(id, "Sign request cancelled")
        }
        Err(_) => {
            tracing::warn!("Personal sign {} timed out", id);
            WsResponse::error(id, "Sign request timed out (5 minutes)")
        }
    }
}

/// Handle signTypedData_v4 request (EIP-712)
#[cfg(feature = "dev-mode")]
async fn handle_sign_typed_data(
    id: u64,
    params: Value,
    context: &HandlerContext,
) -> WsResponse {
    let sign_params: SignTypedDataParams = match serde_json::from_value(params) {
        Ok(p) => p,
        Err(e) => return WsResponse::error(id, format!("Invalid parameters: {}", e)),
    };

    // Verify address is in wallet
    if !context.accounts.iter().any(|a| a.eq_ignore_ascii_case(&sign_params.address)) {
        return WsResponse::error(id, format!(
            "Address {} is not in the wallet",
            sign_params.address
        ));
    }

    // Try to extract description from typed data or context
    let description = sign_params
        .context
        .as_ref()
        .and_then(|c| c.description.clone())
        .unwrap_or_else(|| {
            // Try to get primary type from typed data
            sign_params.typed_data
                .get("primaryType")
                .and_then(|v| v.as_str())
                .map(|t| format!("Sign {} (EIP-712)", t))
                .unwrap_or_else(|| "Sign Typed Data (EIP-712)".to_string())
        });

    tracing::info!(
        "SignTypedData request: {} for {}",
        description,
        short_address(&sign_params.address)
    );

    // Create pending message sign request
    let pending_request = PendingMessageSign {
        request_id: id,
        address: sign_params.address.clone(),
        sign_type: MessageSignType::TypedData,
        message: None,
        message_readable: None,
        typed_data: Some(sign_params.typed_data.clone()),
        context: sign_params.context.clone(),
        description,
    };

    // Create oneshot channel for receiving the result from UI
    let (response_sender, response_receiver) = oneshot::channel::<MessageSignResult>();

    // Create pending request with channel
    let pending_with_channel = PendingMessageSignWithChannel {
        request: pending_request,
        response_sender,
    };

    // Send to UI for confirmation
    if let Err(e) = context.pending_msg_sender.send(pending_with_channel) {
        return WsResponse::error(id, format!("Failed to queue sign request: {}", e));
    }

    tracing::info!("SignTypedData request {} queued for user confirmation", id);

    // Wait for user confirmation (with 5 minute timeout)
    match tokio::time::timeout(
        std::time::Duration::from_secs(300),
        response_receiver,
    ).await {
        Ok(Ok(result)) => {
            if result.success {
                tracing::info!("SignTypedData {} confirmed by user", id);
                WsResponse::success(id, json!({
                    "signature": result.signature,
                }))
            } else {
                tracing::info!("SignTypedData {} rejected: {:?}", id, result.error);
                WsResponse::error(id, result.error.unwrap_or_else(|| "Sign request rejected".to_string()))
            }
        }
        Ok(Err(_)) => {
            tracing::warn!("SignTypedData {} response channel closed", id);
            WsResponse::error(id, "Sign request cancelled")
        }
        Err(_) => {
            tracing::warn!("SignTypedData {} timed out", id);
            WsResponse::error(id, "Sign request timed out (5 minutes)")
        }
    }
}

/// Handle dev_get_session request
#[cfg(feature = "dev-mode")]
async fn handle_dev_get_session(
    id: u64,
    context: &HandlerContext,
) -> WsResponse {
    let session = context.dev_session.read().await;

    match &*session {
        Some(s) => {
            // Check if session is expired
            if s.expires_at < current_timestamp_ms() {
                WsResponse::success(id, json!({
                    "active": false,
                    "message": "Session expired"
                }))
            } else {
                WsResponse::success(id, json!({
                    "active": true,
                    "session": s,
                    "remaining_ms": s.expires_at - current_timestamp_ms()
                }))
            }
        }
        None => WsResponse::success(id, json!({
            "active": false,
            "message": "No active session"
        })),
    }
}

/// Handle dev_create_session request
#[cfg(feature = "dev-mode")]
async fn handle_dev_create_session(
    id: u64,
    params: Value,
    context: &HandlerContext,
) -> WsResponse {
    let create_params: DevCreateSessionParams = match serde_json::from_value(params) {
        Ok(p) => p,
        Err(e) => return WsResponse::error(id, format!("Invalid parameters: {}", e)),
    };

    // Limit duration to 120 minutes max
    let duration_minutes = create_params.duration_minutes.min(120);
    let now = current_timestamp_ms();

    let new_session = DevSession {
        enabled: true,
        wallet_id: Some(create_params.wallet_id.clone()),
        session_token: None, // WebSocket-only session; real session via Tauri command
        created_at: now,
        expires_at: now + (duration_minutes as u64 * 60 * 1000),
        trusted_networks: create_params.trusted_networks,
        max_gas_limit: create_params.max_gas_limit,
        sign_count: 0,
    };

    // Store the session
    {
        let mut session = context.dev_session.write().await;
        *session = Some(new_session.clone());
    }

    tracing::info!(
        "Dev session created for wallet {} ({}min)",
        create_params.wallet_id,
        duration_minutes
    );

    WsResponse::success(id, json!({
        "status": "created",
        "session": new_session,
    }))
}

/// Handle dev_end_session request
#[cfg(feature = "dev-mode")]
async fn handle_dev_end_session(
    id: u64,
    context: &HandlerContext,
) -> WsResponse {
    let mut session = context.dev_session.write().await;

    if session.is_some() {
        let sign_count = session.as_ref().map(|s| s.sign_count).unwrap_or(0);
        *session = None;

        tracing::info!("Dev session ended (signed {} transactions)", sign_count);

        WsResponse::success(id, json!({
            "status": "ended",
            "sign_count": sign_count,
        }))
    } else {
        WsResponse::success(id, json!({
            "status": "no_session",
            "message": "No active session to end"
        }))
    }
}

/// Try to decode a hex message to a readable UTF-8 string
#[cfg(feature = "dev-mode")]
fn decode_hex_message(hex_msg: &str) -> Option<String> {
    // Remove 0x prefix if present
    let hex_str = hex_msg.strip_prefix("0x").unwrap_or(hex_msg);

    // Try to decode hex to bytes
    let bytes: Result<Vec<u8>, _> = (0..hex_str.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex_str[i..i + 2], 16))
        .collect();

    let bytes = match bytes {
        Ok(b) => b,
        Err(_) => return None,
    };

    // Try to convert to UTF-8 string
    match String::from_utf8(bytes) {
        Ok(s) => {
            // Only return if it looks like readable text (mostly printable chars)
            if s.chars().all(|c| c.is_ascii_graphic() || c.is_ascii_whitespace()) {
                Some(s)
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

/// Parse method name from calldata
#[cfg(feature = "dev-mode")]
fn parse_method_name(data: &str) -> String {
    if data.len() < 10 {
        return "Unknown Method".to_string();
    }

    let method_id = &data[0..10];

    // Common method signatures
    match method_id {
        "0x095ea7b3" => "approve(address,uint256)".to_string(),
        "0xa9059cbb" => "transfer(address,uint256)".to_string(),
        "0x23b872dd" => "transferFrom(address,address,uint256)".to_string(),
        "0x40c10f19" => "mint(address,uint256)".to_string(),
        "0x1249c58b" => "mint()".to_string(),
        "0x42842e0e" => "safeTransferFrom(address,address,uint256)".to_string(),
        "0xa22cb465" => "setApprovalForAll(address,bool)".to_string(),
        "0x8da5cb5b" => "owner()".to_string(),
        "0xf2fde38b" => "transferOwnership(address)".to_string(),
        "0x715018a6" => "renounceOwnership()".to_string(),
        "0x5c975abb" => "paused()".to_string(),
        "0x8456cb59" => "pause()".to_string(),
        "0x3f4ba83a" => "unpause()".to_string(),
        "0x3659cfe6" => "upgradeTo(address)".to_string(),
        "0x4f1ef286" => "upgradeToAndCall(address,bytes)".to_string(),
        _ => format!("Contract Call ({})", method_id),
    }
}

/// Get current timestamp in milliseconds
#[cfg(feature = "dev-mode")]
fn current_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

/// Handle get_explorer_api_key request
#[cfg(feature = "dev-mode")]
async fn handle_get_explorer_api_key(
    id: u64,
    params: Value,
    context: &HandlerContext,
) -> WsResponse {
    let key_params: GetExplorerApiKeyParams = match serde_json::from_value(params) {
        Ok(p) => p,
        Err(e) => return WsResponse::error(id, format!("Invalid parameters: {}", e)),
    };

    tracing::info!("Getting explorer API key for: {}", key_params.explorer);

    // Use USB path from params or context
    let usb_path = key_params.usb_path.or_else(|| context.usb_path.clone());

    let usb_path = match usb_path {
        Some(p) => p,
        None => {
            return WsResponse::success(id, json!({
                "api_key": null,
                "message": "USB device not connected"
            }));
        }
    };

    // Read settings from USB
    let settings_path = std::path::PathBuf::from(&usb_path)
        .join("dev_settings")
        .join("settings.json");

    if !settings_path.exists() {
        return WsResponse::success(id, json!({
            "api_key": null,
            "message": "No settings file found"
        }));
    }

    // Read and parse settings file
    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Failed to read settings file: {}", e);
            return WsResponse::success(id, json!({
                "api_key": null,
                "message": format!("Failed to read settings: {}", e)
            }));
        }
    };

    let settings: serde_json::Value = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("Failed to parse settings file: {}", e);
            return WsResponse::success(id, json!({
                "api_key": null,
                "message": format!("Failed to parse settings: {}", e)
            }));
        }
    };

    // Extract the API key based on explorer type
    let api_key = settings
        .get("explorerApiKeys")
        .and_then(|keys| keys.get(&key_params.explorer))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if api_key.is_some() {
        tracing::info!("Found API key for {}", key_params.explorer);
    } else {
        tracing::info!("No API key found for {}", key_params.explorer);
    }

    WsResponse::success(id, json!({
        "api_key": api_key,
        "explorer": key_params.explorer,
    }))
}

#[cfg(test)]
mod dev_gate_tests {
    use super::*;

    // Production build (no dev-mode feature): dispatching a dev method returns a friendly error.
    #[cfg(not(feature = "dev-mode"))]
    #[test]
    fn dev_method_returns_friendly_error_in_production_build() {
        let resp = handle_dev_method_unavailable(42);
        assert!(!resp.success);
        let err = resp.error.unwrap();
        assert!(
            err.contains("developer build"),
            "error should point user to the developer build, got: {err}"
        );
        assert_eq!(resp.id, 42);
    }
}
