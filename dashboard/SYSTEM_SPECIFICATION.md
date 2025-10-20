# ArcSign Dashboard - System Specification

## Overview

The ArcSign Dashboard is a Tauri-based desktop application that provides a user-friendly interface for managing HD wallets stored on USB drives. It implements BIP39/BIP44 standards for wallet generation and derivation, with comprehensive support for multi-chain address management.

**Version**: 1.0.0
**Generated**: 2025-10-17
**Feature Branch**: 004-dashboard

## Architecture

### Technology Stack

#### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand with LocalStorage persistence
- **Form Management**: React Hook Form + Zod validation
- **UI**: TailwindCSS for styling
- **Virtual Scrolling**: react-window for large lists (100+ addresses)

#### Backend
- **Runtime**: Tauri (Rust)
- **CLI Integration**: Go CLI subprocess execution
- **Security**:
  - AES-256-GCM encryption
  - Argon2id key derivation (4 iterations, 256 MiB memory)
  - USB-only storage with 0600 file permissions
  - Screenshot protection (OS-level)
  - Memory clearing for sensitive data

### Component Architecture

```
dashboard/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── WalletCreate.tsx
│   │   ├── WalletImport.tsx
│   │   ├── WalletSelector.tsx
│   │   ├── AddressList.tsx
│   │   ├── AddressRow.tsx
│   │   ├── ExportDialog.tsx
│   │   ├── MnemonicDisplay.tsx
│   │   ├── InactivityWarningDialog.tsx
│   │   ├── ConfirmationDialog.tsx
│   │   └── LoadingSpinner.tsx
│   ├── pages/              # Top-level views
│   │   └── Dashboard.tsx
│   ├── stores/             # State management
│   │   └── dashboardStore.ts
│   ├── hooks/              # Custom React hooks
│   │   └── useInactivityLogout.ts
│   ├── services/           # API layer
│   │   ├── tauri-api.ts
│   │   └── clipboard.ts
│   ├── validation/         # Form schemas
│   │   ├── password.ts
│   │   └── mnemonic.ts
│   └── types/              # TypeScript definitions
│       ├── wallet.ts
│       └── address.ts
├── src-tauri/
│   └── src/
│       ├── commands/       # Tauri command handlers
│       │   ├── wallet.rs
│       │   ├── export.rs
│       │   ├── usb.rs
│       │   └── security.rs
│       ├── models/         # Data models
│       └── main.rs
└── tests/
    ├── frontend/           # React component tests
    └── rust/               # Rust integration tests
```

## Core Features

### 1. Wallet Creation (US1)

**Requirements**: FR-001, FR-002, FR-004, SEC-001, SEC-003

**Components**:
- `WalletCreate`: Form component with validation
- `MnemonicDisplay`: Secure mnemonic display with copy protection

**Flow**:
1. User selects USB drive
2. Enters wallet name (optional, 1-50 characters)
3. Creates password (12+ chars, uppercase, lowercase, number required)
4. Optionally sets BIP39 passphrase (25th word)
5. Selects mnemonic length (12 or 24 words)
6. Submits form → CLI generates encrypted wallet
7. Mnemonic displayed once (must confirm before proceeding)

**Security**:
- Mnemonic auto-cleared from memory after 30 seconds
- Form data never persisted
- Cancellation confirmation if form dirty (FR-032)

### 2. Wallet Import (US2)

**Requirements**: FR-006, FR-029, FR-030, FR-031

**Components**:
- `WalletImport`: Mnemonic input with normalization

**Flow**:
1. User pastes/types 12 or 24 word mnemonic
2. Mnemonic normalized (lowercase, trimmed, single spaces)
3. Real-time BIP39 validation
4. Password and optional passphrase entry
5. Duplicate detection (shows warning if wallet exists)
6. Import → CLI creates wallet from mnemonic

**Validation**:
- Word count check (12 or 24)
- Valid BIP39 word list check
- Checksum validation
- Duplicate wallet detection (FR-031)

### 3. Address Management (US3)

**Requirements**: FR-013, FR-015, FR-017, SC-008

**Components**:
- `AddressList`: Virtualized table for 100+ addresses
- `AddressRow`: Individual address display with clipboard copy

**Flow**:
1. User selects wallet and enters password
2. CLI derives all SLIP-44 addresses (BTC, ETH, etc.)
3. Addresses loaded into memory (cached for session)
4. Virtual scrolling for performance (<5s load time)

**Features**:
- Address clipboard copy with auto-clear (30 seconds)
- Sort by rank, symbol, category
- Filter by category, key type, testnet
- Search by symbol or name
- Display: rank, symbol, name, category, coin type, key type, derivation path, address

**Performance**:
- Virtual scrolling (react-window)
- In-memory caching (Rust HashMap with Mutex)
- <5s load time for 100+ addresses (SC-008)

### 4. Multi-Wallet Management (US4)

**Requirements**: FR-019, A-005

**Components**:
- `WalletSelector`: Grid display of wallets with inline rename

**Flow**:
1. Dashboard lists all wallets from USB
2. User can select, rename, or view addresses
3. Wallet metadata displayed (name, created date, address count, passphrase indicator)

**Constraints**:
- Maximum 10 wallets per USB drive (A-005)
- Wallet names 1-50 characters
- Inline rename with validation

### 5. Export Addresses (US5)

**Requirements**: FR-021, TC-010, SC-008

**Components**:
- `ExportDialog`: Format selection (JSON/CSV)

**Flow**:
1. User views addresses for wallet
2. Clicks "Export Addresses"
3. Selects format (JSON or CSV)
4. CLI exports to USB: `{wallet_id}/addresses/addresses-{timestamp}.{ext}`
5. File permissions set to 0600 (owner read/write only)

**Export Formats**:

**JSON**:
```json
{
  "wallet_id": "...",
  "exported_at": "2025-10-17T...",
  "addresses": [
    {
      "rank": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "category": "BASE",
      "coin_type": 0,
      "key_type": "secp256k1",
      "derivation_path": "m/44'/0'/0'/0/0",
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "error": null
    }
  ]
}
```

**CSV**:
```
Rank,Symbol,Name,Category,Coin Type,Key Type,Derivation Path,Address,Error
1,BTC,Bitcoin,BASE,0,secp256k1,m/44'/0'/0'/0/0,1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa,
```

### 6. Security Features

**Requirements**: SEC-006, FR-032

#### Auto-Logout (T092)
- **Component**: `useInactivityLogout` hook
- **Trigger**: 15 minutes of inactivity
- **Events Monitored**: mousemove, keydown, click, scroll, touchstart
- **Warning**: 60-second countdown before logout
- **Action**: Clears sensitive memory + resets application state

#### Cancellation Confirmation (T093)
- **Component**: `ConfirmationDialog`
- **Trigger**: User tries to cancel form with unsaved data
- **Forms**: WalletCreate, WalletImport
- **Detection**: React Hook Form `isDirty` state

#### Screenshot Protection (SEC-003)
- OS-level protection during mnemonic display
- Disabled after mnemonic confirmation

#### Clipboard Security
- Automatic clear after 30 seconds
- Used for address copying

## Data Flow

### Wallet Creation Flow

```
User Input → WalletCreate
    ↓
React Hook Form Validation (Zod)
    ↓
Tauri IPC: create_wallet
    ↓
Rust Command Handler
    ↓
CLI Subprocess: arcsign create-wallet
    ↓
Encrypted Wallet File (USB)
    ↓
Response: {wallet, mnemonic}
    ↓
MnemonicDisplay (one-time view)
    ↓
Zustand Store Update
    ↓
Dashboard Refresh
```

### Address Loading Flow

```
User selects wallet → Password prompt
    ↓
Tauri IPC: load_addresses
    ↓
Rust Command Handler
    ↓
Check AddressCache (Mutex<HashMap>)
    ↓ (if miss)
CLI Subprocess: arcsign load-addresses
    ↓
Parse JSON Response
    ↓
Store in AddressCache
    ↓
Return addresses to frontend
    ↓
AddressList (virtual scrolling)
```

## State Management

### Zustand Store (`dashboardStore`)

**Persisted** (LocalStorage):
- `selectedWalletId`: Currently selected wallet
- `filter`: Address filter preferences
- `searchQuery`: Address search query
- `usbPath`: Last used USB path

**Non-Persisted** (reloaded on mount):
- `wallets`: List of wallets from USB
- `addresses`: Current wallet's addresses

**Actions**:
- `setWallets`, `addWallet`, `updateWallet`
- `selectWallet`
- `setAddresses`
- `setFilter`, `clearFilter`
- `setSearchQuery`
- `reset`: Clear all state (logout)

## Tauri Commands

### Wallet Commands

**`create_wallet`**
```rust
#[tauri::command]
pub async fn create_wallet(
    password: String,
    usb_path: String,
    name: Option<String>,
    passphrase: Option<String>,
    mnemonic_length: u8,
) -> Result<WalletCreateResponse, String>
```

**`import_wallet`**
```rust
#[tauri::command]
pub async fn import_wallet(
    mnemonic: String,
    password: String,
    usb_path: String,
    passphrase: Option<String>,
    name: Option<String>,
) -> Result<WalletImportResponse, String>
```

**`list_wallets`**
```rust
#[tauri::command]
pub async fn list_wallets(usb_path: String) -> Result<Vec<Wallet>, String>
```

**`load_addresses`**
```rust
#[tauri::command]
pub async fn load_addresses(
    wallet_id: String,
    password: String,
    usb_path: String,
    cache: State<'_, AddressCache>,
) -> Result<AddressListResponse, String>
```

**`rename_wallet`**
```rust
#[tauri::command]
pub async fn rename_wallet(
    wallet_id: String,
    new_name: String,
    usb_path: String,
) -> Result<Wallet, String>
```

### Export Commands

**`export_addresses`**
```rust
#[tauri::command]
pub async fn export_addresses(
    wallet_id: String,
    password: String,
    usb_path: String,
    format: ExportFormat,
) -> Result<ExportResponse, String>
```

### USB Commands

**`detect_usb`**
```rust
#[tauri::command]
pub async fn detect_usb() -> Result<Vec<UsbDevice>, String>
```

### Security Commands

**`enable_screenshot_protection`**
**`disable_screenshot_protection`**
**`clear_sensitive_memory`**

## Type System

### Frontend Types (`TypeScript`)

```typescript
// Wallet
interface Wallet {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  address_count: number;
  has_passphrase: boolean;
}

// Address
interface Address {
  rank: number;
  symbol: string;
  name: string;
  category: Category;
  coin_type: number;
  key_type: KeyType;
  derivation_path: string;
  address: string;
  is_testnet: boolean;
  error: string | null;
}

enum Category {
  BASE = 'BASE',
  LAYER2 = 'LAYER2',
  REGIONAL = 'REGIONAL',
  COSMOS = 'COSMOS',
  ALT_EVM = 'ALT_EVM',
  SPECIALIZED = 'SPECIALIZED',
}

enum KeyType {
  Secp256k1 = 'secp256k1',
  Ed25519 = 'ed25519',
}

enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
}
```

### Backend Types (`Rust`)

```rust
// Wallet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub address_count: usize,
    pub has_passphrase: bool,
}

// Address
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Address {
    pub rank: u32,
    pub symbol: String,
    pub name: String,
    pub category: String,
    pub coin_type: u32,
    pub key_type: String,
    pub derivation_path: String,
    pub address: String,
    pub is_testnet: bool,
    pub error: Option<String>,
}

// Export Format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    Json,
    Csv,
}
```

## Validation Rules

### Password (React Hook Form + Zod)
- Minimum 12 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Confirm password must match

### Wallet Name
- 1-50 characters
- Optional (defaults to generated name)
- Trimmed whitespace

### Mnemonic (Import)
- Must be 12 or 24 words
- All words must be from BIP39 word list
- Valid checksum
- Case-insensitive (normalized to lowercase)
- Multiple spaces collapsed to single space

### BIP39 Passphrase
- Optional
- Any UTF-8 string
- No length limit (BIP39 spec)

## Error Handling

### Frontend Errors
- Form validation errors (inline, per-field)
- API errors (displayed in error banners)
- Network errors (displayed in error banners)

### Backend Errors

**Error Structure**:
```rust
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}
```

**Common Error Codes**:
- `USB_NOT_FOUND`: No USB drive detected
- `WALLET_NOT_FOUND`: Wallet ID not found on USB
- `INVALID_PASSWORD`: Decryption failed (wrong password)
- `WALLET_ALREADY_EXISTS`: Duplicate wallet (FR-031)
- `INVALID_MNEMONIC`: BIP39 validation failed
- `CLI_ERROR`: CLI subprocess error

## Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Wallet Creation | <5s | CLI subprocess + AES-256-GCM |
| Address Loading | <5s | In-memory cache + virtual scrolling |
| Address Export | <5s | Streaming write to USB |
| UI Responsiveness | <100ms | React virtual scrolling (react-window) |
| Address Search | <50ms | Client-side filtering (Zustand) |

## Security Considerations

### Threat Model

**Assets**:
- BIP39 mnemonic phrases
- Wallet encryption passwords
- Private keys (never in memory, only in CLI)
- USB-stored encrypted wallets

**Threats**:
1. **Memory dumps**: Mitigated by auto-clear + `clear_sensitive_memory`
2. **Screenshots**: Mitigated by OS-level protection during mnemonic display
3. **Shoulder surfing**: Mitigated by password masking + auto-logout
4. **USB theft**: Mitigated by AES-256-GCM encryption + strong passwords
5. **Malware keylogging**: Out of scope (OS-level threat)

### Security Controls

| Control | Implementation | Requirement |
|---------|---------------|-------------|
| Encryption at rest | AES-256-GCM | SEC-001 |
| Key derivation | Argon2id (4 iter, 256 MiB) | SEC-001 |
| Password strength | 12+ chars, mixed case + number | SEC-001 |
| Auto-logout | 15 minutes inactivity | SEC-006 |
| Screenshot protection | OS-level during mnemonic display | SEC-003 |
| Clipboard auto-clear | 30 seconds | SEC-004 |
| File permissions | 0600 (Unix) | TC-010 |
| USB-only storage | No hard drive storage | SEC-001 |

## Testing Strategy

### TDD Approach
- Write tests first (RED)
- Implement feature (GREEN)
- Refactor (REFACTOR)

### Test Types

**Frontend Tests** (`dashboard/tests/frontend/`):
- Component rendering tests
- Form validation tests
- User interaction tests
- State management tests

**Rust Tests** (`dashboard/tests/rust/`):
- Command integration tests
- CLI subprocess tests
- Encryption/decryption tests
- File permission tests

### Test Coverage Targets
- Frontend: 80%+ line coverage
- Backend: 90%+ line coverage

## Deployment

### Build Process

```bash
# Frontend build
cd dashboard
npm run build

# Tauri build (generates platform-specific binaries)
npm run tauri build
```

### Distribution

**Platforms**:
- macOS: `.dmg` installer
- Windows: `.msi` installer
- Linux: `.AppImage` / `.deb`

### System Requirements
- **OS**: macOS 10.15+, Windows 10+, Ubuntu 20.04+
- **RAM**: 4GB minimum
- **Storage**: 100MB application + USB drive for wallets
- **USB**: FAT32/exFAT formatted drive (minimum 128MB)

## Future Enhancements

### Phase 2 (Post-MVP)
- [ ] Multiple wallet export (batch export)
- [ ] Address QR code generation
- [ ] Wallet backup to secondary USB
- [ ] Address book (label frequently used addresses)
- [ ] Transaction signing (integrate with blockchain APIs)
- [ ] Dark mode support
- [ ] Multi-language support (i18n)
- [ ] Hardware wallet integration (Ledger, Trezor)

### Performance Optimizations
- [ ] Web Worker for address derivation (offload from main thread)
- [ ] IndexedDB for address caching (persist across sessions)
- [ ] Lazy loading for address categories

## References

### Standards
- [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki): Mnemonic code for generating deterministic keys
- [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki): Multi-account hierarchy for deterministic wallets
- [SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md): Registered coin types for BIP44

### Libraries
- **Frontend**:
  - [Tauri](https://tauri.app/): Desktop app framework
  - [React](https://react.dev/): UI framework
  - [Zustand](https://zustand-demo.pmnd.rs/): State management
  - [React Hook Form](https://react-hook-form.com/): Form management
  - [Zod](https://zod.dev/): Schema validation
  - [react-window](https://react-window.vercel.app/): Virtual scrolling
- **Backend**:
  - [Rust](https://www.rust-lang.org/): Systems programming language
  - [Tauri Rust API](https://tauri.app/v1/api/rust/): IPC between Rust and frontend
  - [serde](https://serde.rs/): Serialization/deserialization
  - [tokio](https://tokio.rs/): Async runtime

### Project Documentation
- Feature spec: `.specify/specs/004-dashboard/spec.md`
- Implementation plan: `.specify/specs/004-dashboard/plan.md`
- Task list: `.specify/specs/004-dashboard/tasks.md`
- Constitution: `.specify/memory/constitution.md`

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-17
**Status**: Complete (Phase 8)
