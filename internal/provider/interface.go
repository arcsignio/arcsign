// Package provider defines the blockchain data provider abstraction.
// This package enables flexible data source configuration (Alchemy, Infura, QuickNode, etc.)
// while maintaining a unified interface for ChainAdapter implementations.
package provider

import (
	"context"
	"math/big"
)

// BlockchainProvider abstracts blockchain data access from various service providers.
// This interface is designed to be provider-agnostic, allowing ChainAdapter to work
// with different data sources (Alchemy, Infura, QuickNode, self-hosted nodes, etc.).
//
// Contract Guarantees:
// - All methods are thread-safe
// - Context cancellation is respected
// - Idempotent operations (safe to retry)
// - Returns ProviderError for error classification
type BlockchainProvider interface {
	// ProviderName returns the name of this provider (e.g., "alchemy", "infura")
	ProviderName() string

	// SupportedChains returns the list of chain IDs this provider supports
	SupportedChains() []string

	// --- Account & Balance Operations ---

	// GetBalance retrieves the native token balance for an address
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier (e.g., "ethereum", "bitcoin")
	// - address: Account address
	//
	// Returns:
	// - Balance in smallest unit (wei for ETH, satoshi for BTC)
	// - Error if query fails
	GetBalance(ctx context.Context, chainID, address string) (*big.Int, error)

	// GetTokenBalance retrieves ERC-20 token balance for an address
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - address: Account address
	// - tokenContract: Token contract address
	//
	// Returns:
	// - Token balance in smallest unit
	// - Error if query fails or chain doesn't support tokens
	GetTokenBalance(ctx context.Context, chainID, address, tokenContract string) (*big.Int, error)

	// GetTransactionCount retrieves the nonce for an address (account-based chains only)
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - address: Account address
	//
	// Returns:
	// - Current nonce value
	// - Error if query fails or chain doesn't use nonces
	GetTransactionCount(ctx context.Context, chainID, address string) (uint64, error)

	// --- Fee Estimation ---

	// EstimateGas estimates the gas required for a transaction (EVM chains)
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - from: Sender address
	// - to: Recipient address
	// - value: Transfer amount (wei)
	// - data: Transaction data (contract call)
	//
	// Returns:
	// - Estimated gas limit
	// - Error if estimation fails
	EstimateGas(ctx context.Context, chainID, from, to string, value *big.Int, data []byte) (uint64, error)

	// GetBaseFee retrieves the current base fee per gas (EIP-1559 chains)
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	//
	// Returns:
	// - Current base fee in wei
	// - Error if query fails or chain doesn't support EIP-1559
	GetBaseFee(ctx context.Context, chainID string) (*big.Int, error)

	// GetFeeHistory retrieves historical fee data for priority fee estimation
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - blockCount: Number of recent blocks to analyze
	//
	// Returns:
	// - Recommended priority fee per gas (wei)
	// - Error if query fails
	GetFeeHistory(ctx context.Context, chainID string, blockCount int) (*big.Int, error)

	// EstimateBitcoinFee estimates the fee rate for Bitcoin transactions
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier (must be Bitcoin variant)
	// - targetBlocks: Desired confirmation time in blocks
	//
	// Returns:
	// - Fee rate in satoshis per byte
	// - Error if estimation fails or chain is not Bitcoin
	EstimateBitcoinFee(ctx context.Context, chainID string, targetBlocks int) (int64, error)

	// --- Transaction Operations ---

	// SendRawTransaction broadcasts a signed raw transaction
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - rawTx: Hex-encoded signed transaction
	//
	// Returns:
	// - Transaction hash
	// - Error if broadcast fails
	SendRawTransaction(ctx context.Context, chainID, rawTx string) (string, error)

	// GetTransactionByHash retrieves transaction details by hash
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - txHash: Transaction hash
	//
	// Returns:
	// - Transaction details (provider-specific format)
	// - Error if transaction not found
	GetTransactionByHash(ctx context.Context, chainID, txHash string) (*TransactionInfo, error)

	// GetTransactionReceipt retrieves transaction receipt (EVM chains)
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - txHash: Transaction hash
	//
	// Returns:
	// - Transaction receipt (includes status, gas used, logs)
	// - Error if receipt not available or chain doesn't support receipts
	GetTransactionReceipt(ctx context.Context, chainID, txHash string) (*TransactionReceipt, error)

	// --- Block & Network Info ---

	// GetBlockNumber retrieves the latest block number
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	//
	// Returns:
	// - Latest block number
	// - Error if query fails
	GetBlockNumber(ctx context.Context, chainID string) (uint64, error)

	// GetBlock retrieves block details by hash or number
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - blockIdentifier: Block hash or number (as string)
	//
	// Returns:
	// - Block details
	// - Error if block not found
	GetBlock(ctx context.Context, chainID, blockIdentifier string) (*BlockInfo, error)

	// --- UTXO Operations (Bitcoin-specific) ---

	// ListUnspent retrieves unspent transaction outputs for an address
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier (must be UTXO-based chain)
	// - address: Bitcoin address
	//
	// Returns:
	// - List of UTXOs
	// - Error if query fails or chain doesn't use UTXOs
	ListUnspent(ctx context.Context, chainID, address string) ([]*UTXO, error)

	// GetRawTransaction retrieves raw transaction data (Bitcoin)
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - chainID: Chain identifier
	// - txHash: Transaction hash
	// - verbose: If true, return decoded transaction
	//
	// Returns:
	// - Raw transaction data or decoded transaction
	// - Error if transaction not found
	GetRawTransaction(ctx context.Context, chainID, txHash string, verbose bool) (*BitcoinTransaction, error)

	// --- Health & Diagnostics ---

	// HealthCheck verifies provider connectivity and API key validity
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	//
	// Returns:
	// - Error if provider is unhealthy or API key is invalid
	HealthCheck(ctx context.Context) error

	// Close releases provider resources
	Close() error
}

// TransactionInfo represents generic transaction information
type TransactionInfo struct {
	Hash        string
	From        string
	To          string
	Value       *big.Int
	BlockNumber *uint64
	BlockHash   *string
	Status      string // "pending", "confirmed", "failed"
	Nonce       *uint64
	GasPrice    *big.Int
	GasLimit    *uint64
	Data        []byte
}

// TransactionReceipt represents EVM transaction receipt
type TransactionReceipt struct {
	TxHash          string
	BlockNumber     string
	BlockHash       string
	Status          string   // "0x1" success, "0x0" failed
	GasUsed         string
	CumulativeGasUsed string
	Logs            []Log
	ContractAddress *string
}

// Log represents an EVM event log
type Log struct {
	Address string
	Topics  []string
	Data    string
}

// BlockInfo represents generic block information
type BlockInfo struct {
	Number       uint64
	Hash         string
	ParentHash   string
	Timestamp    uint64
	Transactions []string // Transaction hashes
}

// UTXO represents an unspent transaction output (Bitcoin)
type UTXO struct {
	TxID         string
	Vout         uint32
	Address      string
	ScriptPubKey string
	Amount       int64 // satoshis
	Confirmations int
}

// BitcoinTransaction represents a Bitcoin transaction
type BitcoinTransaction struct {
	TxID          string
	Hash          string
	Version       int
	Size          int
	Vsize         int
	Weight        int
	Locktime      uint32
	Vin           []BitcoinInput
	Vout          []BitcoinOutput
	BlockHash     string
	Confirmations int
	Time          int64
	Blocktime     int64
}

// BitcoinInput represents a Bitcoin transaction input
type BitcoinInput struct {
	TxID      string
	Vout      uint32
	ScriptSig ScriptSig
	Sequence  uint32
	Witness   []string
}

// ScriptSig represents a Bitcoin script signature
type ScriptSig struct {
	Asm string
	Hex string
}

// BitcoinOutput represents a Bitcoin transaction output
type BitcoinOutput struct {
	Value        float64
	N            uint32
	ScriptPubKey ScriptPubKey
}

// ScriptPubKey represents a Bitcoin script public key
type ScriptPubKey struct {
	Asm       string
	Hex       string
	ReqSigs   int
	Type      string
	Addresses []string
}

// ProviderError represents provider-specific errors
type ProviderError struct {
	Code       string // Error code (e.g., "RATE_LIMIT", "INVALID_API_KEY")
	Message    string // Human-readable error message
	Provider   string // Provider name
	Retryable  bool   // Whether this error is retryable
	Underlying error  // Underlying error
}

func (e *ProviderError) Error() string {
	return e.Message
}

// NewProviderError creates a new ProviderError
func NewProviderError(code, message, provider string, retryable bool, underlying error) *ProviderError {
	return &ProviderError{
		Code:       code,
		Message:    message,
		Provider:   provider,
		Retryable:  retryable,
		Underlying: underlying,
	}
}
