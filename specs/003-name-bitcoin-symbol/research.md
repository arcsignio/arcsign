# Research: Extended Multi-Chain Support Libraries

**Date**: 2025-10-17
**Feature**: v0.3.0 Extended Multi-Chain Support (24 new blockchains)
**Purpose**: Resolve library selection for 6 new address formatters

## Summary

Research completed for ecosystem-standard libraries to implement 6 new address formatters: Starknet, Kusama, Tezos, Zilliqa, Harmony, and ICON. Key finding: 3 formatters require mature SDKs (Starknet, Kusama, Tezos), 1 uses official SDK (Zilliqa), and 2 are built from cryptographic primitives (Harmony, ICON).

## 1. Starknet Address Formatter

### Decision

**Composite approach**: NethermindEth/starknet.go + tyler-smith/go-bip32 + consensys/gnark-crypto + custom EIP-2645 grinding implementation

### Rationale

- **No single library** provides complete BIP32→Starknet derivation
- NethermindEth/starknet.go is the most actively maintained Starknet Go library (853 commits, v0.8.1 in 2024)
- Must implement EIP-2645 grinding algorithm (not provided by any Go library)
- gnark-crypto provides Stark curve operations and Pedersen hashing
- Starknet uses unique key derivation requiring custom integration

### Alternatives Considered

1. **dontpanicdao/caigo** - Less actively maintained than starknet.go, deprecated in favor of NethermindEth fork
2. **Pure JavaScript reference implementations** (scure-starknet) - Not Go-based, but useful for grinding algorithm reference

### Implementation Notes

**Key Technical Requirements**:
- Starknet uses **Stark curve** (different from secp256k1)
- Requires **EIP-2645 derivation path**: `m/2645'/579218131'/application'/eth_addr_1'/eth_addr_2'/index`
- Must implement **grinding algorithm** to ensure derived key falls within Stark curve order
- Addresses are **contract addresses** (not simple public key hashes) requiring Pedersen hash computation

**Grinding Algorithm** (critical for offline derivation):
```go
// Pseudocode from EIP-2645 spec
N := 2^256
n := StarkCurveOrder // 0x800000000000010ffffffffffffffffb781126dcae7b2321e66a241adc64d2f
path := "m/2645'/579218131'/..."
rootKey := BIP32Derive(path)

for i := 0; ; i++ {
    key := SHA256(rootKey || i)
    if key < (N - (N % n)) {
        return key % n
    }
}
```

**Dependencies**:
```go
github.com/NethermindEth/starknet.go v0.8.1+  // Stark curve, Pedersen hash
github.com/tyler-smith/go-bip32               // BIP32 HD derivation
github.com/consensys/gnark-crypto             // Stark curve primitives
```

**Security Considerations**:
- gnark-crypto has no constant-time guarantees (document risk)
- Grinding algorithm has <2^-5 rejection probability per iteration (very efficient)
- Starknet addresses are smart contracts (account abstraction model)

**References**:
- EIP-2645: https://eips.ethereum.org/EIPS/eip-2645
- Starknet key derivation: https://community.starknet.io/t/account-keys-and-addresses-derivation-standard/1230

---

## 2. Kusama Address Formatter

### Decision

**vedhavyas/go-subkey** with optional security review using ChainSafe/go-schnorrkel for cryptographic primitives

### Rationale

- go-subkey is purpose-built for offline Substrate key operations (no RPC dependencies)
- Native sr25519, ed25519, and ECDSA support with built-in ss58 encoding
- Direct port of Substrate's subkey tool (most aligned with Kusama standards)
- ChainSafe/go-schnorrkel (99 stars, security audited by Trail of Bits in 2021) provides low-level sr25519 primitives if needed

### Alternatives Considered

1. **ChainSafe/go-schnorrkel** - Audited but low-level (requires custom ss58 encoding)
2. **go-substrate-rpc-client (GSRPC)** - RPC-focused, requires external subkey binary for offline signing
3. **ChainSafe/gossamer** - Full node implementation, too heavy for address generation

### Implementation Notes

**Critical Substrate Quirk**:
- Substrate uses **non-standard BIP39**: Uses BIP39 wordlist but derives keys from **entropy bytes directly** (not PBKDF2)
- Same mnemonic produces **different keys** on standard BIP39 wallets vs Substrate wallets
- go-subkey handles this correctly via `FromPhrase(phrase, pwd string)`

**Derivation Path Syntax**:
- Hard junctions: `//foo` (non-reversible, cannot derive public key from parent)
- Soft junctions: `/bar` (reversible, can derive public key)
- Password: `///password`
- Example: `"crowd swamp...//foo//42///password"`

**SS58 Encoding**:
- Kusama network format: `2` (addresses start with capital letters C-H, J)
- Polkadot format: `0` (addresses start with `1`)
- Generic Substrate: `42` (addresses start with `5`)

**Dependencies**:
```go
github.com/vedhavyas/go-subkey        // Primary library for offline operations
github.com/ChainSafe/go-schnorrkel    // Optional: audited sr25519 (if extra security needed)
```

**Security Considerations**:
- go-subkey has 22 stars (smaller community than go-schnorrkel)
- For production cold wallets, consider dual implementation (go-subkey + go-schnorrkel) for verification
- Trail of Bits audit available for go-schnorrkel (August 2021)

**References**:
- go-subkey: https://github.com/vedhavyas/go-subkey
- go-schnorrkel audit: https://github.com/ChainSafe/go-schnorrkel (Trail of Bits, 2021)

---

## 3. Tezos Address Formatter

### Decision

**Trilitech/tzgo** (formerly blockwatch-cc/tzgo) + ecadlabs/go-tezos-keygen for SLIP-10 derivation

### Rationale

- tzgo is the most comprehensive, actively maintained Tezos Go library (development moved to Trilitech in 2024)
- Supports latest Tezos protocol (Seoul v023, September 2025)
- Offline-first design with dedicated signer library (no RPC required)
- Native Ed25519, Secp256k1, P256, BLS12_381 support with full tz1/tz2/tz3 address generation
- SLIP-10 library needed for BIP32-compatible Ed25519 derivation (Ed25519 not natively BIP32-compatible)

### Alternatives Considered

1. **goat-systems/go-tezos** - Development stalled after 2021, no 2023-2025 updates
2. **ecadlabs/go-tezos** - Alpha quality, RPC-focused (but keygen sub-library useful)
3. **Custom implementation** - Reinventing wheel when production library exists

### Implementation Notes

**BIP32 Ed25519 Compatibility Challenge**:
- Standard BIP32 only defines secp256k1 derivation
- Ed25519 requires **SLIP-10** (extension of BIP32 for Ed25519)
- All indices must be **hardened** (marked with `'`)

**Tezos BIP44 Paths**:
- Coin type: `1729`
- Common paths:
  - `m/44'/1729'/0'/0'` (Tezbox, tezos-client)
  - `m/44'/1729'/0'/0'/0'` (Galleon)

**tz1 Address Format**:
- Prefix bytes: `0x06, 0xA1, 0x9F` (produces "tz1" in Base58Check)
- Structure: Blake2B hash (20 bytes) of Ed25519 public key + Base58Check encoding

**Derivation Flow**:
```
BIP39 Mnemonic → Seed (512 bits) → SLIP-10 Derivation → Ed25519 Key → tz1 Address
```

**Dependencies**:
```go
github.com/trilitech/tzgo              // Primary Tezos library
github.com/ecadlabs/go-tezos-keygen    // SLIP-10 Ed25519 derivation
github.com/tyler-smith/go-bip39        // BIP39 mnemonic handling
```

**Security Considerations**:
- No public security audits found for tzgo
- Trilitech backing provides institutional support (acquired from Blockwatch in 2024)
- MIT license with long-term interface stability guarantees

**References**:
- tzgo documentation: https://docs.tzpro.io/sdks/tzgo/
- GoDoc: https://pkg.go.dev/github.com/trilitech/tzgo

---

## 4. Zilliqa Address Formatter

### Decision

**Zilliqa/gozilliqa-sdk v2.4.0** (official Zilliqa Go SDK)

### Rationale

- Official SDK maintained by Zilliqa core team (latest release January 2024)
- Complete offline capability with built-in BIP39/BIP44 support
- Native Bech32 encoding with `zil1` prefix
- Default derivation path: `m/44'/313'/0'/0/index` (coin type 313)
- Includes Schnorr signature implementation (Zilliqa-specific, incompatible with ECDSA)

### Alternatives Considered

1. **FireStack-Lab/LaksaGo** - Archived September 2019, officially redirects to gozilliqa-sdk
2. **GincoInc/zillean** - Experimental, no explicit BIP44 support, "still under development"
3. **Generic Bech32 libraries** (btcsuite) - Would require manual Schnorr integration

### Implementation Notes

**Critical: Zilliqa uses secp256k1, NOT ed25519** (common misconception)

**Key Differences from Ethereum**:
- Zilliqa uses **Schnorr signatures** (not ECDSA)
- Hash function: **SHA256** (not Keccak256)
- Same private key produces **different addresses** on Zilliqa vs Ethereum
- Schnorr signatures are 64 bytes (ECDSA: 65 bytes)

**Address Derivation Flow**:
```
BIP39 Mnemonic → BIP32 Seed → m/44'/313'/account'/change/index
→ Private Key (secp256k1) → Public Key (33 bytes compressed)
→ SHA256 hash → Last 20 bytes → Bech32 encode ("zil" HRP) → zil1...
```

**Bech32 Encoding**:
- Human-Readable Prefix (HRP): `"zil"` (mainnet and testnet)
- Follows BIP-173 with Zilliqa-specific HRP
- Base16 addresses (0x...) can convert to/from Bech32 (zil1...)

**Dependencies**:
```go
github.com/Zilliqa/gozilliqa-sdk/v3 v2.4.0  // Primary library
github.com/tyler-smith/go-bip39              // Already in project
github.com/btcsuite/btcd/btcec/v2            // secp256k1 (already used)
```

**Security Considerations**:
- Official SDK with core team maintenance
- Deterministic address generation (same mnemonic → same addresses)
- Built-in encrypted keystore support (PBKDF2/Scrypt + AES-128-CTR)

**References**:
- GitHub: https://github.com/Zilliqa/gozilliqa-sdk
- SLIP-0044 coin type 313: https://github.com/satoshilabs/slips/blob/master/slip-0044.md

---

## 5. Harmony Address Formatter

### Decision

**Compose from Standard Libraries**: ethereum/go-ethereum/crypto + btcsuite/btcd/btcutil/bech32

### Rationale

- **Avoid Harmony-specific libraries** - existing SDKs are CLI-focused or have heavy dependencies
- Harmony uses **identical Ethereum key derivation** (secp256k1 + Keccak256)
- Only difference: Final address format (Bech32 `one1` vs Ethereum `0x`)
- go-ethereum and btcsuite are battle-tested, actively maintained (Oct 2024 commits)
- Minimal dependencies, no RPC code, pure offline capability

### Alternatives Considered

1. **harmony-one/go-sdk** - CLI tool with heavy dependencies, overkill for address generation
2. **harmony-one/harmony internal packages** - Marked internal, not intended for external use, massive dependency tree
3. **cosmos/cosmos-sdk/types/bech32** - Unnecessary complexity, deviates from BIP-173

### Implementation Notes

**Harmony = Ethereum + Bech32 Encoding**:
```go
// 1. Use go-ethereum for BIP44 derivation (m/44'/1023'/0'/0/0)
// 2. Derive secp256k1 private key
// 3. Generate public key, hash with Keccak256
// 4. Take last 20 bytes (Ethereum-format address)
// 5. Convert: bech32.ConvertBits(addr, 8, 5, true)
// 6. Encode: bech32.Encode("one", convertedBits)
```

**BIP44 Coin Type Critical Discrepancy**:
- **Official Harmony coin type**: `1023` (path: `m/44'/1023'/0'/0/0`)
- **MetaMask uses**: `60` (Ethereum's coin type)
- These produce **different addresses** from same seed
- **Recommendation**: Use 1023 for compatibility with official Harmony wallets

**Address Conversion**:
- Every Harmony address has corresponding Ethereum hex address
- Example: `one1pdv9...` ↔ `0x0B585F8D...`
- Users must select correct network despite identical addresses for EVM L2s

**Dependencies**:
```go
github.com/ethereum/go-ethereum/crypto           // Already in project
github.com/btcsuite/btcd/btcutil/bech32 v2.x.x  // Bech32 encoding only
```

**Security Considerations**:
- Reusing well-audited Ethereum libraries (go-ethereum has extensive security review)
- Minimal attack surface (no full SDK dependencies)
- Battle-tested in production across multiple chains

**References**:
- Harmony documentation: https://docs.harmony.one/
- BIP44 coin type: https://github.com/satoshilabs/slips/blob/master/slip-0044.md

---

## 6. ICON Address Formatter

### Decision

**Build from secp256k1 primitives**: golang.org/x/crypto/sha3 + ethereum/go-ethereum/crypto

### Rationale

- **No mature Go SDK** - existing SDKs (eyeonicon, kidmam) have minimal maintenance (4-6 stars)
- ICON address format is **simple and straightforward** to implement
- Building from primitives provides maximum security auditability for cold wallet
- Proven cryptographic libraries reduce risk vs untested SDKs
- Full offline capability guaranteed

### Alternatives Considered

1. **eyeonicon/go-icon-sdk** - 4 stars, unclear maintenance, not widely adopted
2. **kidmam/icon-sdk-go** - v0.0.1 beta since 2019, appears abandoned
3. **icon-project/goloop** - Official node, too complex for simple address generation (reference only)

### Implementation Notes

**ICON Address Format**:
```
Private Key (32 bytes) → secp256k1 ECDSA → Public Key (64 bytes uncompressed)
→ SHA3-256 hash → Last 20 bytes → Prepend "hx" → ICON Address
```

**Example**:
- Private key: `111...111` (32 bytes)
- Public key: `4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa...`
- Address: `hx396031be52ec56955bd7bf15eacdfa1a1c1fe19e`

**Key Differences from Ethereum**:
- ICON uses **SHA3-256** (actual FIPS 202 standard)
- Ethereum uses **Keccak-256** (pre-standard version)
- ICON prefix: `hx` (users) / `cx` (contracts)
- Ethereum prefix: `0x`

**BIP44 Coin Type Critical Discrepancy**:
- **Registered coin type**: `74` (per SLIP-0044)
- **Actual ecosystem usage**: `4801368` (mainnet) / `1` (testnet)
- **Standard path should be**: `m/44'/74'/0'/0/0`
- **But existing wallets use**: `m/44'/4801368'/0'/0/0`
- **Recommendation**: Support **both** with user selection, default to 4801368 for compatibility

**Implementation**:
```go
func DeriveIconAddress(privateKey *ecdsa.PrivateKey) string {
    // 1. Get uncompressed public key (remove 0x04 prefix)
    pubKeyBytes := crypto.FromECDSAPub(&privateKey.PublicKey)[1:]

    // 2. SHA3-256 hash
    hash := sha3.Sum256(pubKeyBytes)

    // 3. Take last 20 bytes
    addressBytes := hash[12:]

    // 4. Prepend "hx"
    return "hx" + hex.EncodeToString(addressBytes)
}
```

**Dependencies**:
```go
github.com/ethereum/go-ethereum/crypto  // Already in project (secp256k1)
golang.org/x/crypto/sha3                // SHA3-256 (not Keccak256)
```

**Security Considerations**:
- Using battle-tested standard libraries (go-ethereum/crypto, x/crypto/sha3)
- Simple implementation reduces bug surface area
- Critical to test against known vectors from ICON documentation
- Cross-verify with Hana/ICONex wallets using same mnemonic

**References**:
- ICON account documentation: https://docs.icon.community/develop-on-icon-chain/blockchain-components/accounts
- Cryptographic primitives: https://icon.community/learn/cryptographic-primitives/
- BIP44 discussion: https://forum.icon.community/t/creating-a-standard-for-the-bip44-path-derivation-of-icon-addresses-discussion/2702

---

## Implementation Priority

### Phase 1 (Layer 2 - EVM Reuse): P1
- Arbitrum, Optimism, Base, zkSync, Linea: **Reuse existing Ethereum formatter** (no new libraries)
- **Starknet**: New formatter (composite approach, complex)

### Phase 2 (Regional + Cosmos): P2
- Klaytn, Cronos, HECO: **Reuse Ethereum formatter**
- **Harmony**: New formatter (Ethereum + Bech32, simple)
- Osmosis, Juno, Evmos, Secret Network: **Reuse/extend existing Cosmos formatter**

### Phase 3 (Alternative EVM + Specialized): P3
- Fantom, Celo, Moonbeam, Metis, Gnosis: **Reuse Ethereum formatter**
- **Kusama**: New formatter (go-subkey, moderate complexity)
- **Tezos**: New formatter (tzgo + SLIP-10, moderate complexity)
- **Zilliqa**: New formatter (official SDK, low complexity)
- Wanchain: **Reuse Ethereum formatter**
- **ICON**: New formatter (primitives, low complexity)

### Complexity Assessment

**Simple** (1-2 days):
1. ICON (build from primitives)
2. Zilliqa (official SDK)
3. Harmony (Ethereum + Bech32)

**Moderate** (3-5 days):
4. Kusama (go-subkey, sr25519, ss58)
5. Tezos (tzgo, SLIP-10, tz1)

**Complex** (5-7 days):
6. Starknet (custom EIP-2645, grinding, Stark curve)

---

## Dependency Summary

### New Dependencies Required

```go
// Starknet
github.com/NethermindEth/starknet.go v0.8.1+
github.com/consensys/gnark-crypto

// Kusama
github.com/vedhavyas/go-subkey
github.com/ChainSafe/go-schnorrkel  // Optional: for security verification

// Tezos
github.com/trilitech/tzgo
github.com/ecadlabs/go-tezos-keygen

// Zilliqa
github.com/Zilliqa/gozilliqa-sdk/v3 v2.4.0

// Harmony
github.com/btcsuite/btcd/btcutil/bech32 v2.x.x  // Only Bech32, rest reuses Ethereum

// ICON
golang.org/x/crypto/sha3  // Standard library
```

### Existing Dependencies (Reused)

```go
github.com/ethereum/go-ethereum/crypto      // Harmony, ICON, 18 EVM chains
github.com/tyler-smith/go-bip39             // All formatters (BIP39 mnemonics)
github.com/tyler-smith/go-bip32             // All formatters (BIP32 derivation)
github.com/btcsuite/btcd/btcec/v2           // secp256k1 operations
```

---

## Security Review Requirements

1. **Starknet**: Review gnark-crypto (no constant-time guarantees), audit custom grinding implementation
2. **Kusama**: Consider dual implementation with go-schnorrkel (audited) for verification
3. **Tezos**: No public audits found for tzgo - document risk for production use
4. **Zilliqa**: Official SDK, generally trusted but verify Schnorr implementation
5. **Harmony**: Reuses audited go-ethereum libraries (low risk)
6. **ICON**: Build from audited primitives, test against known vectors

---

## Testing Strategy

For each new formatter:
1. **Unit tests**: Test with known mnemonic → expected address vectors from official documentation
2. **Determinism tests**: Same mnemonic → same address across multiple runs
3. **Cross-wallet verification**: Generate address with popular wallet (Argent, Hana, etc.) using same mnemonic, verify match
4. **Edge cases**: Empty passphrases, maximum derivation indices, non-standard paths
5. **Security tests**: Verify no private key leakage in logs or error messages

**Test Fixtures Sources**:
- Starknet: EIP-2645 specification test vectors
- Kusama: Substrate subkey tool outputs
- Tezos: Tezbox/Galleon wallet test vectors
- Zilliqa: Official SDK examples
- Harmony: Harmony Explorer test accounts
- ICON: ICON documentation known addresses

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Starknet grinding algorithm incorrect | Reference multiple implementations (argent-starknet-recover JS, official docs), extensive testing |
| Kusama non-standard BIP39 breaks compatibility | Use go-subkey's `FromPhrase()` (handles Substrate quirk), verify with Polkadot.js wallet |
| Tezos SLIP-10 derivation fails | Use ecadlabs/go-tezos-keygen, test against Tezbox/Galleon |
| Zilliqa Schnorr signatures incompatible | Use official SDK, verify against Zilliqa blockchain |
| Harmony BIP44 coin type mismatch | Support both 1023 and 60, default to 1023, document difference |
| ICON coin type discrepancy | Support both 74 and 4801368, default to 4801368, warn users |

---

## Next Steps

1. ✅ **Phase 0 Complete**: All library research resolved
2. **Phase 1 Next**: Generate data-model.md with Chain Metadata extensions
3. **Phase 1**: Generate contracts/cli-commands.md for CLI interface
4. **Phase 1**: Generate quickstart.md for developer implementation guide
5. **Phase 1**: Update CLAUDE.md agent context with new dependencies
6. **Phase 2**: Generate tasks.md with prioritized implementation tasks
