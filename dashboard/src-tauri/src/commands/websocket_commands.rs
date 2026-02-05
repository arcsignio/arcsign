/**
 * WebSocket-related Tauri commands
 *
 * Handles pending transactions from external sources (mint-page).
 * The frontend polls for pending transactions and submits results after user confirmation.
 */

use crate::websocket::{PendingTransaction, PendingTransactionWithChannel, TransactionResult};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::State;
use tokio::sync::{mpsc, oneshot};

/// Pending transaction receiver type (stores pending transactions with their response channels)
pub type PendingTxReceiverState = Arc<Mutex<mpsc::UnboundedReceiver<PendingTransactionWithChannel>>>;

/// Stores the current pending transaction's response sender
pub type CurrentPendingTxState = Arc<Mutex<Option<(PendingTransaction, oneshot::Sender<TransactionResult>)>>>;

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
