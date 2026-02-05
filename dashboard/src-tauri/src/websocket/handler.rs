/**
 * WebSocket Message Handler
 *
 * Processes incoming WebSocket requests and routes to appropriate handlers.
 */

use super::protocol::{
    WsRequest, WsResponse, WsMethod, SignTransactionParams, PendingTransaction,
    TransactionResult, PendingTransactionWithChannel,
    // Developer mode types
    DevSignTransactionParams, PersonalSignParams, SignTypedDataParams,
    DevSession, DevCreateSessionParams, DevContext, PendingDevRequest, DevRequestType,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, RwLock};

/// Channel for sending pending transactions to the UI (with response channel)
pub type PendingTxSender = mpsc::UnboundedSender<PendingTransactionWithChannel>;
pub type PendingTxReceiver = mpsc::UnboundedReceiver<PendingTransactionWithChannel>;

/// Handler context with access to app state
pub struct HandlerContext {
    /// Channel to send pending transactions to UI
    pub pending_tx_sender: PendingTxSender,
    /// BSC addresses from the wallet
    pub accounts: Vec<String>,
    /// Developer session state (shared across connections)
    pub dev_session: Arc<RwLock<Option<DevSession>>>,
}

impl HandlerContext {
    pub fn new(pending_tx_sender: PendingTxSender, accounts: Vec<String>) -> Self {
        Self {
            pending_tx_sender,
            accounts,
            dev_session: Arc::new(RwLock::new(None)),
        }
    }

    /// Create with shared session state
    pub fn with_session(
        pending_tx_sender: PendingTxSender,
        accounts: Vec<String>,
        dev_session: Arc<RwLock<Option<DevSession>>>,
    ) -> Self {
        Self {
            pending_tx_sender,
            accounts,
            dev_session,
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
        WsMethod::DevSignTransaction => {
            handle_dev_sign_transaction(request.id, request.params, context).await
        }

        WsMethod::PersonalSign => {
            handle_personal_sign(request.id, request.params, context).await
        }

        WsMethod::SignTypedDataV4 => {
            handle_sign_typed_data(request.id, request.params, context).await
        }

        WsMethod::DevGetSession => {
            handle_dev_get_session(request.id, context).await
        }

        WsMethod::DevCreateSession => {
            handle_dev_create_session(request.id, request.params, context).await
        }

        WsMethod::DevEndSession => {
            handle_dev_end_session(request.id, context).await
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
fn is_testnet(chain_id: u64) -> bool {
    matches!(chain_id, 5 | 11155111 | 97 | 80001 | 421613 | 420 | 84531)
}

/// Handle dev_sign_transaction request (developer mode)
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
        if let Some(ref s) = *session {
            s.enabled
                && s.expires_at > current_timestamp_ms()
                && s.trusted_networks.contains(&network)
        } else {
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

    // If can auto-sign, proceed automatically
    if can_auto_sign {
        // Update session sign count
        {
            let mut session = context.dev_session.write().await;
            if let Some(ref mut s) = *session {
                s.sign_count += 1;
            }
        }

        // TODO: Implement actual signing here
        // For now, return a placeholder indicating auto-sign happened
        return WsResponse::success(id, json!({
            "status": "auto_signed",
            "network": network,
            "request_type": request_type,
            "description": description,
            "message": "Transaction auto-signed (session mode)"
        }));
    }

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
        .unwrap_or_else(|| "Sign Message".to_string());

    tracing::info!("Personal sign request: {} for {}", description, short_address(&sign_params.address));

    // TODO: Create pending sign request for UI
    // For now, return placeholder
    WsResponse::success(id, json!({
        "status": "pending",
        "message": "Personal sign request queued for approval",
        "address": sign_params.address,
    }))
}

/// Handle signTypedData_v4 request (EIP-712)
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

    let description = sign_params
        .context
        .as_ref()
        .and_then(|c| c.description.clone())
        .unwrap_or_else(|| "Sign Typed Data".to_string());

    tracing::info!("SignTypedData request: {} for {}", description, short_address(&sign_params.address));

    // TODO: Create pending sign request for UI
    // For now, return placeholder
    WsResponse::success(id, json!({
        "status": "pending",
        "message": "Typed data sign request queued for approval",
        "address": sign_params.address,
    }))
}

/// Handle dev_get_session request
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

/// Parse method name from calldata
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
fn current_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}
