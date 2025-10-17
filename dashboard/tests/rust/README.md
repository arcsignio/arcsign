# Rust Backend Tests

**Feature**: User Dashboard for Wallet Management
**Generated**: 2025-10-17

## Overview

This directory contains unit and integration tests for the Tauri Rust backend. Tests follow TDD principles as mandated by the project constitution.

## Test Structure

```
tests/rust/
├── commands_test.rs         # Tauri command tests
├── cli_wrapper_test.rs      # CLI subprocess wrapper tests
├── error_test.rs            # Error type serialization tests
├── security_test.rs         # Screenshot protection tests
├── usb_test.rs              # USB detection tests
├── wallet_create_test.rs    # Wallet creation tests
├── wallet_import_test.rs    # Wallet import tests
├── wallet_list_test.rs      # Wallet list tests
├── wallet_rename_test.rs    # Wallet rename tests
├── address_test.rs          # Address loading tests
└── export_test.rs           # Export functionality tests

tests/integration/
└── wallet_lifecycle_test.rs # End-to-end integration tests
```

## Cargo.toml Configuration

Add these dependencies to `dashboard/src-tauri/Cargo.toml`:

```toml
[dev-dependencies]
tokio-test = "0.4"
mockall = "0.12"
tempfile = "3.8"
serial_test = "3.0"  # For tests that need USB access

[profile.test]
opt-level = 0
debug = true
```

## Running Tests

```bash
# Run all tests
cd dashboard/src-tauri
cargo test

# Run specific test file
cargo test --test cli_wrapper_test

# Run with output
cargo test -- --nocapture

# Run tests in sequence (for USB-dependent tests)
cargo test -- --test-threads=1

# Run with coverage
cargo tarpaulin --out Html --output-dir coverage
```

## Test Utilities

Create helper functions in `tests/rust/common/mod.rs`:

```rust
use std::path::PathBuf;
use tempfile::TempDir;

/// Create temporary USB directory for testing
pub fn create_test_usb() -> (TempDir, PathBuf) {
    let temp_dir = TempDir::new().unwrap();
    let usb_path = temp_dir.path().to_path_buf();
    (temp_dir, usb_path)
}

/// Create test wallet with known mnemonic
pub fn create_test_wallet(usb_path: &str) -> String {
    // Implementation
}

/// Clean up test USB directory
pub fn cleanup_test_usb(temp_dir: TempDir) {
    drop(temp_dir);
}
```

## Test Coverage Targets

Per constitution requirements:
- **Rust backend**: >80% code coverage
- **Critical paths**: 100% coverage (wallet creation, import, address loading)

## Mocking External Dependencies

### Mock Go CLI subprocess

```rust
use mockall::mock;

mock! {
    CliWrapper {
        fn execute_command(&self, args: &[&str]) -> Result<String, String>;
    }
}

#[test]
fn test_create_wallet_with_mock_cli() {
    let mut mock_cli = MockCliWrapper::new();
    mock_cli
        .expect_execute_command()
        .returning(|_| Ok(r#"{"wallet_id":"test-id","mnemonic":"abandon abandon..."}"#.to_string()));

    // Test implementation
}
```

### Mock USB detection

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usb_detection() {
        // Use tempfile crate to create test USB directory
        let temp_dir = TempDir::new().unwrap();
        let usb_path = temp_dir.path().to_str().unwrap();

        // Test USB detection logic
        let detected = detect_usb_devices();
        assert!(detected.contains(&usb_path.to_string()));
    }
}
```

## Security Test Examples

### Test password validation

```rust
#[tokio::test]
async fn test_weak_password_rejected() {
    let result = create_wallet("weak", "/tmp/usb", None, None).await;
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Password must be at least 12 characters"));
}
```

### Test mnemonic clearing

```rust
#[test]
fn test_mnemonic_memory_cleared() {
    // Implementation to verify memory cleared after mnemonic display
}
```

## Integration Test Setup

Integration tests in `tests/integration/` should test full workflows:

```rust
// tests/integration/wallet_lifecycle_test.rs
#[tokio::test]
async fn test_full_wallet_lifecycle() {
    // 1. Create wallet
    let (temp_usb, usb_path) = create_test_usb();
    let create_result = create_wallet("TestPassword123!", usb_path.to_str().unwrap(), None, None).await;
    assert!(create_result.is_ok());

    // 2. Load addresses
    let addresses = load_addresses(create_result.wallet_id, "TestPassword123!", usb_path.to_str().unwrap()).await;
    assert_eq!(addresses.len(), 54);

    // 3. Export addresses
    let export_result = export_addresses(create_result.wallet_id, ExportFormat::Json).await;
    assert!(export_result.is_ok());

    // Cleanup
    cleanup_test_usb(temp_usb);
}
```

## Troubleshooting

### Tests fail with "USB not found"

Create a test USB directory:
```bash
mkdir -p ~/test-wallet-usb
```

### Tests timeout

Increase timeout in test:
```rust
#[tokio::test(flavor = "multi_thread")]
#[timeout(Duration::from_secs(30))]
async fn test_slow_operation() {
    // Test implementation
}
```

### Permission errors on USB

Ensure test USB directory is writable:
```bash
chmod 755 ~/test-wallet-usb
```

---

**Next Steps**:
1. Complete T002 (Initialize Tauri project)
2. Add dev-dependencies to Cargo.toml
3. Create test utility module in `tests/rust/common/mod.rs`
4. Write tests before implementing features (TDD)
