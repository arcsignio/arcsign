# Implementation Plan: User Dashboard for Wallet Management

**Branch**: `004-dashboard` | **Date**: 2025-10-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-dashboard/spec.md`

## Summary

Build a cross-platform desktop dashboard using Tauri (Rust backend + web frontend) that provides a graphical interface for HD wallet management. The dashboard integrates with the existing Go CLI (arcsign) via subprocess invocation, supporting wallet creation, import, address display, and multi-wallet management. The CLI has been refactored to support dual-mode operation (interactive for terminal use, non-interactive with JSON output for dashboard integration). All wallet data remains encrypted and stored exclusively on USB drives, maintaining the existing security model while adding a user-friendly GUI layer.

## Technical Context

**Language/Version**:
- Go 1.21+ (existing CLI, dual-mode JSON output)
- Rust 1.75+ (Tauri backend)
- TypeScript 5.x (React frontend)
- Node.js 18+ (frontend build toolchain)

**Primary Dependencies**:
- **Backend**: Tauri 1.5 (Rust desktop app framework), serde/serde_json (Rust JSON), tokio (async runtime)
- **Frontend**: React 18, TypeScript, React Hook Form, Zod (validation), Tauri API bindings
- **CLI**: Existing Go modules (tyler-smith/go-bip39, btcsuite/hdkeychain, Argon2id, AES-256-GCM)

**Storage**:
- USB-only storage (existing requirement, no hard drive persistence)
- File structure: `{USB_PATH}/wallets/{wallet-id}/` containing encrypted wallet + addresses.json
- addresses.json format: schema_version "1.0", checksum (SHA-256), 54 addresses with full BIP44 derivation

**Testing**:
- Go CLI: `go test` (unit + integration for dual-mode operation, JSON output validation)
- Rust Backend: `cargo test` (Tauri command tests, subprocess integration tests)
- Frontend: Vitest (component tests), React Testing Library (UI interactions)

**Target Platform**:
- Desktop: Windows 10+, macOS 11+, Linux (Ubuntu 20.04+)
- Distribution: Single executable with embedded web assets (~10MB bundle)

**Project Type**: Web application (Tauri desktop with backend-frontend separation)

**Performance Goals**:
- Wallet creation: <15 seconds (includes 54 address generation)
- Address display: <2 seconds (read pre-generated addresses.json)
- CLI subprocess operations: 30-second timeout limit
- UI interactions: <200ms response time

**Constraints**:
- USB-only storage (no hard drive persistence for wallet data)
- Offline operation required (no internet dependency for core features)
- Existing Go CLI must support both interactive (stdin prompts) and non-interactive (environment variables → JSON stdout) modes
- Cross-platform: Windows, macOS, Linux
- Security: mnemonic hidden by default, platform-specific screenshot protection

**Scale/Scope**:
- Support up to 10 wallets per user (single-user desktop application)
- 54 blockchain addresses per wallet (fixed, generated at creation)
- Dashboard manages existing CLI binary (subprocess invocation pattern)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First Development (NON-NEGOTIABLE)

- [x] **Private keys/mnemonics remain on USB**: Dashboard never stores sensitive data; all wallet operations delegated to CLI on USB
- [x] **Encryption (Argon2id + AES-256-GCM)**: Existing CLI encryption maintained; dashboard passes password via environment variable only
- [x] **Multi-factor authentication**: Application password (future scope per OS-011) + Wallet password (existing CLI requirement)
- [x] **API credentials isolated**: N/A for this feature (no external API integration in dashboard; future arcsign_api_service per constitution)
- [x] **Logs sanitized**: Dashboard logs exclude passwords, mnemonics; CLI outputs to stderr (human logs) vs stdout (JSON); sensitive data not logged
- [x] **Secrets via environment variables**: CLI receives WALLET_PASSWORD, USB_PATH, RETURN_MNEMONIC via env vars; no hardcoded secrets

**Status**: ✅ PASS - All security requirements aligned with existing CLI security model and constitution

### II. Test-Driven Development (NON-NEGOTIABLE)

- [x] **Red-Green-Refactor cycle**: Tests written before implementation for all dashboard components and CLI dual-mode functionality
- [x] **Unit + Integration + Contract tests**:
  - CLI: Unit tests for JSON output, integration tests for dual-mode detection, contract tests for addresses.json schema
  - Rust: Unit tests for Tauri commands, integration tests for subprocess invocation
  - Frontend: Unit tests for components, integration tests for form validation, contract tests for API responses
- [x] **Security tests**: Mnemonic display protection tests, password validation tests, subprocess timeout tests, error sanitization tests

**Status**: ✅ PASS - TDD approach planned for all layers

### III. Incremental Progress Over Big Bangs

- [x] **3-5 phases**:
  - Phase 0: Research (CLI refactoring approach, Tauri setup, screenshot protection APIs)
  - Phase 1: Design (data model, CLI JSON contracts, UI wireframes, quickstart)
  - Phase 2: Tasks (breakdown into 5 user stories with incremental deliverables)
- [x] **Every commit runnable**: Each task produces testable, compilable increment
- [x] **3 attempts max**: Documented in tasks.md; failures trigger alternative approach

**Status**: ✅ PASS - Phased approach with clear incremental deliverables

### IV. Composition Over Inheritance

- [x] **Interfaces and DI**:
  - Rust: Trait-based subprocess abstraction (CliWrapper trait for testability)
  - Frontend: React hooks for state management, composition for UI components
  - Go CLI: Existing service interfaces (WalletService, MnemonicService) maintained
- [x] **Single responsibility**: Each module has clear purpose (USB detection, subprocess execution, form validation, address display)
- [x] **Avoid over-abstraction**: Direct subprocess invocation, explicit error handling, readable validation logic

**Status**: ✅ PASS - Composition-based design across all layers

### V. Documentation-Driven Development

- [x] **API contracts before implementation**: CLI JSON response schemas documented in contracts/ (OpenAPI for consistency)
- [x] **Architectural decisions documented**: This plan.md documents dual-mode CLI, subprocess communication, security model
- [x] **Single source of truth**: spec.md updated with all clarifications; plan.md defines technical approach

**Status**: ✅ PASS - Documentation-first approach followed

### Architecture Alignment

- [x] **MVC separation**:
  - Model: Wallet/Address entities (TypeScript types matching CLI JSON)
  - View: React components (WalletCreate, WalletList, AddressDisplay)
  - Controller: Tauri commands (create_wallet, list_wallets, get_addresses)
- [x] **Backend-first (Go)**: Existing Go CLI provides all business logic; dashboard is presentation layer
- [x] **API service isolation**: N/A for this feature (no external APIs; future arcsign_api_service integration per constitution)

**Status**: ✅ PASS - MVC respected, Go backend-first maintained

**Overall Gate Status**: ✅ PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```
specs/004-dashboard/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── cli-api.yaml     # OpenAPI spec for CLI JSON responses
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application structure (Tauri desktop app with frontend-backend separation)

dashboard/                        # NEW: Tauri desktop application
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri app setup
│   │   ├── commands/             # Tauri command handlers
│   │   │   ├── mod.rs
│   │   │   ├── wallet.rs         # create_wallet, list_wallets
│   │   │   ├── usb.rs            # detect_usb, validate_usb
│   │   │   └── address.rs        # get_addresses (read addresses.json)
│   │   ├── cli/                  # CLI subprocess wrapper
│   │   │   ├── mod.rs
│   │   │   ├── wrapper.rs        # CliWrapper trait + implementation
│   │   │   └── types.rs          # Rust types for CLI JSON responses
│   │   ├── security/             # Screenshot protection
│   │   │   ├── mod.rs
│   │   │   ├── macos.rs          # NSWindow.setContentProtection
│   │   │   ├── windows.rs        # SetWindowDisplayAffinity
│   │   │   └── linux.rs          # Watermark overlay
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json           # Tauri configuration (permissions, window settings)
│
├── src/                          # React frontend
│   ├── components/
│   │   ├── WalletCreate.tsx      # Wallet creation form
│   │   ├── WalletImport.tsx      # Mnemonic import form
│   │   ├── WalletList.tsx        # Multi-wallet switcher
│   │   ├── AddressDisplay.tsx    # 54 addresses with search/filter
│   │   ├── MnemonicDisplay.tsx   # Secure mnemonic viewer (advanced)
│   │   └── UsbDetector.tsx       # USB drive selector
│   ├── pages/
│   │   ├── Home.tsx              # Dashboard home
│   │   └── Settings.tsx          # Future: app settings
│   ├── services/
│   │   └── tauri-api.ts          # Tauri command wrappers
│   ├── stores/
│   │   └── dashboardStore.ts     # Zustand state management
│   ├── types/
│   │   └── wallet.ts             # TypeScript types matching CLI JSON
│   └── validation/
│       └── password.ts           # Zod schemas for forms
│
└── tests/
    ├── integration/              # End-to-end dashboard tests
    └── unit/                     # Component unit tests

cmd/arcsign/                      # EXISTING: Go CLI (modified for dual-mode)
├── main.go                       # MODIFIED: Dual-mode detection (env vars vs interactive)
├── handlers.go                   # MODIFIED: JSON output functions (handleCreateWalletNonInteractive)
└── ...                           # Existing wallet business logic (unchanged)

internal/                         # EXISTING: Go services (unchanged)
├── wallet/
│   └── wallet.go                 # MODIFIED: Add generateAddressesFile() for addresses.json
├── mnemonic/
└── crypto/

tests/                            # EXISTING: Go tests (expanded for dual-mode)
└── cli/
    ├── interactive_test.go       # Existing stdin/stdout tests
    └── noninteractive_test.go    # NEW: Environment variable + JSON output tests
```

**Structure Decision**:
- **Web application** (Option 2) selected because feature involves both backend (Rust Tauri) and frontend (React)
- Existing Go CLI (`cmd/arcsign`) modified to support dual-mode operation but remains independent
- Dashboard lives in new `dashboard/` directory with Tauri backend-frontend separation
- Clear separation: Go CLI handles wallet business logic, Rust handles subprocess orchestration, React handles presentation

## Complexity Tracking

*No constitution violations detected. This feature maintains existing security model and adds presentation layer without introducing new complexity.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
