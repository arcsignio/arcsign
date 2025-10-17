# Data Model: Extended Multi-Chain Support

**Feature**: v0.3.0 Extended Multi-Chain Support
**Date**: 2025-10-17
**Status**: Design Complete

## Overview

This document defines the data entities and their relationships for supporting 54 blockchains (30 existing + 24 new) with a data model designed to scale to 100-150 total chains over ~5 years of ecosystem growth.

## Core Entities

### 1. Chain Metadata

**Purpose**: Represents blockchain configuration for address generation

**Location**: `internal/services/coinregistry/types.go`

**Structure**:
```go
type ChainMetadata struct {
    Symbol        string        // e.g., "ARB", "KSM", "XTZ"
    Name          string        // e.g., "Arbitrum", "Kusama", "Tezos"
    CoinType      uint32        // SLIP-44 coin type number
    FormatterID   string        // Address formatter identifier
    KeyType       KeyType       // secp256k1, ed25519, or sr25519
    MarketCapRank int           // For sorting display (1-200)
    Category      ChainCategory // Logical grouping
}

type KeyType string
const (
    KeyTypeSecp256k1 KeyType = "secp256k1"
    KeyTypeEd25519   KeyType = "ed25519"
    KeyTypeSr25519   KeyType = "sr25519"
)

type ChainCategory string
const (
    CategoryUTXO      ChainCategory = "UTXO"           // Bitcoin, Litecoin, Dogecoin, etc.
    CategoryEVM       ChainCategory = "EVM_Mainnet"    // Ethereum mainnet
    CategoryLayer2    ChainCategory = "Layer2"         // Arbitrum, Optimism, Base, etc.
    CategoryCosmos    ChainCategory = "Cosmos_SDK"     // ATOM, OSMO, JUNO, etc.
    CategorySubstrate ChainCategory = "Substrate"      // Kusama, Polkadot
    CategoryCustom    ChainCategory = "Custom"         // Specialized chains
)
```

**Validation Rules**:
- Symbol: 2-10 uppercase characters, unique across registry
- Name: Non-empty string, human-readable
- CoinType: Must match SLIP-44 registry (or documented deviation)
- FormatterID: Must correspond to implemented formatter function
- KeyType: One of three supported types
- MarketCapRank: 1-200, used for default sort order
- Category: Must be one of predefined categories

**Relationships**:
- One ChainMetadata → One formatter function (by FormatterID)
- One ChainMetadata → Many DerivedAddress instances (one per wallet)

**Scale Considerations**:
- Designed to accommodate 100-150 total chains
- In-memory registry structure (no database needed)
- Registry loaded once at application startup
- Estimated memory: ~15-25 KB for 150 chains (100-150 bytes per chain)

---

### 2. Derived Address

**Purpose**: Represents a single blockchain address derived from a wallet's mnemonic seed

**Location**: `internal/models/address.go`

**Structure**:
```go
type DerivedAddress struct {
    Symbol         string        `json:"symbol"`         // e.g., "BTC", "ARB", "KSM"
    CoinName       string        `json:"coinName"`       // e.g., "Bitcoin", "Arbitrum", "Kusama"
    CoinType       uint32        `json:"coinType"`       // SLIP-44 number
    Address        string        `json:"address"`        // Generated address string
    DerivationPath string        `json:"derivationPath"` // e.g., "m/44'/9001'/0'/0/0"
    MarketCapRank  int           `json:"marketCapRank"`  // For sorting
    Category       ChainCategory `json:"category"`       // Chain category (NEW in v0.3.0)
}
```

**New Fields in v0.3.0**:
- `Category`: Added for UI grouping and filtering (UTXO/EVM/Layer2/Cosmos/Substrate/Custom)

**Validation Rules**:
- Symbol: Must match ChainMetadata.Symbol
- Address: Non-empty string, format varies by chain (validated by formatter)
- DerivationPath: Must follow BIP44 format `m/44'/cointype'/account'/change/index` (all hardened for ed25519/sr25519)
- Category: Must match parent ChainMetadata.Category

**Address Format Examples**:
```
Bitcoin (BTC):       1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
Ethereum (ETH):      0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
Arbitrum (ARB):      0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  (identical to ETH)
Starknet (STRK):     0x01234567890abcdef01234567890abcdef01234567890abcdef0123456789ab
Kusama (KSM):        CzBt6Hv6E9gZGG5CQ8NwHfKJL1KvN3Py3tJ3GBPxNqYKD3V
Tezos (XTZ):         tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb
Zilliqa (ZIL):       zil1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjwqv0xzr
Harmony (ONE):       one1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjw4y6ald
ICON (ICX):          hx396031be52ec56955bd7bf15eacdfa1a1c1fe19e
Cosmos (ATOM):       cosmos1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjwl2mj4y
Osmosis (OSMO):      osmo1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjwy7zvdk
```

**Relationships**:
- Many DerivedAddress → One Wallet (via AddressBook)
- Many DerivedAddress → One ChainMetadata (via Symbol/CoinType)

---

### 3. Address Book

**Purpose**: Collection of all derived addresses for a single wallet

**Location**: `internal/models/address.go`

**Structure**:
```go
type AddressBook struct {
    Addresses []DerivedAddress `json:"addresses"`
}

// Lookup methods
func (ab *AddressBook) GetBySymbol(symbol string) (*DerivedAddress, error)
func (ab *AddressBook) GetByCoinType(coinType uint32) (*DerivedAddress, error)
func (ab *AddressBook) GetByCategory(category ChainCategory) []DerivedAddress  // NEW in v0.3.0
func (ab *AddressBook) Count() int
func (ab *AddressBook) IsEmpty() bool
```

**New Methods in v0.3.0**:
- `GetByCategory()`: Filter addresses by chain category for UI grouping

**Validation Rules**:
- Addresses array: Must not contain duplicate symbols
- Each address must have valid Symbol, CoinType, and Address fields
- Sorted by MarketCapRank in descending order (highest market cap first)

**Storage Format** (JSON):
```json
{
  "addresses": [
    {
      "symbol": "BTC",
      "coinName": "Bitcoin",
      "coinType": 0,
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "derivationPath": "m/44'/0'/0'/0/0",
      "marketCapRank": 1,
      "category": "UTXO"
    },
    {
      "symbol": "ETH",
      "coinName": "Ethereum",
      "coinType": 60,
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "derivationPath": "m/44'/60'/0'/0/0",
      "marketCapRank": 2,
      "category": "EVM_Mainnet"
    },
    ... (52 more chains)
  ]
}
```

**File Size Estimates**:
- v0.2.0 (30 chains): ~4-6 KB per wallet
- v0.3.0 (54 chains): ~8-10 KB per wallet
- Future (150 chains): ~20-25 KB per wallet
- **Acceptable for USB storage** (modern USB drives: 8GB-256GB)

**Performance**:
- Lookup by symbol: O(n) linear search (acceptable for n≤150)
- Lookup by category: O(n) filter (acceptable for UI rendering)
- Could optimize with map index if needed (future enhancement)

**Relationships**:
- One AddressBook → One Wallet
- One AddressBook → Many DerivedAddress (54 in v0.3.0, up to 150 future)

---

### 4. Wallet (Extended)

**Purpose**: Main wallet entity containing encrypted mnemonic and derived addresses

**Location**: `internal/models/wallet.go`

**Structure** (unchanged from v0.2.0, AddressBook already supports variable chain count):
```go
type Wallet struct {
    ID                    string        `json:"id"`
    Name                  string        `json:"name,omitempty"`
    CreatedAt             time.Time     `json:"createdAt"`
    LastAccessedAt        time.Time     `json:"lastAccessedAt"`
    EncryptedMnemonicPath string        `json:"encryptedMnemonicPath"`
    UsesPassphrase        bool          `json:"usesPassphrase"`
    AddressBook           *AddressBook  `json:"addressBook,omitempty"`  // v0.2.0+ feature
}
```

**No Changes Required**:
- AddressBook field already supports variable number of chains
- `omitempty` tag ensures v0.1.0 wallets (nil AddressBook) serialize correctly
- Backwards compatible with v0.2.0 (30 chains) and v0.3.0 (54 chains)

**Upgrade Detection**:
- v0.2.0 wallet: AddressBook.Count() == 30
- v0.3.0 wallet: AddressBook.Count() == 54
- Logic: If count < 54, trigger automatic address generation for missing chains

**Version Compatibility**:
```
v0.1.0: AddressBook == nil
v0.2.0: AddressBook.Count() == 30
v0.3.0: AddressBook.Count() == 54
Future: AddressBook.Count() up to 150
```

---

### 5. Generation Metrics (NEW in v0.3.0)

**Purpose**: Track summary statistics for address generation operations (for observability)

**Location**: `internal/lib/errors.go` (extended)

**Structure**:
```go
type GenerationMetrics struct {
    TotalChains      int                     `json:"totalChains"`      // 54 in v0.3.0
    SuccessCount     int                     `json:"successCount"`     // Successfully generated
    FailureCount     int                     `json:"failureCount"`     // Failed after retry
    RetryCount       int                     `json:"retryCount"`       // Total retries attempted
    TotalDuration    time.Duration           `json:"totalDuration"`    // Total generation time
    PerChainMetrics  map[string]ChainMetric  `json:"perChainMetrics"`  // Per-chain details
}

type ChainMetric struct {
    Symbol       string        `json:"symbol"`       // e.g., "ARB", "KSM"
    Duration     time.Duration `json:"duration"`     // Time to generate this chain
    Success      bool          `json:"success"`      // true if generated successfully
    RetryAttempt bool          `json:"retryAttempt"` // true if required retry
    ErrorMessage string        `json:"errorMessage,omitempty"` // Error details if failed
}
```

**Usage**:
- Collected during wallet creation or upgrade
- Displayed to user as summary (e.g., "✓ Generated 52 of 54 chains in 12.3s")
- Logged to audit file for troubleshooting
- Not persisted in wallet file (transient metrics only)

**Success Criteria** (from spec):
- Success rate: ≥95% (allows 2-3 chains to fail out of 54)
- Total duration: <15 seconds for wallet creation, <10 seconds for upgrade
- Per-chain average: ~250-300ms

---

## Formatter Registry

**Purpose**: Maps FormatterID to actual formatter implementation functions

**Location**: `internal/services/address/service.go`

**Structure**:
```go
type AddressService struct {
    // Existing formatters (v0.2.0)
    // - DeriveBitcoinAddress()
    // - DeriveEthereumAddress()
    // - DeriveLitecoinAddress()
    // - DeriveDogecoinAddress()
    // ... (8 more existing formatters)

    // NEW formatters (v0.3.0)
    DeriveStarknetAddress(key *hdkeychain.ExtendedKey) (string, error)
    DeriveKusamaAddress(key *hdkeychain.ExtendedKey) (string, error)
    DeriveTezosAddress(key *hdkeychain.ExtendedKey) (string, error)
    DeriveZilliqaAddress(key *hdkeychain.ExtendedKey) (string, error)
    DeriveHarmonyAddress(key *hdkeychain.ExtendedKey) (string, error)
    DeriveIconAddress(key *hdkeychain.ExtendedKey) (string, error)
}

// Dispatcher function (determines which formatter to use)
func (s *AddressService) deriveAddressByFormatter(
    key *hdkeychain.ExtendedKey,
    formatterID string
) (string, error) {
    switch formatterID {
    case "bitcoin":   return s.DeriveBitcoinAddress(key)
    case "ethereum":  return s.DeriveEthereumAddress(key)
    case "starknet":  return s.DeriveStarknetAddress(key)
    case "kusama":    return s.DeriveKusamaAddress(key)
    case "tezos":     return s.DeriveTezosAddress(key)
    case "zilliqa":   return s.DeriveZilliqaAddress(key)
    case "harmony":   return s.DeriveHarmonyAddress(key)
    case "icon":      return s.DeriveIconAddress(key)
    case "cosmos":    return s.DeriveCosmosAddress(key)
    // ... other formatters
    default:
        return "", fmt.Errorf("unsupported formatter: %s", formatterID)
    }
}
```

**Formatter ID Mapping** (24 new chains):

| Chain(s) | Formatter ID | Implementation File | Reuses Existing? |
|----------|--------------|---------------------|------------------|
| ARB, OP, BASE, ZKS, LINEA | `ethereum` | `ethereum.go` | ✅ Yes (v0.2.0) |
| KLAY, CRO, HT | `ethereum` | `ethereum.go` | ✅ Yes (v0.2.0) |
| FTM, CELO, GLMR, METIS, GNO, WAN | `ethereum` | `ethereum.go` | ✅ Yes (v0.2.0) |
| STRK | `starknet` | `starknet.go` | ❌ New (v0.3.0) |
| ONE | `harmony` | `harmony.go` | ❌ New (v0.3.0) |
| OSMO, JUNO, EVMOS, SCRT | `cosmos` | `cosmos.go` | 🔄 Extend (v0.2.0) |
| KSM | `kusama` | `kusama.go` | ❌ New (v0.3.0) |
| XTZ | `tezos` | `tezos.go` | ❌ New (v0.3.0) |
| ZIL | `zilliqa` | `zilliqa.go` | ❌ New (v0.3.0) |
| ICX | `icon` | `icon.go` | ❌ New (v0.3.0) |

---

## Data Flow

### Wallet Creation (v0.3.0)

```
User provides password + optional passphrase
    ↓
Generate BIP39 mnemonic (24 words)
    ↓
Derive BIP32 master seed
    ↓
FOR EACH chain in registry (54 chains):
    ↓
    Derive key at BIP44 path (m/44'/cointype'/0'/0/0)
    ↓
    Call formatter function (based on FormatterID)
    ↓
    IF formatter fails:
        Retry once
        IF still fails:
            Log error with ChainMetric
            Continue with next chain
    ELSE:
        Create DerivedAddress
        Add to AddressBook
        Record ChainMetric (success)
    ↓
END FOR
    ↓
Create Wallet entity with AddressBook
    ↓
Encrypt mnemonic with Argon2id + AES-256-GCM
    ↓
Save wallet JSON + encrypted mnemonic to USB
    ↓
Display GenerationMetrics summary to user
```

### Wallet Upgrade (v0.2.0 → v0.3.0)

```
User opens v0.2.0 wallet in v0.3.0 application
    ↓
Load wallet JSON from USB
    ↓
Check AddressBook.Count()
    ↓
IF count == 30:  // v0.2.0 wallet detected
    ↓
    Display: "Generating addresses for 24 new blockchains..."
    ↓
    Decrypt mnemonic (requires password + optional passphrase)
    ↓
    Derive BIP32 master seed
    ↓
    Get list of missing chains (54 total - 30 existing = 24 new)
    ↓
    FOR EACH missing chain:
        Generate address (same flow as wallet creation)
        Add to AddressBook
    ↓
    Save updated wallet JSON to USB
    ↓
    Display: "✓ Generated 24 new addresses successfully"
ELSE IF count == 54:  // Already v0.3.0
    Continue normal operation
```

---

## Backwards Compatibility

### Version Detection

```go
func DetectWalletVersion(wallet *Wallet) string {
    if wallet.AddressBook == nil {
        return "v0.1.0"  // No AddressBook
    }

    count := wallet.AddressBook.Count()
    switch count {
    case 30:
        return "v0.2.0"
    case 54:
        return "v0.3.0"
    default:
        return fmt.Sprintf("v0.x.0 (%d chains)", count)
    }
}
```

### Upgrade Safety

- v0.1.0 wallets: No automatic upgrade (AddressBook remains nil, wallet fully functional)
- v0.2.0 wallets: Automatic upgrade on first access (non-destructive, adds 24 addresses)
- v0.3.0 wallets: No upgrade needed

**Critical**: Upgrade process is **non-blocking** and **reversible**:
- If upgrade fails mid-generation, wallet remains in v0.2.0 state
- User can retry upgrade later
- Original 30 addresses never modified

---

## Database Schema

**N/A - This feature uses JSON file storage on USB (no database)**

Wallet metadata stored in: `<USB_MOUNT>/arcsign/wallets/<wallet_id>/wallet.json`

---

## Scale Planning

### Current (v0.3.0)
- 54 chains
- ~8-10 KB per wallet JSON file
- ~150-200 bytes per DerivedAddress

### Future (v0.4.0 - v0.6.0)
- Up to 150 chains
- ~20-25 KB per wallet JSON file
- Same per-address overhead

### Performance Impact
- JSON parsing: <50ms for 150 chains
- Lookup operations: O(n) acceptable for n≤150
- Memory usage: ~50-75 KB per loaded wallet (negligible)

**No database migration needed** - JSON schema is self-describing and forward-compatible.

---

## Next Steps

1. ✅ **Phase 0 Complete**: research.md with library selections
2. ✅ **Phase 1 Complete**: data-model.md with entity definitions
3. **Phase 1 Next**: Generate contracts/cli-commands.md for CLI interface
4. **Phase 1**: Generate quickstart.md for developer implementation guide
5. **Phase 1**: Update CLAUDE.md agent context with new dependencies
