/**
 * Developer Mode Settings Commands
 *
 * Handles persistence of developer settings (API keys, etc.)
 * Stores JSON files on USB device.
 * Consistent with project pattern (dev_history also stored on USB).
 */

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Directory name for dev settings on USB
const DEV_SETTINGS_DIR: &str = "dev_settings";

/// Settings file name
const SETTINGS_FILE: &str = "settings.json";

/// Block explorer API keys
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerApiKeys {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub etherscan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bscscan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub polygonscan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arbiscan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optimism: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub basescan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snowtrace: Option<String>,
}

/// Developer settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevSettings {
    pub version: u32,
    pub explorer_api_keys: ExplorerApiKeys,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_wallet_id: Option<String>,
    pub updated_at: u64,
}

impl Default for DevSettings {
    fn default() -> Self {
        Self {
            version: 1,
            explorer_api_keys: ExplorerApiKeys::default(),
            default_wallet_id: None,
            updated_at: 0,
        }
    }
}

/// Get the settings file path (on USB device)
fn get_settings_file_path(usb_path: &str) -> Result<PathBuf, String> {
    let usb_dir = PathBuf::from(usb_path);

    if !usb_dir.exists() {
        return Err("USB device not accessible".to_string());
    }

    // Create dev_settings subdirectory on USB
    let settings_dir = usb_dir.join(DEV_SETTINGS_DIR);
    if !settings_dir.exists() {
        fs::create_dir_all(&settings_dir)
            .map_err(|e| format!("Failed to create settings dir: {}", e))?;
    }

    Ok(settings_dir.join(SETTINGS_FILE))
}

/// Load settings from file
fn load_settings_file(path: &PathBuf) -> Result<DevSettings, String> {
    if !path.exists() {
        return Ok(DevSettings::default());
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings file: {}", e))
}

/// Save settings to file
fn save_settings_file(path: &PathBuf, settings: &DevSettings) -> Result<(), String> {
    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))
}

/// Load developer settings
#[tauri::command]
pub async fn load_dev_settings(usb_path: String) -> Result<DevSettings, String> {
    tracing::info!("load_dev_settings");

    let path = get_settings_file_path(&usb_path)?;

    match load_settings_file(&path) {
        Ok(settings) => {
            tracing::info!("Loaded dev settings");
            Ok(settings)
        }
        Err(e) => {
            tracing::warn!("Failed to load dev settings: {}, returning defaults", e);
            Ok(DevSettings::default())
        }
    }
}

/// Save developer settings
#[tauri::command]
pub async fn save_dev_settings(
    usb_path: String,
    settings: DevSettings,
) -> Result<(), String> {
    tracing::info!("save_dev_settings");

    let path = get_settings_file_path(&usb_path)?;

    // Update timestamp
    let mut settings = settings;
    settings.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    save_settings_file(&path, &settings)?;

    tracing::info!("Saved dev settings");

    Ok(())
}
