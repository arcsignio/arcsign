/**
 * Developer Mode Signing History Commands
 *
 * Handles persistence of signing history for developer mode.
 * Stores JSON files on USB device, per-wallet basis.
 * Consistent with project pattern (WalletConnect sessions also stored on USB).
 */

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Maximum number of history entries per wallet
const MAX_HISTORY_ENTRIES: usize = 500;

/// Directory name for dev history files on USB
const DEV_HISTORY_DIR: &str = "dev_history";

/// Signing history entry (matches frontend DevSignRequest)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SigningHistoryEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub tx_type: String, // "deploy" | "call" | "sign"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub from: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<String>,
    pub network: String,
    pub chain_id: u64,
    pub status: String, // "approved" | "rejected"
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

/// Signing history file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SigningHistoryFile {
    version: u32,
    wallet_id: String,
    entries: Vec<SigningHistoryEntry>,
    updated_at: u64,
}

impl SigningHistoryFile {
    fn new(wallet_id: String) -> Self {
        Self {
            version: 1,
            wallet_id,
            entries: Vec::new(),
            updated_at: 0,
        }
    }
}

/// Get the history file path for a wallet (on USB device)
fn get_history_file_path(usb_path: &str, wallet_id: &str) -> Result<PathBuf, String> {
    let usb_dir = PathBuf::from(usb_path);

    if !usb_dir.exists() {
        return Err("USB device not accessible".to_string());
    }

    // Create dev_history subdirectory on USB
    let history_dir = usb_dir.join(DEV_HISTORY_DIR);
    if !history_dir.exists() {
        fs::create_dir_all(&history_dir)
            .map_err(|e| format!("Failed to create history dir: {}", e))?;
    }

    // Sanitize wallet_id for filename (remove special chars)
    let safe_wallet_id: String = wallet_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();

    Ok(history_dir.join(format!("{}.json", safe_wallet_id)))
}

/// Load signing history from file
fn load_history_file(path: &PathBuf) -> Result<SigningHistoryFile, String> {
    if !path.exists() {
        return Err("History file does not exist".to_string());
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read history file: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse history file: {}", e))
}

/// Save signing history to file
fn save_history_file(path: &PathBuf, history: &SigningHistoryFile) -> Result<(), String> {
    let content = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("Failed to write history file: {}", e))
}

/// Load developer signing history for a wallet
#[tauri::command]
pub async fn load_dev_signing_history(
    usb_path: String,
    wallet_id: String,
) -> Result<Vec<SigningHistoryEntry>, String> {
    tracing::info!("load_dev_signing_history: wallet_id={}", wallet_id);

    let path = get_history_file_path(&usb_path, &wallet_id)?;

    match load_history_file(&path) {
        Ok(history) => {
            tracing::info!(
                "Loaded {} history entries for wallet {}",
                history.entries.len(),
                wallet_id
            );
            Ok(history.entries)
        }
        Err(_) => {
            // File doesn't exist or is corrupted - return empty history
            tracing::info!("No history file found for wallet {}, returning empty", wallet_id);
            Ok(Vec::new())
        }
    }
}

/// Append a new entry to developer signing history
#[tauri::command]
pub async fn append_dev_signing_history(
    usb_path: String,
    wallet_id: String,
    entry: SigningHistoryEntry,
) -> Result<(), String> {
    tracing::info!(
        "append_dev_signing_history: wallet_id={}, entry_id={}, status={}",
        wallet_id,
        entry.id,
        entry.status
    );

    let path = get_history_file_path(&usb_path, &wallet_id)?;

    // Load existing history or create new
    let mut history = match load_history_file(&path) {
        Ok(h) => h,
        Err(_) => SigningHistoryFile::new(wallet_id.clone()),
    };

    // Append new entry
    history.entries.push(entry);

    // Prune old entries if exceeds limit
    if history.entries.len() > MAX_HISTORY_ENTRIES {
        let excess = history.entries.len() - MAX_HISTORY_ENTRIES;
        history.entries.drain(0..excess);
        tracing::info!("Pruned {} old history entries", excess);
    }

    // Update timestamp
    history.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    // Save
    save_history_file(&path, &history)?;

    tracing::info!(
        "Saved history with {} entries for wallet {}",
        history.entries.len(),
        wallet_id
    );

    Ok(())
}

/// Clear all developer signing history for a wallet
#[tauri::command]
pub async fn clear_dev_signing_history(
    usb_path: String,
    wallet_id: String,
) -> Result<(), String> {
    tracing::info!("clear_dev_signing_history: wallet_id={}", wallet_id);

    let path = get_history_file_path(&usb_path, &wallet_id)?;

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete history file: {}", e))?;
        tracing::info!("Deleted history file for wallet {}", wallet_id);
    }

    Ok(())
}
