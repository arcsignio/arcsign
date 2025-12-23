/**
 * Swap commands for DEX aggregator operations
 * Feature: Token Swap via 1inch DEX Aggregator
 * Created: 2025-12-19
 *
 * Provides Tauri commands for:
 * - Getting swap quotes from 1inch
 * - Building swap transactions
 * - Checking token allowances
 * - Getting approval transactions
 */

use crate::ffi::LazyWalletQueue;
use serde::Deserialize;
use serde_json::json;
use std::time::Instant;
use tauri::State;
use zeroize::Zeroize;

// ============================================================================
// Request/Response Types
// ============================================================================

/// Input for getting a swap quote
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSwapQuoteInput {
    /// Chain identifier: "ethereum", "polygon", "arbitrum", etc.
    pub chain_id: String,
    /// Source token address (use native token address for ETH/MATIC etc.)
    pub from_token_address: String,
    /// Destination token address
    pub to_token_address: String,
    /// Amount to swap (in wei/smallest unit)
    pub amount: String,
    /// User's wallet address
    pub from_address: String,
    /// Slippage tolerance percentage (e.g., 0.5 for 0.5%)
    #[serde(default = "default_slippage")]
    pub slippage: f64,
    /// USB path for provider config
    pub usb_path: String,
    /// App password for provider config decryption
    pub app_password: String,
}

fn default_slippage() -> f64 {
    0.5
}

/// Input for building a swap transaction
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildSwapTransactionInput {
    /// Chain identifier
    pub chain_id: String,
    /// Source token address
    pub from_token_address: String,
    /// Destination token address
    pub to_token_address: String,
    /// Amount to swap (in wei)
    pub amount: String,
    /// User's wallet address
    pub from_address: String,
    /// Slippage tolerance percentage
    #[serde(default = "default_slippage")]
    pub slippage: f64,
    /// USB path
    pub usb_path: String,
    /// App password
    pub app_password: String,
}

/// Input for getting approval transaction
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSwapApprovalInput {
    /// Chain identifier
    pub chain_id: String,
    /// Token contract address to approve
    pub token_address: String,
    /// Amount to approve (empty for unlimited)
    #[serde(default)]
    pub amount: String,
    /// USB path
    pub usb_path: String,
    /// App password
    pub app_password: String,
}

/// Input for checking token allowance
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckSwapAllowanceInput {
    /// Chain identifier
    pub chain_id: String,
    /// Token contract address
    pub token_address: String,
    /// Wallet address to check allowance for
    pub wallet_address: String,
    /// USB path
    pub usb_path: String,
    /// App password
    pub app_password: String,
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Get a swap quote from 1inch DEX aggregator.
///
/// Returns quote with estimated output amount, price impact, gas cost, etc.
#[tauri::command]
pub async fn get_swap_quote(
    queue: State<'_, LazyWalletQueue>,
    input: GetSwapQuoteInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "[swap::get_swap_quote] Getting quote: {} -> {} on {}",
        input.from_token_address,
        input.to_token_address,
        input.chain_id
    );

    // Build FFI request JSON
    let mut app_password = input.app_password;
    let ffi_params = json!({
        "chainId": input.chain_id,
        "fromTokenAddress": input.from_token_address,
        "toTokenAddress": input.to_token_address,
        "amount": input.amount,
        "fromAddress": input.from_address,
        "slippage": input.slippage,
        "usbPath": input.usb_path,
        "appPassword": app_password
    });

    // Clear password from memory
    app_password.zeroize();

    // Call FFI via queue
    let result = queue.get_swap_quote(ffi_params.to_string()).await?;

    tracing::info!(
        "[swap::get_swap_quote] Quote received in {:?}",
        start.elapsed()
    );

    Ok(result)
}

/// Build a complete swap transaction ready for signing.
///
/// Returns transaction data that can be signed and broadcast.
#[tauri::command]
pub async fn build_swap_transaction(
    queue: State<'_, LazyWalletQueue>,
    input: BuildSwapTransactionInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "[swap::build_swap_transaction] Building swap tx: {} -> {} on {}",
        input.from_token_address,
        input.to_token_address,
        input.chain_id
    );

    let mut app_password = input.app_password;
    let ffi_params = json!({
        "chainId": input.chain_id,
        "fromTokenAddress": input.from_token_address,
        "toTokenAddress": input.to_token_address,
        "amount": input.amount,
        "fromAddress": input.from_address,
        "slippage": input.slippage,
        "usbPath": input.usb_path,
        "appPassword": app_password
    });

    app_password.zeroize();

    let result = queue.build_swap_transaction(ffi_params.to_string()).await?;

    tracing::info!(
        "[swap::build_swap_transaction] Swap tx built in {:?}",
        start.elapsed()
    );

    Ok(result)
}

/// Get the approval transaction for an ERC-20 token.
///
/// Required before swapping ERC-20 tokens to authorize 1inch router.
#[tauri::command]
pub async fn get_swap_approval(
    queue: State<'_, LazyWalletQueue>,
    input: GetSwapApprovalInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "[swap::get_swap_approval] Getting approval tx for {} on {}",
        input.token_address,
        input.chain_id
    );

    let mut app_password = input.app_password;
    let ffi_params = json!({
        "chainId": input.chain_id,
        "tokenAddress": input.token_address,
        "amount": input.amount,
        "usbPath": input.usb_path,
        "appPassword": app_password
    });

    app_password.zeroize();

    let result = queue.get_swap_approval(ffi_params.to_string()).await?;

    tracing::info!(
        "[swap::get_swap_approval] Approval tx retrieved in {:?}",
        start.elapsed()
    );

    Ok(result)
}

/// Check the current token allowance for 1inch router.
///
/// Returns whether approval is needed before swapping.
#[tauri::command]
pub async fn check_swap_allowance(
    queue: State<'_, LazyWalletQueue>,
    input: CheckSwapAllowanceInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "[swap::check_swap_allowance] Checking allowance for {} on {}",
        input.token_address,
        input.chain_id
    );

    let mut app_password = input.app_password;
    let ffi_params = json!({
        "chainId": input.chain_id,
        "tokenAddress": input.token_address,
        "walletAddress": input.wallet_address,
        "usbPath": input.usb_path,
        "appPassword": app_password
    });

    app_password.zeroize();

    let result = queue.check_swap_allowance(ffi_params.to_string()).await?;

    tracing::info!(
        "[swap::check_swap_allowance] Allowance checked in {:?}",
        start.elapsed()
    );

    Ok(result)
}

/// Get the native token address used by 1inch API.
///
/// Native tokens (ETH, MATIC, etc.) use this special address.
#[tauri::command]
pub async fn get_native_token_address(
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, String> {
    let result = queue.get_native_token_address().await?;
    Ok(result)
}

/// Input for getting swap tokens
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSwapTokensInput {
    /// Chain identifier
    pub chain_id: String,
    /// USB path for provider config
    pub usb_path: String,
    /// App password for provider config decryption
    pub app_password: String,
}

/// Get all available swap tokens for a chain from 1inch API.
///
/// Returns a list of tokens that can be swapped on the specified chain.
#[tauri::command]
pub async fn get_swap_tokens(
    queue: State<'_, LazyWalletQueue>,
    input: GetSwapTokensInput,
) -> Result<serde_json::Value, String> {
    let start = Instant::now();
    tracing::info!(
        "[swap::get_swap_tokens] Getting tokens for chain {}",
        input.chain_id
    );

    let mut app_password = input.app_password;
    let ffi_params = json!({
        "chainId": input.chain_id,
        "usbPath": input.usb_path,
        "appPassword": app_password
    });

    app_password.zeroize();

    let result = queue.get_swap_tokens(ffi_params.to_string()).await?;

    tracing::info!(
        "[swap::get_swap_tokens] Tokens retrieved in {:?}",
        start.elapsed()
    );

    Ok(result)
}
