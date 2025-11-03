// Package ethereum implements ChainAdapter for Ethereum blockchain (account-based)
package ethereum

import (
	"context"
	"math/big"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
)

// EthereumAdapter implements ChainAdapter for Ethereum blockchain.
type EthereumAdapter struct {
	rpcClient rpc.RPCClient
	txStore   storage.TransactionStateStore
	chainID   string   // "ethereum", "ethereum-goerli", "ethereum-sepolia"
	networkID int64    // Network ID (1 for mainnet, 5 for goerli, etc.)
	builder   *TransactionBuilder
	rpcHelper *RPCHelper
}

// NewEthereumAdapter creates a new Ethereum ChainAdapter.
//
// Parameters:
// - rpcClient: RPC client for communicating with Ethereum node
// - txStore: Transaction state store for broadcast idempotency
// - networkID: Ethereum network ID (1 for mainnet, 5 for goerli, 11155111 for sepolia)
func NewEthereumAdapter(rpcClient rpc.RPCClient, txStore storage.TransactionStateStore, networkID int64) (*EthereumAdapter, error) {
	chainID := "ethereum"
	if networkID == 5 {
		chainID = "ethereum-goerli"
	} else if networkID == 11155111 {
		chainID = "ethereum-sepolia"
	}

	// Create transaction builder
	builder := NewTransactionBuilder(networkID)

	return &EthereumAdapter{
		rpcClient: rpcClient,
		txStore:   txStore,
		chainID:   chainID,
		networkID: networkID,
		builder:   builder,
		rpcHelper: NewRPCHelper(rpcClient),
	}, nil
}

// ChainID returns the unique identifier for Ethereum blockchain.
func (e *EthereumAdapter) ChainID() string {
	return e.chainID
}

// Capabilities returns the feature flags supported by Ethereum adapter.
func (e *EthereumAdapter) Capabilities() *chainadapter.Capabilities {
	return &chainadapter.Capabilities{
		ChainID:               e.chainID,
		InterfaceVersion:      "1.0.0",
		SupportsEIP1559:       true,  // Ethereum supports EIP-1559 (post-London fork)
		SupportsMemo:          true,  // Ethereum supports data field
		SupportsMultiSig:      true,  // Ethereum supports multi-sig via smart contracts
		SupportsFeeDelegation: true,  // Ethereum supports meta-transactions (EIP-2771)
		SupportsWebSocket:     true,  // Ethereum nodes support WebSocket
		SupportsRBF:           false, // Ethereum doesn't support RBF (uses nonce replacement)
		MaxMemoLength:         0,     // No hard limit (limited by gas)
		MinConfirmations:      12,    // Ethereum recommended minimum for finality
	}
}

// Build constructs an unsigned Ethereum transaction from a standardized request.
//
// Contract:
// - MUST validate all fields in TransactionRequest
// - MUST return NonRetryable error for invalid addresses or amounts
// - MUST populate UnsignedTransaction.SigningPayload for offline signing
// - MUST be deterministic (same request → same unsigned tx)
// - MUST query current nonce and estimate gas
func (e *EthereumAdapter) Build(ctx context.Context, req *chainadapter.TransactionRequest) (*chainadapter.UnsignedTransaction, error) {
	// Step 1: Get nonce for the from address
	nonce, err := e.rpcHelper.GetTransactionCount(ctx, req.From)
	if err != nil {
		return nil, err
	}

	// Step 2: Estimate gas for the transaction
	var data []byte
	if req.Memo != "" {
		data = []byte(req.Memo)
	}

	gasLimit, err := e.rpcHelper.EstimateGas(ctx, req.From, req.To, req.Amount, data)
	if err != nil {
		// Use default gas limit if estimation fails
		gasLimit = 21000 // Standard ETH transfer
	}

	// Add 10% buffer to gas estimate
	gasLimit = gasLimit * 110 / 100

	// Step 3: Get EIP-1559 fee parameters
	baseFee, err := e.rpcHelper.GetBaseFee(ctx)
	if err != nil {
		// Fallback to default base fee
		baseFee = big.NewInt(30e9) // 30 Gwei
	}

	priorityFee, err := e.rpcHelper.GetFeeHistory(ctx, 10)
	if err != nil {
		// Fallback to default priority fee
		priorityFee = big.NewInt(2e9) // 2 Gwei
	}

	// Calculate maxFeePerGas based on FeeSpeed
	var multiplier int64
	switch req.FeeSpeed {
	case chainadapter.FeeSpeedFast:
		multiplier = 3 // 3x base fee
	case chainadapter.FeeSpeedNormal:
		multiplier = 2 // 2x base fee
	case chainadapter.FeeSpeedSlow:
		multiplier = 1 // 1x base fee + buffer
	default:
		multiplier = 2
	}

	maxFeePerGas := new(big.Int).Mul(baseFee, big.NewInt(multiplier))
	maxFeePerGas.Add(maxFeePerGas, priorityFee)

	maxPriorityFeePerGas := priorityFee

	// Adjust priority fee based on speed
	if req.FeeSpeed == chainadapter.FeeSpeedFast {
		maxPriorityFeePerGas = new(big.Int).Mul(priorityFee, big.NewInt(2))
	}

	// Step 4: Build the unsigned transaction
	unsigned, err := e.builder.Build(
		ctx,
		req,
		nonce,
		gasLimit,
		maxFeePerGas,
		maxPriorityFeePerGas,
	)
	if err != nil {
		return nil, err
	}

	// Step 5: Set the correct chainID
	unsigned.ChainID = e.chainID

	return unsigned, nil
}

// Estimate calculates fee estimates with confidence bounds for Ethereum.
//
// Contract:
// - MUST be idempotent (can call multiple times safely)
// - MUST return MinFee ≤ Recommended ≤ MaxFee
// - MUST include confidence indicator (0-100%)
// - SHOULD complete within 2 seconds
// - MUST use EIP-1559 baseFee + eth_feeHistory
func (e *EthereumAdapter) Estimate(ctx context.Context, req *chainadapter.TransactionRequest) (*chainadapter.FeeEstimate, error) {
	// TODO: Implement in T046
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Ethereum Estimate() not yet implemented",
		nil,
	)
}

// Sign signs an unsigned Ethereum transaction using the provided signer.
func (e *EthereumAdapter) Sign(ctx context.Context, unsigned *chainadapter.UnsignedTransaction, signer chainadapter.Signer) (*chainadapter.SignedTransaction, error) {
	// TODO: Implement in T060
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Ethereum Sign() not yet implemented",
		nil,
	)
}

// Broadcast submits a signed Ethereum transaction to the blockchain network.
func (e *EthereumAdapter) Broadcast(ctx context.Context, signed *chainadapter.SignedTransaction) (*chainadapter.BroadcastReceipt, error) {
	// TODO: Implement in T064
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Ethereum Broadcast() not yet implemented",
		nil,
	)
}

// Derive generates an Ethereum address from a key source and derivation path.
func (e *EthereumAdapter) Derive(ctx context.Context, keySource chainadapter.KeySource, path string) (*chainadapter.Address, error) {
	// TODO: Implement in T083
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Ethereum Derive() not yet implemented",
		nil,
	)
}

// QueryStatus retrieves the current status of an Ethereum transaction by hash.
func (e *EthereumAdapter) QueryStatus(ctx context.Context, txHash string) (*chainadapter.TransactionStatus, error) {
	// TODO: Implement in T068
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Ethereum QueryStatus() not yet implemented",
		nil,
	)
}

// SubscribeStatus returns a channel that streams real-time Ethereum transaction status updates.
func (e *EthereumAdapter) SubscribeStatus(ctx context.Context, txHash string) (<-chan *chainadapter.TransactionStatus, error) {
	// TODO: Implement in T069
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Ethereum SubscribeStatus() not yet implemented",
		nil,
	)
}
