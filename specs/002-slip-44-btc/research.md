# Research: Multi-Cryptocurrency Address Generation with SLIP-44 Support

**Branch**: `002-slip-44-btc` | **Date**: 2025-10-16 | **Phase**: 0 (Research)

## Overview

This document resolves the 3 NEEDS CLARIFICATION items identified in `plan.md`:

1. **Coin-specific address formatters beyond BTC/ETH**
2. **SLIP-44 Registry source and maintenance strategy**
3. **Market cap ranking data source**

---

## 1. SLIP-44 Registry Source and Maintenance Strategy

### Decision: Use Official SatoshiLabs GitHub Repository

**Source**: https://github.com/satoshilabs/slips/blob/master/slip-0044.md

### Rationale

- **Official Registry**: SLIP-0044 is the authoritative registry maintained by SatoshiLabs (creators of Trezor hardware wallet)
- **Stability**: Registry has been maintained since July 2014 with stable coin type assignments
- **No External Dependencies**: Can be embedded as static data (coin types rarely change once assigned)
- **Industry Standard**: Used by all major hardware wallets (Trezor, Ledger) and BIP44-compliant software

### Implementation Strategy

**Approach**: Embed static coin registry data in Go code rather than runtime fetching

```go
// internal/services/coinregistry/registry.go
type CoinMetadata struct {
    Symbol      string  // "BTC", "ETH", "XRP"
    Name        string  // "Bitcoin", "Ethereum", "Ripple"
    CoinType    uint32  // SLIP-44 index (0, 60, 144)
    FormatterID string  // "bitcoin", "ethereum", "ripple"
}

var RegisteredCoins = []CoinMetadata{
    {Symbol: "BTC", Name: "Bitcoin", CoinType: 0, FormatterID: "bitcoin"},
    {Symbol: "LTC", Name: "Litecoin", CoinType: 2, FormatterID: "bitcoin"}, // Uses Bitcoin formatter
    {Symbol: "DOGE", Name: "Dogecoin", CoinType: 3, FormatterID: "bitcoin"},
    {Symbol: "ETH", Name: "Ethereum", CoinType: 60, FormatterID: "ethereum"},
    {Symbol: "XRP", Name: "Ripple", CoinType: 144, FormatterID: "ripple"},
    {Symbol: "BCH", Name: "Bitcoin Cash", CoinType: 145, FormatterID: "bitcoincash"},
    {Symbol: "XLM", Name: "Stellar", CoinType: 148, FormatterID: "stellar"},
    // ... (30-50 total coins)
}
```

**Maintenance**: Manual updates when supporting new coins (infrequent, as coin types are permanently assigned)

### Alternatives Considered

1. **Runtime fetching from GitHub** - Rejected: Adds network dependency and violates offline-capable requirement
2. **Third-party Go libraries** (slip0044 packages) - Rejected: Adds external dependency for simple static data
3. **Generate from SLIP-44 file at build time** - Considered: Over-engineering for ~50 entries

---

## 2. Coin-Specific Address Formatters

### Decision: Hybrid Approach - Reuse Existing + Add Coin-Specific Formatters

**Strategy**: Leverage existing `btcsuite` and `go-ethereum` implementations, add targeted formatters for unique address formats

### Existing Implementations (from v0.1.0)

✅ **Bitcoin** - `internal/services/address/bitcoin.go`
- Uses `btcsuite/btcutil` for Base58Check P2PKH addresses
- Already implemented and tested

✅ **Ethereum** - `internal/services/address/ethereum.go`
- Uses `go-ethereum/crypto` for Keccak256 hashing
- Produces 0x-prefixed hex addresses
- Already implemented and tested

### Bitcoin-Compatible Coins (Use Bitcoin Formatter with Different Network Parameters)

Many coins use Bitcoin's address format but with different version bytes:

- **Litecoin (LTC)** - SLIP-44: 2 - Uses P2PKH with different version byte (0x30)
- **Dogecoin (DOGE)** - SLIP-44: 3 - P2PKH with version byte 0x1E
- **Dash (DASH)** - SLIP-44: 5 - P2PKH with version byte 0x4C
- **Bitcoin Cash (BCH)** - SLIP-44: 145 - Uses CashAddr format (Bech32-like)
- **Zcash (ZEC)** - SLIP-44: 133 - P2PKH with version bytes 0x1CB8, 0x1CBD

**Implementation**: Extend `bitcoin.go` with network parameter variants

```go
// internal/services/address/bitcoin.go (extend existing)
func (s *AddressService) DeriveBitcoinAddress(key *hdkeychain.ExtendedKey, params *chaincfg.Params) (string, error) {
    // Existing implementation, already supports custom params
}

// Add network parameter constants
var LitecoinMainNet = &chaincfg.Params{PubKeyHashAddrID: 0x30, ...}
var DogecoinMainNet = &chaincfg.Params{PubKeyHashAddrID: 0x1E, ...}
```

### Ethereum-Compatible Coins (Use Ethereum Formatter)

EVM-compatible chains share Ethereum's address format:

- **Ethereum Classic (ETC)** - SLIP-44: 61
- **Binance Smart Chain (BNB)** - SLIP-44: 714
- **Polygon (MATIC)** - SLIP-44: 966
- **Avalanche C-Chain (AVAX)** - SLIP-44: 9000

**Implementation**: Reuse existing `ethereum.go` formatter (addresses are identical across chains)

### Coins Requiring New Formatters

**High Priority** (Top 10 by market cap):

1. **XRP (Ripple)** - SLIP-44: 144
   - **Library**: `github.com/hiromaily/go-crypto-wallet` (supports XRP)
   - **Format**: Base58Check with custom alphabet, starts with 'r'
   - **Effort**: Medium (unique alphabet, checksum algorithm)

2. **Solana (SOL)** - SLIP-44: 501
   - **Library**: `github.com/gagliardetto/solana-go`
   - **Format**: Base58-encoded Ed25519 public key
   - **Effort**: Medium (Ed25519 keys, not secp256k1)

3. **Cardano (ADA)** - SLIP-44: 1815
   - **Library**: `github.com/echovl/cardano-go`
   - **Format**: Bech32-encoded (addr1...) with complex structure
   - **Effort**: High (unique UTXO model, payment + stake keys)

4. **TRON (TRX)** - SLIP-44: 195
   - **Library**: Custom implementation needed
   - **Format**: Base58Check, starts with 'T', similar to Bitcoin
   - **Effort**: Low (Bitcoin-like with different prefix)

5. **Stellar (XLM)** - SLIP-44: 148
   - **Library**: `github.com/stellar/go` (official SDK)
   - **Format**: Base32-encoded (Bech32), starts with 'G'
   - **Effort**: Medium (Ed25519 keys, custom encoding)

**Medium Priority** (Top 50 by market cap):

6. **Monero (XMR)** - SLIP-44: 128
   - **Library**: `github.com/modood/xmrkeygen`
   - **Format**: CryptoNote address (95 characters, Base58)
   - **Effort**: High (CryptoNote cryptography, view keys + spend keys)

7. **Polkadot (DOT)** - SLIP-44: 354
   - **Library**: `github.com/ChainSafe/gossamer`
   - **Format**: SS58 encoding (starts with '1')
   - **Effort**: High (Substrate-based, unique SS58 format)

8. **Cosmos (ATOM)** - SLIP-44: 118
   - **Library**: Custom implementation
   - **Format**: Bech32 with 'cosmos1' prefix
   - **Effort**: Medium (standard Bech32 with secp256k1)

### Recommended Initial Coin List (30 Coins)

| Priority | Coin | Symbol | SLIP-44 | Formatter | Effort |
|----------|------|--------|---------|-----------|--------|
| P0 | Bitcoin | BTC | 0 | bitcoin | ✅ Existing |
| P0 | Ethereum | ETH | 60 | ethereum | ✅ Existing |
| P1 | XRP | XRP | 144 | ripple | Medium |
| P1 | Solana | SOL | 501 | solana | Medium |
| P1 | TRON | TRX | 195 | tron | Low |
| P1 | Stellar | XLM | 148 | stellar | Medium |
| P2 | Litecoin | LTC | 2 | bitcoin-variant | Low |
| P2 | Bitcoin Cash | BCH | 145 | bitcoincash | Medium |
| P2 | Dogecoin | DOGE | 3 | bitcoin-variant | Low |
| P2 | Cardano | ADA | 1815 | cardano | High |
| P2 | Polygon | MATIC | 966 | ethereum | ✅ Reuse |
| P2 | Polkadot | DOT | 354 | polkadot | High |
| P2 | Binance | BNB | 714 | ethereum | ✅ Reuse |
| P3 | Dash | DASH | 5 | bitcoin-variant | Low |
| P3 | Zcash | ZEC | 133 | zcash | Medium |
| P3 | Monero | XMR | 128 | monero | High |
| P3 | Cosmos | ATOM | 118 | cosmos | Medium |
| P3 | Avalanche | AVAX | 9000 | ethereum | ✅ Reuse |
| P3 | Ethereum Classic | ETC | 61 | ethereum | ✅ Reuse |
| P3 | Filecoin | FIL | 461 | filecoin | High |

*P0 = Already implemented, P1 = Top 10 market cap, P2 = Top 20, P3 = Top 50*

**Additional 10 coins** (for 30 total): Select from top 50 by market cap with Bitcoin/Ethereum-compatible formats to minimize implementation effort.

### Implementation Phases

**Phase 1** (MVP - 10 coins):
- BTC, ETH, LTC, DOGE, BCH (Bitcoin-compatible)
- MATIC, BNB, AVAX, ETC (Ethereum-compatible)
- XRP (new formatter)

**Phase 2** (20 coins):
- Add Stellar, TRON, Solana
- Add Dash, Cosmos
- Add 5 more Bitcoin/Ethereum-compatible coins

**Phase 3** (30+ coins):
- Add high-effort coins: Cardano, Polkadot, Monero
- Expand to 30-50 total based on user demand

### Alternatives Considered

1. **Universal address library** - Rejected: No mature Go library supports 30+ coins with consistent API
2. **RPC-based address generation** - Rejected: Requires running full nodes, violates offline requirement
3. **Web API services** - Rejected: Network dependency, privacy concerns
4. **Python wrapper** - Rejected: Complicates deployment, not idiomatic Go

---

## 3. Market Cap Ranking Data Source

### Decision: CoinGecko API for Initial Registry, Static Snapshot Thereafter

**API**: CoinGecko Free Tier API (https://www.coingecko.com/en/api)

### Rationale

- **Free Tier**: 10,000 API calls/month (sufficient for one-time registry creation)
- **Comprehensive**: Covers 13,000+ cryptocurrencies
- **No Registration Required**: Simple REST API
- **Reliable**: Industry-standard data source since 2014
- **Real-Time Rankings**: Provides current market cap rankings

### Implementation Strategy

**One-Time Setup** (Developer Task):

1. Query CoinGecko API for top 50 coins by market cap
2. Map coin symbols to SLIP-44 indices (manual validation)
3. Embed ranking order in `coinregistry/registry.go` as static data
4. Update ranking quarterly (or as-needed basis)

```go
// internal/services/coinregistry/registry.go
func GetCoinsByMarketCap() []CoinMetadata {
    // Return coins pre-sorted by market cap (embedded from CoinGecko snapshot)
    return RegisteredCoins // Already sorted: BTC, ETH, XRP, SOL, BNB, ...
}
```

**Example API Call** (One-Time):

```bash
curl -X 'GET' \
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1' \
  -H 'accept: application/json'
```

**Response Includes**:
```json
[
  {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "market_cap": 2360000000000,
    "market_cap_rank": 1
  },
  {
    "id": "ethereum",
    "symbol": "eth",
    "name": "Ethereum",
    "market_cap": 327400000000,
    "market_cap_rank": 2
  }
  // ... (48 more)
]
```

### Static Snapshot Strategy

**Why Static?**

- **Offline Capability**: Application must work without network (per constitution requirement)
- **Stability**: Top 10 coins rarely change order (BTC always #1, ETH always #2)
- **Performance**: No runtime API calls, instant address listing
- **Reliability**: No external API downtime risk

**Update Policy**:

- **Frequency**: Quarterly review, or when major coins enter/exit top 50
- **Process**: Developer queries CoinGecko, updates `registry.go`, releases new version
- **User Impact**: None (existing wallets continue using creation-time registry)

### Current Top 10 (October 2025 Snapshot)

Based on research:

1. Bitcoin (BTC) - $2.36T
2. Ethereum (ETH) - $327B
3. XRP (XRP) - $144B
4. Tether (USDT) - $140B (stablecoin, not for address generation)
5. Solana (SOL) - Top 5
6. Binance Coin (BNB) - Top 10
7. Cardano (ADA) - Top 10
8. TRON (TRX) - Top 10
9. Dogecoin (DOGE) - $37B
10. USD Coin (USDC) - Top 10 (stablecoin, ERC-20)

**Note**: Stablecoins like USDT and USDC use Ethereum addresses (ERC-20 tokens), so they inherit ETH formatter.

### Alternatives Considered

1. **CoinMarketCap API** - Similar quality, requires registration, 10k calls/month limit
2. **Coinlore API** - Free, no registration, but less comprehensive than CoinGecko
3. **Runtime API calls** - Rejected: Violates offline requirement, adds network dependency
4. **Manual hardcoded ranking** - Rejected: No verifiable data source, prone to bias

---

## Summary

### Resolved Items

✅ **SLIP-44 Registry**: Use SatoshiLabs GitHub as authoritative source, embed static data in Go code

✅ **Address Formatters**: Hybrid approach
- Reuse existing: Bitcoin (5+ variants), Ethereum (5+ EVM chains)
- Add new: XRP, Stellar, Solana, TRON (medium effort)
- Defer high-effort: Cardano, Polkadot, Monero (Phase 3)

✅ **Market Cap Ranking**: CoinGecko API for one-time snapshot, embed as static data sorted by market cap

### Implementation Path

**Phase 1** (MVP - 10 coins, ~3 days):
- Extend Bitcoin formatter for LTC, DOGE, BCH
- Reuse Ethereum formatter for MATIC, BNB, AVAX, ETC
- Implement XRP formatter

**Phase 2** (20 coins, ~4 days):
- Implement Stellar, TRON, Solana formatters
- Add 5 more Bitcoin/Ethereum-compatible coins

**Phase 3** (30+ coins, ~5 days):
- Implement Cardano, Polkadot, Monero formatters
- Expand to 30-50 total

**Total Estimated Effort**: 12-15 days (including testing, integration)

### Dependencies

**Required Libraries**:
- `btcsuite/btcutil` - ✅ Already used (Bitcoin, Litecoin, Dogecoin, Dash)
- `github.com/ethereum/go-ethereum/crypto` - ✅ Already used (Ethereum, all EVM chains)
- `github.com/stellar/go` - NEW (Stellar)
- `github.com/gagliardetto/solana-go` - NEW (Solana)
- Custom implementations for XRP, TRON (Base58Check variants)

**Optional** (for Phase 3):
- `github.com/echovl/cardano-go` - Cardano
- `github.com/ChainSafe/gossamer` - Polkadot
- `github.com/modood/xmrkeygen` - Monero

---

## Next Steps

1. Proceed to **Phase 1: Design** (`data-model.md`, `contracts/`, `quickstart.md`)
2. Define entity schemas for `AddressBook`, `CoinMetadata`, `DerivedAddress`
3. Design CLI command interfaces for `list-addresses`, `get-address`
4. Create quickstart guide with TDD workflow for implementing coin formatters

**Note**: All constitutional requirements remain satisfied (offline-capable, no network dependencies for address generation, only one-time developer setup uses CoinGecko API).
