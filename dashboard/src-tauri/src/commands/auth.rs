/// Session Management Commands
///
/// Provides token-based authentication to avoid storing passwords in frontend.
/// Tokens are created after validating credentials and have a 24-hour expiration.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::ffi::queue::WalletQueue;

/// Input for creating a session token
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionInput {
    pub usb_path: String,
    pub app_password: String,
}

/// Response from creating a session token
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTokenResponse {
    pub token: String,
    pub expires_at: i64,
    pub usb_path: String,
}

/// Input for validating a session token
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateTokenInput {
    pub token: String,
}

/// Response from validating a session token
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateTokenResponse {
    pub valid: bool,
    pub usb_path: String,
    pub expires_at: i64,
}

/// Input for revoking a session token
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeTokenInput {
    pub token: String,
}

/// Response from revoking a session token
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeTokenResponse {
    pub revoked: bool,
}

/// Create a new session token after validating credentials.
///
/// This replaces direct password usage - the frontend sends password once
/// to create a token, then uses the token for subsequent operations.
///
/// # Arguments
/// * `input` - Contains USB path and app password
/// * `queue` - Wallet queue for FFI operations
///
/// # Returns
/// Session token with expiration time
///
/// # Security
/// - Password is validated by Go backend before creating token
/// - Token expires after 24 hours
/// - Token can be revoked explicitly
/// - Frontend should store token in memory (Zustand), not sessionStorage
#[tauri::command]
pub async fn create_session(
    input: CreateSessionInput,
    queue: State<'_, WalletQueue>,
) -> Result<SessionTokenResponse, String> {
    let params = serde_json::json!({
        "usbPath": input.usb_path,
        "appPassword": input.app_password,
    });

    let result = queue
        .call_with_params("create_session_token", params.to_string())
        .await
        .map_err(|e| format!("Failed to create session: {}", e))?;

    let response: SessionTokenResponse = serde_json::from_value(result)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(response)
}

/// Validate a session token and get session information.
///
/// Use this to check if a token is still valid before operations,
/// or to get the associated USB path.
///
/// # Arguments
/// * `input` - Contains token to validate
/// * `queue` - Wallet queue for FFI operations
///
/// # Returns
/// Validation result with USB path and expiration time
#[tauri::command]
pub async fn validate_session(
    input: ValidateTokenInput,
    queue: State<'_, WalletQueue>,
) -> Result<ValidateTokenResponse, String> {
    let params = serde_json::json!({
        "token": input.token,
    });

    let result = queue
        .call_with_params("validate_session_token", params.to_string())
        .await
        .map_err(|e| format!("Failed to validate session: {}", e))?;

    let response: ValidateTokenResponse = serde_json::from_value(result)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(response)
}

/// Revoke (invalidate) a session token.
///
/// Call this on logout or when the user explicitly ends their session.
/// Revoked tokens cannot be used for any operations.
///
/// # Arguments
/// * `input` - Contains token to revoke
/// * `queue` - Wallet queue for FFI operations
///
/// # Returns
/// Confirmation that token was revoked
#[tauri::command]
pub async fn revoke_session(
    input: RevokeTokenInput,
    queue: State<'_, WalletQueue>,
) -> Result<RevokeTokenResponse, String> {
    let params = serde_json::json!({
        "token": input.token,
    });

    let result = queue
        .call_with_params("revoke_session_token", params.to_string())
        .await
        .map_err(|e| format!("Failed to revoke session: {}", e))?;

    let response: RevokeTokenResponse = serde_json::from_value(result)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(response)
}

// ============================================================================
// Wallet Session Management Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWalletSessionInput {
    pub wallet_id: String,
    pub password: String,
    pub usb_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletSessionTokenResponse {
    pub token: String,
    pub wallet_id: String,
    pub expires_at: i64,
    pub usb_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateWalletTokenInput {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateWalletTokenResponse {
    pub valid: bool,
    pub wallet_id: String,
    pub expires_at: i64,
    pub usb_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeWalletTokenInput {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeWalletTokenResponse {
    pub revoked: bool,
}

/// Create a wallet session token by validating wallet password.
///
/// This creates a time-limited session (15 minutes) that allows wallet operations
/// without re-entering the password each time.
///
/// # Arguments
/// * `input` - Contains wallet ID, password, and USB path
/// * `queue` - Wallet queue for FFI operations
///
/// # Returns
/// Session token with expiration time
#[tauri::command]
pub async fn create_wallet_session(
    input: CreateWalletSessionInput,
    queue: State<'_, WalletQueue>,
) -> Result<WalletSessionTokenResponse, String> {
    let params = serde_json::json!({
        "walletId": input.wallet_id,
        "password": input.password,
        "usbPath": input.usb_path,
    });

    let result = queue
        .call_with_params("create_wallet_session_token", params.to_string())
        .await
        .map_err(|e| format!("Failed to create wallet session: {}", e))?;

    let response: WalletSessionTokenResponse = serde_json::from_value(result)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(response)
}

/// Validate a wallet session token and get session information.
///
/// Use this to check if a wallet token is still valid before operations.
///
/// # Arguments
/// * `input` - Contains token to validate
/// * `queue` - Wallet queue for FFI operations
///
/// # Returns
/// Validation result with wallet ID and expiration time
#[tauri::command]
pub async fn validate_wallet_session(
    input: ValidateWalletTokenInput,
    queue: State<'_, WalletQueue>,
) -> Result<ValidateWalletTokenResponse, String> {
    let params = serde_json::json!({
        "token": input.token,
    });

    let result = queue
        .call_with_params("validate_wallet_session_token", params.to_string())
        .await
        .map_err(|e| format!("Failed to validate wallet session: {}", e))?;

    let response: ValidateWalletTokenResponse = serde_json::from_value(result)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(response)
}

/// Revoke (invalidate) a wallet session token.
///
/// Use this to explicitly end a wallet session, clearing the backend state.
///
/// # Arguments
/// * `input` - Contains token to revoke
/// * `queue` - Wallet queue for FFI operations
///
/// # Returns
/// Confirmation of revocation
#[tauri::command]
pub async fn revoke_wallet_session(
    input: RevokeWalletTokenInput,
    queue: State<'_, WalletQueue>,
) -> Result<RevokeWalletTokenResponse, String> {
    let params = serde_json::json!({
        "token": input.token,
    });

    let result = queue
        .call_with_params("revoke_wallet_session_token", params.to_string())
        .await
        .map_err(|e| format!("Failed to revoke wallet session: {}", e))?;

    let response: RevokeWalletTokenResponse = serde_json::from_value(result)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(response)
}
