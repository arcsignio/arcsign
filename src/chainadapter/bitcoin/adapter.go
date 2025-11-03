// Package bitcoin implements ChainAdapter for Bitcoin blockchain (UTXO-based)
package bitcoin

import (
	"context"
	"fmt"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
)

// BitcoinAdapter implements ChainAdapter for Bitcoin blockchain.
type BitcoinAdapter struct {
	rpcClient    rpc.RPCClient
	txStore      storage.TransactionStateStore
	chainID      string // "bitcoin", "bitcoin-testnet", "bitcoin-regtest"
	network      string // "mainnet", "testnet3", "regtest"
	builder      *TransactionBuilder
	rpcHelper    *RPCHelper
	feeEstimator *FeeEstimator
}

// NewBitcoinAdapter creates a new Bitcoin ChainAdapter.
//
// Parameters:
// - rpcClient: RPC client for communicating with Bitcoin node
// - txStore: Transaction state store for broadcast idempotency
// - network: Bitcoin network ("mainnet", "testnet3", "regtest")
func NewBitcoinAdapter(rpcClient rpc.RPCClient, txStore storage.TransactionStateStore, network string) (*BitcoinAdapter, error) {
	chainID := "bitcoin"
	if network == "testnet3" {
		chainID = "bitcoin-testnet"
	} else if network == "regtest" {
		chainID = "bitcoin-regtest"
	}

	// Create transaction builder
	builder, err := NewTransactionBuilder(network)
	if err != nil {
		return nil, fmt.Errorf("failed to create transaction builder: %w", err)
	}

	// Create RPC helper
	rpcHelper := NewRPCHelper(rpcClient)

	return &BitcoinAdapter{
		rpcClient:    rpcClient,
		txStore:      txStore,
		chainID:      chainID,
		network:      network,
		builder:      builder,
		rpcHelper:    rpcHelper,
		feeEstimator: NewFeeEstimator(rpcHelper, network),
	}, nil
}

// ChainID returns the unique identifier for Bitcoin blockchain.
func (b *BitcoinAdapter) ChainID() string {
	return b.chainID
}

// Capabilities returns the feature flags supported by Bitcoin adapter.
func (b *BitcoinAdapter) Capabilities() *chainadapter.Capabilities {
	return &chainadapter.Capabilities{
		ChainID:               b.chainID,
		InterfaceVersion:      "1.0.0",
		SupportsEIP1559:       false, // Bitcoin doesn't support EIP-1559
		SupportsMemo:          true,  // Bitcoin supports OP_RETURN
		SupportsMultiSig:      true,  // Bitcoin supports multi-sig via P2SH/P2WSH
		SupportsFeeDelegation: false, // Bitcoin doesn't support fee delegation
		SupportsWebSocket:     true,  // Bitcoin Core supports ZMQ for WebSocket-like functionality
		SupportsRBF:           true,  // Bitcoin supports Replace-By-Fee (BIP 125)
		MaxMemoLength:         80,    // OP_RETURN max 80 bytes
		MinConfirmations:      6,     // Bitcoin recommended minimum for finality
	}
}

// Build constructs an unsigned Bitcoin transaction from a standardized request.
//
// Contract:
// - MUST validate all fields in TransactionRequest
// - MUST return NonRetryable error for invalid addresses or amounts
// - MUST populate UnsignedTransaction.SigningPayload for offline signing
// - MUST be deterministic (same request → same unsigned tx)
// - MUST select UTXOs and create PSBT
func (b *BitcoinAdapter) Build(ctx context.Context, req *chainadapter.TransactionRequest) (*chainadapter.UnsignedTransaction, error) {
	// Step 1: Fetch UTXOs for the from address
	utxos, err := b.rpcHelper.ListUnspent(ctx, req.From)
	if err != nil {
		return nil, err
	}

	if len(utxos) == 0 {
		return nil, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInsufficientFunds,
			fmt.Sprintf("no UTXOs available for address: %s", req.From),
			nil,
		)
	}

	// Step 2: Estimate fee rate based on FeeSpeed
	var targetBlocks int
	switch req.FeeSpeed {
	case chainadapter.FeeSpeedFast:
		targetBlocks = 1 // Next block
	case chainadapter.FeeSpeedNormal:
		targetBlocks = 3 // ~30 minutes
	case chainadapter.FeeSpeedSlow:
		targetBlocks = 6 // ~1 hour
	default:
		targetBlocks = 3
	}

	feeRate, err := b.rpcHelper.EstimateSmartFee(ctx, targetBlocks)
	if err != nil {
		// If fee estimation fails, use fallback rate
		feeRate = 10 // 10 sat/byte fallback
	}

	// Step 3: Build the unsigned transaction
	unsigned, err := b.builder.Build(ctx, req, utxos, feeRate)
	if err != nil {
		return nil, err
	}

	// Step 4: Set the correct chainID
	unsigned.ChainID = b.chainID

	return unsigned, nil
}

// Estimate calculates fee estimates with confidence bounds for Bitcoin.
//
// Contract:
// - MUST be idempotent (can call multiple times safely)
// - MUST return MinFee ≤ Recommended ≤ MaxFee
// - MUST include confidence indicator (0-100%)
// - SHOULD complete within 2 seconds
// - MUST use estimatesmartfee + mempool analysis
func (b *BitcoinAdapter) Estimate(ctx context.Context, req *chainadapter.TransactionRequest) (*chainadapter.FeeEstimate, error) {
	// Call fee estimator
	estimate, err := b.feeEstimator.Estimate(ctx, req)
	if err != nil {
		return nil, err
	}

	// Set correct chainID
	estimate.ChainID = b.chainID

	return estimate, nil
}

// Sign signs an unsigned Bitcoin transaction using the provided signer.
func (b *BitcoinAdapter) Sign(ctx context.Context, unsigned *chainadapter.UnsignedTransaction, signer chainadapter.Signer) (*chainadapter.SignedTransaction, error) {
	// TODO: Implement in T057
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Bitcoin Sign() not yet implemented",
		nil,
	)
}

// Broadcast submits a signed Bitcoin transaction to the blockchain network.
func (b *BitcoinAdapter) Broadcast(ctx context.Context, signed *chainadapter.SignedTransaction) (*chainadapter.BroadcastReceipt, error) {
	// TODO: Implement in T062
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Bitcoin Broadcast() not yet implemented",
		nil,
	)
}

// Derive generates a Bitcoin address from a key source and derivation path.
func (b *BitcoinAdapter) Derive(ctx context.Context, keySource chainadapter.KeySource, path string) (*chainadapter.Address, error) {
	// TODO: Implement in T080
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Bitcoin Derive() not yet implemented",
		nil,
	)
}

// QueryStatus retrieves the current status of a Bitcoin transaction by hash.
func (b *BitcoinAdapter) QueryStatus(ctx context.Context, txHash string) (*chainadapter.TransactionStatus, error) {
	// TODO: Implement in T066
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Bitcoin QueryStatus() not yet implemented",
		nil,
	)
}

// SubscribeStatus returns a channel that streams real-time Bitcoin transaction status updates.
func (b *BitcoinAdapter) SubscribeStatus(ctx context.Context, txHash string) (<-chan *chainadapter.TransactionStatus, error) {
	// TODO: Implement in T067
	return nil, chainadapter.NewNonRetryableError(
		"ERR_NOT_IMPLEMENTED",
		"Bitcoin SubscribeStatus() not yet implemented",
		nil,
	)
}
