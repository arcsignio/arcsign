/**
 * WebSocket-related Tauri commands
 *
 * Handles pending transactions from external sources (mint-page).
 * The frontend polls for pending transactions and submits results after user confirmation.
 */

use crate::websocket::{
    PendingTransaction, PendingTransactionWithChannel, TransactionResult,
    PendingMessageSign, PendingMessageSignWithChannel, MessageSignResult, MessageSignType,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::sync::{mpsc, oneshot};

/// Pending transaction receiver type (stores pending transactions with their response channels)
pub type PendingTxReceiverState = Arc<Mutex<mpsc::UnboundedReceiver<PendingTransactionWithChannel>>>;

/// Stores the current pending transaction's response sender
pub type CurrentPendingTxState = Arc<Mutex<Option<(PendingTransaction, oneshot::Sender<TransactionResult>)>>>;

/// Pending message sign receiver type
pub type PendingMsgReceiverState = Arc<Mutex<mpsc::UnboundedReceiver<PendingMessageSignWithChannel>>>;

/// Stores the current pending message sign's response sender
pub type CurrentPendingMsgState = Arc<Mutex<Option<(PendingMessageSign, oneshot::Sender<MessageSignResult>)>>>;

/// Response for pending transaction (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTransactionResponse {
    pub request_id: u64,
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
    pub description: String,
    /// Source script name (e.g., "deploy.ts")
    pub script_name: Option<String>,
    pub broadcast: bool,
}

impl From<&PendingTransaction> for PendingTransactionResponse {
    fn from(tx: &PendingTransaction) -> Self {
        Self {
            request_id: tx.request_id,
            from: tx.from.clone(),
            to: tx.to.clone(),
            data: tx.data.clone(),
            value: tx.value.clone(),
            chain_id: tx.chain_id,
            gas: tx.gas.clone(),
            gas_price: tx.gas_price.clone(),
            max_fee_per_gas: tx.max_fee_per_gas.clone(),
            max_priority_fee_per_gas: tx.max_priority_fee_per_gas.clone(),
            nonce: tx.nonce,
            description: tx.description.clone(),
            script_name: tx.script_name.clone(),
            broadcast: tx.broadcast,
        }
    }
}

/// Get pending transaction from queue (if any)
/// Frontend should poll this periodically
#[tauri::command]
pub async fn get_pending_transaction(
    receiver: State<'_, PendingTxReceiverState>,
    current_pending: State<'_, CurrentPendingTxState>,
) -> Result<Option<PendingTransactionResponse>, String> {
    // First check if there's already a current pending transaction
    {
        let current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some((tx, _)) = &*current {
            // Return the current pending transaction
            return Ok(Some(PendingTransactionResponse::from(tx)));
        }
    }

    // Try to receive a new pending transaction
    let mut rx = receiver.lock().map_err(|e| format!("Lock error: {}", e))?;

    match rx.try_recv() {
        Ok(pending_with_channel) => {
            let tx = pending_with_channel.transaction;
            let response = PendingTransactionResponse::from(&tx);

            tracing::info!("Pending transaction found: request_id={}", tx.request_id);

            // Store the transaction and its response sender
            let mut current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;
            *current = Some((tx, pending_with_channel.response_sender));

            Ok(Some(response))
        }
        Err(mpsc::error::TryRecvError::Empty) => Ok(None),
        Err(mpsc::error::TryRecvError::Disconnected) => {
            Err("Transaction channel disconnected".to_string())
        }
    }
}

/// Input for respond_to_transaction command
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RespondToTransactionInput {
    pub request_id: u64,
    pub success: bool,
    #[serde(default)]
    pub tx_hash: Option<String>,
    #[serde(default)]
    pub signed_tx: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

/// Respond to a pending transaction
/// Called by frontend after user confirms with password (or rejects)
#[tauri::command]
pub async fn respond_to_transaction(
    input: RespondToTransactionInput,
    current_pending: State<'_, CurrentPendingTxState>,
) -> Result<(), String> {
    let RespondToTransactionInput {
        request_id,
        success,
        tx_hash,
        signed_tx,
        error,
    } = input;

    tracing::info!(
        "Transaction response: request_id={}, success={}, tx_hash={:?}",
        request_id,
        success,
        tx_hash
    );

    // Get and remove the current pending transaction
    // IMPORTANT: Always remove from current_pending, even if send fails
    let sender = {
        let mut current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;

        match current.take() {
            Some((tx, sender)) if tx.request_id == request_id => sender,
            Some((tx, sender)) => {
                // Request ID mismatch - still remove it to prevent infinite loop
                tracing::warn!(
                    "Request ID mismatch: expected {}, got {}. Dropping stale transaction.",
                    tx.request_id,
                    request_id
                );
                // Don't put it back - let the sender time out
                drop(sender);
                return Ok(()); // Return OK to prevent frontend retry loop
            }
            None => {
                // No pending transaction - that's fine, maybe already handled
                tracing::debug!("No pending transaction to respond to (already handled?)");
                return Ok(());
            }
        }
    };

    // Send the result back to the WebSocket handler
    let result = TransactionResult {
        success,
        tx_hash,
        signed_tx,
        error,
    };

    // Try to send, but don't fail if the receiver is gone
    match sender.send(result) {
        Ok(_) => {
            tracing::info!("Transaction result sent for request_id={}", request_id);
        }
        Err(_) => {
            tracing::warn!("Failed to send response (receiver dropped) for request_id={}", request_id);
        }
    }

    Ok(())
}

/// Cancel the current pending transaction
#[tauri::command]
pub async fn cancel_pending_transaction(
    current_pending: State<'_, CurrentPendingTxState>,
) -> Result<(), String> {
    let sender = {
        let mut current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;
        current.take().map(|(tx, sender)| {
            tracing::info!("Cancelling pending transaction: request_id={}", tx.request_id);
            sender
        })
    };

    if let Some(sender) = sender {
        let result = TransactionResult {
            success: false,
            tx_hash: None,
            signed_tx: None,
            error: Some("Transaction cancelled by user".to_string()),
        };
        let _ = sender.send(result);
    }

    Ok(())
}

// =========================================
// Message Signing Commands (EIP-191, EIP-712)
// =========================================

/// Response for pending message sign (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingMessageSignResponse {
    pub request_id: u64,
    pub address: String,
    pub sign_type: String,  // "personal_sign" or "typed_data"
    pub message: Option<String>,
    pub message_readable: Option<String>,
    pub typed_data: Option<serde_json::Value>,
    pub description: String,
    /// Developer context - script name
    pub script_name: Option<String>,
    /// Developer context - project path
    pub project_path: Option<String>,
}

impl From<&PendingMessageSign> for PendingMessageSignResponse {
    fn from(req: &PendingMessageSign) -> Self {
        Self {
            request_id: req.request_id,
            address: req.address.clone(),
            sign_type: match req.sign_type {
                MessageSignType::PersonalSign => "personal_sign".to_string(),
                MessageSignType::TypedData => "typed_data".to_string(),
            },
            message: req.message.clone(),
            message_readable: req.message_readable.clone(),
            typed_data: req.typed_data.clone(),
            description: req.description.clone(),
            script_name: req.context.as_ref().and_then(|c| c.script_name.clone()),
            project_path: req.context.as_ref().and_then(|c| c.project_path.clone()),
        }
    }
}

/// Get pending message sign request from queue (if any)
/// Frontend should poll this periodically
#[tauri::command]
pub async fn get_pending_message_sign(
    receiver: State<'_, PendingMsgReceiverState>,
    current_pending: State<'_, CurrentPendingMsgState>,
) -> Result<Option<PendingMessageSignResponse>, String> {
    // First check if there's already a current pending request
    {
        let current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;
        if let Some((req, _)) = &*current {
            return Ok(Some(PendingMessageSignResponse::from(req)));
        }
    }

    // Try to receive a new pending request
    let mut rx = receiver.lock().map_err(|e| format!("Lock error: {}", e))?;

    match rx.try_recv() {
        Ok(pending_with_channel) => {
            let req = pending_with_channel.request;
            let response = PendingMessageSignResponse::from(&req);

            tracing::info!(
                "Pending message sign found: request_id={}, type={:?}",
                req.request_id,
                req.sign_type
            );

            // Store the request and its response sender
            let mut current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;
            *current = Some((req, pending_with_channel.response_sender));

            Ok(Some(response))
        }
        Err(mpsc::error::TryRecvError::Empty) => Ok(None),
        Err(mpsc::error::TryRecvError::Disconnected) => {
            Err("Message sign channel disconnected".to_string())
        }
    }
}

/// Input for respond_to_message_sign command
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RespondToMessageSignInput {
    pub request_id: u64,
    pub success: bool,
    #[serde(default)]
    pub signature: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

/// Respond to a pending message sign request
/// Called by frontend after user confirms with password (or rejects)
#[tauri::command]
pub async fn respond_to_message_sign(
    input: RespondToMessageSignInput,
    current_pending: State<'_, CurrentPendingMsgState>,
) -> Result<(), String> {
    let RespondToMessageSignInput {
        request_id,
        success,
        signature,
        error,
    } = input;

    tracing::info!(
        "Message sign response: request_id={}, success={}, has_signature={}",
        request_id,
        success,
        signature.is_some()
    );

    // Get and remove the current pending request
    let sender = {
        let mut current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;

        match current.take() {
            Some((req, sender)) if req.request_id == request_id => sender,
            Some((req, sender)) => {
                tracing::warn!(
                    "Request ID mismatch: expected {}, got {}. Dropping stale request.",
                    req.request_id,
                    request_id
                );
                drop(sender);
                return Ok(());
            }
            None => {
                tracing::debug!("No pending message sign to respond to (already handled?)");
                return Ok(());
            }
        }
    };

    // Send the result back to the WebSocket handler
    let result = MessageSignResult {
        success,
        signature,
        error,
    };

    match sender.send(result) {
        Ok(_) => {
            tracing::info!("Message sign result sent for request_id={}", request_id);
        }
        Err(_) => {
            tracing::warn!("Failed to send message sign response (receiver dropped) for request_id={}", request_id);
        }
    }

    Ok(())
}

/// Cancel the current pending message sign request
#[tauri::command]
pub async fn cancel_pending_message_sign(
    current_pending: State<'_, CurrentPendingMsgState>,
) -> Result<(), String> {
    let sender = {
        let mut current = current_pending.lock().map_err(|e| format!("Lock error: {}", e))?;
        current.take().map(|(req, sender)| {
            tracing::info!("Cancelling pending message sign: request_id={}", req.request_id);
            sender
        })
    };

    if let Some(sender) = sender {
        let result = MessageSignResult {
            success: false,
            signature: None,
            error: Some("Sign request cancelled by user".to_string()),
        };
        let _ = sender.send(result);
    }

    Ok(())
}
