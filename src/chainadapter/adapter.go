// Package chainadapter defines the unified interface for cross-chain transaction operations.
// This file contains the core ChainAdapter interface that all blockchain-specific implementations
// (Bitcoin, Ethereum, etc.) MUST implement.
package chainadapter

import (
	"context"
	"math/big"
	"time"
)

// ChainAdapter is the unified interface for cross-chain transaction operations.
// All blockchain-specific implementations (Bitcoin, Ethereum, etc.) MUST implement this interface.
//
// Contract Guarantees:
// - All methods are idempotent (safe to retry)
// - All methods return ChainError for error classification
// - Context cancellation is respected (operations abort within 100ms)
// - Thread-safe: Multiple goroutines can call methods concurrently
type ChainAdapter interface {
	// ChainID returns the unique identifier for this blockchain (e.g., "bitcoin", "ethereum")
	ChainID() string

	// Capabilities returns the feature flags supported by this chain adapter
	Capabilities() *Capabilities

	// Build constructs an unsigned transaction from a standardized request.
	//
	// Contract:
	// - MUST validate all fields in TransactionRequest
	// - MUST return NonRetryable error for invalid addresses or amounts
	// - MUST populate UnsignedTransaction.SigningPayload for offline signing
	// - MUST be deterministic (same request → same unsigned tx)
	// - Bitcoin: MUST select UTXOs and create PSBT
	// - Ethereum: MUST query current nonce and estimate gas
	//
	// Errors:
	// - NonRetryable: Invalid address format, unsupported asset, zero amount
	// - Retryable: RPC timeout, network unavailable
	Build(ctx context.Context, req *TransactionRequest) (*UnsignedTransaction, error)

	// Estimate calculates fee estimates with confidence bounds.
	//
	// Contract:
	// - MUST be idempotent (can call multiple times safely)
	// - MUST return MinFee ≤ Recommended ≤ MaxFee
	// - MUST include confidence indicator (0-100%)
	// - SHOULD complete within 2 seconds
	// - Bitcoin: MUST use estimatesmartfee + mempool analysis
	// - Ethereum: MUST use EIP-1559 baseFee + feeHistory
	//
	// Errors:
	// - Retryable: RPC timeout, insufficient data
	// - NonRetryable: Unsupported asset
	Estimate(ctx context.Context, req *TransactionRequest) (*FeeEstimate, error)

	// Sign signs an unsigned transaction using the provided signer.
	//
	// Contract:
	// - MUST validate Signer.GetAddress() == UnsignedTransaction.From
	// - MUST verify signature against SigningPayload before returning
	// - MUST preserve UnsignedTransaction in SignedTransaction for audit
	// - MUST NOT leak private key material
	// - MUST support offline signing (no RPC calls required)
	//
	// Errors:
	// - NonRetryable: Invalid signature, address mismatch
	// - UserIntervention: Hardware wallet timeout, user rejected
	Sign(ctx context.Context, unsigned *UnsignedTransaction, signer Signer) (*SignedTransaction, error)

	// Broadcast submits a signed transaction to the blockchain network.
	//
	// Contract:
	// - MUST be idempotent (broadcasting same tx multiple times returns same hash)
	// - MUST check TransactionStateStore before RPC submission
	// - MUST increment retry count in state store
	// - MUST try all configured RPC endpoints with failover
	// - MUST return BroadcastReceipt with TxHash on success
	// - Bitcoin: MUST use sendrawtransaction
	// - Ethereum: MUST use eth_sendRawTransaction
	//
	// Errors:
	// - Retryable: RPC timeout, network congestion (nonce too low)
	// - NonRetryable: Invalid transaction format, insufficient funds
	// - UserIntervention: Fee too low, replace-by-fee required
	Broadcast(ctx context.Context, signed *SignedTransaction) (*BroadcastReceipt, error)

	// QueryStatus retrieves the current status of a transaction by hash.
	//
	// Contract:
	// - MUST return TransactionStatus with current confirmations
	// - MUST use HTTP RPC (not WebSocket)
	// - Bitcoin: MUST use getrawtransaction verbose=true
	// - Ethereum: MUST use eth_getTransactionByHash + eth_getTransactionReceipt
	//
	// Errors:
	// - Retryable: RPC timeout
	// - NonRetryable: Transaction not found (after reasonable retry period)
	QueryStatus(ctx context.Context, txHash string) (*TransactionStatus, error)

	// SubscribeStatus returns a channel that streams real-time transaction status updates.
	//
	// Contract:
	// - MUST use WebSocket RPC if available, fallback to HTTP polling
	// - MUST send initial status immediately, then updates on state change
	// - MUST close channel when context is cancelled
	// - MUST implement automatic reconnection with exponential backoff
	// - Channel sends: Pending → Confirmed (1+) → Finalized (6+ BTC, 12+ ETH)
	//
	// Errors:
	// - Retryable: WebSocket connection failed (fallback to HTTP polling)
	// - NonRetryable: Transaction not found
	SubscribeStatus(ctx context.Context, txHash string) (<-chan *TransactionStatus, error)
}

// TransactionRequest represents a chain-agnostic transaction description
type TransactionRequest struct {
	From      string   // Source address
	To        string   // Destination address
	Asset     string   // Asset identifier ("BTC", "ETH", "USDC")
	Amount    *big.Int // Amount in smallest unit (satoshi, wei)
	Memo      string   // Optional memo (Bitcoin OP_RETURN, Ethereum data field)
	MaxFee    *big.Int // Optional maximum acceptable fee
	ConfirmBy *time.Time
	FeeSpeed  FeeSpeed // "slow", "normal", "fast"

	// Chain-specific extensions (e.g., {"gas_limit": 21000})
	ChainSpecific map[string]interface{}
}

type FeeSpeed string

const (
	FeeSpeedSlow   FeeSpeed = "slow"
	FeeSpeedNormal FeeSpeed = "normal"
	FeeSpeedFast   FeeSpeed = "fast"
)

// UnsignedTransaction represents a transaction ready for signing
type UnsignedTransaction struct {
	ID             string   // Deterministic transaction ID
	ChainID        string   // Blockchain identifier
	From           string   // Source address
	To             string   // Destination address
	Amount         *big.Int // Amount in smallest unit
	Fee            *big.Int // Calculated fee
	Nonce          *uint64  // Account nonce (Ethereum) or nil (Bitcoin UTXO)
	SigningPayload []byte   // Binary payload for signing
	HumanReadable  string   // Human-readable representation
	ChainSpecific  map[string]interface{}
	CreatedAt      time.Time
}

// FeeEstimate contains fee bounds and confidence level
type FeeEstimate struct {
	ChainID         string
	Timestamp       time.Time
	MinFee          *big.Int // Minimum fee (may be slow)
	MaxFee          *big.Int // Maximum fee (guaranteed fast)
	Recommended     *big.Int // Recommended fee
	Confidence      int      // 0-100%
	Reason          string   // Explanation for confidence level
	EstimatedBlocks int      // Expected blocks until confirmation
	BaseFee         *big.Int // Ethereum EIP-1559 base fee (optional)
}

// SignedTransaction represents a transaction ready for broadcast
type SignedTransaction struct {
	UnsignedTx   *UnsignedTransaction
	Signature    []byte    // Signature bytes
	SignedBy     string    // Signing address
	TxHash       string    // Transaction hash
	SerializedTx []byte    // Fully serialized transaction
	SignedAt     time.Time
}

// BroadcastReceipt is the receipt of transaction submission
type BroadcastReceipt struct {
	TxHash        string
	ChainID       string
	SubmittedAt   time.Time
	RPCEndpoint   string
	StatusURL     string
	InitialStatus *TransactionStatus
}

// TransactionStatus represents the current state of a transaction
type TransactionStatus struct {
	TxHash        string
	Status        TxStatus
	Confirmations int
	BlockNumber   *uint64
	BlockHash     *string
	UpdatedAt     time.Time
	Error         *ChainError
}

type TxStatus string

const (
	TxStatusPending   TxStatus = "pending"
	TxStatusConfirmed TxStatus = "confirmed"
	TxStatusFinalized TxStatus = "finalized"
	TxStatusFailed    TxStatus = "failed"
)

// Capabilities defines supported features for a chain adapter
type Capabilities struct {
	ChainID               string
	InterfaceVersion      string // Semver (e.g., "1.0.0")
	SupportsEIP1559       bool
	SupportsMemo          bool
	SupportsMultiSig      bool
	SupportsFeeDelegation bool
	SupportsWebSocket     bool
	SupportsRBF           bool // Replace-by-fee
	MaxMemoLength         int
	MinConfirmations      int // Recommended minimum for finality
}
