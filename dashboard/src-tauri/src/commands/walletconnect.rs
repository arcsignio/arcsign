/**
 * WalletConnect session persistence commands
 * Feature: WalletConnect v2 integration - Secure session storage
 * Updated: 2026-01-14
 *
 * Security: Sessions are encrypted using Session Token-derived key
 * Storage: USB-only (wc_sessions.json)
 */

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;

type HmacSha256 = Hmac<Sha256>;

const WC_SESSIONS_FILE: &str = "wc_sessions.json";
const NONCE_SIZE: usize = 12;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WCSession {
    pub topic: String,
    pub data: String, // JSON string of PersistedSession
}

#[derive(Debug, Serialize, Deserialize)]
struct EncryptedSessionsFile {
    version: u32,
    nonce: Vec<u8>,
    ciphertext: Vec<u8>,
    hmac: Vec<u8>,
}

/// Derive encryption key from Session Token
/// Uses HKDF-SHA256 for key derivation
fn derive_key_from_token(session_token: &str, salt: &str) -> Result<[u8; 32], String> {
    use hkdf::Hkdf;

    let hk = Hkdf::<Sha256>::new(Some(salt.as_bytes()), session_token.as_bytes());
    let mut okm = [0u8; 32];

    hk.expand(b"walletconnect-session-encryption", &mut okm)
        .map_err(|e| format!("Key derivation failed: {}", e))?;

    Ok(okm)
}

/// Save WalletConnect sessions to USB (encrypted + HMAC)
#[tauri::command]
pub async fn save_wc_sessions(
    usb_path: String,
    sessions: Vec<WCSession>,
    session_token: String,
) -> Result<(), String> {
    tracing::info!("Saving {} WalletConnect sessions to USB", sessions.len());

    // Serialize sessions to JSON
    let sessions_json = serde_json::to_string(&sessions)
        .map_err(|e| format!("Failed to serialize sessions: {}", e))?;

    // Derive encryption key from session token
    let key_bytes = derive_key_from_token(&session_token, "arcsign-wc-v1")?;
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, sessions_json.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Generate HMAC for integrity
    let mut mac = <HmacSha256 as KeyInit>::new_from_slice(&key_bytes)
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;
    mac.update(&nonce_bytes);
    mac.update(&ciphertext);
    let hmac_result = mac.finalize().into_bytes().to_vec();

    // Construct encrypted file
    let encrypted_file = EncryptedSessionsFile {
        version: 1,
        nonce: nonce_bytes.to_vec(),
        ciphertext,
        hmac: hmac_result,
    };

    // Write to USB
    let file_path = PathBuf::from(usb_path).join(WC_SESSIONS_FILE);
    let json = serde_json::to_string_pretty(&encrypted_file)
        .map_err(|e| format!("Failed to serialize encrypted file: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write to USB: {}", e))?;

    tracing::info!("WalletConnect sessions saved successfully");
    Ok(())
}

/// Load WalletConnect sessions from USB (decrypt + verify HMAC)
#[tauri::command]
pub async fn load_wc_sessions(
    usb_path: String,
    session_token: String,
) -> Result<Vec<WCSession>, String> {
    tracing::info!("Loading WalletConnect sessions from USB");

    let file_path = PathBuf::from(usb_path).join(WC_SESSIONS_FILE);

    // Check if file exists
    if !file_path.exists() {
        tracing::info!("No WalletConnect sessions file found");
        return Ok(vec![]);
    }

    // Read encrypted file
    let json = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read from USB: {}", e))?;

    let encrypted_file: EncryptedSessionsFile = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse encrypted file: {}", e))?;

    // Derive decryption key from session token
    let key_bytes = derive_key_from_token(&session_token, "arcsign-wc-v1")?;

    // Verify HMAC
    let mut mac = <HmacSha256 as KeyInit>::new_from_slice(&key_bytes)
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;
    mac.update(&encrypted_file.nonce);
    mac.update(&encrypted_file.ciphertext);

    mac.verify_slice(&encrypted_file.hmac)
        .map_err(|_| "HMAC verification failed. File may be corrupted or tampered.".to_string())?;

    // Decrypt
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&encrypted_file.nonce);
    let plaintext = cipher
        .decrypt(nonce, encrypted_file.ciphertext.as_ref())
        .map_err(|_| "Decryption failed. Invalid session token or corrupted file.".to_string())?;

    // Deserialize sessions
    let sessions_json = String::from_utf8(plaintext)
        .map_err(|e| format!("Failed to decode plaintext: {}", e))?;

    let sessions: Vec<WCSession> = serde_json::from_str(&sessions_json)
        .map_err(|e| format!("Failed to deserialize sessions: {}", e))?;

    tracing::info!("Loaded {} WalletConnect sessions", sessions.len());
    Ok(sessions)
}

/// Delete a specific WalletConnect session from USB
#[tauri::command]
pub async fn delete_wc_session(
    usb_path: String,
    session_token: String,
    topic: String,
) -> Result<(), String> {
    tracing::info!("Deleting WalletConnect session: {}", topic);

    // Load all sessions
    let mut sessions = load_wc_sessions(usb_path.clone(), session_token.clone()).await?;

    // Filter out the session to delete
    let original_len = sessions.len();
    sessions.retain(|s| s.topic != topic);

    if sessions.len() == original_len {
        return Err(format!("Session not found: {}", topic));
    }

    // Save updated sessions
    save_wc_sessions(usb_path, sessions, session_token).await?;

    tracing::info!("Session deleted successfully");
    Ok(())
}

/// Delete all WalletConnect sessions from USB
#[tauri::command]
pub async fn delete_all_wc_sessions(usb_path: String) -> Result<(), String> {
    tracing::info!("Deleting all WalletConnect sessions");

    let file_path = PathBuf::from(usb_path).join(WC_SESSIONS_FILE);

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete sessions file: {}", e))?;
    }

    tracing::info!("All sessions deleted");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let token = "test-session-token-12345";
        let key1 = derive_key_from_token(token, "arcsign-wc-v1").unwrap();
        let key2 = derive_key_from_token(token, "arcsign-wc-v1").unwrap();

        // Same token should produce same key
        assert_eq!(key1, key2);

        // Different salt should produce different key
        let key3 = derive_key_from_token(token, "different-salt").unwrap();
        assert_ne!(key1, key3);
    }

    #[tokio::test]
    async fn test_encrypt_decrypt_roundtrip() {
        use tempfile::tempdir;

        let temp_dir = tempdir().unwrap();
        let usb_path = temp_dir.path().to_str().unwrap().to_string();
        let session_token = "test-token-123".to_string();

        let sessions = vec![
            WCSession {
                topic: "topic1".to_string(),
                data: r#"{"test":"data1"}"#.to_string(),
            },
            WCSession {
                topic: "topic2".to_string(),
                data: r#"{"test":"data2"}"#.to_string(),
            },
        ];

        // Save
        save_wc_sessions(usb_path.clone(), sessions.clone(), session_token.clone())
            .await
            .unwrap();

        // Load
        let loaded = load_wc_sessions(usb_path.clone(), session_token)
            .await
            .unwrap();

        assert_eq!(sessions.len(), loaded.len());
        assert_eq!(sessions[0].topic, loaded[0].topic);
        assert_eq!(sessions[1].topic, loaded[1].topic);
    }
}
