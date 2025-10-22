# ArcSign Dashboard Developer Quickstart

**Version**: 1.0.0
**Last Updated**: 2025-10-22
**Target Audience**: Dashboard developers implementing the Tauri + React frontend

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Development Workflow (TDD)](#development-workflow-tdd)
4. [Running the Dashboard](#running-the-dashboard)
5. [Testing the CLI Dual-Mode](#testing-the-cli-dual-mode)
6. [Key Files](#key-files)
7. [Common Tasks](#common-tasks)
8. [Debugging](#debugging)
9. [Build for Production](#build-for-production)
10. [Troubleshooting](#troubleshooting)
11. [Next Steps](#next-steps)

---

## Prerequisites

Before starting development, ensure you have the following installed:

### Required Software

- **Go 1.21+**: For CLI backend development
  ```bash
  go version  # Should show go1.21 or higher
  ```

- **Rust 1.75+**: For Tauri backend
  ```bash
  rustc --version   # Should show 1.75.0 or higher
  cargo --version   # Should show 1.75.0 or higher
  rustup --version  # Rust toolchain installer
  ```

- **Node.js 18+**: For React frontend
  ```bash
  node --version  # Should show v18.0.0 or higher
  npm --version   # Should show 9.0.0 or higher
  ```

- **USB drive**: For testing wallet storage (any size, will be reformatted)

- **Existing ArcSign CLI binary**: Must be built from source before dashboard development

### Platform-Specific Requirements

**macOS**:
```bash
xcode-select --install  # Install Xcode command line tools
```

**Linux** (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

**Windows**:
- Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

---

## Environment Setup

### 1. Clone Repository and Checkout Branch

```bash
# Clone repository
git clone https://github.com/your-org/arcSignv2.git
cd arcSignv2

# Checkout dashboard feature branch
git checkout 004-dashboard

# Verify branch
git status
# Should show: On branch 004-dashboard
```

### 2. Build the ArcSign CLI

The dashboard requires a working CLI binary to function.

```bash
# Navigate to project root
cd /Users/jnr350/Desktop/Yansiang/arcSignv2

# Build CLI binary
go build -o arcsign ./cmd/arcsign

# Verify CLI works
./arcsign --help

# Expected output:
# ArcSign HD Wallet CLI
# Usage: arcsign [command]
# ...
```

### 3. Install Rust Dependencies

```bash
# Navigate to Tauri backend directory
cd dashboard/src-tauri

# Build Rust backend (this will download dependencies)
cargo build

# Expected output:
# Compiling arcsign-dashboard v1.0.0 (/Users/.../dashboard/src-tauri)
# Finished dev [unoptimized + debuginfo] target(s) in 45.23s
```

### 4. Install Frontend Dependencies

```bash
# Navigate to dashboard directory
cd ../..  # Back to dashboard/
cd dashboard

# Install npm packages
npm install

# Expected output:
# added 324 packages, and audited 325 packages in 12s
# ...
```

### 5. Copy CLI Binary to Tauri

The Tauri backend needs access to the CLI binary for subprocess execution.

```bash
# From dashboard/ directory
cp ../arcsign src-tauri/

# Verify binary exists
ls -lh src-tauri/arcsign
# Expected: -rwxr-xr-x ... src-tauri/arcsign
```

### 6. Set Environment Variables for Testing

```bash
# macOS/Linux: Add to ~/.zshrc or ~/.bashrc
export USB_PATH="/Volumes/TEST_USB"
export CLI_BINARY_PATH="../arcsign"

# Windows (PowerShell): Add to profile
$env:USB_PATH="E:\"
$env:CLI_BINARY_PATH="..\arcsign.exe"

# Reload shell configuration
source ~/.zshrc  # or source ~/.bashrc
```

**Note**: Replace `/Volumes/TEST_USB` with your actual USB mount point.

---

## Development Workflow (TDD)

The ArcSign constitution mandates **Test-Driven Development (TDD)** for all features. Follow the Red-Green-Refactor cycle:

### TDD Cycle Overview

```
┌─────────────────────────────────────────────┐
│ 1. RED: Write Failing Test                 │
├─────────────────────────────────────────────┤
│ - Write test for desired behavior          │
│ - Run test suite (should FAIL)             │
│ - Verify failure is expected               │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ 2. GREEN: Minimal Implementation            │
├─────────────────────────────────────────────┤
│ - Write minimal code to pass test          │
│ - Run test suite (should PASS)             │
│ - Commit if all tests pass                 │
└────────────┬────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────┐
│ 3. REFACTOR: Improve Code Quality           │
├─────────────────────────────────────────────┤
│ - Refactor without changing behavior       │
│ - Re-run tests (should still PASS)         │
│ - Commit if tests pass after refactor      │
└─────────────────────────────────────────────┘
```

### Example: Adding a New Component

#### Step 1: Write Test First (RED)

**File**: `dashboard/tests/frontend/WalletCreate.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletCreate } from '@/components/WalletCreate';

describe('WalletCreate Component', () => {
  it('should render password input field', () => {
    render(<WalletCreate />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toBeInTheDocument();
  });

  it('should validate password strength', async () => {
    render(<WalletCreate />);

    const passwordInput = screen.getByLabelText('Password');
    fireEvent.change(passwordInput, { target: { value: 'weak' } });

    const errorMessage = await screen.findByText(/password must be at least 12 characters/i);
    expect(errorMessage).toBeInTheDocument();
  });
});
```

**Run Test** (should FAIL):

```bash
npm test

# Expected output:
# FAIL tests/frontend/WalletCreate.test.tsx
#   ✕ should render password input field (23ms)
#   Error: Component WalletCreate not found
```

#### Step 2: Minimal Implementation (GREEN)

**File**: `dashboard/src/components/WalletCreate.tsx`

```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@/validation/password';

export const WalletCreate: React.FC = () => {
  const { register, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  return (
    <form>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register('password')}
        />
        {errors.password && (
          <span role="alert">{errors.password.message}</span>
        )}
      </div>
    </form>
  );
};
```

**Run Test** (should PASS):

```bash
npm test

# Expected output:
# PASS tests/frontend/WalletCreate.test.tsx
#   ✓ should render password input field (12ms)
#   ✓ should validate password strength (34ms)
# Tests: 2 passed, 2 total
```

#### Step 3: Refactor (REFACTOR)

Extract reusable form field component:

```typescript
// dashboard/src/components/FormField.tsx
export const FormField: React.FC<FormFieldProps> = ({ label, error, children }) => (
  <div className="form-field">
    <label>{label}</label>
    {children}
    {error && <span role="alert" className="error">{error}</span>}
  </div>
);

// Update WalletCreate.tsx to use FormField
export const WalletCreate: React.FC = () => {
  const { register, formState: { errors } } = useForm({ ... });

  return (
    <form>
      <FormField label="Password" error={errors.password?.message}>
        <input type="password" {...register('password')} />
      </FormField>
    </form>
  );
};
```

**Re-run Tests** (should still PASS):

```bash
npm test
# All tests should still pass after refactor
```

### Test Commands

```bash
# Frontend tests (Vitest + React Testing Library)
npm test                    # Run tests in watch mode
npm test -- --run           # Run tests once (CI mode)
npm run test:coverage       # Generate coverage report
npm run test:ui             # Open Vitest UI

# Backend tests (Rust + Cargo)
cd src-tauri
cargo test                  # Run all Rust tests
cargo test -- --nocapture   # Show println! output
cargo test wallet_create    # Run specific test

# Integration tests
cargo test --test integration
```

---

## Running the Dashboard

### Development Mode

Start both the Vite dev server (React) and Tauri app (Rust backend) simultaneously:

```bash
cd dashboard
npm run tauri:dev
```

**Expected output**:

```
vite v5.0.12 dev server running at:
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h to show help

    __  ____  __  __  ____  __
   / / / / / / / / / / __ \/ /
  / /_/ / /_/ / /_/ / /_/ / /
  \__,_/\__,_/\__,_/\____/_/

[Tauri] Running BeforeDevCommand: npm run dev
[Tauri] Compiling arcsign-dashboard v1.0.0
[Tauri] Finished dev [unoptimized + debuginfo] target(s) in 2.34s
[Tauri] App window opened successfully
```

**What Happens**:
1. Vite starts React dev server on `http://localhost:5173`
2. Tauri compiles Rust backend
3. Tauri opens desktop window pointing to Vite dev server
4. Hot reload enabled for both React and Rust code

### Development Features

- **Hot Reload (React)**: Edit `.tsx` files → browser updates instantly
- **Hot Reload (Rust)**: Edit `.rs` files → Tauri rebuilds and restarts app
- **DevTools**: Right-click in app → "Inspect Element" → Browser DevTools
- **Console Logs**:
  - Frontend logs: DevTools Console
  - Rust logs: Terminal where `npm run tauri:dev` is running

### Manual Testing Workflow

1. **Start Dashboard**: `npm run tauri:dev`
2. **Insert USB Drive**: Mount USB at configured `USB_PATH`
3. **Create Wallet**: Click "Create New Wallet" → Enter password → View mnemonic
4. **View Addresses**: Select wallet → Wait for 54 addresses to load
5. **Test Filters**: Select category → Verify address list updates
6. **Test Search**: Type "BTC" → Verify Bitcoin address highlighted

---

## Testing the CLI Dual-Mode

The CLI supports two modes: **interactive** (terminal) and **non-interactive** (dashboard subprocess).

### Interactive Mode (Existing)

Direct terminal usage with prompts:

```bash
# Navigate to project root
cd /Users/jnr350/Desktop/Yansiang/arcSignv2

# Run CLI interactively
./arcsign create

# Expected prompts:
# Enter wallet password: ********
# Confirm password: ********
# Enter wallet name (optional): My Wallet
# Select mnemonic length (12/24): 24
# USB path: /Volumes/TEST_USB
# [Generates mnemonic and displays for backup]
```

### Non-Interactive Mode (New - Dashboard Subprocess)

Environment variable-driven mode for dashboard integration:

```bash
# Set environment variables
export ARCSIGN_MODE="dashboard"
export WALLET_PASSWORD="Test1234!"
export USB_PATH="/Volumes/TEST_USB"
export MNEMONIC_LENGTH="24"
export WALLET_NAME="Test Wallet"

# Run CLI (no prompts, JSON output)
./arcsign create

# Expected JSON output to stdout:
{
  "schema_version": "1.0.0",
  "success": true,
  "data": {
    "wallet_id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b",
    "name": "Test Wallet",
    "created_at": "2025-10-22T14:30:25+08:00",
    "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  }
}
```

### Testing Dashboard-CLI Integration

```bash
# From dashboard/src-tauri/ directory
cargo test cli_wrapper

# Expected output:
# running 3 tests
# test cli_wrapper_tests::test_create_wallet ... ok
# test cli_wrapper_tests::test_invalid_password ... ok
# test cli_wrapper_tests::test_timeout_handling ... ok
```

### Environment Variables Reference

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `ARCSIGN_MODE` | Yes | `dashboard` | Enables JSON output mode |
| `WALLET_PASSWORD` | Yes | `Test1234!` | Wallet encryption password |
| `USB_PATH` | Yes | `/Volumes/TEST_USB` | USB mount point |
| `MNEMONIC_LENGTH` | No | `24` | 12 or 24 (default: 24) |
| `WALLET_NAME` | No | `My Wallet` | User-friendly name (default: timestamp) |
| `BIP39_PASSPHRASE` | No | `secret` | Optional BIP39 25th word |

---

## Key Files

### Architecture Overview

```
dashboard/
├── src/                          # React frontend (View Layer)
├── src-tauri/                    # Rust backend (Controller Layer)
├── tests/                        # Test files
└── docs/                         # Documentation

cmd/arcsign/                      # Go CLI (Model Layer)
└── main.go                       # CLI entry point
```

### Critical Files by Function

#### Tauri Backend (Rust - Controller Layer)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `src-tauri/src/main.rs` | Tauri entry point | Registers commands, manages state |
| `src-tauri/src/commands/wallet.rs` | Wallet operations | `create_wallet`, `import_wallet`, `list_wallets` |
| `src-tauri/src/commands/address.rs` | Address operations | `load_addresses`, `export_addresses` |
| `src-tauri/src/commands/usb.rs` | USB detection | `detect_usb` (cross-platform mount detection) |
| `src-tauri/src/commands/security.rs` | Security features | `enable_screenshot_protection`, `clear_sensitive_memory` |
| `src-tauri/src/cli/wrapper.rs` | CLI subprocess wrapper | Executes arcsign commands, parses JSON |
| `src-tauri/src/models/wallet.rs` | Wallet data model | Rust struct definitions |
| `src-tauri/src/error.rs` | Error handling | Custom error types for Tauri IPC |

#### React Frontend (TypeScript - View Layer)

| File | Purpose | Key Components |
|------|---------|----------------|
| `src/App.tsx` | Root component | Routing, global providers |
| `src/pages/Dashboard.tsx` | Main dashboard page | Wallet list, address display |
| `src/components/WalletCreate.tsx` | Wallet creation form | Password input, validation |
| `src/components/WalletImport.tsx` | Wallet import form | Mnemonic input, checksum validation |
| `src/components/MnemonicDisplay.tsx` | Secure mnemonic display | 30s countdown, screenshot protection |
| `src/components/AddressList.tsx` | Address list view | Virtual scrolling, filtering, search |
| `src/components/WalletSelector.tsx` | Wallet switching UI | Multi-wallet management |
| `src/stores/dashboardStore.ts` | Zustand global state | Wallets, addresses, filters, USB path |
| `src/services/tauri-api.ts` | Tauri IPC wrapper | Type-safe API calls to Rust backend |
| `src/validation/mnemonic.ts` | BIP39 validation | Checksum verification, word validation |

#### Go CLI (Model Layer)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `cmd/arcsign/main.go` | CLI entry point | Dual-mode detection, command routing |
| `internal/handlers/wallet.go` | Wallet handlers | Create, import, export logic |
| `internal/crypto/bip39.go` | BIP39 implementation | Mnemonic generation, validation |
| `internal/crypto/bip44.go` | BIP44 derivation | Address derivation for 54 chains |
| `internal/storage/usb.go` | USB storage | Encrypted wallet file read/write |

#### API Contracts

| File | Purpose | Schema |
|------|---------|--------|
| `specs/004-dashboard/contracts/wallet-api.yaml` | Wallet API spec | Create, import, list wallet contracts |
| `specs/004-dashboard/contracts/address-api.yaml` | Address API spec | Load, export address contracts |
| `specs/004-dashboard/contracts/cli-integration.yaml` | CLI integration spec | JSON response schemas |

#### Documentation

| File | Purpose |
|------|---------|
| `specs/004-dashboard/research.md` | Technical decisions, architecture research |
| `specs/004-dashboard/data-model.md` | Entity relationships, validation rules |
| `specs/004-dashboard/tasks.md` | Implementation task breakdown |
| `dashboard/SYSTEM_SPECIFICATION.md` | System requirements, acceptance criteria |
| `dashboard/quickstart.md` | This file - developer quickstart guide |

---

## Common Tasks

### 1. Add New Tauri Command

**Scenario**: Add a command to rename a wallet.

#### Step 1: Write Test (Rust)

**File**: `dashboard/tests/rust/wallet_rename_test.rs`

```rust
#[cfg(test)]
mod wallet_rename_tests {
    use super::*;

    #[tokio::test]
    async fn test_rename_wallet_updates_metadata() {
        let wallet_id = "test-wallet-id";
        let new_name = "Renamed Wallet";

        let result = rename_wallet(wallet_id.to_string(), new_name.to_string()).await;

        assert!(result.is_ok());
        let updated_wallet = result.unwrap();
        assert_eq!(updated_wallet.name, new_name);
    }
}
```

#### Step 2: Implement Command

**File**: `dashboard/src-tauri/src/commands/wallet.rs`

```rust
use tauri::State;

#[tauri::command]
pub async fn rename_wallet(
    wallet_id: String,
    new_name: String,
    cli: State<'_, CliWrapper>,
) -> Result<Wallet, String> {
    // Call CLI subprocess
    let response = cli.rename_wallet(&wallet_id, &new_name).await
        .map_err(|e| format!("Failed to rename wallet: {}", e))?;

    Ok(response.wallet)
}
```

#### Step 3: Register Command

**File**: `dashboard/src-tauri/src/main.rs`

```rust
fn main() {
    tauri::Builder::default()
        .manage(CliWrapper::new("arcsign"))
        .invoke_handler(tauri::generate_handler![
            commands::wallet::create_wallet,
            commands::wallet::import_wallet,
            commands::wallet::rename_wallet,  // Add new command
            // ... other commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### Step 4: Add TypeScript Types

**File**: `dashboard/src/services/tauri-api.ts`

```typescript
export async function renameWallet(
  walletId: string,
  newName: string
): Promise<Wallet> {
  return await invoke('rename_wallet', {
    walletId,
    newName
  });
}
```

### 2. Add New React Component

**Scenario**: Create a confirmation dialog component.

#### Step 1: Write Test

**File**: `dashboard/tests/frontend/ConfirmationDialog.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

describe('ConfirmationDialog', () => {
  it('should call onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

#### Step 2: Implement Component

**File**: `dashboard/src/components/ConfirmationDialog.tsx`

```typescript
import React from 'react';

interface ConfirmationDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  message,
  onConfirm,
  onCancel
}) => {
  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <p>{message}</p>
        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
};
```

#### Step 3: Export Component

**File**: `dashboard/src/components/index.ts`

```typescript
export { WalletCreate } from './WalletCreate';
export { WalletImport } from './WalletImport';
export { AddressList } from './AddressList';
export { ConfirmationDialog } from './ConfirmationDialog';  // Add export
```

### 3. Modify CLI JSON Output

**Scenario**: Add a `last_used` timestamp to wallet metadata.

#### Step 1: Update Go CLI

**File**: `cmd/arcsign/main.go`

```go
type WalletResponse struct {
    ID          string    `json:"id"`
    Name        string    `json:"name"`
    CreatedAt   time.Time `json:"created_at"`
    LastUsed    time.Time `json:"last_used"`  // Add new field
    AddressCount int      `json:"address_count"`
}
```

#### Step 2: Update API Contract

**File**: `specs/004-dashboard/contracts/wallet-api.yaml`

```yaml
WalletResponse:
  type: object
  properties:
    id:
      type: string
      format: uuid
    name:
      type: string
    created_at:
      type: string
      format: date-time
    last_used:                      # Add to schema
      type: string
      format: date-time
      description: Timestamp of last wallet access
    address_count:
      type: integer
```

#### Step 3: Update Rust Types

**File**: `dashboard/src-tauri/src/models/wallet.rs`

```rust
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,  // Add new field
    pub address_count: usize,
}
```

#### Step 4: Update TypeScript Types

**File**: `dashboard/src/types/wallet.ts`

```typescript
export interface Wallet {
  id: string;
  name: string;
  created_at: string;
  last_used: string;  // Add new field
  address_count: number;
}
```

#### Step 5: Run Tests

```bash
# Update test expectations
# dashboard/tests/rust/wallet_create_test.rs
assert!(wallet.last_used.is_some());

# Verify all tests pass
npm test
cargo test
```

---

## Debugging

### Frontend Debugging (React + TypeScript)

#### Browser DevTools

```bash
# Start dashboard
npm run tauri:dev

# In Tauri window:
# 1. Right-click anywhere
# 2. Select "Inspect Element"
# 3. DevTools opens (same as Chrome DevTools)
```

**Useful Tabs**:
- **Console**: View `console.log()`, errors, warnings
- **Network**: Inspect Tauri IPC calls (WebSocket messages)
- **Sources**: Set breakpoints in TypeScript code
- **React DevTools**: Install extension for component inspection

#### Console Logging

```typescript
// dashboard/src/components/WalletCreate.tsx
const handleSubmit = async (data: FormData) => {
  console.log('Creating wallet with password length:', data.password.length);

  try {
    const result = await createWallet(data.password, usbPath);
    console.log('Wallet created:', result);
  } catch (error) {
    console.error('Wallet creation failed:', error);
  }
};
```

### Rust Backend Debugging

#### Enable Debug Logging

```bash
# macOS/Linux
export RUST_LOG=debug

# Windows (PowerShell)
$env:RUST_LOG="debug"

# Run dashboard with debug logs
npm run tauri:dev
```

**Log Output** (in terminal):

```
[2025-10-22T14:30:25Z DEBUG arcsign_dashboard::commands::wallet] Creating wallet with password
[2025-10-22T14:30:26Z DEBUG arcsign_dashboard::cli::wrapper] Executing CLI: arcsign create
[2025-10-22T14:30:28Z DEBUG arcsign_dashboard::cli::wrapper] CLI response: {"success":true,...}
```

#### Add Debug Statements

**File**: `dashboard/src-tauri/src/commands/wallet.rs`

```rust
use tracing::{debug, info, warn, error};

#[tauri::command]
pub async fn create_wallet(
    password: String,
    usb_path: String,
) -> Result<CreateWalletResponse, String> {
    debug!("create_wallet called with usb_path: {}", usb_path);

    let cli_response = cli.create_wallet(&password, &usb_path).await
        .map_err(|e| {
            error!("CLI error: {}", e);
            format!("Failed to create wallet: {}", e)
        })?;

    info!("Wallet created successfully: {}", cli_response.wallet.id);
    Ok(cli_response)
}
```

### CLI Subprocess Debugging

#### Check CLI Output

The CLI subprocess writes JSON to `stdout` and logs to `stderr`.

**File**: `dashboard/src-tauri/src/cli/wrapper.rs`

```rust
// Capture stderr for debugging
let mut child = Command::new(&self.cli_path)
    .arg("create")
    .env("ARCSIGN_MODE", "dashboard")
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())  // Capture stderr
    .spawn()?;

// Read stderr
let stderr = child.stderr.take().unwrap();
let stderr_reader = BufReader::new(stderr);
for line in stderr_reader.lines() {
    eprintln!("CLI stderr: {}", line?);  // Print to Tauri console
}
```

**Expected CLI Logs** (stderr):

```
[2025-10-22 14:30:25] INFO: Generating BIP39 mnemonic (24 words)
[2025-10-22 14:30:26] INFO: Deriving wallet ID from mnemonic
[2025-10-22 14:30:27] INFO: Encrypting wallet with Argon2id
[2025-10-22 14:30:28] INFO: Writing wallet to USB: /Volumes/TEST_USB/wallet-abc123.enc
```

### Common Debugging Scenarios

#### Issue: Tauri Command Not Found

**Symptom**:
```
Uncaught (in promise): command create_wallet not found
```

**Solution**:
1. Verify command is registered in `src-tauri/src/main.rs`
2. Check command name matches frontend call: `invoke('create_wallet', ...)`
3. Rebuild Rust backend: `cargo build`

#### Issue: USB Not Detected

**Symptom**:
```
Error: No USB drive detected
```

**Solution**:
1. Check USB is mounted: `ls /Volumes` (macOS) or `ls /media` (Linux)
2. Verify environment variable: `echo $USB_PATH`
3. Test USB detection command:
   ```bash
   cd dashboard/src-tauri
   cargo test usb_detection -- --nocapture
   ```

#### Issue: CLI Timeout

**Symptom**:
```
Error: CLI timeout (5s)
```

**Solution**:
1. Increase timeout in `wrapper.rs`:
   ```rust
   timeout(Duration::from_secs(30), async { ... })  // Increase from 5s to 30s
   ```
2. Check CLI performance:
   ```bash
   time ./arcsign create  # Should complete in <10s
   ```
3. Verify USB write speed (not a slow USB 1.0 device)

#### Issue: JSON Parse Error

**Symptom**:
```
Error: Invalid JSON: expected value at line 1 column 1
```

**Solution**:
1. Validate CLI output manually:
   ```bash
   export ARCSIGN_MODE=dashboard
   ./arcsign create | jq .  # jq validates JSON
   ```
2. Check CLI for stderr mixed with stdout
3. Verify `schema_version` matches Rust parser expectations

---

## Build for Production

### Build Dashboard Application

```bash
cd dashboard

# Build frontend and Tauri app
npm run tauri:build
```

**Build Process**:
1. TypeScript compiled to JavaScript
2. Vite bundles React app
3. Rust compiled in release mode (optimized)
4. Tauri packages app with bundled CLI binary

**Output Locations**:

**macOS**:
```
dashboard/src-tauri/target/release/bundle/
├── dmg/
│   └── ArcSign Dashboard_1.0.0_x64.dmg      # Installer
└── macos/
    └── ArcSign Dashboard.app                # Application bundle
```

**Windows**:
```
dashboard\src-tauri\target\release\bundle\
├── msi\
│   └── ArcSign Dashboard_1.0.0_x64_en-US.msi  # Installer
└── nsis\
    └── ArcSign Dashboard_1.0.0_x64-setup.exe  # NSIS installer
```

**Linux**:
```
dashboard/src-tauri/target/release/bundle/
├── deb/
│   └── arcsign-dashboard_1.0.0_amd64.deb    # Debian package
└── appimage/
    └── arcsign-dashboard_1.0.0_amd64.AppImage
```

### Build Verification

```bash
# macOS
open target/release/bundle/macos/ArcSign\ Dashboard.app

# Windows
.\target\release\bundle\nsis\ArcSign Dashboard_1.0.0_x64-setup.exe

# Linux
./target/release/bundle/appimage/arcsign-dashboard_1.0.0_amd64.AppImage
```

### Release Checklist

- [ ] All tests pass: `npm test && cargo test`
- [ ] Version bumped in `package.json` and `Cargo.toml`
- [ ] CHANGELOG.md updated with release notes
- [ ] CLI binary bundled in `src-tauri/arcsign`
- [ ] Cross-platform builds tested (macOS + Windows/Linux)
- [ ] Code signing certificates configured (production only)

---

## Troubleshooting

### USB Not Detected

**Symptoms**:
- Dashboard shows "No USB drive detected"
- `detect_usb` command returns empty array

**Solutions**:

1. **Check USB mount point**:
   ```bash
   # macOS
   ls /Volumes
   # Expected: Macintosh HD, TEST_USB

   # Linux
   ls /media/$USER
   # Expected: USB device name

   # Windows
   wmic logicaldisk get name
   # Expected: C:\, E:\, F:\
   ```

2. **Verify permissions**:
   ```bash
   # macOS/Linux
   ls -ld /Volumes/TEST_USB
   # Expected: drwxr-xr-x ... /Volumes/TEST_USB

   # If permission denied:
   sudo chmod 755 /Volumes/TEST_USB
   ```

3. **Check Tauri filesystem scope**:

   **File**: `dashboard/src-tauri/tauri.conf.json`

   ```json
   "fs": {
     "scope": [
       "$APPDATA/**",
       "/Volumes/**",      // macOS USB paths
       "/media/**",        // Linux USB paths
       "/mnt/**",          // Linux alternative
       "E:\\**",           // Windows USB drives
       "F:\\**"
     ]
   }
   ```

4. **Test USB detection directly**:
   ```bash
   cd dashboard/src-tauri
   cargo test detect_usb -- --nocapture
   ```

### CLI Timeout

**Symptoms**:
- Dashboard shows "Operation timed out"
- Wallet creation hangs at loading spinner

**Solutions**:

1. **Increase timeout**:

   **File**: `dashboard/src-tauri/src/cli/wrapper.rs`

   ```rust
   // Change from 5s to 30s for slow operations
   timeout(Duration::from_secs(30), async {
       reader.read_line(&mut line)
   }).await
   ```

2. **Check CLI performance**:
   ```bash
   # Measure CLI execution time
   time ./arcsign create

   # Expected: <10 seconds
   # If >10 seconds, check:
   # - USB write speed (use USB 3.0, not 1.0)
   # - Argon2id iterations (should be 4, not 100)
   ```

3. **Verify subprocess spawning**:
   ```bash
   # Test CLI directly
   export ARCSIGN_MODE=dashboard
   export WALLET_PASSWORD=Test1234
   export USB_PATH=/Volumes/TEST_USB

   ./arcsign create
   # Should complete in <10s and output JSON
   ```

### JSON Parse Error

**Symptoms**:
- Dashboard shows "Invalid CLI response"
- Console error: "Invalid JSON: expected value at line 1 column 1"

**Solutions**:

1. **Validate CLI output manually**:
   ```bash
   export ARCSIGN_MODE=dashboard
   ./arcsign create | jq .

   # Expected: Valid JSON output
   # If error, check CLI stdout for non-JSON text
   ```

2. **Check for stderr mixed with stdout**:

   **File**: `cmd/arcsign/main.go`

   ```go
   // Ensure logs go to stderr, not stdout
   func WriteLog(message string) {
       fmt.Fprintln(os.Stderr, message)  // Correct
       // NOT: fmt.Println(message)       // Wrong - goes to stdout
   }
   ```

3. **Verify schema version compatibility**:

   **CLI Output**:
   ```json
   {"schema_version": "1.0.0", "success": true, ...}
   ```

   **Rust Parser**:
   ```rust
   const SUPPORTED_SCHEMA_VERSION: &str = "1.0.0";  // Must match
   ```

4. **Enable CLI debug output**:
   ```bash
   export RUST_LOG=debug
   npm run tauri:dev

   # Check Tauri console for raw CLI output
   ```

### Screenshot Protection Not Working

**Symptoms**:
- Mnemonic visible in screenshots (macOS/Windows)
- No watermark overlay (Linux)

**Solutions**:

1. **Verify platform support**:
   ```bash
   # macOS: Requires 10.13+
   sw_vers -productVersion
   # Expected: 10.13.0 or higher

   # Windows: Requires 10 version 2004+
   winver
   # Expected: Version 2004 (Build 19041) or higher
   ```

2. **Check screenshot protection call**:

   **File**: `dashboard/src/components/MnemonicDisplay.tsx`

   ```typescript
   useEffect(() => {
     invoke('enable_screenshot_protection');

     return () => {
       invoke('disable_screenshot_protection');
     };
   }, []);
   ```

3. **Test screenshot protection manually**:

   **macOS**:
   ```bash
   # Open dashboard, display mnemonic
   # Take screenshot: Cmd+Shift+4, select window
   # Expected: Window appears black in screenshot
   ```

   **Windows**:
   ```bash
   # Open dashboard, display mnemonic
   # Take screenshot: Win+Shift+S
   # Expected: Window appears black in Snipping Tool
   ```

4. **Linux watermark fallback**:

   If Linux, verify watermark overlay renders:

   **File**: `dashboard/src/components/WatermarkOverlay.tsx`

   ```typescript
   // Should render diagonal "CONFIDENTIAL" text
   <div style={{ transform: 'rotate(-45deg)', fontSize: '48px' }}>
     CONFIDENTIAL - DO NOT SCREENSHOT
   </div>
   ```

---

## Next Steps

After completing this quickstart, proceed to:

### 1. Read Architecture Documentation

- **Research**: `specs/004-dashboard/research.md`
  - Technical decisions (Tauri vs Electron, Zustand vs Redux)
  - CLI dual-mode architecture
  - Screenshot protection APIs
  - JSON schema validation

- **Data Model**: `specs/004-dashboard/data-model.md`
  - Entity relationships (Wallet, Address, DashboardState)
  - Validation rules
  - State transitions

### 2. Review Implementation Tasks

- **Tasks**: `specs/004-dashboard/tasks.md`
  - 95 tasks organized by user story
  - TDD workflow for each task
  - Dependencies and parallel execution opportunities

### 3. Study API Contracts

- **Wallet API**: `specs/004-dashboard/contracts/wallet-api.yaml`
- **Address API**: `specs/004-dashboard/contracts/address-api.yaml`
- **CLI Integration**: `specs/004-dashboard/contracts/cli-integration.yaml`

### 4. Follow TDD Workflow

1. Pick a task from `tasks.md` (start with Setup Phase T001-T012)
2. Write test first (RED)
3. Implement minimal code (GREEN)
4. Refactor if needed (REFACTOR)
5. Commit and move to next task

### 5. Join Development

- **Communication**: Set up team chat (Slack/Discord)
- **Code Reviews**: Submit PRs for each completed user story
- **Testing**: Run full test suite before each commit
- **Documentation**: Update `SYSTEM_SPECIFICATION.md` after deployment

---

## Additional Resources

### Official Documentation

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [React Documentation](https://react.dev/)
- [Zustand State Management](https://docs.pmnd.rs/zustand/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [Vitest Testing](https://vitest.dev/)

### ArcSign Constitution

- Location: `.specify/memory/constitution.md`
- Key Principles:
  - **Principle I**: Security-First Development (NON-NEGOTIABLE)
  - **Principle II**: Test-Driven Development (RED-GREEN-REFACTOR)
  - **Principle III**: Incremental Progress Over Big Bangs
  - **Principle IV**: Composition Over Inheritance
  - **Principle V**: Documentation-Driven Development

### BIP Standards

- [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki): Mnemonic code
- [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki): Multi-account hierarchy
- [SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md): Coin type registry

---

**Happy coding!** Follow TDD principles, prioritize security, and build incrementally.

For questions or issues, refer to `specs/004-dashboard/research.md` for technical decisions or open an issue in the project repository.
