# Data Model: Multi-Cryptocurrency Address Generation with SLIP-44 Support

**Branch**: `002-slip-44-btc` | **Date**: 2025-10-16 | **Phase**: 1 (Design)

## Overview

This document defines the data entities and their relationships for multi-cryptocurrency address generation. All entities are designed to extend the existing v0.1.0 ArcSign wallet data model.

---

## Entity Definitions

### 1. CoinMetadata

**Purpose**: Represents metadata for a single SLIP-44 registered cryptocurrency.

**Location**: `internal/services/coinregistry/types.go`

**Attributes**:

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `Symbol` | `string` | Yes | Short ticker symbol | Uppercase, 2-5 chars (e.g., "BTC", "ETH", "XRP") |
| `Name` | `string` | Yes | Full coin name | 1-64 chars (e.g., "Bitcoin", "Ethereum") |
| `CoinType` | `uint32` | Yes | SLIP-44 coin type index | 0-2147483647 (hardened derivation: 0x80000000 + value) |
| `FormatterID` | `string` | Yes | Address formatter identifier | Lowercase, references formatter function (e.g., "bitcoin", "ethereum", "ripple") |
| `MarketCapRank` | `int` | Yes | Market capitalization ranking | 1-50 (lower = higher market cap) |

**Example**:

```go
type CoinMetadata struct {
    Symbol         string `json:"symbol"`
    Name           string `json:"name"`
    CoinType       uint32 `json:"coinType"`
    FormatterID    string `json:"formatterId"`
    MarketCapRank  int    `json:"marketCapRank"`
}

// Example instance
var Bitcoin = CoinMetadata{
    Symbol:        "BTC",
    Name:          "Bitcoin",
    CoinType:      0,
    FormatterID:   "bitcoin",
    MarketCapRank: 1,
}

var Ethereum = CoinMetadata{
    Symbol:        "ETH",
    Name:          "Ethereum",
    CoinType:      60,
    FormatterID:   "ethereum",
    MarketCapRank: 2,
}
```

**Validation Rules**:

- `Symbol` must be unique across all registered coins
- `CoinType` must be unique across all registered coins
- `FormatterID` must reference an implemented formatter
- `MarketCapRank` must be unique (no two coins can have same rank)

**Business Logic**:

- Read-only static data (embedded in code, updated per release)
- No database persistence (compiled into binary)
- Sorted by `MarketCapRank` for display ordering

---

### 2. DerivedAddress

**Purpose**: Represents a single cryptocurrency address derived from a BIP44 path.

**Location**: `internal/models/address.go`

**Attributes**:

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `Symbol` | `string` | Yes | Coin ticker symbol | Matches `CoinMetadata.Symbol` (e.g., "BTC") |
| `Name` | `string` | Yes | Full coin name | Matches `CoinMetadata.Name` (e.g., "Bitcoin") |
| `Address` | `string` | Yes | Derived cryptocurrency address | Format varies by coin (e.g., "1A1zP1...", "0x742d35...") |
| `CoinType` | `uint32` | Yes | SLIP-44 coin type index | Matches `CoinMetadata.CoinType` |
| `DerivationPath` | `string` | Yes | BIP44 derivation path | Format: `m/44'/COIN_TYPE'/0'/0/0` |

**Example**:

```go
type DerivedAddress struct {
    Symbol         string `json:"symbol"`
    Name           string `json:"name"`
    Address        string `json:"address"`
    CoinType       uint32 `json:"coinType"`
    DerivationPath string `json:"path"`
}

// Example instance
var BitcoinAddress = DerivedAddress{
    Symbol:         "BTC",
    Name:           "Bitcoin",
    Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    CoinType:       0,
    DerivationPath: "m/44'/0'/0'/0/0",
}

var EthereumAddress = DerivedAddress{
    Symbol:         "ETH",
    Name:           "Ethereum",
    Address:        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    CoinType:       60,
    DerivationPath: "m/44'/60'/0'/0/0",
}
```

**Validation Rules**:

- `Address` must not be empty
- `CoinType` must match registered coin in `CoinMetadata`
- `DerivationPath` must match pattern `m/44'/[0-9]+'/0'/0/0`
- `Symbol` and `Name` must match corresponding `CoinMetadata` entry

**Storage**:

- Persisted in `wallet.json` as part of `AddressBook` array
- Stored in plaintext (addresses are public keys, not sensitive)
- Each `DerivedAddress` is ~150-200 bytes JSON

---

### 3. AddressBook

**Purpose**: Collection of all pre-generated cryptocurrency addresses for a wallet.

**Location**: `internal/models/wallet.go` (extends existing `Wallet` entity)

**Attributes**:

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `Addresses` | `[]DerivedAddress` | Yes | Array of derived addresses | 30-50 elements, one per SLIP-44 coin type |

**Example**:

```go
type AddressBook struct {
    Addresses []DerivedAddress `json:"addresses"`
}

// Example instance (abbreviated)
var myAddressBook = AddressBook{
    Addresses: []DerivedAddress{
        {Symbol: "BTC", Name: "Bitcoin", Address: "1A1zP1...", CoinType: 0, DerivationPath: "m/44'/0'/0'/0/0"},
        {Symbol: "ETH", Name: "Ethereum", Address: "0x742d35...", CoinType: 60, DerivationPath: "m/44'/60'/0'/0/0"},
        {Symbol: "XRP", Name: "Ripple", Address: "rN7n7ot...", CoinType: 144, DerivationPath: "m/44'/144'/0'/0/0"},
        // ... (27-47 more addresses)
    },
}
```

**Validation Rules**:

- `Addresses` array must not be empty after wallet creation
- Each `DerivedAddress` must have unique `Symbol` and `CoinType`
- Addresses must be sorted by `MarketCapRank` (BTC first, ETH second, etc.)
- No duplicate addresses allowed

**Storage**:

- Persisted in `wallet.json` under new `addressBook` field
- JSON serialization: ~5-10 KB for 30-50 addresses
- Atomic file writes (same strategy as existing wallet storage)

**Business Logic**:

- **Creation**: Generated once during wallet creation (`CreateWallet`)
- **Retrieval**: Read from file without re-derivation (`ListAddresses`, `GetAddress`)
- **Immutability**: Never modified after creation (deterministic from mnemonic)
- **Filtering**: Support by `Symbol` or `CoinType` for targeted lookups

---

### 4. Wallet (Extended)

**Purpose**: Extends existing `Wallet` entity to include `AddressBook`.

**Location**: `internal/models/wallet.go`

**Changes**:

```go
// BEFORE (v0.1.0)
type Wallet struct {
    ID                     string    `json:"id"`
    Name                   string    `json:"name,omitempty"`
    CreatedAt              time.Time `json:"createdAt"`
    LastAccessedAt         time.Time `json:"lastAccessedAt"`
    EncryptedMnemonicPath  string    `json:"encryptedMnemonicPath"`
    UsesPassphrase         bool      `json:"usesPassphrase"`
}

// AFTER (v0.2.0 - this feature)
type Wallet struct {
    ID                     string       `json:"id"`
    Name                   string       `json:"name,omitempty"`
    CreatedAt              time.Time    `json:"createdAt"`
    LastAccessedAt         time.Time    `json:"lastAccessedAt"`
    EncryptedMnemonicPath  string       `json:"encryptedMnemonicPath"`
    UsesPassphrase         bool         `json:"usesPassphrase"`
    AddressBook            *AddressBook `json:"addressBook,omitempty"` // NEW FIELD
}
```

**Migration**:

- **Backward Compatibility**: `AddressBook` is optional (`omitempty`) for v0.1.0 wallets
- **Forward Compatibility**: New wallets always include `AddressBook`
- **Detection**: Check `wallet.AddressBook != nil` to determine if multi-coin addresses exist

**Example JSON** (wallet.json):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Wallet",
  "createdAt": "2025-10-16T10:30:00Z",
  "lastAccessedAt": "2025-10-16T10:30:00Z",
  "encryptedMnemonicPath": "mnemonic.enc",
  "usesPassphrase": false,
  "addressBook": {
    "addresses": [
      {
        "symbol": "BTC",
        "name": "Bitcoin",
        "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        "coinType": 0,
        "path": "m/44'/0'/0'/0/0"
      },
      {
        "symbol": "ETH",
        "name": "Ethereum",
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "coinType": 60,
        "path": "m/44'/60'/0'/0/0"
      }
    ]
  }
}
```

---

## Entity Relationships

```
┌─────────────────────┐
│   CoinRegistry      │ (Static Data)
│  (CoinMetadata[])   │
└──────────┬──────────┘
           │ references
           │ (formatterId lookup)
           ▼
┌─────────────────────┐
│  AddressFormatter   │ (Behavior)
│  Interface/Strategy │
└─────────────────────┘
           │ generates
           │
           ▼
┌─────────────────────┐        ┌─────────────────────┐
│   DerivedAddress    │◄───────│    AddressBook      │
│   (single address)  │  1..*  │  (collection)       │
└─────────────────────┘        └──────────┬──────────┘
                                          │ embedded in
                                          │ 1..1
                                          ▼
                               ┌─────────────────────┐
                               │       Wallet        │
                               │  (extended entity)  │
                               └─────────────────────┘
```

**Relationships**:

1. **CoinMetadata → AddressFormatter**: One-to-one mapping via `FormatterID`
2. **AddressFormatter → DerivedAddress**: One-to-many (formatter generates multiple addresses)
3. **AddressBook → DerivedAddress**: One-to-many composition (AddressBook contains 30-50 DerivedAddress instances)
4. **Wallet → AddressBook**: One-to-one composition (each Wallet has one AddressBook)

---

## Storage Schema

### File Structure

```
<USB_PATH>/<WALLET_ID>/
├── wallet.json           # Extended with addressBook field
├── mnemonic.enc          # Encrypted BIP39 mnemonic (unchanged)
└── audit.log             # Audit trail (unchanged)
```

### wallet.json Schema

**File Format**: JSON (UTF-8 encoded)

**File Permissions**: 0600 (read/write owner only)

**Size Estimate**: 8-12 KB (including 30-50 addresses)

**Schema**:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "createdAt", "lastAccessedAt", "encryptedMnemonicPath", "usesPassphrase"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique wallet identifier"
    },
    "name": {
      "type": "string",
      "maxLength": 64,
      "description": "Optional wallet name"
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "Wallet creation timestamp (RFC3339)"
    },
    "lastAccessedAt": {
      "type": "string",
      "format": "date-time",
      "description": "Last access timestamp (RFC3339)"
    },
    "encryptedMnemonicPath": {
      "type": "string",
      "description": "Relative path to encrypted mnemonic file"
    },
    "usesPassphrase": {
      "type": "boolean",
      "description": "Whether BIP39 passphrase was used"
    },
    "addressBook": {
      "type": "object",
      "required": ["addresses"],
      "properties": {
        "addresses": {
          "type": "array",
          "minItems": 1,
          "maxItems": 100,
          "items": {
            "type": "object",
            "required": ["symbol", "name", "address", "coinType", "path"],
            "properties": {
              "symbol": {
                "type": "string",
                "pattern": "^[A-Z]{2,5}$",
                "description": "Coin ticker symbol"
              },
              "name": {
                "type": "string",
                "maxLength": 64,
                "description": "Full coin name"
              },
              "address": {
                "type": "string",
                "minLength": 20,
                "maxLength": 128,
                "description": "Derived cryptocurrency address"
              },
              "coinType": {
                "type": "integer",
                "minimum": 0,
                "maximum": 2147483647,
                "description": "SLIP-44 coin type index"
              },
              "path": {
                "type": "string",
                "pattern": "^m/44'/[0-9]+'/0'/0/0$",
                "description": "BIP44 derivation path"
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Data Flow

### 1. Wallet Creation Flow (with Multi-Coin Address Generation)

```
User Input
  └─> walletService.CreateWallet(name, password, wordCount, usesPassphrase, passphrase)
        │
        ├─> bip39Service.GenerateMnemonic(wordCount)
        │     └─> Returns: mnemonic (12/24 words)
        │
        ├─> bip39Service.MnemonicToSeed(mnemonic, passphrase)
        │     └─> Returns: seed (512-bit)
        │
        ├─> hdKeyService.NewMasterKey(seed)
        │     └─> Returns: masterKey (BIP32 root)
        │
        ├─> addressService.GenerateMultiCoinAddresses(masterKey)
        │     │
        │     ├─> coinRegistry.GetCoinsByMarketCap()
        │     │     └─> Returns: []CoinMetadata (sorted by market cap)
        │     │
        │     ├─> For each coin in CoinMetadata:
        │     │     │
        │     │     ├─> hdKeyService.DerivePath(masterKey, "m/44'/COIN_TYPE'/0'/0/0")
        │     │     │     └─> Returns: childKey (BIP44 derived)
        │     │     │
        │     │     ├─> addressFormatter.FormatAddress(childKey, coin.FormatterID)
        │     │     │     └─> Returns: address (coin-specific format)
        │     │     │
        │     │     └─> Create DerivedAddress{symbol, name, address, coinType, path}
        │     │
        │     └─> Returns: AddressBook{addresses: []DerivedAddress}
        │
        ├─> crypto.EncryptMnemonic(mnemonic, password)
        │     └─> Returns: encryptedMnemonic (Argon2id + AES-256-GCM)
        │
        ├─> storage.AtomicWriteFile(mnemonicPath, encryptedData, 0600)
        │
        ├─> Create Wallet{id, name, createdAt, usesPassphrase, addressBook}
        │
        ├─> storage.AtomicWriteFile(walletPath/wallet.json, walletJSON, 0600)
        │
        └─> auditService.LogWalletCreation(walletID, timestamp, success, addressCount)
```

### 2. Address Listing Flow (No Derivation)

```
User Input: list-addresses --wallet-id <uuid>
  └─> walletService.ListAddresses(walletID)
        │
        ├─> storage.ReadFile(walletPath/wallet.json)
        │     └─> Returns: Wallet (with AddressBook)
        │
        ├─> wallet.AddressBook.Addresses (already sorted by market cap)
        │     └─> Returns: []DerivedAddress
        │
        └─> Display: Format addresses for CLI output
              └─> Example:
                  BTC (Bitcoin)         1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa    m/44'/0'/0'/0/0
                  ETH (Ethereum)        0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb m/44'/60'/0'/0/0
                  XRP (Ripple)          rN7n7otQDd6FczFgLdlqtyMVrXeMCJzTbf    m/44'/144'/0'/0/0
```

### 3. Get Specific Address Flow (No Derivation)

```
User Input: get-address --wallet-id <uuid> --coin BTC
  └─> walletService.GetAddress(walletID, coinSymbol)
        │
        ├─> storage.ReadFile(walletPath/wallet.json)
        │     └─> Returns: Wallet (with AddressBook)
        │
        ├─> Filter wallet.AddressBook.Addresses by symbol == "BTC"
        │     └─> Returns: DerivedAddress (single match)
        │
        └─> Display: Format address for CLI output
              └─> Example:
                  Coin:    Bitcoin (BTC)
                  Address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
                  Path:    m/44'/0'/0'/0/0
                  Type:    0 (SLIP-44)
```

---

## Performance Considerations

### Storage Size

| Entity | Count | Size per Item | Total Size |
|--------|-------|---------------|------------|
| `Wallet` (base) | 1 | ~200 bytes | 200 bytes |
| `DerivedAddress` | 30-50 | ~150 bytes | 4.5-7.5 KB |
| **Total** | - | - | **~5-8 KB** |

**Impact**: Negligible (USB has GB capacity, increase is <0.001%)

### Wallet Creation Time

| Operation | Time per Coin | Total (30 coins) | Total (50 coins) |
|-----------|---------------|------------------|------------------|
| BIP44 Derivation | ~50 ms | 1.5 sec | 2.5 sec |
| Address Formatting | ~10 ms | 0.3 sec | 0.5 sec |
| JSON Serialization | - | ~10 ms | ~15 ms |
| File I/O | - | ~20 ms | ~20 ms |
| **Total** | - | **~2 sec** | **~3 sec** |

**Meets Success Criteria**: SC-001 requires <10 seconds ✅

### Address Lookup Time

| Operation | Time |
|-----------|------|
| Read wallet.json | ~5 ms |
| Parse JSON | ~5 ms |
| Linear search (50 items) | ~0.5 ms |
| **Total** | **~10 ms** |

**Meets Success Criteria**: SC-003 requires <100 ms ✅

---

## Backward Compatibility

### v0.1.0 Wallets (Without AddressBook)

**Detection**:

```go
if wallet.AddressBook == nil {
    // v0.1.0 wallet, no multi-coin addresses
    return errors.New("wallet does not contain pre-generated addresses, use 'derive' command")
}
```

**Migration Path** (Future Feature):

```bash
# User can manually migrate v0.1.0 wallet
arcsign migrate-wallet --wallet-id <uuid> --password <password>
# Generates AddressBook from existing mnemonic, updates wallet.json
```

**Not Required for MVP**: v0.1.0 wallets continue to work with existing `derive` command.

---

## Security Considerations

### Public Data

- **AddressBook** contains only **public keys** (addresses), not private keys
- **Safe for plaintext storage**: Addresses are designed to be shared publicly
- **No encryption required**: Addresses do not compromise wallet security if exposed

### Sensitive Data (Still Encrypted)

- **Mnemonic**: Remains encrypted with Argon2id + AES-256-GCM in `mnemonic.enc`
- **Private Keys**: Never persisted, derived on-demand for signing
- **Passwords**: Never stored, used only for encryption key derivation

### Audit Trail

All address generation events logged:

```
[2025-10-16T10:30:00Z] WALLET_CREATE walletID=550e8400... addressCount=30 duration=2.1s SUCCESS
[2025-10-16T10:30:00Z] ADDRESS_GENERATION walletID=550e8400... coin=BTC address=1A1zP1... SUCCESS
[2025-10-16T10:30:00Z] ADDRESS_GENERATION walletID=550e8400... coin=ETH address=0x742d... SUCCESS
[2025-10-16T10:30:00Z] ADDRESS_GENERATION_FAILED walletID=550e8400... coin=XMR error="formatter not implemented"
```

---

## Validation Rules Summary

### CoinMetadata

- ✅ Unique `Symbol` across all coins
- ✅ Unique `CoinType` across all coins
- ✅ Unique `MarketCapRank` across all coins
- ✅ `FormatterID` must reference implemented formatter

### DerivedAddress

- ✅ `Address` not empty
- ✅ `CoinType` matches registered coin
- ✅ `DerivationPath` matches pattern `m/44'/[0-9]+'/0'/0/0`
- ✅ `Symbol` and `Name` match `CoinMetadata`

### AddressBook

- ✅ `Addresses` array not empty
- ✅ Unique `Symbol` per address
- ✅ Unique `CoinType` per address
- ✅ No duplicate `Address` values
- ✅ Sorted by `MarketCapRank`

### Wallet (Extended)

- ✅ `AddressBook` is `nil` for v0.1.0 wallets (backward compatible)
- ✅ `AddressBook` is non-`nil` for v0.2.0+ wallets
- ✅ All existing v0.1.0 validations still apply

---

## Next Steps

1. Generate `contracts/` (CLI command interfaces, API specs)
2. Generate `quickstart.md` (developer guide with TDD workflow)
3. Update `CLAUDE.md` agent context
4. Re-evaluate Constitution Check after Phase 1 completion
