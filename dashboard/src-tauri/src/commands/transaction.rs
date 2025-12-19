/**
 * Transaction commands for ChainAdapter operations
 * Feature: EVM Transaction Send Functionality
 * Created: 2025-12-18
 *
 * Provides Tauri commands for:
 * - Building unsigned transactions
 * - Signing transactions with wallet password
 * - Broadcasting signed transactions
 * - Querying transaction status
 * - Estimating transaction fees
 */

use crate::error::{AppError, ErrorCode};
use crate::ffi::LazyWalletQueue;
use serde::Deserialize;
use serde_json::json;
use std::time::Instant;
use tauri::State;
use zeroize::Zeroize;

// ============================================================================
// Request/Response Types
// ============================================================================

/// Input for building an unsigned transaction
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildTransactionInput {
    /// Chain identifier: "ethereum", "polygon", "arbitrum", etc.
    pub chain_id: String,
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Amount to send (in native token, e.g., "0.1" for 0.1 ETH)
    pub amount: String,
    /// Fee speed: "slow", "normal", "fast"
    #[serde(default = "default_fee_speed")]
    pub fee_speed: String,
    /// ERC-20 token contract address (optional, empty for native token)
    #[serde(default)]
    pub token_address: Option<String>,
    /// USB path for provider config
    pub usb_path: String,
    /// App password for provider config decryption
    pub app_password: String,
}

fn default_fee_speed() -> String {
    "normal".to_string()
}

/// Input for signing a transaction
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignTransactionInput {
    /// Chain identifier
    pub chain_id: String,
    /// Wallet ID
    pub wallet_id: String,
    /// Wallet password for key derivation
    pub password: String,
    /// BIP39 passphrase (empty string if not used)
    #[serde(default)]
    pub passphrase: String,
    /// From address (to determine derivation path)
    pub from_address: String,
    /// Unsigned transaction data (from build_transaction)
    pub unsigned_tx: serde_json::Value,
    /// USB path
    pub usb_path: String,
    /// App password
    pub app_password: String,
}

/// Input for broadcasting a signed transaction
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastTransactionInput {
    /// Chain identifier
    pub chain_id: String,
    /// Signed transaction data (from sign_transaction)
    pub signed_tx: serde_json::Value,
    /// USB path
    pub usb_path: String,
    /// App password
    pub app_password: String,
}

/// Input for querying transaction status
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryTransactionStatusInput {
    /// Chain identifier
    pub chain_id: String,
    /// Transaction hash
    pub tx_hash: String,
    /// USB path
    pub usb_path: String,
    /// App password
    pub app_password: String,
}

/// Input for estimating transaction fees
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EstimateFeeInput {
    /// Chain identifier
    pub chain_id: String,
    /// Sender address
    pub from: String,
    /// Recipient address
    pub to: String,
    /// Amount to send
    pub amount: String,
    /// USB path
    pub usb_path: String,
    /// App password
    pub app_password: String,
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Build an unsigned transaction for the specified chain.
///
/// This prepares a transaction with:
/// - Current nonce from the blockchain
/// - Estimated gas limit
/// - Fee parameters (EIP-1559 or legacy)
///
/// Returns the unsigned transaction data ready to be signed.
#[tauri::command]
pub async fn build_transaction(
    queue: State<'_, LazyWalletQueue>,
    input: BuildTransactionInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "build_transaction called: chain={}, from={}, to={}, amount={}",
        input.chain_id,
        input.from,
        input.to,
        input.amount
    );

    // Build JSON params for FFI call
    let mut params = json!({
        "chainId": input.chain_id,
        "from": input.from,
        "to": input.to,
        "amount": input.amount,
        "feeSpeed": input.fee_speed,
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
    });

    // Add tokenAddress for ERC-20 transfers
    if let Some(ref token_addr) = input.token_address {
        if !token_addr.is_empty() {
            params["tokenAddress"] = json!(token_addr);
            tracing::info!("ERC-20 transfer: token_address={}", token_addr);
        }
    }

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // Call FFI
    let result = queue
        .build_transaction(params_json)
        .await
        .map_err(|e| {
            tracing::error!("build_transaction FFI error: {}", e);
            if e.contains("PROVIDER_NOT_FOUND") || e.contains("API_KEY") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Alchemy provider not configured",
                )
            } else if e.contains("INSUFFICIENT_FUNDS") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Insufficient funds for transaction",
                )
            } else if e.contains("INVALID_ADDRESS") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Invalid address format",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to build transaction",
                    e,
                )
            }
        })?;

    let elapsed = start.elapsed();
    tracing::info!(
        "build_transaction completed in {:?}",
        elapsed
    );

    Ok(result)
}

/// Sign an unsigned transaction with the wallet password.
///
/// This:
/// - Decrypts the wallet with the provided password
/// - Derives the private key for the from_address
/// - Signs the transaction
/// - Clears the private key from memory
///
/// Returns the signed transaction ready to broadcast.
#[tauri::command]
pub async fn sign_transaction(
    queue: State<'_, LazyWalletQueue>,
    mut input: SignTransactionInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "sign_transaction called: chain={}, wallet={}, from={}",
        input.chain_id,
        input.wallet_id,
        input.from_address
    );

    // Build JSON params for FFI call
    let params = json!({
        "chainId": input.chain_id,
        "walletId": input.wallet_id,
        "password": input.password,
        "passphrase": input.passphrase,  // BIP39 passphrase for seed derivation
        "fromAddress": input.from_address,
        "unsignedTx": input.unsigned_tx,
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // Call FFI
    let result = queue
        .sign_transaction(params_json)
        .await
        .map_err(|e| {
            tracing::error!("sign_transaction FFI error: {}", e);
            if e.contains("INVALID_PASSWORD") || e.contains("DECRYPTION_ERROR") {
                AppError::new(
                    ErrorCode::InvalidPassword,
                    "Invalid wallet password",
                )
            } else if e.contains("WALLET_NOT_FOUND") {
                AppError::new(
                    ErrorCode::WalletNotFound,
                    "Wallet not found",
                )
            } else if e.contains("ADDRESS_NOT_FOUND") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Address not found in wallet",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to sign transaction",
                    e,
                )
            }
        })?;

    // Zero sensitive data
    input.password.zeroize();
    input.passphrase.zeroize();

    let elapsed = start.elapsed();
    tracing::info!(
        "sign_transaction completed in {:?}",
        elapsed
    );

    Ok(result)
}

/// Broadcast a signed transaction to the blockchain network.
///
/// This sends the signed transaction via eth_sendRawTransaction.
/// Returns the transaction hash and status URL.
#[tauri::command]
pub async fn broadcast_transaction(
    queue: State<'_, LazyWalletQueue>,
    input: BroadcastTransactionInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "broadcast_transaction called: chain={}",
        input.chain_id
    );

    // Build JSON params for FFI call
    let params = json!({
        "chainId": input.chain_id,
        "signedTx": input.signed_tx,
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // Call FFI
    let result = queue
        .broadcast_transaction(params_json)
        .await
        .map_err(|e| {
            tracing::error!("broadcast_transaction FFI error: {}", e);
            if e.contains("NONCE_TOO_LOW") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Transaction nonce too low - please try again",
                )
            } else if e.contains("INSUFFICIENT_FUNDS") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Insufficient funds for gas",
                )
            } else if e.contains("ALREADY_KNOWN") {
                AppError::new(
                    ErrorCode::CliExecutionFailed,
                    "Transaction already submitted",
                )
            } else {
                AppError::with_details(
                    ErrorCode::CliExecutionFailed,
                    "Failed to broadcast transaction",
                    e,
                )
            }
        })?;

    let elapsed = start.elapsed();
    tracing::info!(
        "broadcast_transaction completed in {:?}",
        elapsed
    );

    Ok(result)
}

/// Query the status of a transaction by hash.
///
/// Returns transaction status (pending, confirmed, failed) and details.
#[tauri::command]
pub async fn query_transaction_status(
    queue: State<'_, LazyWalletQueue>,
    input: QueryTransactionStatusInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "query_transaction_status called: chain={}, tx={}",
        input.chain_id,
        input.tx_hash
    );

    // Build JSON params for FFI call
    let params = json!({
        "chainId": input.chain_id,
        "txHash": input.tx_hash,
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // Call FFI
    let result = queue
        .query_transaction_status(params_json)
        .await
        .map_err(|e| {
            tracing::error!("query_transaction_status FFI error: {}", e);
            AppError::with_details(
                ErrorCode::CliExecutionFailed,
                "Failed to query transaction status",
                e,
            )
        })?;

    let elapsed = start.elapsed();
    tracing::info!(
        "query_transaction_status completed in {:?}",
        elapsed
    );

    Ok(result)
}

/// Estimate transaction fees for the specified chain.
///
/// Returns fee estimates for slow, normal, and fast confirmation times.
#[tauri::command]
pub async fn estimate_fee(
    queue: State<'_, LazyWalletQueue>,
    input: EstimateFeeInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "estimate_fee called: chain={}, from={}, to={}",
        input.chain_id,
        input.from,
        input.to
    );

    // Build JSON params for FFI call
    let params = json!({
        "chainId": input.chain_id,
        "from": input.from,
        "to": input.to,
        "amount": input.amount,
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
    });

    let params_json = serde_json::to_string(&params)
        .map_err(|e| format!("Failed to serialize params: {}", e))?;

    // Call FFI
    let result = queue
        .estimate_fee(params_json)
        .await
        .map_err(|e| {
            tracing::error!("estimate_fee FFI error: {}", e);
            AppError::with_details(
                ErrorCode::CliExecutionFailed,
                "Failed to estimate fees",
                e,
            )
        })?;

    let elapsed = start.elapsed();
    tracing::info!(
        "estimate_fee completed in {:?}",
        elapsed
    );

    Ok(result)
}
