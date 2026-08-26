/**
 * ERC-7730 clear-signing descriptor commands.
 *
 * SECURITY: these affect DISPLAY only. Nothing here feeds the blacklist,
 * requiresAcknowledge, or any signing gate. A missing or unusable descriptor
 * makes the frontend fall back to its existing calldata decoding — it never
 * blocks or weakens signing.
 *
 * Every optional field is `Option` / `#[serde(default)]` on purpose: a required
 * field the frontend forgets to send fails at the Tauri IPC deserialization
 * layer at runtime, where neither `tsc` nor `vitest` can catch it.
 */

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::Error;
use crate::ffi::queue::LazyWalletQueue;

/// A token the caller already knows about, so `tokenAmount` fields can render
/// with the right symbol and decimals without this layer issuing any RPC.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptorTokenInfo {
    pub address: String,
    pub symbol: String,
    pub decimals: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveDescriptorInput {
    pub chain_id: i64,
    pub to: String,
    /// 4-byte function selector, 0x-prefixed.
    pub selector: String,
    /// Calldata already decoded by the caller (this layer does no ABI decoding).
    #[serde(default)]
    pub decoded: serde_json::Value,
    #[serde(default)]
    pub usb_path: Option<String>,
    #[serde(default)]
    pub session_token: Option<String>,
    #[serde(default)]
    pub tokens: Vec<DescriptorTokenInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptorStoreInput {
    pub usb_path: String,
    #[serde(default)]
    pub session_token: Option<String>,
}

/// Unwrap the FFI envelope `{success, data, error}`.
///
/// `data: null` with `success: true` is a normal outcome for descriptor lookup
/// (no descriptor for this contract), so it maps to `Ok(Value::Null)` rather
/// than an error.
fn unwrap_ffi(result: serde_json::Value, context: &str) -> Result<serde_json::Value, Error> {
    if result.get("success").and_then(|v| v.as_bool()) == Some(true) {
        return Ok(result
            .get("data")
            .cloned()
            .unwrap_or(serde_json::Value::Null));
    }
    let code = result
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("INTERNAL_ERROR");
    Err(Error::new(
        crate::error::ErrorCode::InternalError,
        format!("{}: {}", context, code),
    ))
}

/// Render a transaction through its ERC-7730 descriptor.
/// Returns `null` when no descriptor matches — the caller then keeps its
/// existing calldata decoding.
#[tauri::command]
pub async fn resolve_descriptor(
    input: ResolveDescriptorInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    let params_json = serde_json::to_string(&serde_json::json!({
        "chainId": input.chain_id,
        "to": input.to,
        "selector": input.selector,
        "decoded": input.decoded,
        "usbPath": input.usb_path.unwrap_or_default(),
        "sessionToken": input.session_token.unwrap_or_default(),
        "tokens": input.tokens,
    }))
    .map_err(|e| {
        Error::new(
            crate::error::ErrorCode::SerializationError,
            format!("Failed to serialize descriptor request: {}", e),
        )
    })?;

    let result = queue
        .resolve_descriptor(params_json)
        .await
        .map_err(|e| Error::new(crate::error::ErrorCode::InternalError, e))?;

    unwrap_ffi(result, "resolve_descriptor")
}

/// Download the latest descriptor set and store it encrypted on the USB.
/// This is the only descriptor code path that touches the network, and it runs
/// only when the user explicitly asks for an update.
#[tauri::command]
pub async fn update_descriptors(
    input: DescriptorStoreInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    tracing::info!("update_descriptors: fetching latest ERC-7730 registry");

    let params_json = serde_json::to_string(&serde_json::json!({
        "usbPath": input.usb_path,
        "sessionToken": input.session_token.unwrap_or_default(),
    }))
    .map_err(|e| {
        Error::new(
            crate::error::ErrorCode::SerializationError,
            format!("Failed to serialize update request: {}", e),
        )
    })?;

    let result = queue
        .update_descriptors(params_json)
        .await
        .map_err(|e| Error::new(crate::error::ErrorCode::InternalError, e))?;

    unwrap_ffi(result, "update_descriptors")
}

/// Report the active descriptor set's version and size.
#[tauri::command]
pub async fn get_descriptor_status(
    input: DescriptorStoreInput,
    queue: State<'_, LazyWalletQueue>,
) -> Result<serde_json::Value, Error> {
    let params_json = serde_json::to_string(&serde_json::json!({
        "usbPath": input.usb_path,
        "sessionToken": input.session_token.unwrap_or_default(),
    }))
    .map_err(|e| {
        Error::new(
            crate::error::ErrorCode::SerializationError,
            format!("Failed to serialize status request: {}", e),
        )
    })?;

    let result = queue
        .get_descriptor_status(params_json)
        .await
        .map_err(|e| Error::new(crate::error::ErrorCode::InternalError, e))?;

    unwrap_ffi(result, "get_descriptor_status")
}
