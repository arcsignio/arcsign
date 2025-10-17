# Quickstart Guide: Multi-Cryptocurrency Address Generation

**Branch**: `002-slip-44-btc` | **Date**: 2025-10-16 | **Phase**: 1 (Design)

## Overview

This quickstart guide helps developers implement the multi-cryptocurrency address generation feature using Test-Driven Development (TDD). It provides step-by-step instructions, code examples, and TDD workflows aligned with the ArcSign constitution.

---

## Prerequisites

### 1. Development Environment

**Required**:
- Go 1.21+ installed
- Git configured
- USB drive for integration testing (optional but recommended)
- Code editor with Go support (VS Code, GoLand, etc.)

**Verify Installation**:

```bash
go version  # Should show 1.21 or higher
git --version
```

### 2. Clone Repository and Checkout Branch

```bash
cd /Users/jnr350/Desktop/Yansiang/arcSignv2
git checkout 002-slip-44-btc
git pull origin 002-slip-44-btc
```

### 3. Install Dependencies

```bash
# Existing dependencies (already in go.mod from v0.1.0)
go mod download

# New dependencies for this feature (will be added as needed)
go get github.com/stellar/go/keypair
go get github.com/gagliardetto/solana-go
```

### 4. Run Existing Tests (Baseline)

```bash
# Ensure all v0.1.0 tests pass before starting
go test ./tests/unit/... -v
go test ./tests/integration/... -v
```

**Expected Result**: All existing tests pass ✅

---

## Project Structure

```
/Users/jnr350/Desktop/Yansiang/arcSignv2/
├── cmd/arcsign/
│   └── main.go                          # CLI entry point (modify)
├── internal/
│   ├── models/
│   │   ├── wallet.go                    # Extend Wallet with AddressBook
│   │   └── address.go                   # NEW: DerivedAddress model
│   ├── services/
│   │   ├── coinregistry/                # NEW: SLIP-44 metadata + market cap
│   │   │   ├── registry.go
│   │   │   └── types.go
│   │   ├── address/                     # Extend with multi-coin formatters
│   │   │   ├── service.go               # Extend with GenerateMultiCoinAddresses
│   │   │   ├── bitcoin.go               # Extend with variants
│   │   │   ├── ethereum.go              # Reuse (already supports EVM chains)
│   │   │   ├── ripple.go                # NEW: XRP formatter
│   │   │   ├── stellar.go               # NEW: XLM formatter
│   │   │   ├── tron.go                  # NEW: TRX formatter
│   │   │   └── solana.go                # NEW: SOL formatter
│   │   └── wallet/
│   │       └── service.go               # Modify CreateWallet
│   └── lib/
│       └── errors.go                    # Extend with coin-specific errors
└── tests/
    ├── unit/
    │   ├── coinregistry_test.go         # NEW
    │   ├── address_formatters_test.go   # NEW
    │   └── wallet_service_test.go       # Modify
    ├── integration/
    │   └── multicoin_test.go            # NEW
    └── contract/
        └── slip44_vectors_test.go       # NEW: BIP44 test vectors
```

---

## TDD Workflow

### Principle: Red-Green-Refactor

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve code while keeping tests passing

**Constitution Requirement**: Every feature must follow TDD (non-negotiable).

---

## Implementation Roadmap

### Phase 1: Foundation (Days 1-2)

**User Story**: P1 - Pre-generate Multi-Coin Addresses on Wallet Creation

**Tasks**:
1. Define `CoinMetadata` and coin registry
2. Extend `Wallet` model with `AddressBook`
3. Create `DerivedAddress` model

### Phase 2: Bitcoin-Compatible Formatters (Days 3-4)

**Tasks**:
4. Extend Bitcoin formatter for Litecoin
5. Extend Bitcoin formatter for Dogecoin
6. Implement Bitcoin Cash formatter

### Phase 3: New Coin Formatters (Days 5-8)

**Tasks**:
7. Implement XRP (Ripple) formatter
8. Implement Stellar (XLM) formatter
9. Implement TRON (TRX) formatter
10. Implement Solana (SOL) formatter

### Phase 4: Wallet Integration (Days 9-10)

**Tasks**:
11. Modify `CreateWallet` to generate multi-coin addresses
12. Implement address generation summary display

### Phase 5: CLI Commands (Days 11-12)

**User Stories**: P2 - View All Addresses, P3 - Get Specific Address

**Tasks**:
13. Implement `list-addresses` command
14. Implement `get-address` command

### Phase 6: Testing & Polish (Days 13-15)

**Tasks**:
15. Contract tests with BIP44 test vectors
16. Integration tests (end-to-end wallet creation)
17. Performance testing (<10 sec wallet creation)
18. Error handling and user-facing messages

---

## Step-by-Step TDD Guide

### Task 1: Define CoinMetadata and Coin Registry

#### Step 1.1: Write the Test (RED)

**File**: `tests/unit/coinregistry_test.go`

```go
package unit

import (
    "testing"
    "github.com/yourusername/arcsign/internal/services/coinregistry"
)

// Test: Coin registry contains Bitcoin with correct metadata
func TestCoinRegistry_Bitcoin(t *testing.T) {
    registry := coinregistry.NewRegistry()

    btc, err := registry.GetCoinBySymbol("BTC")
    if err != nil {
        t.Fatalf("Expected Bitcoin to be registered, got error: %v", err)
    }

    if btc.Symbol != "BTC" {
        t.Errorf("Expected symbol 'BTC', got '%s'", btc.Symbol)
    }
    if btc.Name != "Bitcoin" {
        t.Errorf("Expected name 'Bitcoin', got '%s'", btc.Name)
    }
    if btc.CoinType != 0 {
        t.Errorf("Expected coin type 0, got %d", btc.CoinType)
    }
    if btc.FormatterID != "bitcoin" {
        t.Errorf("Expected formatter 'bitcoin', got '%s'", btc.FormatterID)
    }
    if btc.MarketCapRank != 1 {
        t.Errorf("Expected market cap rank 1, got %d", btc.MarketCapRank)
    }
}

// Test: Coin registry contains Ethereum with correct metadata
func TestCoinRegistry_Ethereum(t *testing.T) {
    registry := coinregistry.NewRegistry()

    eth, err := registry.GetCoinBySymbol("ETH")
    if err != nil {
        t.Fatalf("Expected Ethereum to be registered, got error: %v", err)
    }

    if eth.CoinType != 60 {
        t.Errorf("Expected coin type 60, got %d", eth.CoinType)
    }
    if eth.MarketCapRank != 2 {
        t.Errorf("Expected market cap rank 2, got %d", eth.MarketCapRank)
    }
}

// Test: Registry returns error for unknown coin
func TestCoinRegistry_UnknownCoin(t *testing.T) {
    registry := coinregistry.NewRegistry()

    _, err := registry.GetCoinBySymbol("INVALID")
    if err == nil {
        t.Error("Expected error for unknown coin, got nil")
    }
}

// Test: Registry returns coins sorted by market cap
func TestCoinRegistry_SortedByMarketCap(t *testing.T) {
    registry := coinregistry.NewRegistry()

    coins := registry.GetAllCoinsSortedByMarketCap()

    if len(coins) < 10 {
        t.Errorf("Expected at least 10 registered coins, got %d", len(coins))
    }

    // Verify first coin is Bitcoin
    if coins[0].Symbol != "BTC" {
        t.Errorf("Expected first coin to be BTC, got '%s'", coins[0].Symbol)
    }

    // Verify second coin is Ethereum
    if coins[1].Symbol != "ETH" {
        t.Errorf("Expected second coin to be ETH, got '%s'", coins[1].Symbol)
    }

    // Verify sorting (rank should be ascending)
    for i := 0; i < len(coins)-1; i++ {
        if coins[i].MarketCapRank > coins[i+1].MarketCapRank {
            t.Errorf("Coins not sorted: rank %d at index %d, rank %d at index %d",
                coins[i].MarketCapRank, i, coins[i+1].MarketCapRank, i+1)
        }
    }
}
```

**Run Test** (should FAIL):

```bash
go test ./tests/unit/coinregistry_test.go -v
```

**Expected Output**:

```
--- FAIL: TestCoinRegistry_Bitcoin (0.00s)
    coinregistry_test.go:10: cannot find package "github.com/yourusername/arcsign/internal/services/coinregistry"
FAIL
```

#### Step 1.2: Implement Minimal Code (GREEN)

**File**: `internal/services/coinregistry/types.go`

```go
package coinregistry

// CoinMetadata represents metadata for a SLIP-44 registered cryptocurrency
type CoinMetadata struct {
    Symbol         string `json:"symbol"`
    Name           string `json:"name"`
    CoinType       uint32 `json:"coinType"`
    FormatterID    string `json:"formatterId"`
    MarketCapRank  int    `json:"marketCapRank"`
}
```

**File**: `internal/services/coinregistry/registry.go`

```go
package coinregistry

import (
    "errors"
    "sort"
)

// Registry manages SLIP-44 coin metadata
type Registry struct {
    coins map[string]CoinMetadata // key: symbol (e.g., "BTC")
}

// NewRegistry creates a new coin registry with pre-loaded coins
func NewRegistry() *Registry {
    return &Registry{
        coins: loadRegisteredCoins(),
    }
}

// GetCoinBySymbol retrieves coin metadata by symbol
func (r *Registry) GetCoinBySymbol(symbol string) (CoinMetadata, error) {
    coin, exists := r.coins[symbol]
    if !exists {
        return CoinMetadata{}, errors.New("coin not found: " + symbol)
    }
    return coin, nil
}

// GetAllCoinsSortedByMarketCap returns all coins sorted by market cap rank
func (r *Registry) GetAllCoinsSortedByMarketCap() []CoinMetadata {
    coins := make([]CoinMetadata, 0, len(r.coins))
    for _, coin := range r.coins {
        coins = append(coins, coin)
    }

    // Sort by market cap rank (ascending: 1, 2, 3, ...)
    sort.Slice(coins, func(i, j int) bool {
        return coins[i].MarketCapRank < coins[j].MarketCapRank
    })

    return coins
}

// loadRegisteredCoins loads the static coin registry
func loadRegisteredCoins() map[string]CoinMetadata {
    return map[string]CoinMetadata{
        "BTC": {
            Symbol:        "BTC",
            Name:          "Bitcoin",
            CoinType:      0,
            FormatterID:   "bitcoin",
            MarketCapRank: 1,
        },
        "ETH": {
            Symbol:        "ETH",
            Name:          "Ethereum",
            CoinType:      60,
            FormatterID:   "ethereum",
            MarketCapRank: 2,
        },
        "XRP": {
            Symbol:        "XRP",
            Name:          "Ripple",
            CoinType:      144,
            FormatterID:   "ripple",
            MarketCapRank: 3,
        },
        "SOL": {
            Symbol:        "SOL",
            Name:          "Solana",
            CoinType:      501,
            FormatterID:   "solana",
            MarketCapRank: 4,
        },
        "BNB": {
            Symbol:        "BNB",
            Name:          "Binance Coin",
            CoinType:      714,
            FormatterID:   "ethereum", // BNB uses Ethereum formatter
            MarketCapRank: 5,
        },
        "LTC": {
            Symbol:        "LTC",
            Name:          "Litecoin",
            CoinType:      2,
            FormatterID:   "bitcoin-ltc",
            MarketCapRank: 10,
        },
        "DOGE": {
            Symbol:        "DOGE",
            Name:          "Dogecoin",
            CoinType:      3,
            FormatterID:   "bitcoin-doge",
            MarketCapRank: 8,
        },
        // Add more coins here (total 30-50)
    }
}
```

**Run Test** (should PASS):

```bash
go test ./tests/unit/coinregistry_test.go -v
```

**Expected Output**:

```
=== RUN   TestCoinRegistry_Bitcoin
--- PASS: TestCoinRegistry_Bitcoin (0.00s)
=== RUN   TestCoinRegistry_Ethereum
--- PASS: TestCoinRegistry_Ethereum (0.00s)
=== RUN   TestCoinRegistry_UnknownCoin
--- PASS: TestCoinRegistry_UnknownCoin (0.00s)
=== RUN   TestCoinRegistry_SortedByMarketCap
--- PASS: TestCoinRegistry_SortedByMarketCap (0.00s)
PASS
ok      github.com/yourusername/arcsign/tests/unit    0.005s
```

#### Step 1.3: Refactor (Optional)

- Extract coin list to separate file if it grows large
- Add helper methods (GetCoinByCoinType, etc.)

---

### Task 2: Extend Wallet Model with AddressBook

#### Step 2.1: Write the Test (RED)

**File**: `tests/unit/wallet_model_test.go`

```go
package unit

import (
    "encoding/json"
    "testing"
    "github.com/yourusername/arcsign/internal/models"
)

// Test: Wallet can be serialized with AddressBook
func TestWallet_SerializeWithAddressBook(t *testing.T) {
    wallet := models.Wallet{
        ID:                    "550e8400-e29b-41d4-a716-446655440000",
        Name:                  "My Wallet",
        UsesPassphrase:        false,
        AddressBook: &models.AddressBook{
            Addresses: []models.DerivedAddress{
                {
                    Symbol:         "BTC",
                    Name:           "Bitcoin",
                    Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                    CoinType:       0,
                    DerivationPath: "m/44'/0'/0'/0/0",
                },
            },
        },
    }

    jsonData, err := json.Marshal(wallet)
    if err != nil {
        t.Fatalf("Failed to marshal wallet: %v", err)
    }

    // Verify JSON contains addressBook
    jsonStr := string(jsonData)
    if !strings.Contains(jsonStr, "addressBook") {
        t.Error("JSON should contain 'addressBook' field")
    }
    if !strings.Contains(jsonStr, "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa") {
        t.Error("JSON should contain Bitcoin address")
    }
}

// Test: Wallet without AddressBook is backward compatible
func TestWallet_BackwardCompatibility(t *testing.T) {
    wallet := models.Wallet{
        ID:                    "550e8400-e29b-41d4-a716-446655440000",
        Name:                  "Old Wallet",
        UsesPassphrase:        false,
        AddressBook:           nil, // v0.1.0 wallet
    }

    jsonData, err := json.Marshal(wallet)
    if err != nil {
        t.Fatalf("Failed to marshal wallet: %v", err)
    }

    // Verify JSON does NOT contain addressBook (omitempty)
    jsonStr := string(jsonData)
    if strings.Contains(jsonStr, "addressBook") {
        t.Error("JSON should not contain 'addressBook' for v0.1.0 wallet")
    }
}
```

#### Step 2.2: Implement Minimal Code (GREEN)

**File**: `internal/models/address.go` (NEW)

```go
package models

// DerivedAddress represents a derived cryptocurrency address
type DerivedAddress struct {
    Symbol         string `json:"symbol"`
    Name           string `json:"name"`
    Address        string `json:"address"`
    CoinType       uint32 `json:"coinType"`
    DerivationPath string `json:"path"`
}

// AddressBook contains all pre-generated addresses for a wallet
type AddressBook struct {
    Addresses []DerivedAddress `json:"addresses"`
}
```

**File**: `internal/models/wallet.go` (MODIFY)

```go
package models

import (
    "errors"
    "time"
)

// Wallet represents a hierarchical deterministic wallet created from a BIP39 mnemonic
type Wallet struct {
    ID                     string       `json:"id"`
    Name                   string       `json:"name,omitempty"`
    CreatedAt              time.Time    `json:"createdAt"`
    LastAccessedAt         time.Time    `json:"lastAccessedAt"`
    EncryptedMnemonicPath  string       `json:"encryptedMnemonicPath"`
    UsesPassphrase         bool         `json:"usesPassphrase"`
    AddressBook            *AddressBook `json:"addressBook,omitempty"` // NEW FIELD
}

// ValidateWalletName validates the wallet name length and characters
func ValidateWalletName(name string) error {
    if len(name) > 64 {
        return errors.New("wallet name must be 64 characters or less")
    }
    return nil
}
```

**Run Test**:

```bash
go test ./tests/unit/wallet_model_test.go -v
```

**Expected**: PASS ✅

---

### Task 7: Implement XRP (Ripple) Formatter (Example of New Coin)

#### Step 7.1: Write the Test (RED)

**File**: `tests/unit/ripple_formatter_test.go`

```go
package unit

import (
    "testing"
    "github.com/btcsuite/btcd/btcutil/hdkeychain"
    "github.com/yourusername/arcsign/internal/services/address"
    "github.com/yourusername/arcsign/internal/services/bip39service"
    "github.com/yourusername/arcsign/internal/services/hdkey"
)

// Test: Derive XRP address from known test vector
func TestRippleFormatter_KnownTestVector(t *testing.T) {
    // BIP39 test vector
    mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    passphrase := ""

    // Generate seed
    bip39Svc := bip39service.NewBIP39Service()
    seed, err := bip39Svc.MnemonicToSeed(mnemonic, passphrase)
    if err != nil {
        t.Fatalf("Failed to generate seed: %v", err)
    }

    // Create master key
    hdkeySvc := hdkey.NewHDKeyService()
    masterKey, err := hdkeySvc.NewMasterKey(seed)
    if err != nil {
        t.Fatalf("Failed to create master key: %v", err)
    }

    // Derive XRP path: m/44'/144'/0'/0/0
    derivedKey, err := hdkeySvc.DerivePath(masterKey, "m/44'/144'/0'/0/0")
    if err != nil {
        t.Fatalf("Failed to derive key: %v", err)
    }

    // Format XRP address
    addressSvc := address.NewAddressService()
    xrpAddress, err := addressSvc.DeriveRippleAddress(derivedKey)
    if err != nil {
        t.Fatalf("Failed to derive XRP address: %v", err)
    }

    // Expected address for this test vector (from ripple-lib test suite)
    expectedAddress := "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"

    if xrpAddress != expectedAddress {
        t.Errorf("Expected XRP address '%s', got '%s'", expectedAddress, xrpAddress)
    }

    // Verify address format
    if len(xrpAddress) < 25 || len(xrpAddress) > 35 {
        t.Errorf("XRP address length should be 25-35 chars, got %d", len(xrpAddress))
    }
    if xrpAddress[0] != 'r' {
        t.Errorf("XRP address should start with 'r', got '%c'", xrpAddress[0])
    }
}
```

#### Step 7.2: Implement Minimal Code (GREEN)

**File**: `internal/services/address/ripple.go` (NEW)

```go
package address

import (
    "crypto/sha256"
    "errors"
    "github.com/btcsuite/btcd/btcutil/hdkeychain"
    "github.com/btcsuite/btcutil/base58"
)

// DeriveRippleAddress derives a Ripple (XRP) address from an extended key
func (s *AddressService) DeriveRippleAddress(key *hdkeychain.ExtendedKey) (string, error) {
    // Get public key
    pubKey, err := key.ECPubKey()
    if err != nil {
        return "", err
    }

    // Ripple uses compressed public key
    pubKeyBytes := pubKey.SerializeCompressed()

    // Ripple address derivation:
    // 1. SHA-256 hash of public key
    sha256Hash := sha256.Sum256(pubKeyBytes)

    // 2. RIPEMD-160 hash of SHA-256 hash
    ripemd160Hash := ripemd160Hash(sha256Hash[:])

    // 3. Add version byte (0x00 for Ripple mainnet)
    versionedPayload := append([]byte{0x00}, ripemd160Hash...)

    // 4. Double SHA-256 for checksum
    checksum := doubleSha256(versionedPayload)[:4]

    // 5. Concatenate payload + checksum
    fullPayload := append(versionedPayload, checksum...)

    // 6. Base58 encode with Ripple alphabet
    address := base58.Encode(fullPayload)

    if address == "" {
        return "", errors.New("failed to encode Ripple address")
    }

    return address, nil
}

// ripemd160Hash computes RIPEMD-160 hash
func ripemd160Hash(data []byte) []byte {
    hasher := ripemd160.New()
    hasher.Write(data)
    return hasher.Sum(nil)
}

// doubleSha256 computes double SHA-256 hash
func doubleSha256(data []byte) []byte {
    first := sha256.Sum256(data)
    second := sha256.Sum256(first[:])
    return second[:]
}
```

**Note**: You may need to import `golang.org/x/crypto/ripemd160` for RIPEMD-160 hashing.

**Run Test**:

```bash
go test ./tests/unit/ripple_formatter_test.go -v
```

**Expected**: PASS ✅

#### Step 7.3: Refactor

- Extract common hashing functions to `internal/lib/crypto.go`
- Add comprehensive error handling
- Add more test vectors from official Ripple test suite

---

## Running All Tests

### Unit Tests

```bash
# Run all unit tests
go test ./tests/unit/... -v

# Run specific test file
go test ./tests/unit/coinregistry_test.go -v

# Run with coverage
go test ./tests/unit/... -cover
```

### Integration Tests

```bash
# Run all integration tests (requires USB drive)
go test ./tests/integration/... -v

# Skip USB tests (for CI/CD)
go test ./tests/integration/... -short -v
```

### Contract Tests (BIP44 Test Vectors)

```bash
go test ./tests/contract/... -v
```

---

## Building the CLI

```bash
# Build for current platform
go build -o arcsign cmd/arcsign/main.go

# Build for multiple platforms
GOOS=linux GOARCH=amd64 go build -o arcsign-linux cmd/arcsign/main.go
GOOS=darwin GOARCH=amd64 go build -o arcsign-macos cmd/arcsign/main.go
GOOS=windows GOARCH=amd64 go build -o arcsign.exe cmd/arcsign/main.go
```

---

## Testing the Feature Manually

### 1. Create a new wallet with multi-coin support

```bash
./arcsign create
# Follow prompts, note wallet ID
```

### 2. List all addresses

```bash
./arcsign list-addresses --wallet-id <UUID>
```

**Expected**: See 30+ addresses sorted by market cap

### 3. Get specific address

```bash
./arcsign get-address --wallet-id <UUID> --coin BTC
./arcsign get-address --wallet-id <UUID> --coin-type 60  # Ethereum
```

---

## Common Pitfalls and Solutions

### Pitfall 1: Test Vector Mismatches

**Problem**: Your derived address doesn't match the expected test vector.

**Solution**:
- Verify you're using the exact mnemonic from the test vector
- Check passphrase (often empty string `""`)
- Verify derivation path (hardened vs non-hardened indices)
- Check network parameters (mainnet vs testnet)

### Pitfall 2: Import Cycles

**Problem**: `import cycle not allowed`

**Solution**:
- Keep models in `internal/models/` (no dependencies on services)
- Services can import models, but not vice versa
- Use interfaces to break cycles

### Pitfall 3: Formatter Not Implemented

**Problem**: Address generation fails with "formatter not implemented"

**Solution**:
- Check `FormatterID` in coin registry matches method name
- Implement formatter or mark coin as "coming soon" in registry
- Gracefully handle missing formatters (log error, continue with other coins)

---

## Performance Optimization Tips

### 1. Parallel Address Generation

For 30-50 coins, consider deriving addresses in parallel:

```go
// Example: Parallel derivation (Phase 4 optimization)
func (s *WalletService) GenerateMultiCoinAddresses(masterKey *hdkeychain.ExtendedKey) ([]models.DerivedAddress, error) {
    registry := coinregistry.NewRegistry()
    coins := registry.GetAllCoinsSortedByMarketCap()

    addresses := make([]models.DerivedAddress, len(coins))
    errors := make([]error, len(coins))

    var wg sync.WaitGroup
    for i, coin := range coins {
        wg.Add(1)
        go func(index int, c coinregistry.CoinMetadata) {
            defer wg.Done()
            addr, err := s.deriveAddressForCoin(masterKey, c)
            addresses[index] = addr
            errors[index] = err
        }(i, coin)
    }

    wg.Wait()

    // Filter out failed derivations
    successfulAddresses := []models.DerivedAddress{}
    for i, addr := range addresses {
        if errors[i] == nil {
            successfulAddresses = append(successfulAddresses, addr)
        }
    }

    return successfulAddresses, nil
}
```

**Caution**: Only optimize after confirming sequential generation is too slow (measure first!).

### 2. Caching HD Key Derivations

BIP44 derivation involves multiple levels. Cache intermediate keys:

```go
// Cache account key: m/44'/coin_type'/0'
accountKey := s.deriveAccountKey(masterKey, coinType, 0)

// Derive external chain: m/44'/coin_type'/0'/0
externalKey, _ := accountKey.Derive(0)

// Derive address: m/44'/coin_type'/0'/0/0
addressKey, _ := externalKey.Derive(0)
```

---

## Next Steps

1. **Start with Task 1**: Implement coin registry (follow TDD workflow above)
2. **Progress sequentially**: Complete Tasks 1-6 (foundation + formatters)
3. **Integrate with wallet creation**: Modify `CreateWallet` (Task 11)
4. **Add CLI commands**: Implement `list-addresses` and `get-address` (Tasks 13-14)
5. **Test thoroughly**: Unit, integration, and contract tests (Task 15-17)

---

## Getting Help

### Documentation References

- **BIP39**: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- **BIP32**: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- **BIP44**: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
- **SLIP-44**: https://github.com/satoshilabs/slips/blob/master/slip-0044.md

### Library Documentation

- **btcsuite**: https://pkg.go.dev/github.com/btcsuite/btcd
- **go-ethereum**: https://pkg.go.dev/github.com/ethereum/go-ethereum
- **stellar-go**: https://pkg.go.dev/github.com/stellar/go
- **solana-go**: https://pkg.go.dev/github.com/gagliardetto/solana-go

### Code Review Checklist

Before submitting code for review:

- ✅ All tests pass (`go test ./... -v`)
- ✅ Code coverage >80% for new code
- ✅ TDD workflow followed (test written first)
- ✅ Error handling implemented
- ✅ Audit logging added
- ✅ Documentation comments added (GoDoc format)
- ✅ Constitution requirements met (security, TDD, composition)

---

## Summary

This quickstart guide provides:

✅ **TDD Workflow**: Red-Green-Refactor examples
✅ **Step-by-Step Tasks**: From coin registry to CLI commands
✅ **Code Examples**: Concrete implementations with tests
✅ **Performance Tips**: Optimization strategies
✅ **Common Pitfalls**: Solutions to frequent issues

**Estimated Timeline**: 12-15 days for full implementation (30-50 coins + CLI)

**Next Action**: Begin with Task 1 (Coin Registry) using the TDD workflow above. Write tests first, make them pass, then refactor. Repeat for each task.
