// Package bitcoin implements ChainAdapter for Bitcoin blockchain (UTXO-based)
package bitcoin

import (
	"context"
	"fmt"
	"time"

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
//
// Contract:
// - MUST validate Signer.GetAddress() == UnsignedTransaction.From
// - MUST verify signature against SigningPayload
// - MUST preserve UnsignedTransaction for audit trail
// - MUST NOT leak private key material
// - MUST support offline signing (no RPC calls)
func (b *BitcoinAdapter) Sign(ctx context.Context, unsigned *chainadapter.UnsignedTransaction, signer chainadapter.Signer) (*chainadapter.SignedTransaction, error) {
	// Step 1: Validate signer address matches transaction From address
	signerAddress := signer.GetAddress()
	if signerAddress != unsigned.From {
		return nil, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("address mismatch: signer controls %s, transaction from %s",
				signerAddress, unsigned.From),
			nil,
		)
	}

	// Step 2: Validate ChainID matches
	if unsigned.ChainID != b.chainID {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_CHAIN_MISMATCH",
			fmt.Sprintf("chain mismatch: unsigned tx for %s, adapter for %s",
				unsigned.ChainID, b.chainID),
			nil,
		)
	}

	// Step 3: Validate SigningPayload exists
	if len(unsigned.SigningPayload) == 0 {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_INVALID_PAYLOAD",
			"SigningPayload is empty",
			nil,
		)
	}

	// Step 4: Sign the payload
	signature, err := signer.Sign(unsigned.SigningPayload, unsigned.From)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_SIGNING_FAILED",
			fmt.Sprintf("signing failed: %v", err),
			err,
		)
	}

	// Step 5: For Bitcoin, the serialized transaction is the SigningPayload
	// (In practice, this would serialize the signed PSBT)
	// For now, we use the SigningPayload as the SerializedTx
	serializedTx := unsigned.SigningPayload

	// Step 6: Compute transaction hash
	txHash := ComputeTransactionHash(serializedTx)

	// Step 7: Create SignedTransaction
	signed := &chainadapter.SignedTransaction{
		UnsignedTx:   unsigned,
		Signature:    signature,
		SignedBy:     signerAddress,
		TxHash:       txHash,
		SerializedTx: serializedTx,
		SignedAt:     unsigned.CreatedAt,
	}

	return signed, nil
}

// Broadcast submits a signed Bitcoin transaction to the blockchain network.
//
// Contract:
// - MUST check TransactionStateStore before broadcasting (idempotency)
// - MUST increment broadcast count on retry
// - MUST record FirstBroadcast and LastBroadcast timestamps
// - MUST return existing BroadcastReceipt if transaction already broadcast
// - MUST handle duplicate transaction errors gracefully
func (b *BitcoinAdapter) Broadcast(ctx context.Context, signed *chainadapter.SignedTransaction) (*chainadapter.BroadcastReceipt, error) {
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
	if b.txStore != nil {
		existingState, err := b.txStore.Get(txHash)
		if err == nil && existingState != nil {
			// Transaction already broadcast
			if existingState.RetryCount > 0 {
				// Return existing receipt (idempotency)
				return &chainadapter.BroadcastReceipt{
					TxHash:      txHash,
					ChainID:     b.chainID,
					SubmittedAt: existingState.LastRetry,
				}, nil
			}
		}
	}

	// Step 3: Convert serialized tx to hex for RPC call
	txHex := fmt.Sprintf("%x", signed.SerializedTx)

	// Step 4: Broadcast via RPC
	broadcastedHash, err := b.rpcHelper.SendRawTransaction(ctx, txHex)
	if err != nil {
		// Check if it's an already-broadcast error
		errMsg := err.Error()
		if contains(errMsg, "already") {
			// Transaction already broadcast, treat as success
			broadcastedHash = txHash
		} else {
			return nil, err
		}
	}

	// Step 5: Verify broadcasted hash matches
	if broadcastedHash != txHash {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_HASH_MISMATCH",
			fmt.Sprintf("broadcasted tx hash %s doesn't match signed tx hash %s",
				broadcastedHash, txHash),
			nil,
		)
	}

	// Step 6: Update state store
	if b.txStore != nil {
		now := time.Now()
		state := &storage.TxState{
			TxHash:     txHash,
			ChainID:    b.chainID,
			RawTx:      signed.SerializedTx,
			RetryCount: 1,
			FirstSeen:  now,
			LastRetry:  now,
			Status:     storage.TxStatusPending,
		}

		// Check if state exists to increment retry count
		if existingState, err := b.txStore.Get(txHash); err == nil && existingState != nil {
			state.RetryCount = existingState.RetryCount + 1
			state.FirstSeen = existingState.FirstSeen
			if state.FirstSeen.IsZero() {
				state.FirstSeen = now
			}
		}

		if err := b.txStore.Set(txHash, state); err != nil {
			// Log error but don't fail broadcast (tx was successful)
			// In production, you'd want to log this error
			_ = err
		}
	}

	// Step 7: Return broadcast receipt
	return &chainadapter.BroadcastReceipt{
		TxHash:      txHash,
		ChainID:     b.chainID,
		SubmittedAt: time.Now(),
	}, nil
}

// contains checks if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Derive generates a Bitcoin address from a key source and derivation path.
//
// Contract:
// - MUST follow BIP44 derivation path standard (m/44'/0'/account'/change/index)
// - MUST return P2WPKH address format (bc1q... for mainnet, tb1q... for testnet)
// - MUST NOT expose private key material
// - MUST be deterministic (same KeySource + path → same address)
//
// Parameters:
// - ctx: Context for cancellation
// - keySource: Source of key material (mnemonic, xpub, hardware wallet)
// - path: BIP44 derivation path (e.g., "m/44'/0'/0'/0/0")
//
// Returns:
// - Address with chain-specific encoding and metadata
// - Error if path is invalid or derivation fails
func (b *BitcoinAdapter) Derive(ctx context.Context, keySource chainadapter.KeySource, path string) (*chainadapter.Address, error) {
	// Step 1: Validate BIP44 path format
	if err := validateBIP44Path(path, 0); err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_INVALID_PATH",
			fmt.Sprintf("invalid BIP44 path: %s", err.Error()),
			err,
		)
	}

	// Step 2: Get public key from key source
	pubKeyBytes, err := keySource.GetPublicKey(path)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_KEY_DERIVATION",
			fmt.Sprintf("failed to derive public key: %s", err.Error()),
			err,
		)
	}

	// Step 3: Create P2WPKH address from public key
	address, err := pubKeyToP2WPKHAddress(pubKeyBytes, b.network)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_ADDRESS_ENCODING",
			fmt.Sprintf("failed to create P2WPKH address: %s", err.Error()),
			err,
		)
	}

	// Step 4: Return Address struct
	return &chainadapter.Address{
		Address:        address,
		ChainID:        b.chainID,
		DerivationPath: path,
		PublicKey:      pubKeyBytes,
		Format:         "P2WPKH",
	}, nil
}

// QueryStatus retrieves the current status of a Bitcoin transaction by hash.
//
// Contract:
// - MUST return TransactionStatus with current confirmations
// - MUST use HTTP RPC (not WebSocket)
// - MUST use getrawtransaction verbose=true
//
// Returns:
// - TransactionStatus with confirmation count and block info
// - Error if transaction not found or RPC fails
func (b *BitcoinAdapter) QueryStatus(ctx context.Context, txHash string) (*chainadapter.TransactionStatus, error) {
	// Step 1: Get raw transaction details
	txResult, err := b.rpcHelper.GetRawTransaction(ctx, txHash, true)
	if err != nil {
		// Check if transaction not found
		if errMsg := err.Error(); contains(errMsg, "not found") || contains(errMsg, "No such") {
			return nil, chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeTxNotFound,
				fmt.Sprintf("transaction not found: %s", txHash),
				err,
			)
		}
		return nil, err
	}

	// Step 2: Determine transaction status
	var status chainadapter.TxStatus
	var blockNumber *uint64
	var blockHash *string

	if txResult.Confirmations == 0 {
		// Transaction is pending (in mempool)
		status = chainadapter.TxStatusPending
	} else if txResult.Confirmations >= b.Capabilities().MinConfirmations {
		// Transaction is finalized (6+ confirmations for Bitcoin)
		status = chainadapter.TxStatusFinalized
	} else {
		// Transaction is confirmed but not finalized yet
		status = chainadapter.TxStatusConfirmed
	}

	// Step 3: Get block information if transaction is confirmed
	if txResult.BlockHash != "" {
		blockHash = &txResult.BlockHash

		// Get block details to obtain block height
		blockResult, err := b.rpcHelper.GetBlock(ctx, txResult.BlockHash, 1)
		if err == nil {
			blockHeight := uint64(blockResult.Height)
			blockNumber = &blockHeight
		}
		// If block fetch fails, we still return status with what we have
	}

	// Step 4: Return transaction status
	return &chainadapter.TransactionStatus{
		TxHash:        txHash,
		Status:        status,
		Confirmations: txResult.Confirmations,
		BlockNumber:   blockNumber,
		BlockHash:     blockHash,
		UpdatedAt:     time.Now(),
		Error:         nil,
	}, nil
}

// SubscribeStatus returns a channel that streams real-time Bitcoin transaction status updates.
//
// Contract:
// - MUST use HTTP polling (WebSocket not available for Bitcoin Core by default)
// - MUST send initial status immediately
// - MUST close channel when context is cancelled
// - MUST send updates only on state change
// - Poll interval: 10 seconds (Bitcoin block time ~10 minutes)
//
// Returns:
// - Channel receiving status updates
// - Error if initial status query fails
func (b *BitcoinAdapter) SubscribeStatus(ctx context.Context, txHash string) (<-chan *chainadapter.TransactionStatus, error) {
	statusChan := make(chan *chainadapter.TransactionStatus, 10)

	// Get initial status
	initialStatus, err := b.QueryStatus(ctx, txHash)
	if err != nil {
		close(statusChan)
		return statusChan, err
	}

	// Start background polling goroutine
	go func() {
		defer close(statusChan)

		// Send initial status
		select {
		case statusChan <- initialStatus:
		case <-ctx.Done():
			return
		}

		lastStatus := initialStatus.Status
		lastConfirmations := initialStatus.Confirmations
		pollInterval := 10 * time.Second
		maxPollInterval := 60 * time.Second
		errorBackoff := 5 * time.Second

		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// Query current status
				status, err := b.QueryStatus(ctx, txHash)
				if err != nil {
					// On error, increase backoff and continue
					ticker.Reset(errorBackoff)
					if errorBackoff < maxPollInterval {
						errorBackoff *= 2
					}
					continue
				}

				// Reset backoff on success
				errorBackoff = 5 * time.Second

				// Check if status changed
				statusChanged := status.Status != lastStatus || status.Confirmations != lastConfirmations

				if statusChanged {
					lastStatus = status.Status
					lastConfirmations = status.Confirmations

					// Send update
					select {
					case statusChan <- status:
					case <-ctx.Done():
						return
					default:
						// Channel full, drop old update
					}

					// Once finalized, we can slow down polling
					if status.Status == chainadapter.TxStatusFinalized {
						ticker.Reset(maxPollInterval)
					}
				}
			}
		}
	}()

	return statusChan, nil
}
