# Research & Technical Decisions: Dashboard Feature

**Feature**: User Dashboard for Wallet Management
**Date**: 2025-10-17
**Status**: Phase 0 Complete

## Overview

This document captures all technical research and decisions made during Phase 0 planning for the ArcSign dashboard application. All "NEEDS CLARIFICATION" items from the plan have been resolved.

---

## Decision 1: Frontend Framework Selection (React vs Svelte)

### Decision
**React 18+ with TypeScript** for the Tauri frontend.

### Rationale

**Security Priority (Critical for Crypto Wallet)**:
- React has larger security research community and extensive audit history
- Multiple production cryptocurrency wallets use React + Tauri (BMO Wallet, commercial solutions)
- No comparable Svelte + Tauri crypto wallet examples found in production
- React's maturity reduces implementation risk for financial software

**Form Complexity**:
- Wallet creation/import flows require complex validation (BIP39 mnemonic phrases, derivation paths, password confirmation)
- React Hook Form + Zod schema validation is battle-tested for crypto-specific validation patterns
- Svelte's form libraries (Felte, Sveltik) are less mature for these scenarios

**Testing Requirements**:
- Cryptocurrency wallets require extensive testing (unit, integration, E2E)
- React Testing Library + Vitest + Playwright provide better tooling for Tauri integration tests
- Critical for security audits and compliance

**Ecosystem Maturity**:
- React: 110,000+ developer positions globally (122:1 ratio vs Svelte)
- Easier to find developers with crypto/Web3 experience for code reviews and audits
- Extensive UI component libraries (Chakra UI, MUI, Ant Design, Mantine)

**Performance Trade-offs**:
- Svelte: 1.8 KB gzipped vs React: 44.5 KB gzipped (42 KB difference)
- Tauri apps are already lightweight (~3-5 MB total), 42 KB is <1% overhead
- React meets performance requirements (<200ms UI, 54 addresses in <15s) with virtual lists
- Svelte's performance advantage is overkill for this use case

### Alternatives Considered

**Svelte 5**:
- **Pros**: 96% smaller bundle, compile-time optimization, fine-grained reactivity, simpler DX
- **Cons**: Smaller ecosystem (900 jobs globally), recent XSS vulnerabilities (CVE-2024-45047), immature form libraries, fewer production crypto wallet examples
- **Rejected Because**: Security and ecosystem maturity outweigh performance gains we don't need

**Vue 3**:
- **Pros**: Middle ground between React/Svelte, good reactivity model, growing ecosystem
- **Cons**: Fewer crypto wallet examples, composition API still maturing, smaller talent pool than React
- **Rejected Because**: React's cryptocurrency ecosystem is more established

### Implementation Stack

```typescript
// Frontend Stack
- React 18+
- TypeScript 5.0+
- Vite (build tool)
- React Hook Form + Zod (form validation)
- Zustand (lightweight state management)
- react-window (virtual lists for 54 addresses)
- DOMPurify (XSS sanitization)
- Vitest (unit/component tests)
- Playwright (E2E tests)
```

**Security Patterns**:
- Keep sensitive data (mnemonics, passwords) in Rust backend via Tauri State Manager
- Never store plaintext secrets in React state
- Use `tauri-plugin-clipboard` with 30-second auto-clear for address copying
- React's JSX auto-escaping for XSS protection (no `dangerouslySetInnerHTML` usage)

---

## Decision 2: Tauri CLI Integration Pattern

### Decision
**Subprocess wrapper pattern** - Rust backend spawns Go CLI as subprocess, parses stdout/stderr.

### Rationale

**Separation of Concerns**:
- Existing Go CLI is mature, tested, and handles all wallet logic (creation, encryption, derivation)
- Tauri Rust backend acts as thin orchestration layer between UI and CLI
- Dashboard can be developed/deployed independently from CLI updates

**Security Boundary**:
- Go CLI already implements secure USB storage, encryption (Argon2id + AES-256-GCM), and audit logging
- Subprocess isolation prevents dashboard from bypassing security controls
- Sensitive operations (mnemonic generation, wallet decryption) stay in Go's memory space

**Maintainability**:
- No need to reimplement 54-blockchain derivation logic in Rust
- CLI can be updated independently (bug fixes, new chains) without dashboard changes
- Shared CLI between terminal users and GUI users ensures consistency

### Alternatives Considered

**Rust FFI to Go**:
- **Pros**: Direct function calls, no subprocess overhead, tighter integration
- **Cons**: Complex CGO setup, memory management at language boundary, harder to debug, security boundary unclear
- **Rejected Because**: Complexity outweighs minor performance gains (wallet operations are infrequent)

**Rust Native Implementation**:
- **Pros**: Single-language codebase, no subprocess overhead, cleaner architecture
- **Cons**: Must reimplement all 54 blockchain formatters, duplicate encryption logic, duplicate USB management
- **Rejected Because**: Massive duplication of effort, high risk of introducing bugs in security-critical code

### Implementation Pattern

```rust
// Rust subprocess wrapper (dashboard/src-tauri/src/cli/wrapper.rs)
use std::process::Command;
use serde::{Deserialize, Serialize};

pub struct CliWrapper {
    cli_path: String,
}

impl CliWrapper {
    pub async fn create_wallet(&self, password: &str) -> Result<WalletResponse, CliError> {
        let output = Command::new(&self.cli_path)
            .arg("create")
            .env("WALLET_PASSWORD", password) // Pass via env for security
            .output()
            .await?;

        if !output.status.success() {
            return Err(CliError::from_stderr(&output.stderr));
        }

        serde_json::from_slice(&output.stdout)?
    }

    pub async fn generate_all(&self, wallet_id: &str, password: &str)
        -> Result<Vec<Address>, CliError> {
        // Similar pattern for generate-all command
    }
}
```

**Security Considerations**:
- Passwords passed via environment variables (not command-line args visible in `ps`)
- Stdout captured and parsed (JSON), stderr for errors
- No shell invocation (`Command::new` vs `sh -c`) to prevent injection attacks
- CLI validates all inputs (Rust only orchestrates, doesn't validate)

---

## Decision 3: State Management Architecture

### Decision
**Layered state management** with clear security boundaries.

### Rationale

**Security Separation**:
- Sensitive data (mnemonics, passwords) must never touch JavaScript heap
- Rust backend holds transient secrets during operations, clears immediately after
- React state only holds non-sensitive UI state and display-safe data (wallet IDs, address lists)

**Performance**:
- Zustand for lightweight global state (selected wallet, filters, search query)
- React component state for local UI state (form inputs, loading states)
- No need for heavy Redux/MobX - wallet operations are infrequent

### Implementation Layers

```
┌─────────────────────────────────────────┐
│ React Components (View Layer)          │
│ - Display only: wallet names, addresses│
│ - No sensitive data in state            │
└─────────────────┬───────────────────────┘
                  │ Tauri IPC
┌─────────────────▼───────────────────────┐
│ Tauri Rust Commands (Controller)       │
│ - Transient sensitive data in memory    │
│ - Immediate clearing after operations   │
└─────────────────┬───────────────────────┘
                  │ Subprocess
┌─────────────────▼───────────────────────┐
│ Go CLI (Model Layer)                    │
│ - Persistent encrypted storage (USB)    │
│ - All cryptographic operations          │
└─────────────────────────────────────────┘
```

**State Ownership**:
- **React (Zustand)**: Selected wallet ID, active category filter, search query, UI preferences
- **Tauri State**: USB device path, CLI process handle, temporary operation results
- **Go CLI**: Encrypted wallet files, mnemonic seeds, private keys (on USB only)

---

## Decision 4: USB Storage Integration

### Decision
**Wrapper around existing Go USB detection** with Tauri file system APIs for read/write.

### Rationale

**Leverage Existing Logic**:
- Go CLI already has USB detection (`internal/services/storage/`)
- Tauri just needs to detect mount point and pass path to CLI
- No need to reimplement USB enumeration in Rust

**Cross-Platform Consistency**:
- Go's USB detection works on Windows (drive letters), macOS (/Volumes), Linux (/media, /mnt)
- Tauri uses platform-agnostic path handling once USB is detected

### Implementation

```rust
// Tauri USB detection (dashboard/src-tauri/src/commands/usb.rs)
use tauri::api::path;
use std::path::PathBuf;

#[tauri::command]
pub async fn detect_usb_devices() -> Result<Vec<String>, String> {
    // Call Go CLI's detect command or scan known USB mount points
    let output = Command::new("./arcsign")
        .arg("detect-usb")
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let devices: Vec<String> = serde_json::from_slice(&output.stdout)
        .map_err(|e| e.to_string())?;

    Ok(devices)
}
```

**User Experience**:
- Dashboard scans for USB on startup
- Shows clear error if no USB detected
- Re-scan button if user plugs USB after launch
- All wallet operations blocked until USB available (enforced by CLI)

---

## Decision 5: Clipboard Security

### Decision
**Tauri clipboard plugin with 30-second auto-clear** for address copying.

### Rationale

**Security Requirement** (FR-SEC-005):
- Addresses are public but should not linger in clipboard indefinitely
- 30-second window balances usability (paste into recipient field) vs security

**Implementation**:
```typescript
// frontend/src/services/clipboard.ts
import { writeText } from '@tauri-apps/api/clipboard';

export async function copyAddressToClipboard(address: string): Promise<void> {
  await writeText(address);

  // Auto-clear after 30 seconds
  setTimeout(async () => {
    const current = await readText();
    if (current === address) {
      await writeText(''); // Clear clipboard
    }
  }, 30000);
}
```

**User Feedback**:
- Toast notification: "Address copied! Clipboard will clear in 30 seconds"
- Visual indicator on address row (checkmark for 2 seconds)

---

## Decision 6: Mnemonic Display Security

### Decision
**Custom secure mnemonic component** with screenshot prevention, countdown timer, and memory clearing.

### Rationale

**Security Requirements** (SEC-002, SEC-003, SEC-004):
- SEC-002: Time-limited display (30-second countdown)
- SEC-003: Clear from memory immediately after user confirms
- SEC-004: Screenshot/screen recording prevention (OS-level APIs)

### Implementation

```typescript
// frontend/src/components/MnemonicDisplay.tsx
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api';

export function MnemonicDisplay({ mnemonic, onConfirm }) {
  const [countdown, setCountdown] = useState(30);
  const [canConfirm, setCanConfirm] = useState(false);

  useEffect(() => {
    // Enable screenshot prevention
    invoke('enable_screenshot_protection');

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanConfirm(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      // Clear mnemonic from memory
      invoke('clear_sensitive_memory');
      invoke('disable_screenshot_protection');
      clearInterval(timer);
    };
  }, []);

  const handleConfirm = () => {
    // User acknowledged backup
    invoke('clear_sensitive_memory');
    onConfirm();
  };

  return (
    <div className="mnemonic-display">
      <div className="mnemonic-grid">
        {mnemonic.split(' ').map((word, i) => (
          <div key={i} className="mnemonic-word">
            <span className="word-number">{i + 1}</span>
            <span className="word-text">{word}</span>
          </div>
        ))}
      </div>

      <div className="warning">
        <p>⚠️ Write down these words in order. You will not see them again.</p>
        {countdown > 0 && <p>Please review for {countdown} seconds...</p>}
      </div>

      <button
        disabled={!canConfirm}
        onClick={handleConfirm}
      >
        {canConfirm ? 'I have backed up my mnemonic' : `Wait ${countdown}s...`}
      </button>
    </div>
  );
}
```

**Rust Backend** (screenshot prevention):
```rust
// dashboard/src-tauri/src/commands/security.rs
#[cfg(target_os = "macos")]
fn enable_screenshot_protection() {
    // macOS: Set window as non-capturable
    // NSWindow.sharingType = .none
}

#[cfg(target_os = "windows")]
fn enable_screenshot_protection() {
    // Windows: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
}

#[cfg(target_os = "linux")]
fn enable_screenshot_protection() {
    // Linux: Limited support, log warning
}
```

---

## Decision 7: Error Handling Pattern

### Decision
**Typed error hierarchy** with user-friendly messages and technical details for logging.

### Rationale

**Security Consideration** (SEC-008):
- Error messages must not reveal sensitive information (wallet existence, password hints)
- Technical details logged for debugging but not shown to user

### Implementation

```rust
// dashboard/src-tauri/src/error.rs
#[derive(Debug, Serialize)]
pub enum DashboardError {
    UsbNotDetected {
        user_message: String,
        technical_details: String,
    },
    WalletCreationFailed {
        user_message: String,
        technical_details: String,
    },
    InvalidMnemonic {
        user_message: String,
        technical_details: String,
    },
    CliError {
        user_message: String,
        technical_details: String,
    },
}

impl DashboardError {
    pub fn to_user_message(&self) -> String {
        match self {
            Self::InvalidMnemonic { user_message, .. } => user_message.clone(),
            // Never reveal: "wallet not found" → "Invalid wallet ID or password"
            _ => self.generic_user_message(),
        }
    }

    pub fn log_technical_details(&self) {
        // Log to audit file, never to UI
        match self {
            Self::CliError { technical_details, .. } => {
                tracing::error!("CLI error: {}", technical_details);
            }
            // ...
        }
    }
}
```

**User-Facing Error Messages**:
- ✅ "Invalid mnemonic: checksum verification failed"
- ✅ "USB drive not detected. Please insert your wallet drive."
- ❌ "Wallet 'personal-wallet' does not exist" (reveals wallet names)
- ✅ "Wallet not found or incorrect password" (ambiguous for security)

---

## Phase 0 Summary

### All Clarifications Resolved

| Item | Decision | Rationale |
|------|----------|-----------|
| Frontend Framework | React 18+ | Security, ecosystem maturity, production crypto wallet examples |
| CLI Integration | Subprocess wrapper | Security boundary, maintainability, leverage existing Go code |
| State Management | Layered (React/Rust/Go) | Clear security boundaries for sensitive data |
| USB Storage | Wrapper around Go CLI | Leverage existing detection, cross-platform consistency |
| Clipboard Security | Tauri plugin + 30s auto-clear | Balance usability vs security |
| Mnemonic Display | Custom component + screenshot prevention | Meet SEC-002, SEC-003, SEC-004 requirements |
| Error Handling | Typed hierarchy + user-friendly messages | Prevent information disclosure (SEC-008) |

### Technology Stack Finalized

**Frontend**:
- React 18+, TypeScript 5.0+, Vite
- React Hook Form + Zod
- Zustand (state)
- react-window (virtual lists)
- Vitest + Playwright (testing)

**Backend (Tauri)**:
- Rust 1.75+, Tauri 1.5+
- tauri-plugin-clipboard
- serde_json (CLI output parsing)
- tokio (async subprocess)

**Existing Services**:
- Go 1.21+ CLI (unchanged)
- USB storage (Go internal/services/storage)
- Encryption (Go internal/services/encryption)

### Next Phase

Ready to proceed to **Phase 1: Design & Contracts**
- Generate data-model.md (entities and state)
- Generate Tauri command contracts (contracts/tauri-commands.yaml)
- Generate CLI integration contracts (contracts/cli-integration.yaml)
- Generate quickstart.md (developer setup guide)
- Update agent context (CLAUDE.md with new technologies)
