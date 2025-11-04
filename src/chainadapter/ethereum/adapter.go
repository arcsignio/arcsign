// Package ethereum implements ChainAdapter for Ethereum blockchain (account-based)
package ethereum

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// EthereumAdapter implements ChainAdapter for Ethereum blockchain.
type EthereumAdapter struct {
	rpcClient    rpc.RPCClient
	txStore      storage.TransactionStateStore
	chainID      string   // "ethereum", "ethereum-goerli", "ethereum-sepolia"
	networkID    int64    // Network ID (1 for mainnet, 5 for goerli, etc.)
	builder      *TransactionBuilder
	rpcHelper    *RPCHelper
	feeEstimator *FeeEstimator
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

	// Create RPC helper
	rpcHelper := NewRPCHelper(rpcClient)

	return &EthereumAdapter{
		rpcClient:    rpcClient,
		txStore:      txStore,
		chainID:      chainID,
		networkID:    networkID,
		builder:      builder,
		rpcHelper:    rpcHelper,
		feeEstimator: NewFeeEstimator(rpcHelper, uint64(networkID)),
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
	// Call fee estimator
	estimate, err := e.feeEstimator.Estimate(ctx, req)
	if err != nil {
		return nil, err
	}

	// Set correct chainID
	estimate.ChainID = e.chainID

	return estimate, nil
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
//
// Contract:
// - MUST check TransactionStateStore before broadcasting (idempotency)
// - MUST increment retry count on subsequent attempts
// - MUST record FirstSeen and LastRetry timestamps
// - MUST return existing BroadcastReceipt if transaction already broadcast
// - MUST handle duplicate transaction errors gracefully
func (e *EthereumAdapter) Broadcast(ctx context.Context, signed *chainadapter.SignedTransaction) (*chainadapter.BroadcastReceipt, error) {
	// Step 1: Validate inputs
	if signed == nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_INVALID_INPUT",
			"signed transaction is nil",
			nil,
		)
	}

	if len(signed.SerializedTx) == 0 {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_INVALID_INPUT",
			"SerializedTx is empty",
			nil,
		)
	}

	txHash := signed.TxHash

	// Step 2: Check state store for existing broadcast
	if e.txStore != nil {
		existingState, err := e.txStore.Get(txHash)
		if err == nil && existingState != nil {
			// Transaction already broadcast
			if existingState.RetryCount > 0 {
				// Return existing receipt (idempotency)
				return &chainadapter.BroadcastReceipt{
					TxHash:      txHash,
					ChainID:     e.chainID,
					SubmittedAt: existingState.LastRetry,
				}, nil
			}
		}
	}

	// Step 3: Convert serialized tx to hex for RPC call
	// Ethereum expects 0x-prefixed hex
	txHex := "0x" + fmt.Sprintf("%x", signed.SerializedTx)

	// Step 4: Broadcast via RPC
	broadcastedHash, err := e.rpcHelper.SendRawTransaction(ctx, txHex)
	if err != nil {
		// Check if it's an already-broadcast error
		errMsg := err.Error()
		if contains(errMsg, "already") || contains(errMsg, "known") {
			// Transaction already broadcast, treat as success
			broadcastedHash = txHash
		} else {
			return nil, err
		}
	}

	// Step 5: Verify broadcasted hash matches (case-insensitive for Ethereum)
	// Normalize both hashes to lowercase for comparison
	if normalizeHash(broadcastedHash) != normalizeHash(txHash) {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_HASH_MISMATCH",
			fmt.Sprintf("broadcasted tx hash %s doesn't match signed tx hash %s",
				broadcastedHash, txHash),
			nil,
		)
	}

	// Step 6: Update state store
	if e.txStore != nil {
		now := time.Now()
		state := &storage.TxState{
			TxHash:     txHash,
			ChainID:    e.chainID,
			RawTx:      signed.SerializedTx,
			RetryCount: 1,
			FirstSeen:  now,
			LastRetry:  now,
			Status:     storage.TxStatusPending,
		}

		// Check if state exists to increment retry count
		if existingState, err := e.txStore.Get(txHash); err == nil && existingState != nil {
			state.RetryCount = existingState.RetryCount + 1
			state.FirstSeen = existingState.FirstSeen
			if state.FirstSeen.IsZero() {
				state.FirstSeen = now
			}
		}

		if err := e.txStore.Set(txHash, state); err != nil {
			// Log error but don't fail broadcast (tx was successful)
			// In production, you'd want to log this error
			_ = err
		}
	}

	// Step 7: Return broadcast receipt
	return &chainadapter.BroadcastReceipt{
		TxHash:      txHash,
		ChainID:     e.chainID,
		SubmittedAt: time.Now(),
	}, nil
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// normalizeHash converts a hash to lowercase and removes 0x prefix for comparison
func normalizeHash(hash string) string {
	if len(hash) >= 2 && hash[:2] == "0x" {
		hash = hash[2:]
	}
	return toLower(hash)
}

func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c = c + ('a' - 'A')
		}
		result[i] = c
	}
	return string(result)
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
//
// Contract:
// - MUST return TransactionStatus with current confirmations
// - MUST use HTTP RPC (not WebSocket)
// - MUST use eth_getTransactionByHash + eth_getTransactionReceipt
//
// Returns:
// - TransactionStatus with confirmation count and block info
// - Error if transaction not found or RPC fails
func (e *EthereumAdapter) QueryStatus(ctx context.Context, txHash string) (*chainadapter.TransactionStatus, error) {
	// Step 1: Get transaction details
	tx, err := e.rpcHelper.GetTransactionByHash(ctx, txHash)
	if err != nil {
		return nil, err
	}

	// Check if transaction was found
	if tx == nil {
		return nil, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeTxNotFound,
			fmt.Sprintf("transaction not found: %s", txHash),
			nil,
		)
	}

	// Step 2: Get transaction receipt
	receipt, err := e.rpcHelper.GetTransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, err
	}

	// Step 3: Determine transaction status
	var status chainadapter.TxStatus
	var confirmations int
	var blockNumber *uint64
	var blockHash *string
	var txError *chainadapter.ChainError

	if receipt == nil {
		// Transaction is pending (no receipt yet)
		status = chainadapter.TxStatusPending
		confirmations = 0
	} else {
		// Transaction is mined, check if it succeeded or failed
		if receipt.Status == "0x0" {
			status = chainadapter.TxStatusFailed
			txError = &chainadapter.ChainError{
				Code:    "ERR_TX_REVERTED",
				Message: "Transaction reverted",
			}
		} else {
			// Get current block number to calculate confirmations
			currentBlock, err := e.rpcHelper.GetBlockNumber(ctx)
			if err == nil {
				// Parse receipt block number
				receiptBlockNum, err := hexutil.DecodeUint64(receipt.BlockNumber)
				if err == nil {
					confirmations = int(currentBlock - receiptBlockNum)

					// Determine if transaction is confirmed or finalized
					if confirmations >= e.Capabilities().MinConfirmations {
						status = chainadapter.TxStatusFinalized
					} else {
						status = chainadapter.TxStatusConfirmed
					}

					blockNumber = &receiptBlockNum
				}
			}

			// If we couldn't get confirmations, still mark as confirmed
			if status == "" {
				status = chainadapter.TxStatusConfirmed
				confirmations = 1
			}
		}

		blockHash = &receipt.BlockHash
	}

	// Step 4: Return transaction status
	return &chainadapter.TransactionStatus{
		TxHash:        txHash,
		Status:        status,
		Confirmations: confirmations,
		BlockNumber:   blockNumber,
		BlockHash:     blockHash,
		UpdatedAt:     time.Now(),
		Error:         txError,
	}, nil
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
