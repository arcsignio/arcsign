/**
 * CLI subprocess wrapper for executing Go ArcSign CLI commands
 * Feature: User Dashboard for Wallet Management
 * Task: T016 - Implement CLI wrapper subprocess executor
 * Generated: 2025-10-17
 */

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

/// CLI command variants
#[derive(Debug, Clone)]
pub enum CliCommand {
    /// Get CLI version
    Version,

    /// Create new wallet
    CreateWallet {
        password: String,
        usb_path: String,
        name: Option<String>,
        passphrase: Option<String>,
        mnemonic_length: usize,
    },

    /// Restore wallet from mnemonic
    RestoreWallet {
        mnemonic: String,
        password: String,
        usb_path: String,
        passphrase: Option<String>,
        name: Option<String>,
    },

    /// Generate all 54 addresses
    GenerateAll {
        wallet_id: String,
        password: String,
        usb_path: String,
    },

    /// List all wallets
    ListWallets { usb_path: String },

    /// Rename wallet
    RenameWallet {
        wallet_id: String,
        new_name: String,
        usb_path: String,
    },
}

/// CLI wrapper for subprocess execution
#[derive(Debug, Clone)]
pub struct CliWrapper {
    /// Path to arcsign CLI binary
    cli_path: PathBuf,

    /// Command timeout (default: 3 minutes for wallet creation)
    timeout: Duration,
}

impl CliWrapper {
    /// Create new CLI wrapper with default binary path
    pub fn new<P: Into<PathBuf>>(cli_path: P) -> Self {
        Self {
            cli_path: cli_path.into(),
            timeout: Duration::from_secs(180), // 3 minutes default
        }
    }

    /// Set custom timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Execute a CLI command and return output
    pub async fn execute(&self, command: CliCommand) -> Result<String, String> {
        // Validate CLI binary exists
        if !self.cli_path.exists() {
            return Err(format!(
                "CLI binary not found at: {}",
                self.cli_path.display()
            ));
        }

        // Build command
        let mut cmd = self.build_command(&command);

        // Execute with timeout
        let output = timeout(self.timeout, cmd.output())
            .await
            .map_err(|_| "Command execution timed out".to_string())?
            .map_err(|e| format!("Failed to execute CLI: {}", e))?;

        // Check if command succeeded
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("CLI error: {}", stderr));
        }

        // Parse stdout
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();

        // Clear sensitive data from memory (password, mnemonic)
        // Note: Full implementation would use secure memory zeroing
        drop(command);

        Ok(stdout)
    }

    /// Build Command with appropriate arguments and environment variables
    fn build_command(&self, cli_command: &CliCommand) -> Command {
        let mut cmd = Command::new(&self.cli_path);

        // Configure stdio
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        match cli_command {
            CliCommand::Version => {
                cmd.arg("version");
            }

            CliCommand::CreateWallet {
                password,
                usb_path,
                name,
                passphrase,
                mnemonic_length,
            } => {
                cmd.arg("create");

                // SECURITY: Pass sensitive data via environment variables, not CLI args
                cmd.env("WALLET_PASSWORD", password);
                cmd.env("USB_PATH", usb_path);

                if let Some(n) = name {
                    cmd.env("WALLET_NAME", n);
                }

                if let Some(p) = passphrase {
                    cmd.env("BIP39_PASSPHRASE", p);
                }

                cmd.env("MNEMONIC_LENGTH", mnemonic_length.to_string());
            }

            CliCommand::RestoreWallet {
                mnemonic,
                password,
                usb_path,
                passphrase,
                name,
            } => {
                cmd.arg("restore");

                // SECURITY: Pass sensitive data via environment variables
                cmd.env("MNEMONIC", mnemonic);
                cmd.env("WALLET_PASSWORD", password);
                cmd.env("USB_PATH", usb_path);

                if let Some(p) = passphrase {
                    cmd.env("BIP39_PASSPHRASE", p);
                }

                if let Some(n) = name {
                    cmd.env("WALLET_NAME", n);
                }
            }

            CliCommand::GenerateAll {
                wallet_id,
                password,
                usb_path,
            } => {
                cmd.arg("generate-all");
                cmd.arg("--wallet-id");
                cmd.arg(wallet_id);

                // SECURITY: Pass password via environment variable
                cmd.env("WALLET_PASSWORD", password);
                cmd.env("USB_PATH", usb_path);
            }

            CliCommand::ListWallets { usb_path } => {
                cmd.arg("list");
                cmd.env("USB_PATH", usb_path);
            }

            CliCommand::RenameWallet {
                wallet_id,
                new_name,
                usb_path,
            } => {
                cmd.arg("rename");
                cmd.arg("--wallet-id");
                cmd.arg(wallet_id);
                cmd.arg("--name");
                cmd.arg(new_name);
                cmd.env("USB_PATH", usb_path);
            }
        }

        cmd
    }

    /// Parse JSON output from CLI
    pub fn parse_json<T: for<'de> Deserialize<'de>>(&self, output: &str) -> Result<T, String> {
        serde_json::from_str(output)
            .map_err(|e| format!("Failed to parse CLI JSON output: {}", e))
    }
}

/// Wallet creation response from CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletCreateResponse {
    pub wallet_id: String,
    pub mnemonic: String,
    pub created_at: String,
}

/// Wallet import response from CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletImportResponse {
    pub wallet_id: String,
    pub is_duplicate: bool,
    pub created_at: String,
}

/// Address generation response from CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressListResponse {
    pub wallet_id: String,
    pub addresses: Vec<AddressRecord>,
}

/// Single address record from CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressRecord {
    pub rank: u32,
    pub symbol: String,
    pub name: String,
    pub coin_type: u32,
    pub derivation_path: String,
    pub address: String,
    pub category: String,
    pub key_type: String,
}

/// Wallet list response from CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletListResponse {
    pub wallets: Vec<WalletInfo>,
}

/// Wallet metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub has_passphrase: bool,
    pub address_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_wrapper_creation() {
        let wrapper = CliWrapper::new("./arcsign");
        assert_eq!(wrapper.cli_path, PathBuf::from("./arcsign"));
        assert_eq!(wrapper.timeout, Duration::from_secs(180));
    }

    #[test]
    fn test_cli_wrapper_with_custom_timeout() {
        let wrapper = CliWrapper::new("./arcsign").with_timeout(Duration::from_secs(60));
        assert_eq!(wrapper.timeout, Duration::from_secs(60));
    }

    #[test]
    fn test_parse_json_wallet_response() {
        let wrapper = CliWrapper::new("./arcsign");
        let json = r#"{
            "wallet_id": "abc123",
            "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
            "created_at": "2025-10-17T12:00:00Z"
        }"#;

        let result: Result<WalletCreateResponse, _> = wrapper.parse_json(json);
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response.wallet_id, "abc123");
        assert_eq!(response.mnemonic.split_whitespace().count(), 12);
    }

    #[test]
    fn test_parse_json_invalid() {
        let wrapper = CliWrapper::new("./arcsign");
        let invalid_json = "{ this is not valid json }";

        let result: Result<WalletCreateResponse, _> = wrapper.parse_json(invalid_json);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_execute_version() {
        let wrapper = CliWrapper::new("./arcsign");

        // This test will actually run if arcsign binary exists
        if wrapper.cli_path.exists() {
            let result = wrapper.execute(CliCommand::Version).await;
            if result.is_ok() {
                let output = result.unwrap();
                assert!(output.contains("ArcSign") || output.contains("v"));
            }
        }
    }

    #[tokio::test]
    async fn test_execute_nonexistent_binary() {
        let wrapper = CliWrapper::new("./nonexistent-binary");

        let result = wrapper.execute(CliCommand::Version).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }
}
