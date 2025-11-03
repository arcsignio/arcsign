# Research: ChainAdapter Cross-Chain Transaction Interface

**Feature**: 006-chain-adapter
**Date**: 2025-11-03
**Status**: Phase 0 Complete

## Overview

This document consolidates research findings for implementing a unified cross-chain transaction interface supporting Bitcoin (UTXO-based) and Ethereum (account-based with EIP-1559). Research covers Go library selection, RPC communication patterns, state storage strategies, and testing approaches.

---

## 1. Go Bitcoin Libraries

### Decision: btcsuite/btcd + btcutil

**Chosen Libraries**:
- `github.com/btcsuite/btcd` - Bitcoin protocol implementation in Go
- `github.com/btcsuite/btcd/btcutil` - Bitcoin utility functions
- `github.com/btcsuite/btcd/btcutil/psbt` - PSBT (Partially Signed Bitcoin Transactions) support
- `github.com/btcsuite/btcd/chaincfg` - Chain configuration (mainnet, testnet, regtest)

**Rationale**:
- **Industry Standard**: btcsuite is the de facto Go Bitcoin library, maintained by the Lightning Network team
- **PSBT Support**: Native support for BIP 174 (Partially Signed Bitcoin Transactions), essential for hardware wallet integration and offline signing
- **P2WPKH**: Built-in support for SegWit addresses (bech32 encoding)
- **Well-Tested**: Production-proven in Lightning Network implementations (lnd)
- **Active Maintenance**: Regular updates and security patches

**Alternatives Considered**:
1. **go-bitcoin** - Less mature, smaller community
2. **Custom Implementation** - High security risk, not justified for standard Bitcoin operations
3. **C bindings (libbitcoin)** - CGO complexity, cross-compilation difficulties

**Implementation Notes**:
- Use `btcutil.NewAddressWitnessPubKeyHash()` for P2WPKH address generation
- Use `psbt.New()` for creating unsigned transactions
- Chain parameters via `chaincfg.MainNetParams`, `chaincfg.TestNet3Params`

---

## 2. Go Ethereum Libraries

### Decision: go-ethereum (geth)

**Chosen Library**:
- `github.com/ethereum/go-ethereum` (geth official client library)

**Rationale**:
- **Official Implementation**: Maintained by Ethereum Foundation
- **EIP-1559 Support**: Native support for London hard fork fee market (base fee + priority fee)
- **Comprehensive**: Covers RLP encoding, transaction signing, address checksumming, ABI encoding
- **JSON-RPC Client**: Built-in HTTP/WebSocket RPC client with subscription support
- **Production Battle-Tested**: Powers majority of Ethereum infrastructure

**Alternatives Considered**:
1. **ethclient-go** - Lightweight but missing advanced features (EIP-1559, subscriptions)
2. **web3.go** - Less mature, incomplete EIP support
3. **Custom RLP/Signing** - Reinventing the wheel, high risk of subtle bugs

**Implementation Notes**:
- Use `crypto.PubkeyToAddress()` for address derivation from ECDSA public key
- Use `types.NewTx()` with `types.DynamicFeeTx` for EIP-1559 transactions
- Use `ethclient.DialContext()` for HTTP, `ethclient.Dial()` for WebSocket
- Use `common.HexToAddress()` with EIP-55 checksum validation

---

## 3. BIP39/BIP44 Key Derivation

### Decision: tyler-smith/go-bip39 + btcsuite/btcd/hdkeychain

**Chosen Libraries**:
- `github.com/tyler-smith/go-bip39` - BIP39 mnemonic generation/validation
- `github.com/btcsuite/btcd/btcutil/hdkeychain` - BIP32/BIP44 hierarchical deterministic key derivation

**Rationale**:
- **BIP39 Standard Compliance**: go-bip39 implements official BIP39 word lists (English, Chinese, etc.)
- **BIP44 Derivation**: hdkeychain supports BIP32 extended keys and BIP44 derivation paths (m/44'/coin'/account'/change/index)
- **Cross-Chain**: Same mnemonic → multiple chains via different coin type indices (BTC: 0, ETH: 60)
- **Hardware Wallet Compatibility**: Produces same addresses as Ledger/Trezor for equivalent paths

**Alternatives Considered**:
1. **go-ethereum/accounts/hd** - Ethereum-only, no Bitcoin support
2. **Custom Derivation** - Extreme security risk, cryptographic complexity

**Implementation Notes**:
```go
// Derive Bitcoin address: m/44'/0'/0'/0/0
masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 0) // BTC
// ... continue derivation

// Derive Ethereum address: m/44'/60'/0'/0/0
// Same process but coinType = HardenedKeyStart + 60
```

**SLIP-44 Coin Types**:
- Bitcoin: 0
- Ethereum: 60
- (Future: Cosmos: 118, Solana: 501)

---

## 4. WebSocket Libraries for Go

### Decision: gorilla/websocket

**Chosen Library**:
- `github.com/gorilla/websocket`

**Rationale**:
- **Industry Standard**: Most widely used Go WebSocket library (10k+ stars)
- **RFC 6455 Compliant**: Full WebSocket protocol implementation
- **Production-Proven**: Used by major Go projects (Kubernetes, Docker, etc.)
- **Automatic Reconnection**: Easy to implement exponential backoff with `Dialer` and connection pooling
- **Ping/Pong Support**: Built-in keep-alive mechanism

**Alternatives Considered**:
1. **golang.org/x/net/websocket** - Deprecated, lacks features
2. **nhooyr.io/websocket** - Newer but less battle-tested
3. **Standard library net/http** - Requires manual WebSocket handshake

**Implementation Notes**:
```go
dialer := websocket.Dialer{
    HandshakeTimeout: 10 * time.Second,
}
conn, _, err := dialer.Dial(url, nil)
// Implement reconnection with exponential backoff: 1s, 2s, 4s, 8s, max 32s
```

---

## 5. RPC Failover Strategy

### Decision: Round-Robin with Circuit Breaker

**Pattern**: Round-robin endpoint selection + circuit breaker per endpoint

**Rationale**:
- **Simple**: No complex load balancing algorithms needed
- **Fast Failover**: Circuit breaker detects failures quickly (3 consecutive errors → open circuit for 30s)
- **Fair Distribution**: Round-robin ensures even load across healthy endpoints
- **Self-Healing**: Circuit breaker half-open state allows automatic recovery

**Implementation**:
```go
type EndpointHealth struct {
    URL            string
    FailureCount   int
    LastFailure    time.Time
    CircuitOpen    bool
    ResponseTimes  []time.Duration // Ring buffer for p95 calculation
}

// Select next healthy endpoint (skip if circuit open)
// On error: increment FailureCount, open circuit if >= 3
// On success: reset FailureCount, close circuit, record response time
```

**Alternatives Considered**:
1. **Weighted Round-Robin**: Overly complex for 2-3 RPC endpoints
2. **Least Connections**: Requires connection tracking, not suitable for stateless HTTP
3. **Random Selection**: Unfair distribution, potential thundering herd

---

## 6. Transaction State Storage

### Decision: In-Memory Map with Optional File Persistence

**Primary**: `sync.Map` for concurrent access
**Secondary**: Periodic JSON marshaling to file for persistence across restarts

**Rationale**:
- **No Database**: Aligns with constitution (USB-only storage, no external dependencies)
- **Fast Lookups**: O(1) transaction hash lookup for idempotency checks
- **Concurrent-Safe**: `sync.Map` provides lock-free concurrent access
- **Simple Persistence**: JSON marshaling to `~/.arcsign/tx_state.json` on shutdown or periodic flush

**Data Structure**:
```go
type TxState struct {
    TxHash      string
    RetryCount  int
    FirstSeen   time.Time
    LastRetry   time.Time
    Status      string // "pending", "broadcast", "confirmed"
}

// Storage interface
type TransactionStateStore interface {
    Get(txHash string) (*TxState, error)
    Set(txHash string, state *TxState) error
    Delete(txHash string) error
}
```

**Alternatives Considered**:
1. **SQLite**: Database dependency violates constitution
2. **BadgerDB**: Embedded DB still adds complexity and file locks
3. **Redis**: External service dependency, over-engineering

**TTL Strategy**: Remove entries older than 7 days or confirmed >24 hours ago

---

## 7. Fee Estimation Strategies

### Bitcoin Fee Estimation

**Method**: Combine `estimatesmartfee` RPC with mempool analysis

**Algorithm**:
1. Call `estimatesmartfee` with target blocks (1, 3, 6 for fast/normal/slow)
2. Query mempool for unconfirmed tx count and size
3. If mempool >100MB → increase estimate by 20-50%
4. Confidence based on `estimatesmartfee` response field

**Rationale**: Bitcoin Core's `estimatesmartfee` uses historical block data but may lag during sudden congestion. Mempool size provides real-time signal.

### Ethereum Fee Estimation

**Method**: EIP-1559 Base Fee + Priority Fee

**Algorithm**:
1. Get latest block's `baseFeePerGas`
2. Call `eth_feeHistory` for last 10 blocks to calculate priority fee percentiles
3. Fast: base fee × 1.2 + 90th percentile priority fee
4. Normal: base fee × 1.1 + 50th percentile priority fee
5. Slow: base fee + 10th percentile priority fee
6. Max fee = base fee × 2 (safety cap for next block base fee spike)

**Confidence**:
- High (>90%): Base fee stable (<10% variation in last 5 blocks)
- Medium (60-90%): Moderate volatility (10-30% variation)
- Low (<60%): High volatility (>30% variation) or pending major network event

---

## 8. Testing Strategy

### Unit Tests

**Scope**: Individual functions and methods
**Tools**: Go `testing` package + `github.com/stretchr/testify/assert`

**Coverage**:
- Core interface method contracts
- Error classification logic
- Fee calculation algorithms
- Address derivation paths

**Mocking**:
```go
type MockRPCClient struct {
    mock.Mock
}

func (m *MockRPCClient) Call(method string, params interface{}) (json.RawMessage, error) {
    args := m.Called(method, params)
    return args.Get(0).(json.RawMessage), args.Error(1)
}
```

### Integration Tests

**Scope**: Real RPC interactions with test networks
**Tools**: Docker containers for local Bitcoin/Ethereum nodes

**Setup**:
- Bitcoin: `btcd` in regtest mode
- Ethereum: `geth` with `--dev` flag
- Fund test addresses with faucet transactions

**Tests**:
- Build → Sign → Broadcast full cycle
- RPC failover (kill primary node mid-test)
- WebSocket reconnection

### Contract Tests

**Scope**: Verify adapter guarantees from specification
**Tools**: Table-driven tests

**Contracts**:
- Idempotency: Broadcasting same tx 10 times returns same hash
- Fee bounds: Estimated fees within 20% of actual
- Address derivation: Same mnemonic produces same addresses as reference wallets

---

## 9. Error Handling Patterns

### Error Classification

**Retryable**:
- Network timeouts (context.DeadlineExceeded)
- Connection refused (temporary RPC unavailability)
- HTTP 503 Service Unavailable
- Nonce too low (Ethereum - can be resolved by re-querying nonce)

**NonRetryable**:
- Invalid transaction format (malformed hex, wrong signature length)
- Insufficient funds (cannot be resolved without user action)
- Invalid address format
- Unsupported operation (e.g., memo on Bitcoin)

**UserIntervention**:
- Fee too low during congestion (user must approve higher fee)
- Hardware wallet timeout (user must physically interact with device)
- Multi-sig pending (waiting for co-signers)

**Implementation**:
```go
type ChainError struct {
    Code           string // "ERR_INSUFFICIENT_FUNDS", "ERR_RPC_TIMEOUT"
    Message        string
    Classification ErrorClassification
    RetryAfter     *time.Duration // For Retryable errors
}
```

---

## 10. Observability and Metrics

### Metrics to Track

**RPC Health**:
- `rpc_call_duration_seconds` (histogram, labels: chain, endpoint, method)
- `rpc_call_errors_total` (counter, labels: chain, endpoint, error_type)
- `rpc_failover_events_total` (counter, labels: chain, from_endpoint, to_endpoint)

**Chain Operations**:
- `tx_build_duration_seconds` (histogram, labels: chain)
- `tx_broadcast_retry_count` (histogram, labels: chain)
- `fee_estimate_confidence` (gauge, labels: chain, speed)

**WebSocket**:
- `websocket_connections_active` (gauge, labels: chain)
- `websocket_reconnections_total` (counter, labels: chain)
- `websocket_message_age_seconds` (histogram, labels: chain, subscription_type)

**Export Format**: Prometheus `/metrics` endpoint

---

## 11. Configuration Management

### Configuration Structure

```go
type ChainConfig struct {
    ChainID         string
    RPCEndpoints    []RPCEndpoint
    WSEndpoints     []string
    NetworkType     string // "mainnet", "testnet", "regtest"
    FeeLimits       FeeLimits
}

type RPCEndpoint struct {
    URL             string
    Priority        int    // 1 = primary, 2 = secondary, etc.
    Timeout         time.Duration
}

type FeeLimits struct {
    MinFeePerByte   int64 // Bitcoin: sat/byte, Ethereum: gwei
    MaxFeePerByte   int64
    DefaultGasLimit uint64 // Ethereum only
}
```

**Loading**: Environment variables > JSON config file > Defaults

**Example**:
```bash
export CHAINADAPTER_BITCOIN_RPC_1="https://btc-node-1.example.com"
export CHAINADAPTER_BITCOIN_RPC_2="https://btc-node-2.example.com"
export CHAINADAPTER_ETHEREUM_WS="wss://eth-ws.example.com"
```

---

## 12. Security Considerations

### Key Material Handling

**Principle**: Keys never touch ChainAdapter code directly

- **Derive**: Returns addresses only, never exposes private keys
- **Sign**: Accepts pre-built transactions + external signer interface
- **Hardware Wallets**: Signer interface delegates to hardware wallet libraries

### RPC Security

- **TLS Required**: All RPC endpoints must use HTTPS/WSS
- **No Credentials in Logs**: Redact API keys from error messages
- **Rate Limiting**: Implement client-side rate limiting (10 req/s per endpoint)

### Transaction Safety

- **Idempotency Check**: Always query state store before RPC submission
- **Sanity Checks**: Validate amounts, addresses, gas limits before signing
- **Audit Logging**: Log all broadcast attempts with tx hash, timestamp, result

---

## Summary

All technical decisions have been researched and documented. No NEEDS CLARIFICATION items remain. Key choices:

1. **Bitcoin**: btcsuite/btcd with PSBT support
2. **Ethereum**: Official go-ethereum library with EIP-1559
3. **Key Derivation**: tyler-smith/go-bip39 + hdkeychain
4. **WebSocket**: gorilla/websocket with reconnection
5. **RPC Failover**: Round-robin with circuit breaker
6. **Storage**: sync.Map with JSON file persistence
7. **Testing**: Unit (mocks) + Integration (Docker) + Contract (table-driven)

Proceed to **Phase 1: Data Model and Contracts**.
