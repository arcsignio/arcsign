# Data Model: Dashboard Feature

**Feature**: User Dashboard for Wallet Management
**Date**: 2025-10-17
**Status**: Phase 1 Design

## Overview

This document defines all entities, their attributes, relationships, validation rules, and state transitions for the dashboard application. The model follows MVC architecture with clear separation between View (React), Controller (Tauri Rust), and Model (Go CLI).

---

## Entity Definitions

### 1. Wallet

Represents a hierarchical deterministic (HD) wallet derived from a BIP39 mnemonic seed.

**Attributes**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `id` | UUID (string) | Yes | UUID v4 format | Unique wallet identifier (generated from mnemonic hash) |
| `name` | string | No | 1-50 chars, alphanumeric + spaces | User-assigned wallet name (default: "Wallet {timestamp}") |
| `created_at` | ISO 8601 datetime | Yes | Valid UTC timestamp | Wallet creation timestamp |
| `updated_at` | ISO 8601 datetime | Yes | Valid UTC timestamp | Last modification timestamp |
| `has_passphrase` | boolean | Yes | true/false | Indicates if BIP39 passphrase was used (25th word) |
| `address_count` | integer | Yes | Always 54 | Number of derived addresses (constant for v0.3.0) |
| `usb_path` | string | Yes | Valid filesystem path | USB device mount point where wallet is stored |

**Relationships**:
- 1-to-Many with **Address** (one wallet has 54 addresses)
- 1-to-1 with **EncryptedWalletFile** (stored on USB, managed by Go CLI)

**Identity Rules**:
- `id` is derived from SHA-256(mnemonic) and uniquely identifies wallet across imports
- Two imports of same mnemonic produce same `id` (enables duplicate detection per FR-031)

**State Transitions**:
```
[Created] ──(successful backup)──> [Active]
[Created] ──(cancelled)──────────> [Deleted]
[Active] ───(export)──────────────> [Active]  (no state change)
[Active] ───(rename)──────────────> [Active]  (updates name, updated_at)
```

**Validation Rules**:
- `name` must not contain path separators (/, \), null bytes, or control characters
- `usb_path` must exist and have write permissions (verified by CLI)
- `id` format: lowercase hex string, 64 chars (SHA-256 output)

**Security Notes**:
- **Mnemonic phrase is NEVER stored in this entity** (only in encrypted file on USB)
- Wallet object only contains metadata, not cryptographic material
- Dashboard (React/Rust) never has access to mnemonic after initial creation/import

---

### 2. Address

Represents a cryptocurrency address derived from a wallet using BIP44 derivation path.

**Attributes**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `wallet_id` | UUID (string) | Yes | Foreign key to Wallet | Parent wallet identifier |
| `rank` | integer | Yes | 1-54 | Market cap ranking (determines display order) |
| `symbol` | string | Yes | 2-10 chars, uppercase | Blockchain symbol (e.g., BTC, ETH, SOL) |
| `name` | string | Yes | 1-100 chars | Full blockchain name (e.g., Bitcoin, Ethereum) |
| `coin_type` | integer | Yes | 0-2^31-1 | SLIP-44 coin type (e.g., 0 for BTC, 60 for ETH) |
| `derivation_path` | string | Yes | BIP44 format | Full path: m/44'/{coin_type}'/0'/0/0 |
| `address` | string | Yes | Format varies by chain | Derived cryptocurrency address |
| `category` | enum | Yes | See categories below | Blockchain category for filtering |
| `key_type` | enum | Yes | See key types below | Cryptographic signature scheme |

**Categories** (enum):
- `base` - Top 30 by market cap (v0.2.0 chains)
- `layer2` - Layer 2 networks (ARB, OP, BASE, ZKS, LINEA, STRK)
- `regional` - Regional chains (KLAY, CRO, HT, ONE)
- `cosmos` - Cosmos ecosystem (OSMO, JUNO, EVMOS, SCRT)
- `alt_evm` - Alternative EVM chains (FTM, CELO, GLMR, METIS, GNO, WAN)
- `specialized` - Specialized chains (KSM, ICX, XTZ, ZIL)

**Key Types** (enum):
- `secp256k1` - ECDSA (most chains: BTC, ETH, etc.)
- `ed25519` - EdDSA (Solana, Tezos)
- `sr25519` - Schnorrkel (Kusama/Substrate)
- `schnorr` - Schnorr signatures (Zilliqa)

**Relationships**:
- Many-to-1 with **Wallet** (54 addresses per wallet)
- 1-to-1 with **CoinMetadata** (from Go coin registry)

**Identity Rules**:
- Composite key: (`wallet_id`, `coin_type`)
- Same `coin_type` cannot appear twice for a given wallet

**Validation Rules**:
- `address` format varies by chain:
  - Bitcoin: Starts with `1`, `3`, or `bc1`, 26-62 chars
  - Ethereum: Starts with `0x`, 42 hex chars (including 0x)
  - Solana: Base58, 32-44 chars
  - Cosmos: Bech32 with chain prefix, 39-59 chars
- `derivation_path` must match pattern `m/44'/\d+'/0'/0/0`
- `rank` must be unique across all addresses for a wallet

**Display Rules**:
- Addresses displayed in ascending `rank` order (Bitcoin first, Zilliqa last)
- Filter by `category` shows subset of addresses
- Search by `symbol` or `name` (case-insensitive partial match)

---

### 3. DashboardState

Represents the current UI state and user preferences (React/Zustand global state).

**Attributes**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `selected_wallet_id` | UUID (string) \| null | No | null | Currently active wallet (null if no wallet selected) |
| `active_category_filter` | category enum \| "all" | No | "all" | Address list filter (shows all or specific category) |
| `search_query` | string | No | "" | Address search text (filters by symbol/name) |
| `wallets` | Wallet[] | Yes | [] | List of all available wallets (loaded from USB on startup) |
| `addresses` | Address[] | Yes | [] | Addresses for selected wallet (empty if no wallet selected) |
| `is_loading` | boolean | Yes | false | Global loading indicator |
| `usb_detected` | boolean | Yes | false | USB device detection status |
| `usb_path` | string \| null | No | null | Current USB mount point |

**Relationships**:
- References **Wallet** via `selected_wallet_id`
- Contains **Wallet** array and **Address** array (cached from Tauri backend)

**State Transitions**:
```
[Initial] ──(detect USB)────────> [USB Detected]
[USB Detected] ──(load wallets)─> [Wallets Loaded]
[Wallets Loaded] ──(select wallet)─> [Wallet Selected]
[Wallet Selected] ──(load addresses)─> [Addresses Displayed]
[Addresses Displayed] ──(filter/search)─> [Addresses Filtered]
```

**Validation Rules**:
- `selected_wallet_id` must exist in `wallets` array or be null
- `active_category_filter` must be valid category or "all"
- `search_query` max length: 100 chars

**Persistence**:
- Dashboard state is **transient** (not persisted to disk)
- State resets on application restart
- User must re-select wallet after relaunch

---

### 4. ExportPackage

Represents a collection of addresses with metadata prepared for export to CSV/JSON.

**Attributes**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet_id` | UUID (string) | Yes | Source wallet identifier |
| `wallet_name` | string | Yes | Wallet display name at export time |
| `generated_at` | ISO 8601 datetime | Yes | Export timestamp |
| `total_chains` | integer | Yes | Total number of blockchains (always 54) |
| `success_count` | integer | Yes | Successfully exported addresses |
| `failed_count` | integer | Yes | Failed address exports (should be 0) |
| `addresses` | Address[] | Yes | Full array of 54 addresses with metadata |

**Relationships**:
- References **Wallet** (source of export)
- Contains **Address** array (full metadata copy)

**Validation Rules**:
- `success_count` + `failed_count` must equal `total_chains`
- `addresses` length must equal `success_count`

**Export Formats**:

**JSON Format**:
```json
{
  "wallet_id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b",
  "wallet_name": "My Personal Wallet",
  "generated_at": "2025-10-17T14:30:25+08:00",
  "total_chains": 54,
  "success_count": 54,
  "failed_count": 0,
  "addresses": [
    {
      "rank": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "coin_type": 0,
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "path": "m/44'/0'/0'/0/0",
      "category": "base",
      "key_type": "secp256k1"
    },
    // ... 53 more addresses
  ]
}
```

**CSV Format**:
```csv
Rank,Symbol,Name,Category,Coin Type,Key Type,Derivation Path,Address,Error
1,BTC,Bitcoin,base,0,secp256k1,m/44'/0'/0'/0/0,1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa,
2,ETH,Ethereum,base,60,secp256k1,m/44'/60'/0'/0/0,0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,
...
```

**File Naming**:
- Pattern: `addresses-{YYYYMMDD}-{HHMMSS}.{json|csv}`
- Example: `addresses-20251017-143025.json`
- Location: `{usb_path}/{wallet_id}/addresses/`

---

### 5. EncryptedWalletFile (Managed by Go CLI)

Represents the encrypted wallet file stored on USB (dashboard does not read directly).

**Attributes**:

| Field | Type | Description |
|-------|------|-------------|
| `encrypted_mnemonic` | byte array | AES-256-GCM encrypted mnemonic phrase |
| `salt` | byte array (32 bytes) | Argon2id salt for key derivation |
| `nonce` | byte array (12 bytes) | AES-GCM nonce (IV) |
| `has_passphrase` | boolean | BIP39 passphrase flag |
| `metadata` | JSON | Wallet name, creation timestamp, version |

**Storage Location**:
- Path: `{usb_path}/{wallet_id}/wallet.enc`
- Permissions: 0600 (owner read/write only)

**Encryption Process** (Go CLI handles this):
```
1. User password → Argon2id(password, salt, 4 iter, 256 MiB) → 32-byte key
2. Mnemonic → AES-256-GCM(key, nonce) → encrypted_mnemonic
3. Write {salt, nonce, encrypted_mnemonic, metadata} to wallet.enc
```

**Dashboard Interaction**:
- Dashboard **NEVER reads** this file directly
- All wallet operations go through Go CLI subprocess
- CLI decrypts, performs operation, clears memory

---

## Data Flow Diagrams

### 1. Wallet Creation Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. Click "Create Wallet"
     ▼
┌─────────────────┐
│ React Component │ (WalletCreate.tsx)
└────┬────────────┘
     │ 2. invoke('create_wallet', {password})
     ▼
┌─────────────────┐
│ Tauri Command   │ (wallet.rs)
└────┬────────────┘
     │ 3. Command::new("arcsign create")
     ▼
┌─────────────────┐
│ Go CLI          │ (cmd/arcsign/main.go)
├─────────────────┤
│ - Detect USB    │
│ - Generate mnemonic (BIP39)
│ - Derive wallet ID
│ - Encrypt wallet file
│ - Save to USB   │
└────┬────────────┘
     │ 4. Return {id, name, mnemonic} (JSON stdout)
     ▼
┌─────────────────┐
│ Tauri Command   │
└────┬────────────┘
     │ 5. Return WalletResponse
     ▼
┌─────────────────┐
│ React Component │
├─────────────────┤
│ - Show mnemonic (30s countdown)
│ - User confirms backup
│ - Clear mnemonic from memory
│ - Navigate to dashboard
└─────────────────┘
```

### 2. Address Display Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │ 1. Select wallet from list
     ▼
┌─────────────────┐
│ React Component │ (Dashboard.tsx)
└────┬────────────┘
     │ 2. invoke('load_addresses', {wallet_id})
     ▼
┌─────────────────┐
│ Tauri Command   │ (wallet.rs)
└────┬────────────┘
     │ 3. Check cache or call CLI
     ▼
┌─────────────────┐
│ Go CLI          │ (generate-all command)
├─────────────────┤
│ - Load wallet from USB
│ - Derive 54 addresses
│ - Format per blockchain
└────┬────────────┘
     │ 4. Return Address[] (JSON)
     ▼
┌─────────────────┐
│ Tauri Command   │
├─────────────────┤
│ - Cache addresses in State
└────┬────────────┘
     │ 5. Return Address[]
     ▼
┌─────────────────┐
│ React Component │ (AddressList.tsx)
├─────────────────┤
│ - Render virtualized list
│ - Apply category filter
│ - Apply search query
└─────────────────┘
```

### 3. Sensitive Data Flow (Security)

```
Sensitive Data: Mnemonic, Passwords
════════════════════════════════════

┌─────────────────────────────────────────────┐
│ React (View Layer)                           │
│ ❌ NEVER stores mnemonic/passwords in state │
│ ✅ Only displays in secure component        │
└──────────────┬──────────────────────────────┘
               │ Tauri IPC (JSON over websocket)
┌──────────────▼──────────────────────────────┐
│ Tauri Rust (Controller Layer)               │
│ ⚠️  Transient memory during operation only  │
│ ✅ Clears immediately after CLI call         │
└──────────────┬──────────────────────────────┘
               │ Subprocess (stdin/stdout)
┌──────────────▼──────────────────────────────┐
│ Go CLI (Model Layer)                         │
│ ✅ Decrypts from USB                         │
│ ✅ Performs cryptographic operations         │
│ ✅ Clears sensitive data from memory         │
│ ✅ Writes encrypted back to USB              │
└──────────────────────────────────────────────┘

Storage:
  USB Drive (encrypted files only)
  ✅ AES-256-GCM + Argon2id
  ✅ 0600 permissions
  ❌ No hard drive storage
```

---

## Validation Rules Summary

### Wallet Validation
- ✅ `id` must be 64-char hex string (SHA-256 output)
- ✅ `name` must be 1-50 chars, no path separators
- ✅ `usb_path` must exist and be writable
- ✅ `created_at` <= `updated_at`

### Address Validation
- ✅ `wallet_id` must reference existing wallet
- ✅ `coin_type` must be unique per wallet
- ✅ `address` format must match blockchain standards
- ✅ `derivation_path` must match BIP44 pattern
- ✅ `rank` must be 1-54, unique per wallet

### Dashboard State Validation
- ✅ `selected_wallet_id` must exist in `wallets` array or be null
- ✅ `search_query` max 100 chars
- ✅ `active_category_filter` must be valid category or "all"

### Export Validation
- ✅ `success_count` + `failed_count` = `total_chains`
- ✅ `addresses` length = `success_count`
- ✅ Export filename must follow pattern `addresses-YYYYMMDD-HHMMSS.ext`

---

## State Machine: Wallet Lifecycle

```
     ┌────────────────┐
     │  Not Created   │
     └────────┬───────┘
              │ User clicks "Create Wallet"
              ▼
     ┌────────────────┐
     │  Creating...   │ (Loading state)
     └────────┬───────┘
              │ CLI returns mnemonic
              ▼
     ┌────────────────┐
     │ Showing Mnemonic │ (30-second countdown)
     └────────┬───────┘
              │ User confirms backup
              │ OR
              │ User cancels
              ▼
     ┌────────────────┐────> [Cancelled] ──> [Deleted]
     │   Active       │
     └────────┬───────┘
              │ User operations:
              │ - View addresses
              │ - Export
              │ - Rename
              │
              ▼
     ┌────────────────┐
     │   Updated      │ (name change, export)
     └────────────────┘

Terminal states: [Active], [Cancelled/Deleted]
```

---

## Database Schema (Go CLI - SQLite on USB)

While the dashboard doesn't directly access the database, the Go CLI uses SQLite for wallet metadata:

```sql
-- Table: wallets
CREATE TABLE wallets (
    id TEXT PRIMARY KEY,              -- UUID (SHA-256 of mnemonic)
    name TEXT NOT NULL,               -- User-assigned name
    created_at TIMESTAMP NOT NULL,    -- Creation time
    updated_at TIMESTAMP NOT NULL,    -- Last update time
    has_passphrase BOOLEAN NOT NULL,  -- BIP39 passphrase flag
    encrypted_data BLOB NOT NULL,     -- Encrypted mnemonic
    salt BLOB NOT NULL,               -- Argon2id salt
    nonce BLOB NOT NULL               -- AES-GCM nonce
);

-- Table: addresses (cached, regenerated on demand)
CREATE TABLE addresses (
    wallet_id TEXT NOT NULL,
    coin_type INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    derivation_path TEXT NOT NULL,
    category TEXT NOT NULL,
    key_type TEXT NOT NULL,
    PRIMARY KEY (wallet_id, coin_type),
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

CREATE INDEX idx_addresses_rank ON addresses(wallet_id, rank);
CREATE INDEX idx_addresses_category ON addresses(wallet_id, category);
```

**Dashboard Interaction**:
- Dashboard queries this data via Go CLI subprocess (never direct DB access)
- CLI returns JSON responses (deserialized in Tauri Rust → passed to React)

---

## Next Steps

With data model defined, proceed to:
1. ✅ Generate API contracts (contracts/tauri-commands.yaml, contracts/cli-integration.yaml)
2. ✅ Generate quickstart.md (developer setup guide)
3. ✅ Update agent context (CLAUDE.md)
