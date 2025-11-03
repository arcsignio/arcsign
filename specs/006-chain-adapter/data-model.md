# Data Model: ChainAdapter

**Feature**: 006-chain-adapter
**Date**: 2025-11-03
**Phase**: 1 - Design

## Overview

This document defines all entities, types, and data structures for the ChainAdapter cross-chain transaction interface. The model supports Bitcoin (UTXO) and Ethereum (account-based) paradigms while maintaining chain-agnostic abstractions.

---

## Core Entities

### 1. ChainAdapter Interface

**Purpose**: Unified interface for all blockchain-specific adapters

**Interface Definition**:
```go
type ChainAdapter interface {
    // Metadata
    ChainID() string
    Capabilities() Capabilities

    // Transaction Lifecycle
    Build(ctx context.Context, req *TransactionRequest) (*UnsignedTransaction, error)
    Estimate(ctx context.Context, req *TransactionRequest) (*FeeEstimate, error)
    Sign(ctx context.Context, unsigned *UnsignedTransaction, signer Signer) (*SignedTransaction, error)
    Broadcast(ctx context.Context, signed *SignedTransaction) (*BroadcastReceipt, error)

    // Address Derivation
    Derive(ctx context.Context, keySource KeySource, path string) (*Address, error)

    // Monitoring
    QueryStatus(ctx context.Context, txHash string) (*TransactionStatus, error)
    SubscribeStatus(ctx context.Context, txHash string) (<-chan TransactionStatus, error)
}
```

**Relationships**:
- Implemented by: `BitcoinAdapter`, `EthereumAdapter`
- Uses: `RPCClient`, `TransactionStateStore`, `ChainMetrics`

---

### 2. TransactionRequest

**Purpose**: Chain-agnostic transaction description

**Fields**:
```go
type TransactionRequest struct {
    // Common Fields
    From         string            // Source address
    To           string            // Destination address
    Asset        string            // Asset identifier (e.g., "BTC", "ETH", "USDC")
    Amount       *big.Int          // Amount in smallest unit (satoshi, wei)
    Memo         string            // Optional memo/data field

    // Constraints
    MaxFee       *big.Int          // Maximum acceptable fee
    ConfirmBy    *time.Time        // Optional deadline for confirmation

    // Preferences
    FeeSpeed     FeeSpeed          // "slow", "normal", "fast"
    RBFEnabled   bool              // Replace-by-fee (Bitcoin only)

    // Chain-Specific Extensions
    ChainSpecific map[string]interface{} // e.g., Ethereum gas limit, Bitcoin UTXO selection
}

type FeeSpeed string

const (
    FeeSpeedSlow   FeeSpeed = "slow"
    FeeSpeedNormal FeeSpeed = "normal"
    FeeSpeedFast   FeeSpeed = "fast"
)
```

**Validation Rules**:
- `From` and `To` must be valid addresses for the target chain
- `Amount` must be positive
- `Asset` must be supported by the adapter
- `Memo` length must not exceed chain-specific limits (Bitcoin OP_RETURN: 80 bytes)

**Relationships**:
- Input to: `Build()`, `Estimate()`
- Validated by: Chain-specific adapters

---

### 3. UnsignedTransaction

**Purpose**: Chain-agnostic representation of an unsigned transaction

**Fields**:
```go
type UnsignedTransaction struct {
    ID              string            // Deterministic ID (hash of canonical form)
    ChainID         string            // "bitcoin", "ethereum"
    From            string            // Source address
    To              string            // Destination address
    Amount          *big.Int          // Amount in smallest unit
    Fee             *big.Int          // Calculated fee
    Nonce           *uint64           // Account nonce (Ethereum) or nil (Bitcoin UTXO)

    // Signing Payload
    SigningPayload  []byte            // Binary payload for signing
    HumanReadable   string            // Human-readable representation for audit

    // Reconstruction Data
    ChainSpecific   map[string]interface{} // Chain-specific fields for reconstruction
    CreatedAt       time.Time
}
```

**Reconstruction**:
- Bitcoin: `ChainSpecific` contains PSBT bytes, UTXOs, scripts
- Ethereum: `ChainSpecific` contains gas limit, chain ID, EIP-1559 parameters

**Relationships**:
- Output from: `Build()`
- Input to: `Sign()`

---

### 4. FeeEstimate

**Purpose**: Fee estimate with confidence bounds

**Fields**:
```go
type FeeEstimate struct {
    ChainID      string
    Timestamp    time.Time

    // Fee Bounds
    MinFee       *big.Int    // Minimum fee (may be slow)
    MaxFee       *big.Int    // Maximum fee (guaranteed fast)
    Recommended  *big.Int    // Recommended fee for normal speed

    // Confidence
    Confidence   int         // 0-100%
    Reason       string      // Explanation for confidence level

    // Additional Info
    EstimatedBlocks int      // Expected blocks until confirmation
    BaseFee         *big.Int // Ethereum EIP-1559 base fee (if applicable)
}
```

**Confidence Calculation**:
- High (>90%): Network stable, RPC responsive, historical data consistent
- Medium (60-90%): Moderate volatility or degraded RPC
- Low (<60%): High volatility, RPC failures, or insufficient data

**Relationships**:
- Output from: `Estimate()`
- Used by: UI/CLI for fee selection

---

### 5. SignedTransaction

**Purpose**: Signed transaction ready for broadcast

**Fields**:
```go
type SignedTransaction struct {
    UnsignedTx   *UnsignedTransaction  // Original unsigned tx
    Signature    []byte                // Signature bytes (format: chain-specific)
    SignedBy     string                // Signing address (for verification)
    TxHash       string                // Transaction hash (before broadcast)

    // Serialization
    SerializedTx []byte                // Fully serialized transaction (hex encoded)

    // Audit Trail
    SignedAt     time.Time
}
```

**Verification**:
- `SignedBy` must match `UnsignedTx.From`
- `Signature` must be valid for `UnsignedTx.SigningPayload`

**Relationships**:
- Output from: `Sign()`
- Input to: `Broadcast()`

---

### 6. BroadcastReceipt

**Purpose**: Receipt of transaction broadcast

**Fields**:
```go
type BroadcastReceipt struct {
    TxHash         string
    ChainID        string
    SubmittedAt    time.Time
    RPCEndpoint    string             // Which RPC was used

    // Status Query
    StatusURL      string             // URL for status query (if applicable)
    InitialStatus  TransactionStatus  // Status immediately after broadcast
}
```

**Relationships**:
- Output from: `Broadcast()`
- Contains: `TransactionStatus`

---

### 7. TransactionStatus

**Purpose**: Current status of a transaction

**Fields**:
```go
type TransactionStatus struct {
    TxHash         string
    Status         TxStatus
    Confirmations  int
    BlockNumber    *uint64            // Nil if pending
    BlockHash      *string            // Nil if pending
    UpdatedAt      time.Time

    // Failure Info
    Error          *ChainError        // If status == Failed
}

type TxStatus string

const (
    TxStatusPending   TxStatus = "pending"
    TxStatusConfirmed TxStatus = "confirmed"
    TxStatusFinalized TxStatus = "finalized"
    TxStatusFailed    TxStatus = "failed"
)
```

**State Transitions**:
- `Pending` → `Confirmed` (1+ confirmations)
- `Confirmed` → `Finalized` (6+ confirmations Bitcoin, 12+ Ethereum)
- `Pending` → `Failed` (rejected by mempool or chain)

**Relationships**:
- Output from: `QueryStatus()`, `SubscribeStatus()`
- Embedded in: `BroadcastReceipt`

---

### 8. Address

**Purpose**: Derived blockchain address

**Fields**:
```go
type Address struct {
    Address      string            // Chain-specific encoding
    ChainID      string
    DerivationPath string          // BIP44 path (e.g., m/44'/0'/0'/0/0)
    PublicKey    []byte            // Public key bytes
    Format       string            // "P2WPKH", "checksummed", etc.
}
```

**Format Examples**:
- Bitcoin P2WPKH: `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`
- Ethereum: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`

**Relationships**:
- Output from: `Derive()`

---

### 9. Capabilities

**Purpose**: Feature flags for chain adapter

**Fields**:
```go
type Capabilities struct {
    ChainID             string
    InterfaceVersion    string  // Semver (e.g., "1.0.0")

    // Features
    SupportsEIP1559     bool
    SupportsMemo        bool
    SupportsMultiSig    bool
    SupportsFeeDelegation bool
    SupportsWebSocket   bool
    SupportsRBF         bool    // Replace-by-fee

    // Limits
    MaxMemoLength       int
    MinConfirmations    int     // Recommended minimum for finality
}
```

**Usage**: UI/CLI queries capabilities to show/hide features

**Relationships**:
- Output from: `Capabilities()`

---

### 10. ErrorClassification

**Purpose**: Categorize errors for retry logic

**Fields**:
```go
type ChainError struct {
    Code           string          // "ERR_INSUFFICIENT_FUNDS", "ERR_RPC_TIMEOUT"
    Message        string          // Human-readable message
    Classification ErrorClassification
    RetryAfter     *time.Duration  // For retryable errors
    Cause          error           // Original error
}

type ErrorClassification int

const (
    Retryable        ErrorClassification = iota  // Temporary network issues
    NonRetryable                                 // Invalid tx, insufficient funds
    UserIntervention                             // Requires user action
)
```

**Classification Rules**:
- `Retryable`: Network timeouts, RPC unavailable, nonce conflicts
- `NonRetryable`: Invalid format, insufficient balance, unsupported operation
- `UserIntervention`: Fee too low, hardware wallet timeout, multi-sig pending

**Relationships**:
- Returned by: All adapter methods
- Used by: Retry logic, error handling

---

## Supporting Types

### 11. KeySource

**Purpose**: Abstraction for key material sources

**Interface**:
```go
type KeySource interface {
    Type() KeySourceType
    GetPublicKey(path string) ([]byte, error)
}

type KeySourceType string

const (
    KeySourceMnemonic      KeySourceType = "mnemonic"
    KeySourceXPub          KeySourceType = "xpub"
    KeySourceHardwareWallet KeySourceType = "hardware"
)
```

**Implementations**:
- `MnemonicKeySource`: BIP39 mnemonic + BIP44 derivation
- `XPubKeySource`: Extended public key
- `HardwareWalletKeySource`: Ledger/Trezor abstraction

---

### 12. Signer

**Purpose**: Abstract signing interface

**Interface**:
```go
type Signer interface {
    Sign(payload []byte, address string) ([]byte, error)
    GetAddress() string
}
```

**Implementations**:
- `LocalSigner`: In-memory private key (for testing)
- `HardwareWalletSigner`: Delegates to hardware device
- `RemoteSigner`: Signs via external service (e.g., KMS)

---

### 13. RPCClient

**Purpose**: Abstract RPC communication

**Interface**:
```go
type RPCClient interface {
    Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error)
    CallBatch(ctx context.Context, requests []RPCRequest) ([]json.RawMessage, error)
    Close() error
}

type RPCRequest struct {
    Method string
    Params interface{}
}
```

**Implementations**:
- `HTTPRPCClient`: HTTP JSON-RPC with failover
- `WebSocketRPCClient`: WebSocket with reconnection
- `MockRPCClient`: For testing

---

### 14. TransactionStateStore

**Purpose**: Persistent state for broadcast idempotency

**Interface**:
```go
type TransactionStateStore interface {
    Get(txHash string) (*TxState, error)
    Set(txHash string, state *TxState) error
    Delete(txHash string) error
    List() ([]*TxState, error)
}

type TxState struct {
    TxHash      string
    RetryCount  int
    FirstSeen   time.Time
    LastRetry   time.Time
    Status      TxStatus
}
```

**Implementations**:
- `MemoryTxStore`: In-memory `sync.Map`
- `FileTxStore`: JSON file persistence

---

### 15. ChainMetrics

**Purpose**: Observability metrics

**Interface**:
```go
type ChainMetrics interface {
    RecordRPCCall(chain, endpoint, method string, duration time.Duration, err error)
    RecordBroadcast(chain string, retryCount int, success bool)
    RecordWebSocketEvent(chain string, eventType string)
}
```

**Metrics**:
- RPC call duration histogram
- RPC error counter
- Broadcast retry counter
- WebSocket reconnection counter

---

## Data Flow Diagrams

### Transaction Build Flow

```
TransactionRequest
       ↓
  [Validate]
       ↓
  [Select UTXOs (BTC) / Get Nonce (ETH)]
       ↓
  [Calculate Fee]
       ↓
  [Build Unsigned Tx]
       ↓
UnsignedTransaction
```

### Sign & Broadcast Flow

```
UnsignedTransaction
       ↓
  [Extract Signing Payload]
       ↓
  [Call Signer]
       ↓
SignedTransaction
       ↓
  [Check TxStateStore for idempotency]
       ↓
  [Submit to RPC (with failover)]
       ↓
BroadcastReceipt
```

### Address Derivation Flow

```
KeySource + DerivationPath
       ↓
  [BIP32/BIP44 Derivation]
       ↓
  [Public Key]
       ↓
  [Chain-Specific Address Encoding]
       ↓
Address (P2WPKH / Checksummed)
```

---

## Validation Rules Summary

| Entity | Rule |
|--------|------|
| TransactionRequest | Amount > 0, valid addresses, supported asset |
| UnsignedTransaction | SigningPayload non-empty, Fee > 0 |
| SignedTransaction | Signature valid for SigningPayload, SignedBy == From |
| FeeEstimate | MinFee ≤ Recommended ≤ MaxFee, Confidence 0-100 |
| Address | Valid format for ChainID, DerivationPath follows BIP44 |
| BroadcastReceipt | TxHash non-empty, SubmittedAt ≤ now |

---

## Indexes and Queries

### TransactionStateStore Queries

- **Get by TxHash**: O(1) lookup for idempotency check
- **List by Status**: Filter pending/confirmed transactions
- **Cleanup**: Delete entries older than 7 days

### Metrics Queries

- **RPC Health**: Query per-endpoint response times (p50, p95, p99)
- **Chain Status**: Current broadcast retry rates, error rates
- **WebSocket Health**: Active connections, reconnection events

---

## Chain-Specific Extensions

### Bitcoin ChainSpecific Fields

```go
// In TransactionRequest.ChainSpecific
{
    "utxo_selection": "largest_first",  // or "smallest_first", "optimal"
    "rbf_enabled": true,
    "script_type": "P2WPKH"
}

// In UnsignedTransaction.ChainSpecific
{
    "psbt": "<base64_psbt>",
    "utxos": [{"txid": "...", "vout": 0, "amount": 50000}],
    "change_address": "bc1q..."
}
```

### Ethereum ChainSpecific Fields

```go
// In TransactionRequest.ChainSpecific
{
    "gas_limit": 21000,
    "data": "0x...",  // Contract call data
    "access_list": [...]  // EIP-2930
}

// In UnsignedTransaction.ChainSpecific
{
    "chain_id": 1,
    "max_fee_per_gas": "50000000000",
    "max_priority_fee_per_gas": "2000000000",
    "base_fee": "48000000000"
}
```

---

## Summary

Data model complete with 15 core entities covering:
- Transaction lifecycle (Request → Unsigned → Signed → Receipt → Status)
- Address derivation (KeySource → Address)
- Error handling (ChainError with classification)
- RPC abstraction (RPCClient interface)
- State management (TransactionStateStore)
- Observability (ChainMetrics)

All entities support dependency injection for testing. Chain-specific extensions are isolated in `ChainSpecific` maps.

**Next**: Generate API contracts in `contracts/` directory.
