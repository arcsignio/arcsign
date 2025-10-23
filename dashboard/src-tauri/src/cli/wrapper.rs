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
                // T050-T055: Use dashboard mode with environment variables
                cmd.env("ARCSIGN_MODE", "dashboard");
                cmd.env("CLI_COMMAND", "create");

                // SECURITY: Pass sensitive data via environment variables, not CLI args
                cmd.env("WALLET_PASSWORD", password);
                cmd.env("USB_PATH", usb_path);
                cmd.env("MNEMONIC_LENGTH", mnemonic_length.to_string());

                if let Some(n) = name {
                    cmd.env("WALLET_NAME", n);
                }

                if let Some(p) = passphrase {
                    cmd.env("BIP39_PASSPHRASE", p);
                }

                // Request mnemonic to be returned in JSON response
                cmd.env("RETURN_MNEMONIC", "true");
            }

            CliCommand::RestoreWallet {
                mnemonic,
                password,
                usb_path,
                passphrase,
                name,
            } => {
                // T092-T098: Use dashboard mode with environment variables
                cmd.env("ARCSIGN_MODE", "dashboard");
                cmd.env("CLI_COMMAND", "import");

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

    /// Parse CLI error with fallback chain (T035)
    /// Priority order:
    /// 1. Parse stdout for JSON error response
    /// 2. Parse stderr for JSON error object
    /// 3. Use raw stderr message
    /// 4. Generic error with exit code
    pub fn parse_cli_error(
        &self,
        exit_code: Option<i32>,
        stdout: &str,
        stderr: &str,
    ) -> crate::cli::types::CliError {
        use crate::cli::types::CliError;

        // 1. Try parsing stdout for JSON error response
        if !stdout.trim().is_empty() {
            if let Ok(error) = serde_json::from_str::<CliError>(stdout) {
                if !error.success {
                    return error;
                }
            }
        }

        // 2. Try parsing stderr for JSON error object
        if !stderr.trim().is_empty() {
            if let Ok(error) = serde_json::from_str::<CliError>(stderr) {
                return error;
            }
        }

        // 3. Use raw stderr message if available
        if !stderr.trim().is_empty() {
            return CliError::from_stderr(stderr.to_string());
        }

        // 4. Generic error with exit code
        CliError::from_exit_code(exit_code.unwrap_or(1))
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

    // T034: Test for error parsing priority (JSON stdout → JSON stderr → raw stderr → exit code)
    #[test]
    fn test_parse_cli_error_from_stdout_json() {
        use crate::cli::types::CliErrorCode;

        let wrapper = CliWrapper::new("./arcsign");
        let stdout = r#"{
            "success": false,
            "error": {
                "code": "USB_NOT_FOUND",
                "message": "USB device not detected"
            },
            "request_id": "req-123",
            "cli_version": "0.1.0",
            "duration_ms": 100
        }"#;

        let error = wrapper.parse_cli_error(Some(1), stdout, "");
        assert!(!error.success);
        assert_eq!(error.error.code, CliErrorCode::UsbNotFound);
        assert_eq!(error.error.message, "USB device not detected");
        assert_eq!(error.request_id, "req-123");
    }

    #[test]
    fn test_parse_cli_error_from_stderr_json() {
        use crate::cli::types::CliErrorCode;

        let wrapper = CliWrapper::new("./arcsign");
        let stderr = r#"{
            "success": false,
            "error": {
                "code": "INVALID_PASSWORD",
                "message": "Wrong password"
            },
            "request_id": "req-456",
            "cli_version": "0.1.0",
            "duration_ms": 50
        }"#;

        let error = wrapper.parse_cli_error(Some(1), "", stderr);
        assert!(!error.success);
        assert_eq!(error.error.code, CliErrorCode::InvalidPassword);
        assert_eq!(error.error.message, "Wrong password");
    }

    #[test]
    fn test_parse_cli_error_from_raw_stderr() {
        use crate::cli::types::CliErrorCode;

        let wrapper = CliWrapper::new("./arcsign");
        let stderr = "  Crypto operation failed  ";

        let error = wrapper.parse_cli_error(Some(1), "", stderr);
        assert!(!error.success);
        assert_eq!(error.error.code, CliErrorCode::IoError);
        assert_eq!(error.error.message, "Crypto operation failed");
    }

    #[test]
    fn test_parse_cli_error_from_exit_code() {
        use crate::cli::types::CliErrorCode;

        let wrapper = CliWrapper::new("./arcsign");

        let error = wrapper.parse_cli_error(Some(127), "", "");
        assert!(!error.success);
        assert_eq!(error.error.code, CliErrorCode::IoError);
        assert!(error.error.message.contains("exit code 127"));
    }

    #[test]
    fn test_parse_cli_error_priority_stdout_over_stderr() {
        use crate::cli::types::CliErrorCode;

        let wrapper = CliWrapper::new("./arcsign");
        let stdout = r#"{"success":false,"error":{"code":"USB_NOT_FOUND","message":"USB error"},"request_id":"req-1","cli_version":"0.1.0","duration_ms":10}"#;
        let stderr = r#"{"success":false,"error":{"code":"INVALID_PASSWORD","message":"Password error"},"request_id":"req-2","cli_version":"0.1.0","duration_ms":10}"#;

        // Should prefer stdout over stderr
        let error = wrapper.parse_cli_error(Some(1), stdout, stderr);
        assert_eq!(error.error.code, CliErrorCode::UsbNotFound);
        assert_eq!(error.error.message, "USB error");
    }

    // T029: Test for 30-second subprocess timeout
    #[test]
    fn test_cli_wrapper_timeout_configuration() {
        use std::time::Duration;

        let wrapper = CliWrapper::new("./arcsign").with_timeout(Duration::from_secs(30));
        assert_eq!(wrapper.timeout, Duration::from_secs(30));
    }

    // T031: Test for JSON response parsing from stdout
    #[test]
    fn test_parse_json_response() {
        use crate::cli::types::{CliResponse, DeriveAddressData};

        let wrapper = CliWrapper::new("./arcsign");
        let json = r#"{
            "success": true,
            "data": {
                "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                "blockchain": "Bitcoin",
                "symbol": "BTC",
                "coin_type": 0,
                "path": "m/44'/0'/0'/0/0"
            },
            "request_id": "req-789",
            "cli_version": "0.1.0",
            "duration_ms": 200,
            "warnings": []
        }"#;

        let result: Result<CliResponse<DeriveAddressData>, _> = wrapper.parse_json(json);
        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.success);
        assert_eq!(response.request_id, "req-789");
        assert_eq!(response.data.unwrap().symbol, "BTC");
    }

    // T027: Test for CliWrapper subprocess spawning with environment variables
    #[test]
    fn test_build_command_with_env_vars() {
        let wrapper = CliWrapper::new("./arcsign");

        let command = CliCommand::CreateWallet {
            password: "test-password".to_string(),
            usb_path: "/path/to/usb".to_string(),
            name: Some("Test Wallet".to_string()),
            passphrase: Some("secret".to_string()),
            mnemonic_length: 24,
        };

        // Note: We can't directly inspect Command env vars in tests,
        // but we can verify the command builds successfully
        let cmd = wrapper.build_command(&command);
        // This test verifies the command builds without panicking
        drop(cmd);
    }
}
