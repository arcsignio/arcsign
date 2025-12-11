/**
 * Application-level authentication commands
 * Feature: App-level password and configuration management
 */

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::Error;
use crate::ffi::queue::LazyWalletQueue;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeAppInput {
    pub password: String,
    pub usb_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockAppInput {
    pub password: String,
    pub usb_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletMetadata {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub provider_type: String,
    pub api_key: String,
    pub priority: i32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettings {
    pub theme: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
    pub wallets: Vec<WalletMetadata>,
    pub providers: Vec<ProviderConfig>,
    pub settings: GlobalSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigResponse {
    pub config: AppConfig,
}

/// Check if this is first-time setup (app_config.enc doesn't exist)
#[tauri::command]
pub async fn is_first_time_setup(
    usb_path: String,
    queue: State<'_, LazyWalletQueue>,
) -> Result<bool, Error> {
    tracing::info!("is_first_time_setup: usb_path={}", usb_path);

    // Serialize input to JSON for FFI
    let params_json = serde_json::to_string(&serde_json::json!({
        "usbPath": usb_path,
    }))
    .map_err(|e| Error::new(
        crate::error::ErrorCode::SerializationError,
        format!("Failed to serialize input: {}", e)
    ))?;

    // Call FFI through queue
    let result = queue.is_first_time_setup(params_json).await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::InternalError,
            format!("Failed to check first-time setup: {}", e)
        ))?;

    // Parse response - Go returns {success: true, data: {isFirstTime: bool}}
    let is_first_time = result
        .get("data")
        .and_then(|data| data.get("isFirstTime"))
        .and_then(|v| v.as_bool())
        .ok_or_else(|| Error::new(
            crate::error::ErrorCode::InternalError,
            "Invalid response from FFI".to_string()
        ))?;

    Ok(is_first_time)
}

/// Initialize app config for first-time setup
#[tauri::command]
pub async fn initialize_app(
    input: InitializeAppInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<String, Error> {
    tracing::info!("initialize_app: usb_path={}", input.usb_path);

    // Serialize input to JSON for FFI
    let params_json = serde_json::to_string(&serde_json::json!({
        "password": input.password,
        "usbPath": input.usb_path,
    }))
    .map_err(|e| Error::new(
        crate::error::ErrorCode::SerializationError,
        format!("Failed to serialize input: {}", e)
    ))?;

    // Call FFI through queue
    let result = queue.initialize_app(params_json).await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::InternalError,
            format!("Failed to initialize app: {}", e)
        ))?;

    // Parse response - Go returns {success: true, data: {message: string}}
    let message = result
        .get("data")
        .and_then(|data| data.get("message"))
        .and_then(|v| v.as_str())
        .unwrap_or("App initialized successfully")
        .to_string();

    Ok(message)
}

/// Unlock app and load configuration
#[tauri::command]
pub async fn unlock_app(
    input: UnlockAppInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<AppConfig, Error> {
    tracing::info!("unlock_app: usb_path={}", input.usb_path);

    // Serialize input to JSON for FFI
    let params_json = serde_json::to_string(&serde_json::json!({
        "password": input.password,
        "usbPath": input.usb_path,
    }))
    .map_err(|e| Error::new(
        crate::error::ErrorCode::SerializationError,
        format!("Failed to serialize input: {}", e)
    ))?;

    // Call FFI through queue
    let result = queue.unlock_app(params_json).await
        .map_err(|e| Error::new(
            crate::error::ErrorCode::InternalError,
            format!("Failed to unlock app: {}", e)
        ))?;

    // Parse config from response - Go returns {success: true, data: {config: AppConfig}}
    let config_value = result
        .get("data")
        .and_then(|data| data.get("config"))
        .ok_or_else(|| Error::new(
            crate::error::ErrorCode::InternalError,
            "No config in response".to_string()
        ))?;

    let config: AppConfig = serde_json::from_value(config_value.clone())
        .map_err(|e| Error::new(
            crate::error::ErrorCode::SerializationError,
            format!("Failed to parse config: {}", e)
        ))?;

    Ok(config)
}
