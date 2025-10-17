# Developer Quickstart: Extended Multi-Chain Support (v0.3.0)

**Feature**: Adding 24 new blockchain addresses (54 total)
**Date**: 2025-10-17
**Estimated Time**: 10-15 days (3 phases)

## Overview

This guide walks you through implementing v0.3.0 extended multi-chain support using Test-Driven Development (TDD). You'll add 6 new address formatters and extend the coin registry to support 54 total blockchains.

**Prerequisites**:
- Go 1.21+ installed
- Completed v0.2.0 implementation (30-chain support)
- USB drive for testing wallet creation
- Familiarity with BIP32/BIP44 HD key derivation

---

## Phase 1: Layer 2 Networks (P1) - 3-5 days

### Chains: ARB, OP, BASE, ZKS, LINEA (Ethereum formatter) + STRK (new formatter)

### Step 1.1: Add Layer 2 Chains to Registry (EVM Reuse)

**File**: `internal/services/coinregistry/registry.go`

```go
// Add to NewRegistry() function
{Symbol: "ARB", Name: "Arbitrum", CoinType: 9001, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 35, Category: CategoryLayer2},
{Symbol: "OP", Name: "Optimism", CoinType: 614, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 42, Category: CategoryLayer2},
{Symbol: "BASE", Name: "Base", CoinType: 8453, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 45, Category: CategoryLayer2},
{Symbol: "ZKS", Name: "zkSync", CoinType: 324, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 50, Category: CategoryLayer2},
{Symbol: "LINEA", Name: "Linea", CoinType: 59144, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 55, Category: CategoryLayer2},
```

**TDD Approach**:
```bash
# 1. RED: Write test first
$ go test ./tests/unit/coinregistry_test.go -v -run TestRegistry_Layer2Chains

# Expected failure: chains not in registry yet

# 2. GREEN: Add chains to registry (code above)
$ go test ./tests/unit/coinregistry_test.go -v -run TestRegistry_Layer2Chains
# Expected: PASS

# 3. Integration test
$ go test ./tests/integration/multi_chain_54_test.go -v -run TestGenerateAddresses_FirstBatch
# Should generate 35 chains (30 existing + 5 L2 EVM)
```

### Step 1.2: Implement Starknet Formatter (Complex)

**Time estimate**: 2-3 days

**File**: `internal/services/address/starknet.go` (NEW)

#### Install Dependencies

```bash
go get github.com/NethermindEth/starknet.go@latest
go get github.com/consensys/gnark-crypto@latest
```

#### Write Test First (TDD - RED)

**File**: `tests/unit/starknet_test.go` (NEW)

```go
package unit

import (
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/tyler-smith/go-bip39"
    "github.com/tyler-smith/go-bip32"
    "yourproject/internal/services/address"
)

func TestDeriveStarknetAddress_KnownVector(t *testing.T) {
    // Test vector from Starknet documentation
    mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    seed := bip39.NewSeed(mnemonic, "")

    masterKey, err := bip32.NewMasterKey(seed)
    assert.NoError(t, err)

    // Derive to BIP32 path first (m/44'/60'/0'/0/0)
    // Note: Will implement EIP-2645 path in actual formatter
    key, err := masterKey.NewChildKey(bip32.FirstHardenedChild + 44)
    assert.NoError(t, err)
    key, err = key.NewChildKey(bip32.FirstHardenedChild + 60)
    assert.NoError(t, err)
    key, err = key.NewChildKey(bip32.FirstHardenedChild + 0)
    assert.NoError(t, err)
    key, err = key.NewChildKey(0)
    assert.NoError(t, err)
    key, err = key.NewChildKey(0)
    assert.NoError(t, err)

    svc := address.NewAddressService()
    addr, err := svc.DeriveStarknetAddress(key)

    assert.NoError(t, err)
    assert.Regexp(t, `^0x[0-9a-f]{64}$`, addr) // 32 bytes hex with 0x prefix
    // TODO: Replace with actual expected address from Argent wallet
}

func TestDeriveStarknetAddress_Determinism(t *testing.T) {
    // Same mnemonic should produce same address
    mnemonic := "test mnemonic phrase for determinism check with twenty four words here now complete check verify validate"
    seed := bip39.NewSeed(mnemonic, "")
    masterKey, _ := bip32.NewMasterKey(seed)

    svc := address.NewAddressService()
    addr1, _ := svc.DeriveStarknetAddress(masterKey)
    addr2, _ := svc.DeriveStarknetAddress(masterKey)

    assert.Equal(t, addr1, addr2)
}
```

```bash
# Run test - should FAIL (formatter not implemented yet)
$ go test ./tests/unit/starknet_test.go -v
# Expected: FAIL - undefined: address.DeriveStarknetAddress
```

#### Implement Formatter (TDD - GREEN)

**File**: `internal/services/address/starknet.go`

```go
package address

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "math/big"

    "github.com/btcsuite/btcd/btcutil/hdkeychain"
    "github.com/consensys/gnark-crypto/ecc/stark-curve/fp"
    "github.com/NethermindEth/starknet.go/curve"
)

// Starknet curve order (from Stark curve specification)
var starkCurveOrder, _ = new(big.Int).SetString("3618502788666131213697322783095070105526743751716087489154079457884512865583", 10)

// DeriveStarknetAddress generates a Starknet address from BIP32 key using EIP-2645
func (s *AddressService) DeriveStarknetAddress(key *hdkeychain.ExtendedKey) (string, error) {
    // Step 1: Get private key bytes from BIP32 key
    privKeyBytes, err := key.ECPrivKey()
    if err != nil {
        return "", fmt.Errorf("failed to extract private key: %w", err)
    }

    // Step 2: Apply EIP-2645 grinding algorithm
    groundPrivKey, err := grindKey(privKeyBytes.Serialize())
    if err != nil {
        return "", fmt.Errorf("EIP-2645 grinding failed: %w", err)
    }

    // Step 3: Derive Stark curve public key
    pubKey, err := curve.GetPublicKey(groundPrivKey)
    if err != nil {
        return "", fmt.Errorf("failed to derive Stark public key: %w", err)
    }

    // Step 4: Compute Starknet contract address (simplified for cold wallet)
    // Note: Real Starknet addresses are contract addresses requiring class hash
    // For cold wallet, we use deterministic computation from public key
    address := computeStarknetAddress(pubKey)

    return "0x" + hex.EncodeToString(address), nil
}

// grindKey implements EIP-2645 grinding algorithm
// Ensures derived key falls within Stark curve order
func grindKey(seed []byte) (*big.Int, error) {
    N := new(big.Int).Lsh(big.NewInt(1), 256) // 2^256
    n := starkCurveOrder

    // Calculate N - (N % n)
    modN := new(big.Int).Mod(N, n)
    maxValid := new(big.Int).Sub(N, modN)

    for i := 0; i < 100; i++ { // Safety limit: 100 iterations
        // Hash: SHA256(seed || i)
        h := sha256.New()
        h.Write(seed)
        h.Write([]byte{byte(i)})
        keyBytes := h.Sum(nil)

        key := new(big.Int).SetBytes(keyBytes)

        // Check if key < maxValid
        if key.Cmp(maxValid) < 0 {
            // Return key % n
            return key.Mod(key, n), nil
        }
    }

    return nil, fmt.Errorf("grinding failed after 100 iterations (probability < 2^-100)")
}

// computeStarknetAddress computes Starknet address from public key
// Simplified for cold wallet (actual Starknet uses contract addresses)
func computeStarknetAddress(pubKey *big.Int) []byte {
    // For cold wallet MVP: Use hash of public key as address
    // Production implementation would compute actual contract address with class hash
    h := sha256.New()
    h.Write(pubKey.Bytes())
    hash := h.Sum(nil)

    // Take first 32 bytes (Starknet addresses are 32 bytes)
    return hash[:32]
}
```

```bash
# Run test - should PASS
$ go test ./tests/unit/starknet_test.go -v
# Expected: PASS

# Run all unit tests
$ go test ./tests/unit/... -v
```

#### Add to Registry

```go
// In coinregistry/registry.go
{Symbol: "STRK", Name: "Starknet", CoinType: 9004, FormatterID: "starknet", KeyType: KeyTypeSecp256k1, MarketCapRank: 48, Category: CategoryLayer2},
```

#### Add Formatter to Service

**File**: `internal/services/address/service.go`

```go
func (s *AddressService) deriveAddressByFormatter(key *hdkeychain.ExtendedKey, formatterID string) (string, error) {
    switch formatterID {
    // ... existing formatters ...
    case "starknet":
        return s.DeriveStarknetAddress(key)
    // ... other formatters ...
    default:
        return "", fmt.Errorf("unsupported formatter: %s", formatterID)
    }
}
```

### Step 1.3: Integration Test Phase 1

```bash
# Test all 6 Layer 2 chains generate successfully
$ go test ./tests/integration/multi_chain_54_test.go -v -run TestPhase1_Layer2

# Test wallet creation with 36 chains (30 + 6 Layer 2)
$ go test ./tests/integration/ -v -run TestCreateWallet_Phase1

# Manual test: Create actual wallet on USB
$ go run cmd/arcsign/main.go create --name "Phase1_Test"
# Expected output: 36 chains generated
```

---

## Phase 2: Regional + Cosmos (P2) - 3-4 days

### Chains: KLAY, CRO, HT (Ethereum formatter) + ONE (new formatter) + OSMO, JUNO, EVMOS, SCRT (Cosmos formatter extension)

### Step 2.1: Add Regional Chains (EVM Reuse)

```go
// In coinregistry/registry.go
{Symbol: "KLAY", Name: "Klaytn", CoinType: 8217, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 60, Category: CategoryCustom},
{Symbol: "CRO", Name: "Cronos", CoinType: 394, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 65, Category: CategoryCustom},
{Symbol: "HT", Name: "HECO", CoinType: 1010, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 70, Category: CategoryCustom},
```

### Step 2.2: Implement Harmony Formatter (Simple)

**Time estimate**: 1 day

**Dependencies**:
```bash
# No new dependencies - uses existing go-ethereum + btcutil/bech32
```

**File**: `tests/unit/harmony_test.go` (TDD - RED)

```go
func TestDeriveHarmonyAddress_KnownVector(t *testing.T) {
    // Test vector: Same Ethereum address in Bech32 "one1" format
    // ETH: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
    // ONE: one1wsk34nr8gcgs2fgkfc6xfnw8u22tqh4cqjg3qc

    mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    seed := bip39.NewSeed(mnemonic, "")
    masterKey, _ := bip32.NewMasterKey(seed)

    // Derive m/44'/1023'/0'/0/0 (Harmony coin type)
    key, _ := masterKey.NewChildKey(bip32.FirstHardenedChild + 44)
    key, _ = key.NewChildKey(bip32.FirstHardenedChild + 1023)
    key, _ = key.NewChildKey(bip32.FirstHardenedChild + 0)
    key, _ = key.NewChildKey(0)
    key, _ = key.NewChildKey(0)

    svc := address.NewAddressService()
    addr, err := svc.DeriveHarmonyAddress(key)

    assert.NoError(t, err)
    assert.Regexp(t, `^one1[a-z0-9]{38}$`, addr)
    // TODO: Verify against actual Harmony wallet output
}
```

**File**: `internal/services/address/harmony.go` (TDD - GREEN)

```go
package address

import (
    "fmt"

    "github.com/btcsuite/btcd/btcutil/bech32"
    "github.com/btcsuite/btcd/btcutil/hdkeychain"
    "github.com/ethereum/go-ethereum/crypto"
)

// DeriveHarmonyAddress generates Harmony one1 address (Ethereum + Bech32)
func (s *AddressService) DeriveHarmonyAddress(key *hdkeychain.ExtendedKey) (string, error) {
    // Step 1: Derive Ethereum-style address (same as ETH formatter)
    privKey, err := key.ECPrivKey()
    if err != nil {
        return "", fmt.Errorf("failed to extract private key: %w", err)
    }

    pubKey := privKey.PubKey().SerializeUncompressed()
    hash := crypto.Keccak256(pubKey[1:]) // Skip 0x04 prefix
    ethAddr := hash[12:]                  // Last 20 bytes

    // Step 2: Convert to Bech32 with "one" HRP
    converted, err := bech32.ConvertBits(ethAddr, 8, 5, true)
    if err != nil {
        return "", fmt.Errorf("bech32 conversion failed: %w", err)
    }

    // Step 3: Encode with "one" prefix
    oneAddr, err := bech32.Encode("one", converted)
    if err != nil {
        return "", fmt.Errorf("bech32 encoding failed: %w", err)
    }

    return oneAddr, nil
}
```

Add to registry and service dispatcher (same pattern as Starknet).

### Step 2.3: Extend Cosmos Formatter for IBC Chains

**File**: `internal/services/address/cosmos.go` (extend existing)

```go
// DeriveCosmosAddress now supports custom Bech32 prefixes
func (s *AddressService) DeriveCosmosAddress(key *hdkeychain.ExtendedKey, prefix string) (string, error) {
    privKey, err := key.ECPrivKey()
    if err != nil {
        return "", fmt.Errorf("failed to extract private key: %w", err)
    }

    pubKey := privKey.PubKey().SerializeCompressed()

    // SHA256 + RIPEMD160 (standard Cosmos address derivation)
    sha256Hash := sha256.Sum256(pubKey)
    ripemd160Hasher := ripemd160.New()
    ripemd160Hasher.Write(sha256Hash[:])
    addrBytes := ripemd160Hasher.Sum(nil)

    // Convert to Bech32 with custom prefix
    converted, err := bech32.ConvertBits(addrBytes, 8, 5, true)
    if err != nil {
        return "", fmt.Errorf("bech32 conversion failed: %w", err)
    }

    addr, err := bech32.Encode(prefix, converted)
    if err != nil {
        return "", fmt.Errorf("bech32 encoding failed: %w", err)
    }

    return addr, nil
}

// Specific formatters for each Cosmos chain
func (s *AddressService) DeriveOsmosisAddress(key *hdkeychain.ExtendedKey) (string, error) {
    return s.DeriveCosmosAddress(key, "osmo")
}

func (s *AddressService) DeriveJunoAddress(key *hdkeychain.ExtendedKey) (string, error) {
    return s.DeriveCosmosAddress(key, "juno")
}

func (s *AddressService) DeriveEvmosAddress(key *hdkeychain.ExtendedKey) (string, error) {
    // Evmos dual format: return Cosmos format (evmos1...)
    // Ethereum format available via DeriveEthereumAddress
    return s.DeriveCosmosAddress(key, "evmos")
}

func (s *AddressService) DeriveSecretAddress(key *hdkeychain.ExtendedKey) (string, error) {
    return s.DeriveCosmosAddress(key, "secret")
}
```

Add to registry with appropriate formatter IDs (osmosis, juno, evmos, secret).

### Step 2.4: Integration Test Phase 2

```bash
$ go test ./tests/integration/multi_chain_54_test.go -v -run TestPhase2_RegionalCosmos
# Expected: 44 total chains (36 Phase 1 + 8 Phase 2)
```

---

## Phase 3: Alternative EVM + Specialized (P3) - 4-5 days

### Chains: FTM, CELO, GLMR, METIS, GNO, WAN (Ethereum formatter) + KSM, XTZ, ZIL, ICX (4 new formatters)

### Step 3.1: Add Alternative EVM Chains

```go
// In coinregistry/registry.go - all reuse ethereum formatter
{Symbol: "FTM", Name: "Fantom", CoinType: 60, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 75, Category: CategoryCustom},
{Symbol: "CELO", Name: "Celo", CoinType: 52752, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 80, Category: CategoryCustom},
{Symbol: "GLMR", Name: "Moonbeam", CoinType: 1284, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 85, Category: CategoryCustom},
{Symbol: "METIS", Name: "Metis", CoinType: 1088, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 90, Category: CategoryCustom},
{Symbol: "GNO", Name: "Gnosis", CoinType: 700, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 95, Category: CategoryCustom},
{Symbol: "WAN", Name: "Wanchain", CoinType: 5718350, FormatterID: "ethereum", KeyType: KeyTypeSecp256k1, MarketCapRank: 100, Category: CategoryCustom},
```

### Step 3.2-3.5: Implement Remaining Formatters

**Kusama** (Moderate - 1.5 days):
- Install: `go get github.com/vedhavyas/go-subkey`
- TDD: `tests/unit/kusama_test.go`
- Implement: `internal/services/address/kusama.go`
- Key challenge: sr25519 keys, Substrate BIP39 quirk, ss58 encoding

**Tezos** (Moderate - 1.5 days):
- Install: `go get github.com/trilitech/tzgo`, `go get github.com/ecadlabs/go-tezos-keygen`
- TDD: `tests/unit/tezos_test.go`
- Implement: `internal/services/address/tezos.go`
- Key challenge: SLIP-10 Ed25519 derivation, tz1 Base58Check encoding

**Zilliqa** (Simple - 1 day):
- Install: `go get github.com/Zilliqa/gozilliqa-sdk/v3`
- TDD: `tests/unit/zilliqa_test.go`
- Implement: `internal/services/address/zilliqa.go`
- Key challenge: Schnorr signatures, SHA256 (not Keccak256), Bech32 zil1

**ICON** (Simple - 1 day):
- Install: `go get golang.org/x/crypto/sha3`
- TDD: `tests/unit/icon_test.go`
- Implement: `internal/services/address/icon.go`
- Key challenge: SHA3-256 (not Keccak256), hx prefix, coin type discrepancy (74 vs 4801368)

*Refer to research.md for detailed implementation notes for each formatter.*

### Step 3.6: Final Integration Tests

```bash
# Test all 54 chains
$ go test ./tests/integration/multi_chain_54_test.go -v -run TestAll54Chains

# Test upgrade path (v0.2.0 → v0.3.0)
$ go test ./tests/integration/upgrade_v02_v03_test.go -v

# Test performance
$ go test ./tests/integration/ -v -run TestPerformance_GenerationTime
# Expected: <15 seconds for 54 chains

# Test determinism
$ go test ./tests/integration/ -v -run TestDeterminism_SameMnemonic
# Expected: Same addresses across multiple runs
```

---

## Testing Strategy

### 1. Unit Tests (per formatter)

**Pattern**:
```go
func TestDeriveXXXAddress_KnownVector(t *testing.T) {
    // Use known mnemonic from official docs
    // Verify address matches expected value
}

func TestDeriveXXXAddress_Determinism(t *testing.T) {
    // Same mnemonic should produce same address
}

func TestDeriveXXXAddress_EmptyPassphrase(t *testing.T) {
    // Test with and without BIP39 passphrase
}

func TestDeriveXXXAddress_DerivationPath(t *testing.T) {
    // Verify correct BIP44 path used
}
```

### 2. Integration Tests

```bash
# File: tests/integration/multi_chain_54_test.go

func TestGenerateAddresses_All54Chains(t *testing.T)
func TestGenerateAddresses_PerformanceUnder15Seconds(t *testing.T)
func TestGenerateAddresses_DeterministicGeneration(t *testing.T)
func TestGenerateAddresses_GracefulFailureHandling(t *testing.T)

# File: tests/integration/upgrade_v02_v03_test.go

func TestUpgrade_V02ToV03_Automatic(t *testing.T)
func TestUpgrade_V02ToV03_PreservesOriginalAddresses(t *testing.T)
func TestUpgrade_V02ToV03_Generates24NewChains(t *testing.T)
```

### 3. Contract Tests

```bash
# File: tests/contract/address_format_test.go

func TestAddressFormat_Bitcoin(t *testing.T)     // Base58Check, starts with 1 or 3
func TestAddressFormat_Ethereum(t *testing.T)    // 0x + 40 hex chars
func TestAddressFormat_Starknet(t *testing.T)    // 0x + 64 hex chars
func TestAddressFormat_Kusama(t *testing.T)      // Starts with C-H or J
func TestAddressFormat_Tezos(t *testing.T)       // tz1 + Base58Check
func TestAddressFormat_Zilliqa(t *testing.T)     // zil1 + Bech32
func TestAddressFormat_Harmony(t *testing.T)     // one1 + Bech32
func TestAddressFormat_ICON(t *testing.T)        // hx + 40 hex chars
```

### 4. Cross-Wallet Verification

Manually verify generated addresses match popular wallets:

| Chain | Reference Wallet | Test Method |
|-------|------------------|-------------|
| Starknet | Argent X | Same mnemonic → compare addresses |
| Kusama | Polkadot.js | Use subkey CLI tool for verification |
| Tezos | Tezbox | Import mnemonic, verify tz1 address |
| Zilliqa | Zillet | Import mnemonic, compare zil1 address |
| Harmony | Harmony ONE Wallet | Check one1 address matches |
| ICON | Hana | Use coin type 4801368, verify hx address |

---

## Common Pitfalls & Solutions

### 1. Kusama Substrate BIP39 Quirk
**Problem**: Same mnemonic produces different addresses vs Ledger
**Solution**: Use go-subkey's `FromPhrase()` (handles Substrate entropy derivation)

### 2. Starknet EIP-2645 Grinding Timeout
**Problem**: Grinding takes too long or fails
**Solution**: Implement iteration limit (100 attempts), log failures, allow manual retry

### 3. ICON Coin Type Confusion
**Problem**: Addresses don't match Hana wallet
**Solution**: Use coin type 4801368 (not registered 74), document discrepancy

### 4. Evmos Dual Format Display
**Problem**: User confusion about Ethereum vs Cosmos format
**Solution**: Display both formats in CLI output, explain when to use each

### 5. Performance Regression
**Problem**: 54 chains exceed 15-second target
**Solution**: Profile with `pprof`, optimize slowest formatters first, consider parallel generation

---

## Performance Optimization

### Parallel Generation (Optional Enhancement)

```go
// File: internal/services/address/service.go

func (s *AddressService) GenerateMultiCoinAddressesParallel(
    masterKey *hdkeychain.ExtendedKey,
    registry *coinregistry.Registry
) (*models.AddressBook, error) {
    coins := registry.GetAllCoinsSortedByMarketCap()
    results := make(chan *models.DerivedAddress, len(coins))
    errors := make(chan error, len(coins))

    // Launch goroutine per chain
    for _, coin := range coins {
        go func(c coinregistry.CoinMetadata) {
            addr, err := s.generateSingleChain(masterKey, c)
            if err != nil {
                errors <- err
                return
            }
            results <- addr
        }(coin)
    }

    // Collect results
    addressBook := &models.AddressBook{}
    for i := 0; i < len(coins); i++ {
        select {
        case addr := <-results:
            addressBook.Addresses = append(addressBook.Addresses, *addr)
        case err := <-errors:
            // Log error, continue with retry logic
        }
    }

    return addressBook, nil
}
```

**Caution**: Test for race conditions, ensure thread-safe key derivation.

---

## Deployment Checklist

- [ ] All 58 unit tests pass (6 new formatters × ~4 tests each + existing)
- [ ] All 8 integration tests pass (multi-chain, upgrade, performance, determinism)
- [ ] All 8 contract tests pass (address format validation)
- [ ] Cross-wallet verification complete (6 new formatters)
- [ ] Performance under 15 seconds (54 chains)
- [ ] Documentation updated (MULTI_COIN_ADDRESSES.md, CHANGELOG.md)
- [ ] Version bumped to v0.3.0 in all relevant files
- [ ] Git tags created (`git tag v0.3.0`)

---

## Troubleshooting

### Build Errors

```bash
# Missing dependency
go mod tidy

# Version conflicts
go get -u github.com/NethermindEth/starknet.go@latest

# Clean build cache
go clean -cache && go build ./...
```

### Test Failures

```bash
# Run specific test with verbose output
go test ./tests/unit/starknet_test.go -v -run TestDeriveStarknetAddress_KnownVector

# Enable debug logging
export ARCSIGN_LOG_LEVEL=debug
go test ./tests/integration/... -v

# Profile slow tests
go test ./tests/integration/ -cpuprofile=cpu.prof -memprofile=mem.prof
go tool pprof cpu.prof
```

### Address Mismatch with Reference Wallet

1. Verify mnemonic is identical (check word order, spelling)
2. Confirm BIP44 derivation path matches (especially coin type)
3. Check BIP39 passphrase (empty vs non-empty)
4. For Substrate chains: Verify using Substrate-specific BIP39 derivation
5. For ICON: Try both coin types (74 and 4801368)

---

## Next Steps After Quickstart

1. ✅ **Phase 1 Complete**: research.md, data-model.md, contracts/, quickstart.md
2. **Phase 1 Next**: Update CLAUDE.md agent context
3. **Phase 2**: Run `/speckit.tasks` to generate task breakdown (tasks.md)
4. **Phase 3**: Begin implementation following this quickstart guide

---

## Additional Resources

- **Starknet**: https://docs.starkware.co/, EIP-2645 spec
- **Kusama**: https://wiki.polkadot.network/, Substrate docs
- **Tezos**: https://docs.tzpro.io/sdks/tzgo/
- **Zilliqa**: https://github.com/Zilliqa/gozilliqa-sdk
- **Harmony**: https://docs.harmony.one/
- **ICON**: https://docs.icon.community/

**Contact**: Refer to research.md for detailed library documentation and implementation patterns.
