/**
 * Provider configuration commands
 * Feature: Provider Registry System - API Key Management
 * TODO: Implement provider methods in WalletQueue
 */

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::Error;
use crate::ffi::queue::LazyWalletQueue;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetProviderConfigInput {
    pub provider_type: String,
    pub api_key: String,
    pub chain_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_endpoint: Option<String>,
    #[serde(default = "default_priority")]
    pub priority: i32,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub password: String,
    pub usb_path: String,
}

fn default_priority() -> i32 {
    100
}

fn default_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetProviderConfigInput {
    pub chain_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_type: Option<String>,
    pub password: String,
    pub usb_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListProviderConfigsInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chain_id: Option<String>,
    pub password: String,
    pub usb_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProviderConfigInput {
    pub chain_id: String,
    pub provider_type: String,
    pub password: String,
    pub usb_path: String,
}

/// Set provider configuration (Tauri command)
#[tauri::command]
pub async fn set_provider_config(
    input: SetProviderConfigInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!(
        "set_provider_config: provider_type={}, chain_id={}",
        input.provider_type,
        input.chain_id
    );

    // Serialize input to JSON for FFI
    let params_json = serde_json::to_string(&serde_json::json!({
        "providerType": input.provider_type,
        "apiKey": input.api_key,
        "chainId": input.chain_id,
        "networkId": input.network_id.unwrap_or_default(),
        "customEndpoint": input.custom_endpoint.unwrap_or_default(),
        "priority": input.priority,
        "enabled": input.enabled,
        "password": input.password,
        "usbPath": input.usb_path,
    }))
    .map_err(|e| Error::new(
        crate::error::ErrorCode::SerializationError,
        format!("Failed to serialize provider config: {}", e)
    ))?;

    // Call FFI through queue
    let result = queue.set_provider_config(params_json).await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::InternalError,
            format!("Failed to set provider config: {}", e)
        ))?;

    Ok(result)
}

/// Get provider configuration (Tauri command)
#[tauri::command]
pub async fn get_provider_config(
    input: GetProviderConfigInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!(
        "get_provider_config: chain_id={}, provider_type={:?}",
        input.chain_id,
        input.provider_type
    );

    // Serialize input to JSON for FFI
    let params_json = serde_json::to_string(&serde_json::json!({
        "chainId": input.chain_id,
        "providerType": input.provider_type.unwrap_or_default(),
        "password": input.password,
        "usbPath": input.usb_path,
    }))
    .map_err(|e| Error::new(
        crate::error::ErrorCode::SerializationError,
        format!("Failed to serialize provider config request: {}", e)
    ))?;

    // Call FFI through queue
    let result = queue.get_provider_config(params_json).await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::InternalError,
            format!("Failed to get provider config: {}", e)
        ))?;

    Ok(result)
}

/// List provider configurations (Tauri command)
#[tauri::command]
pub async fn list_provider_configs(
    input: ListProviderConfigsInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!("list_provider_configs: chain_id={:?}", input.chain_id);

    // Serialize input to JSON for FFI
    let params_json = serde_json::to_string(&serde_json::json!({
        "chainId": input.chain_id.unwrap_or_default(),
        "password": input.password,
        "usbPath": input.usb_path,
    }))
    .map_err(|e| Error::new(
        crate::error::ErrorCode::SerializationError,
        format!("Failed to serialize list request: {}", e)
    ))?;

    // Call FFI through queue
    let result = queue.list_provider_configs(params_json).await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::InternalError,
            format!("Failed to list provider configs: {}", e)
        ))?;

    Ok(result)
}

/// Delete provider configuration (Tauri command)
#[tauri::command]
pub async fn delete_provider_config(
    input: DeleteProviderConfigInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!(
        "delete_provider_config: chain_id={}, provider_type={}",
        input.chain_id,
        input.provider_type
    );

    // Serialize input to JSON for FFI
    let params_json = serde_json::to_string(&serde_json::json!({
        "chainId": input.chain_id,
        "providerType": input.provider_type,
        "password": input.password,
        "usbPath": input.usb_path,
    }))
    .map_err(|e| Error::new(
        crate::error::ErrorCode::SerializationError,
        format!("Failed to serialize delete request: {}", e)
    ))?;

    // Call FFI through queue
    let result = queue.delete_provider_config(params_json).await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::InternalError,
            format!("Failed to delete provider config: {}", e)
        ))?;

    Ok(result)
}
