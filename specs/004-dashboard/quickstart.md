# Quickstart Guide: Dashboard Development

**Feature**: User Dashboard for Wallet Management
**Date**: 2025-10-17
**Audience**: Developers setting up the ArcSign dashboard for the first time

## Overview

This guide walks you through setting up the ArcSign dashboard development environment, running tests, and understanding the architecture. Follow TDD principles: write tests before implementation.

---

## Prerequisites

### System Requirements

- **Operating System**: macOS 12+, Windows 10+, or Linux (Ubuntu 20.04+)
- **Go**: 1.21+ (existing CLI)
- **Rust**: 1.75+ (Tauri backend)
- **Node.js**: 18+ (frontend)
- **USB Drive**: For testing wallet storage

### Install Tools

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js (via nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install Tauri CLI
cargo install tauri-cli

# Verify installations
rustc --version   # Should be 1.75+
node --version    # Should be v18+
cargo --version   # Should be 1.75+
go version        # Should be go1.21+
```

---

## Project Setup

### 1. Clone Repository

```bash
cd /Users/jnr350/Desktop/Yansiang/arcSignv2
git checkout 004-dashboard

# Verify existing Go CLI builds
go build -o arcsign ./cmd/arcsign
./arcsign version  # Should show v0.3.0
```

### 2. Create Dashboard Directory Structure

```bash
# Create Tauri project structure
mkdir -p dashboard/src-tauri/src/commands
mkdir -p dashboard/src-tauri/src/cli
mkdir -p dashboard/src-tauri/src/models
mkdir -p dashboard/src/components
mkdir -p dashboard/src/pages
mkdir -p dashboard/src/services
mkdir -p dashboard/src/types
mkdir -p dashboard/tests/rust
mkdir -p dashboard/tests/frontend
mkdir -p dashboard/tests/integration
```

### 3. Initialize Tauri Project

```bash
cd dashboard

# Create Tauri app
npm create tauri-app@latest . -- --template react-ts

# Install frontend dependencies
npm install react-hook-form zod zustand react-window
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @tauri-apps/cli @tauri-apps/api

# Install Tauri plugins
cd src-tauri
cargo add tauri-plugin-clipboard
cargo add tokio --features full
cargo add serde --features derive
cargo add serde_json
cargo add tracing
cd ..
```

### 4. Configure Tauri

Edit `dashboard/src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "package": {
    "productName": "ArcSign Dashboard",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "clipboard": {
        "all": true
      },
      "fs": {
        "all": false,
        "readDir": true,
        "readFile": true,
        "writeFile": true,
        "scope": ["$HOME/**/wallet-usb/**"]
      },
      "shell": {
        "all": false,
        "execute": false,
        "open": false
      },
      "window": {
        "all": false,
        "show": true,
        "hide": true,
        "close": true,
        "setTitle": true
      }
    },
    "windows": [
      {
        "title": "ArcSign Dashboard",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  }
}
```

---

## Architecture Overview

### Component Layers

```
┌─────────────────────────────────────────────┐
│ React Frontend (View)                       │
│ - Components: WalletCreate, AddressList     │
│ - State: Zustand (wallet selection, filters)│
│ - Types: TypeScript interfaces              │
└──────────────────┬──────────────────────────┘
                   │ Tauri IPC (invoke())
┌──────────────────▼──────────────────────────┐
│ Tauri Rust Backend (Controller)             │
│ - Commands: create_wallet, load_addresses   │
│ - CLI Wrapper: subprocess executor           │
│ - Models: Rust data structures              │
└──────────────────┬──────────────────────────┘
                   │ Subprocess (stdin/stdout)
┌──────────────────▼──────────────────────────┐
│ Go CLI (Model)                               │
│ - Wallet: BIP39/BIP44 implementation         │
│ - Storage: USB encryption (AES-256-GCM)     │
│ - Address: 54-blockchain derivation          │
└─────────────────────────────────────────────┘
```

### Data Flow Example: Create Wallet

```
User Input → React Form
    ↓
React Hook Form validates password
    ↓
invoke('create_wallet', {password, usb_path})
    ↓
Tauri Rust command (commands/wallet.rs)
    ↓
Command::new("arcsign create")
  .env("WALLET_PASSWORD", password)
  .output().await
    ↓
Go CLI generates mnemonic, encrypts wallet
    ↓
Returns JSON: {wallet_id, mnemonic}
    ↓
Tauri parses JSON, returns to React
    ↓
React displays mnemonic in secure component
```

---

## Test-Driven Development Workflow

### Red-Green-Refactor Cycle

```
1. RED: Write failing test
2. GREEN: Minimal code to pass test
3. REFACTOR: Clean up code while keeping tests passing
```

### Example: Create Wallet Feature

#### Step 1: Write Test (RED)

```rust
// dashboard/tests/rust/commands_test.rs
#[cfg(test)]
mod wallet_tests {
    use super::*;

    #[tokio::test]
    async fn test_create_wallet_success() {
        // Arrange
        let password = "TestPassword123!";
        let usb_path = "/tmp/test-usb";
        std::fs::create_dir_all(usb_path).unwrap();

        // Act
        let result = create_wallet(password, usb_path, None, None).await;

        // Assert
        assert!(result.is_ok());
        let response = result.unwrap();
        assert!(!response.wallet.id.is_empty());
        assert_eq!(response.mnemonic.split_whitespace().count(), 24);

        // Cleanup
        std::fs::remove_dir_all(usb_path).unwrap();
    }

    #[tokio::test]
    async fn test_create_wallet_weak_password() {
        // Arrange
        let password = "weak";  // Too short
        let usb_path = "/tmp/test-usb";

        // Act
        let result = create_wallet(password, usb_path, None, None).await;

        // Assert
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Password must be at least 12 characters"));
    }
}
```

Run test (should fail):
```bash
cd dashboard/src-tauri
cargo test test_create_wallet_success
# Expected: compilation error or test failure
```

#### Step 2: Implement Minimal Code (GREEN)

```rust
// dashboard/src-tauri/src/commands/wallet.rs
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct WalletResponse {
    pub wallet: Wallet,
    pub mnemonic: String,
}

#[derive(Serialize, Deserialize)]
pub struct Wallet {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub has_passphrase: bool,
}

#[tauri::command]
pub async fn create_wallet(
    password: &str,
    usb_path: &str,
    name: Option<String>,
    passphrase: Option<String>,
) -> Result<WalletResponse, String> {
    // Validate password
    if password.len() < 12 {
        return Err("Password must be at least 12 characters".to_string());
    }

    // Call Go CLI
    let mut cmd = Command::new("./arcsign");
    cmd.arg("create")
       .env("WALLET_PASSWORD", password)
       .env("USB_PATH", usb_path);

    if let Some(n) = name {
        cmd.env("WALLET_NAME", n);
    }
    if let Some(p) = passphrase {
        cmd.env("BIP39_PASSPHRASE", p);
    }

    let output = cmd.output()
        .map_err(|e| format!("Failed to execute CLI: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("CLI error: {}", stderr));
    }

    let response: WalletResponse = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse CLI output: {}", e))?;

    Ok(response)
}
```

Run test again (should pass):
```bash
cargo test test_create_wallet_success
# Expected: ✅ test test_create_wallet_success ... ok
```

#### Step 3: Refactor

- Extract CLI wrapper to separate module
- Add logging with `tracing`
- Handle edge cases (USB not writable, etc.)

```rust
// dashboard/src-tauri/src/cli/wrapper.rs
pub struct CliWrapper {
    cli_path: PathBuf,
}

impl CliWrapper {
    pub async fn create_wallet(&self, params: CreateWalletParams)
        -> Result<WalletResponse, CliError> {
        // Refactored implementation with better error handling
    }
}
```

### Frontend Test Example

```typescript
// dashboard/tests/frontend/WalletCreate.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletCreate } from '@/components/WalletCreate';

describe('WalletCreate Component', () => {
  test('displays error for weak password', async () => {
    // Arrange
    render(<WalletCreate />);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create/i });

    // Act
    await userEvent.type(passwordInput, 'weak');
    await userEvent.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/password must be at least 12 characters/i))
        .toBeInTheDocument();
    });
  });

  test('creates wallet successfully with valid inputs', async () => {
    // Mock Tauri invoke
    const mockInvoke = vi.fn().mockResolvedValue({
      wallet: { id: 'test-id', name: 'Test Wallet' },
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    });
    vi.stubGlobal('__TAURI__', { invoke: mockInvoke });

    // Arrange
    render(<WalletCreate />);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /create/i });

    // Act
    await userEvent.type(passwordInput, 'MySecurePass123!');
    await userEvent.click(submitButton);

    // Assert
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('create_wallet', {
        password: 'MySecurePass123!',
        usb_path: expect.any(String),
      });
      expect(screen.getByText(/abandon abandon abandon/i)).toBeInTheDocument();
    });
  });
});
```

Run frontend tests:
```bash
npm run test
# Expected: ✅ Test Suites: 1 passed
```

---

## Running the Application

### Development Mode

```bash
# Terminal 1: Start frontend dev server
cd dashboard
npm run dev

# Terminal 2: Start Tauri (with hot reload)
cd dashboard
npm run tauri dev
```

This will:
1. Build Go CLI (if changed)
2. Compile Rust backend
3. Start React dev server (Vite)
4. Open dashboard window

### USB Testing Setup

```bash
# Create test USB directory
mkdir -p ~/test-wallet-usb

# In dashboard, set USB path to ~/test-wallet-usb
# All wallets will be stored here during development
```

### Build for Production

```bash
cd dashboard
npm run tauri build

# Output:
# macOS: dashboard/src-tauri/target/release/bundle/dmg/ArcSign Dashboard_1.0.0_x64.dmg
# Windows: dashboard/src-tauri/target/release/bundle/msi/ArcSign Dashboard_1.0.0_x64_en-US.msi
# Linux: dashboard/src-tauri/target/release/bundle/deb/arcsign-dashboard_1.0.0_amd64.deb
```

---

## Testing Checklist

### Before Implementation

- [ ] Read feature spec (`specs/004-dashboard/spec.md`)
- [ ] Read data model (`specs/004-dashboard/data-model.md`)
- [ ] Read API contracts (`specs/004-dashboard/contracts/`)

### Unit Tests (Write First)

- [ ] Rust command functions (commands/wallet.rs)
- [ ] CLI wrapper (cli/wrapper.rs)
- [ ] React components (components/*.tsx)
- [ ] State management (Zustand stores)

### Integration Tests

- [ ] End-to-end wallet creation flow
- [ ] End-to-end wallet import flow
- [ ] Address display with filters
- [ ] Export functionality

### Security Tests

- [ ] Mnemonic never in React state
- [ ] Password validation
- [ ] Screenshot protection enabled during mnemonic display
- [ ] Clipboard auto-clear (30 seconds)
- [ ] Error messages don't leak sensitive info

### Manual Testing

- [ ] USB detection on macOS/Windows/Linux
- [ ] Wallet creation with 12-word and 24-word mnemonics
- [ ] Wallet import with duplicate detection
- [ ] Address display (all 54 blockchains)
- [ ] Category filter (base, layer2, etc.)
- [ ] Search by symbol/name
- [ ] Export to JSON and CSV
- [ ] Multi-wallet switching

---

## Common Development Tasks

### Add a New Tauri Command

1. **Write test** (RED):
```rust
// tests/rust/commands_test.rs
#[tokio::test]
async fn test_my_new_command() {
    let result = my_new_command("input").await;
    assert!(result.is_ok());
}
```

2. **Implement command** (GREEN):
```rust
// src-tauri/src/commands/my_module.rs
#[tauri::command]
pub async fn my_new_command(input: &str) -> Result<String, String> {
    // Implementation
    Ok(format!("Processed: {}", input))
}
```

3. **Register in main.rs**:
```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::wallet::create_wallet,
            commands::my_module::my_new_command,  // Add here
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

4. **Call from React**:
```typescript
import { invoke } from '@tauri-apps/api';

const result = await invoke('my_new_command', { input: 'test' });
```

### Debug Rust Backend

```bash
# Enable debug logging
RUST_LOG=debug npm run tauri dev

# Rust logs appear in terminal
```

### Debug React Frontend

```bash
# Open DevTools in Tauri window (Cmd+Opt+I on macOS)
# Console logs appear in DevTools
```

### Update API Contracts

```bash
# After changing Tauri commands, update contract:
vim specs/004-dashboard/contracts/tauri-commands.yaml

# Commit contract changes with implementation
git add specs/004-dashboard/contracts/
git commit -m "feat: add new command with contract"
```

---

## Troubleshooting

### Issue: CLI not found

**Error**: `Failed to execute CLI: No such file or directory`

**Solution**:
```bash
# Build CLI
cd /Users/jnr350/Desktop/Yansiang/arcSignv2
go build -o arcsign ./cmd/arcsign

# Copy to dashboard directory
cp arcsign dashboard/src-tauri/arcsign

# Or update Tauri to use absolute path:
Command::new("/absolute/path/to/arcsign")
```

### Issue: USB not detected

**Error**: `USB drive not detected`

**Solution**:
```bash
# macOS: Check /Volumes
ls /Volumes

# Linux: Check /media and /mnt
ls /media/$USER
ls /mnt

# Create test USB directory
mkdir -p ~/test-wallet-usb

# Use test directory in dashboard
```

### Issue: Tauri build fails

**Error**: `error: could not compile tauri`

**Solution**:
```bash
# Update Rust
rustup update stable

# Clean build
cd dashboard/src-tauri
cargo clean
cargo build

# Check tauri.conf.json for syntax errors
```

### Issue: React hot reload not working

**Solution**:
```bash
# Kill all processes
pkill -f tauri
pkill -f vite

# Restart
npm run tauri dev
```

---

## Next Steps

1. **Review Architecture**: Read `specs/004-dashboard/plan.md`
2. **Understand Data Model**: Read `specs/004-dashboard/data-model.md`
3. **Check Contracts**: Review `specs/004-dashboard/contracts/*.yaml`
4. **Start with Tests**: Follow TDD workflow for first feature
5. **Implement Incrementally**: Break work into small, testable units

---

## Resources

- **Tauri Docs**: https://tauri.app/v1/guides/
- **React Hook Form**: https://react-hook-form.com/
- **Zustand**: https://github.com/pmndrs/zustand
- **Vitest**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/docs/react-testing-library/intro/

---

**Version**: 1.0.0
**Last Updated**: 2025-10-17
**Maintainer**: ArcSign Development Team
