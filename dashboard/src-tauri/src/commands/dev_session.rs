/**
 * Developer Mode Session Commands
 *
 * Provides Tauri commands for managing developer sessions.
 * Sessions allow auto-signing of testnet transactions without password.
 *
 * Created: 2026-02-09
 */

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ffi::LazyWalletQueue;
use crate::websocket::WebSocketServer;
use crate::websocket::protocol::DevSession;

/// Response from creating a dev session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDevSessionResponse {
    pub session_token: String,
    pub expires_at: u64,
    pub trusted_networks: Vec<String>,
    pub addresses: Vec<String>,
}

/// Response from getting dev session info
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevSessionInfo {
    pub active: bool,
    pub wallet_id: Option<String>,
    pub expires_at: Option<u64>,
    pub remaining_ms: Option<i64>,
    pub sign_count: Option<u32>,
    pub trusted_networks: Option<Vec<String>>,
    pub addresses: Option<Vec<String>>,
    pub message: Option<String>,
}

/// Response from dev session signing
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevSessionSignResponse {
    pub signed_tx: String,
    pub tx_hash: String,
    pub signed_by: String,
}

/// Create a developer session for auto-signing testnets.
/// User enters password once, session lasts for configured duration.
#[tauri::command]
pub async fn create_dev_session(
    wallet_id: String,
    password: String,
    passphrase: Option<String>,
    usb_path: String,
    duration_minutes: Option<u32>,
    trusted_networks: Option<Vec<String>>,
    wallet_queue: tauri::State<'_, LazyWalletQueue>,
    ws_server: tauri::State<'_, Arc<RwLock<WebSocketServer>>>,
) -> Result<CreateDevSessionResponse, String> {
    tracing::info!("create_dev_session for wallet: {}", wallet_id);

    let trusted_networks_input = trusted_networks.clone().unwrap_or_else(|| vec![
        "sepolia".to_string(),
        "goerli".to_string(),
        "bsc-testnet".to_string(),
        "mumbai".to_string(),
    ]);

    let params = serde_json::json!({
        "walletId": wallet_id,
        "password": password,
        "passphrase": passphrase.unwrap_or_default(),
        "usbPath": usb_path,
        "durationMinutes": duration_minutes.unwrap_or(30),
        "trustedNetworks": trusted_networks_input.clone(),
    });

    let result = wallet_queue
        .create_dev_session(params.to_string())
        .await?;

    // Parse the response
    let session_token = result["sessionToken"]
        .as_str()
        .ok_or("Missing sessionToken")?
        .to_string();

    let expires_at = result["expiresAt"]
        .as_u64()
        .ok_or("Missing expiresAt")?;

    let trusted_networks: Vec<String> = result["trustedNetworks"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    let addresses = result["addresses"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    // Create session state for WebSocket server
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let ws_session = DevSession {
        enabled: true,
        wallet_id: Some(wallet_id.clone()),
        session_token: Some(session_token.clone()),
        created_at: now,
        expires_at,
        trusted_networks: trusted_networks.clone(),
        max_gas_limit: None,
        sign_count: 0,
    };

    // Update WebSocket server's session state
    {
        let server = ws_server.read().await;
        server.set_dev_session(Some(ws_session)).await;
    }

    tracing::info!("Dev session created and synced to WebSocket server, expires at: {}", expires_at);

    Ok(CreateDevSessionResponse {
        session_token,
        expires_at,
        trusted_networks,
        addresses,
    })
}

/// Get information about a dev session
#[tauri::command]
pub async fn get_dev_session(
    session_token: String,
    wallet_queue: tauri::State<'_, LazyWalletQueue>,
) -> Result<DevSessionInfo, String> {
    tracing::info!("get_dev_session");

    let params = serde_json::json!({
        "sessionToken": session_token,
    });

    let result = wallet_queue
        .get_dev_session(params.to_string())
        .await?;

    let active = result["active"].as_bool().unwrap_or(false);

    if !active {
        return Ok(DevSessionInfo {
            active: false,
            wallet_id: None,
            expires_at: None,
            remaining_ms: None,
            sign_count: None,
            trusted_networks: None,
            addresses: None,
            message: result["message"].as_str().map(String::from),
        });
    }

    Ok(DevSessionInfo {
        active: true,
        wallet_id: result["walletId"].as_str().map(String::from),
        expires_at: result["expiresAt"].as_u64(),
        remaining_ms: result["remainingMs"].as_i64(),
        sign_count: result["signCount"].as_u64().map(|v| v as u32),
        trusted_networks: result["trustedNetworks"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()),
        addresses: result["addresses"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()),
        message: None,
    })
}

/// Sign a transaction using an active dev session (no password required)
#[tauri::command]
pub async fn dev_session_sign(
    session_token: String,
    chain_id: u64,
    from: String,
    to: String,
    data: String,
    value: String,
    gas: String,
    gas_price: Option<String>,
    max_fee_per_gas: Option<String>,
    max_priority_fee_per_gas: Option<String>,
    nonce: u64,
    wallet_queue: tauri::State<'_, LazyWalletQueue>,
) -> Result<DevSessionSignResponse, String> {
    tracing::info!("dev_session_sign: chainId={}, from={}", chain_id, from);

    let params = serde_json::json!({
        "sessionToken": session_token,
        "chainId": chain_id,
        "from": from,
        "to": to,
        "data": data,
        "value": value,
        "gas": gas,
        "gasPrice": gas_price,
        "maxFeePerGas": max_fee_per_gas,
        "maxPriorityFeePerGas": max_priority_fee_per_gas,
        "nonce": nonce,
    });

    let result = wallet_queue
        .dev_session_sign(params.to_string())
        .await?;

    let signed_tx = result["signedTx"]
        .as_str()
        .ok_or("Missing signedTx")?
        .to_string();

    let tx_hash = result["txHash"]
        .as_str()
        .ok_or("Missing txHash")?
        .to_string();

    let signed_by = result["signedBy"]
        .as_str()
        .ok_or("Missing signedBy")?
        .to_string();

    tracing::info!("Dev session signed tx: {}", tx_hash);

    Ok(DevSessionSignResponse {
        signed_tx,
        tx_hash,
        signed_by,
    })
}

/// End a developer session and clear all stored keys
#[tauri::command]
pub async fn end_dev_session(
    session_token: String,
    wallet_queue: tauri::State<'_, LazyWalletQueue>,
    ws_server: tauri::State<'_, Arc<RwLock<WebSocketServer>>>,
) -> Result<(), String> {
    tracing::info!("end_dev_session");

    let params = serde_json::json!({
        "sessionToken": session_token,
    });

    let _ = wallet_queue
        .end_dev_session(params.to_string())
        .await?;

    // Clear WebSocket server's session state
    {
        let server = ws_server.read().await;
        server.set_dev_session(None).await;
    }

    tracing::info!("Dev session ended and cleared from WebSocket server");

    Ok(())
}
