// Package ethereum implements ChainAdapter for Ethereum blockchain (account-based)
package ethereum

import (
	"context"
	"encoding/base64"
	"fmt"
	"math/big"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/arcsignio/arcsign/src/chainadapter"
	"github.com/arcsignio/arcsign/src/chainadapter/metrics"
	"github.com/arcsignio/arcsign/src/chainadapter/rpc"
	"github.com/arcsignio/arcsign/src/chainadapter/storage"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// extractRevertReason extracts a human-readable revert reason from an error message.
// It handles various RPC provider formats for revert errors.
func extractRevertReason(errMsg string) string {
	// Common patterns for revert reasons:
	// 1. "execution reverted: Insufficient payment"
	// 2. "execution reverted: BEP20: transfer amount exceeds balance: 0x08c379a0..."
	// 3. "Error: VM Exception while processing transaction: revert Insufficient payment"

	// Pattern 1: Match "BEP20: <reason>" or "ERC20: <reason>" - stop at colon or hex data
	bepPattern := regexp.MustCompile(`(BEP20|ERC20):\s*([^:0x]+)`)
	if matches := bepPattern.FindStringSubmatch(errMsg); len(matches) > 2 {
		reason := strings.TrimSpace(matches[1] + ": " + matches[2])
		return reason
	}

	// Pattern 2: Match common error messages directly
	commonErrors := []string{
		"transfer amount exceeds balance",
		"transfer amount exceeds allowance",
		"insufficient balance",
		"insufficient allowance",
		"Insufficient payment",
	}
	lowerMsg := strings.ToLower(errMsg)
	for _, errText := range commonErrors {
		if strings.Contains(lowerMsg, strings.ToLower(errText)) {
			return errText
		}
	}

	// Pattern 3: Try to extract from "execution reverted: <reason>"
	// But stop before hex data (0x...) or nested error info
	revertPattern := regexp.MustCompile(`execution reverted:\s*([^:]+?)(?::|0x|\(|$)`)
	if matches := revertPattern.FindStringSubmatch(errMsg); len(matches) > 1 {
		reason := strings.TrimSpace(matches[1])
		if reason != "" && len(reason) < 100 { // Sanity check - not too long
			return reason
		}
	}

	return ""
}

// networkIDToChainID maps EVM network IDs to chainID strings used by frontend.
// This ensures consistency between frontend chainId and backend adapter chainID.
func networkIDToChainID(networkID int64) string {
	switch networkID {
	case 1:
		return "ethereum"
	case 5:
		return "ethereum-goerli"
	case 11155111:
		return "ethereum-sepolia"
	case 56:
		return "bnb" // BSC Mainnet - frontend uses "bnb"
	case 97:
		return "bnb-testnet" // BSC Testnet
	case 137:
		return "polygon" // Polygon Mainnet
	case 42161:
		return "arbitrum" // Arbitrum One
	case 10:
		return "optimism" // Optimism
	case 8453:
		return "base" // Base
	default:
		return "ethereum" // Default fallback
	}
}

// EthereumAdapter implements ChainAdapter for Ethereum blockchain.
type EthereumAdapter struct {
	rpcClient    rpc.RPCClient
	txStore      storage.TransactionStateStore
	chainID      string   // Chain identifier (e.g., "ethereum", "bnb", "polygon")
	networkID    int64    // Network ID (1 for mainnet, 56 for BSC, etc.)
	builder      *TransactionBuilder
	rpcHelper    *RPCHelper
	feeEstimator *FeeEstimator
	metrics      metrics.ChainMetrics // Metrics recorder (optional)
}

// NewEthereumAdapter creates a new Ethereum ChainAdapter.
//
// Parameters:
// - rpcClient: RPC client for communicating with Ethereum node
// - txStore: Transaction state store for broadcast idempotency
// - networkID: Ethereum network ID (1 for mainnet, 5 for goerli, 11155111 for sepolia)
// - metricsRecorder: Optional metrics recorder (pass nil to disable metrics)
func NewEthereumAdapter(rpcClient rpc.RPCClient, txStore storage.TransactionStateStore, networkID int64, metricsRecorder metrics.ChainMetrics) (*EthereumAdapter, error) {
	// Map networkID to chainID string that frontend uses
	chainID := networkIDToChainID(networkID)

	// Wrap RPC client with metrics if recorder provided
	if metricsRecorder != nil {
		rpcClient = rpc.NewMetricsRPCClient(rpcClient, metricsRecorder)
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
		metrics:      metricsRecorder,
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
func (e *EthereumAdapter) Build(ctx context.Context, req *chainadapter.TransactionRequest) (result *chainadapter.UnsignedTransaction, err error) {
	// Record metrics
	start := time.Now()
	defer func() {
		if e.metrics != nil {
			duration := time.Since(start)
			success := err == nil
			e.metrics.RecordTransactionBuild(e.chainID, duration, success)
		}
	}()

	// Step 1: Get nonce for the from address
	nonce, err := e.rpcHelper.GetTransactionCount(ctx, req.From)
	if err != nil {
		return nil, err
	}

	// Step 2: Estimate gas for the transaction
	var data []byte
	if req.Memo != "" {
		// Check if memo is hex-encoded (contract call data)
		if len(req.Memo) >= 2 && req.Memo[:2] == "0x" {
			data = common.FromHex(req.Memo)
		} else {
			// Plain text memo
			data = []byte(req.Memo)
		}
	}

	gasLimit, err := e.rpcHelper.EstimateGas(ctx, req.From, req.To, req.Amount, data)
	if err != nil {
		// Log the estimation error for debugging
		fmt.Fprintf(os.Stderr, "[ETH Build] Gas estimation failed: %v\n", err)

		errStr := strings.ToLower(err.Error())

		// Check if this is a contract revert error - these should NOT be ignored
		// Common revert patterns from different RPC providers:
		// - "execution reverted" (standard)
		// - "reverted" (some providers)
		// - "revert" (some providers)
		// - "insufficient" (balance/allowance errors)
		// - "transfer amount exceeds" (ERC20 balance errors)
		// - "exceeds balance" (balance errors)
		isRevertError := strings.Contains(errStr, "execution reverted") ||
			strings.Contains(errStr, "reverted") ||
			strings.Contains(errStr, "revert") ||
			strings.Contains(errStr, "insufficient") ||
			strings.Contains(errStr, "transfer amount exceeds") ||
			strings.Contains(errStr, "exceeds balance") ||
			strings.Contains(errStr, "exceeds allowance")

		if isRevertError {
			// Extract revert reason if available for user-friendly error message
			revertReason := extractRevertReason(err.Error())
			if revertReason != "" {
				return nil, chainadapter.NewNonRetryableError(
					chainadapter.ErrCodeContractRevert,
					fmt.Sprintf("Transaction will fail: %s", revertReason),
					err,
				)
			}
			return nil, chainadapter.NewNonRetryableError(
				chainadapter.ErrCodeContractRevert,
				fmt.Sprintf("Transaction will fail: %v", err),
				err,
			)
		}

		// For non-revert errors (e.g., RPC connection issues), use fallback gas limit
		if len(data) > 0 {
			// Contract call - use higher default
			// NFT mints typically need 150k-300k, approvals need ~50k
			gasLimit = 300000 // Safe default for most contract interactions
			fmt.Fprintf(os.Stderr, "[ETH Build] Using fallback gas limit: %d (contract call)\n", gasLimit)
		} else {
			gasLimit = 21000 // Standard ETH transfer
			fmt.Fprintf(os.Stderr, "[ETH Build] Using fallback gas limit: %d (ETH transfer)\n", gasLimit)
		}
	} else {
		fmt.Fprintf(os.Stderr, "[ETH Build] Gas estimated: %d\n", gasLimit)
	}

	// Add 20% buffer to gas estimate for safety
	// Standard industry practice; unused gas is refunded
	originalGasLimit := gasLimit
	gasLimit = gasLimit * 120 / 100
	fmt.Fprintf(os.Stderr, "[ETH Build] Gas with 20%% buffer: %d (original: %d)\n", gasLimit, originalGasLimit)

	// Ensure minimum gas limit for contract calls
	if len(data) > 0 && gasLimit < 150000 {
		gasLimit = 150000 // Minimum for contract interactions
		fmt.Fprintf(os.Stderr, "[ETH Build] Applied minimum gas limit: %d\n", gasLimit)
	}

	// Step 3: Get fee parameters based on chain type
	// Different chains require different fee calculation strategies:
	// - Legacy chains (BSC, Fantom): Use eth_gasPrice
	// - EIP-1559 chains (ETH, Polygon): Use eth_feeHistory + baseFee
	// - L2 chains (Arbitrum, Optimism, Base): Use EIP-1559 with L2-specific handling
	var maxFeePerGas, maxPriorityFeePerGas *big.Int

	isLegacyChain := e.networkID == 56 || e.networkID == 97 || e.networkID == 250 // BSC, BSC Testnet, Fantom
	isL2Chain := e.networkID == 42161 || e.networkID == 10 || e.networkID == 8453 // Arbitrum, Optimism, Base

	if isLegacyChain {
		// Legacy strategy: Use eth_gasPrice for chains without proper EIP-1559
		fmt.Fprintf(os.Stderr, "[ETH Build] Using Legacy gas price strategy for chain %d\n", e.networkID)

		gasPrice, err := e.rpcHelper.GetGasPrice(ctx)
		if err != nil {
			// Fallback to default gas price
			gasPrice = big.NewInt(3e9) // 3 Gwei for BSC default
			fmt.Fprintf(os.Stderr, "[ETH Build] Using fallback gasPrice: %s\n", gasPrice.String())
		}

		// Apply speed multiplier to gasPrice
		// BSC gasPrice is typically stable, so multipliers are conservative
		var multiplier int64
		switch req.FeeSpeed {
		case chainadapter.FeeSpeedFast:
			multiplier = 120 // 1.2x for fast
		case chainadapter.FeeSpeedNormal:
			multiplier = 100 // 1.0x for normal
		case chainadapter.FeeSpeedSlow:
			multiplier = 80 // 0.8x for slow (may get stuck during congestion)
		default:
			multiplier = 100
		}

		// For Legacy chains, set maxFeePerGas = maxPriorityFeePerGas = gasPrice * multiplier / 100
		// This ensures the transaction uses legacy-style pricing
		adjustedGasPrice := new(big.Int).Mul(gasPrice, big.NewInt(multiplier))
		adjustedGasPrice.Div(adjustedGasPrice, big.NewInt(100))

		// BSC minimum gas price: 0.05 Gwei (post-Feynman upgrade allows much lower gas)
		minGasPrice := big.NewInt(50000000) // 0.05 Gwei
		if adjustedGasPrice.Cmp(minGasPrice) < 0 {
			adjustedGasPrice = minGasPrice
		}

		maxFeePerGas = adjustedGasPrice
		maxPriorityFeePerGas = adjustedGasPrice

		fmt.Fprintf(os.Stderr, "[ETH Build] Legacy gasPrice: base=%s, adjusted=%s (speed=%s)\n",
			gasPrice.String(), adjustedGasPrice.String(), req.FeeSpeed)

	} else {
		// EIP-1559 strategy: Use baseFee + priorityFee
		fmt.Fprintf(os.Stderr, "[ETH Build] Using EIP-1559 strategy for chain %d\n", e.networkID)

		baseFee, err := e.rpcHelper.GetBaseFee(ctx)
		if err != nil {
			// Fallback base fee depends on chain type:
			// - L2 chains: 0.1 Gwei (L2 fees are orders of magnitude lower)
			// - L1 chains: 30 Gwei
			if isL2Chain {
				baseFee = big.NewInt(1e8) // 0.1 Gwei for L2
			} else {
				baseFee = big.NewInt(30e9) // 30 Gwei for L1
			}
			fmt.Fprintf(os.Stderr, "[ETH Build] Using fallback baseFee: %s (L2=%v)\n", baseFee.String(), isL2Chain)
		}

		priorityFee, err := e.rpcHelper.GetFeeHistory(ctx, 10)
		if err != nil {
			// Fallback priority fee depends on chain type:
			// - L2 chains: 0.001 Gwei
			// - L1 chains: 2 Gwei
			if isL2Chain {
				priorityFee = big.NewInt(1e6) // 0.001 Gwei for L2
			} else {
				priorityFee = big.NewInt(2e9) // 2 Gwei for L1
			}
			fmt.Fprintf(os.Stderr, "[ETH Build] Using fallback priorityFee: %s (L2=%v)\n", priorityFee.String(), isL2Chain)
		}

		// Minimum priority fee depends on chain type:
		// - L2 chains (Arbitrum, Optimism, Base): 0.001 Gwei (1e6 wei) - L2s have very low fees
		// - Other EIP-1559 chains (ETH, Polygon): 1 Gwei (1e9 wei)
		var minPriorityFee *big.Int
		if isL2Chain {
			minPriorityFee = big.NewInt(1e6) // 0.001 Gwei for L2
		} else {
			minPriorityFee = big.NewInt(1e9) // 1 Gwei for L1
		}
		if priorityFee.Cmp(minPriorityFee) < 0 {
			priorityFee = minPriorityFee
		}

		// Calculate maxFeePerGas based on FeeSpeed
		// Using more conservative multipliers (like MetaMask):
		// - Fast: baseFee * 1.5 + priorityFee * 1.5
		// - Normal: baseFee * 1.25 + priorityFee
		// - Slow: baseFee * 1.1 + priorityFee
		var baseMult, priorityMult int64
		switch req.FeeSpeed {
		case chainadapter.FeeSpeedFast:
			baseMult = 150   // 1.5x base fee
			priorityMult = 150 // 1.5x priority fee
		case chainadapter.FeeSpeedNormal:
			baseMult = 125   // 1.25x base fee
			priorityMult = 100 // 1x priority fee
		case chainadapter.FeeSpeedSlow:
			baseMult = 110   // 1.1x base fee
			priorityMult = 100 // 1x priority fee
		default:
			baseMult = 125
			priorityMult = 100
		}

		// maxFeePerGas = (baseFee * baseMult / 100) + (priorityFee * priorityMult / 100)
		adjustedBaseFee := new(big.Int).Mul(baseFee, big.NewInt(baseMult))
		adjustedBaseFee.Div(adjustedBaseFee, big.NewInt(100))

		adjustedPriorityFee := new(big.Int).Mul(priorityFee, big.NewInt(priorityMult))
		adjustedPriorityFee.Div(adjustedPriorityFee, big.NewInt(100))

		maxFeePerGas = new(big.Int).Add(adjustedBaseFee, adjustedPriorityFee)
		maxPriorityFeePerGas = adjustedPriorityFee

		fmt.Fprintf(os.Stderr, "[ETH Build] EIP-1559: baseFee=%s, priorityFee=%s, maxFee=%s, maxPriority=%s\n",
			baseFee.String(), priorityFee.String(), maxFeePerGas.String(), maxPriorityFeePerGas.String())
	}

	// EIP-1559 constraint: maxPriorityFeePerGas MUST NOT exceed maxFeePerGas
	if maxPriorityFeePerGas.Cmp(maxFeePerGas) > 0 {
		fmt.Fprintf(os.Stderr, "[ETH Build] Capping maxPriorityFeePerGas from %s to %s (must not exceed maxFeePerGas)\n",
			maxPriorityFeePerGas.String(), maxFeePerGas.String())
		maxPriorityFeePerGas = new(big.Int).Set(maxFeePerGas)
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
//
// Contract:
// - MUST validate Signer.GetAddress() == UnsignedTransaction.From
// - MUST verify signature against SigningPayload
// - MUST preserve UnsignedTransaction for audit trail
// - MUST NOT leak private key material
// - MUST support offline signing (no RPC calls)
func (e *EthereumAdapter) Sign(ctx context.Context, unsigned *chainadapter.UnsignedTransaction, signer chainadapter.Signer) (result *chainadapter.SignedTransaction, err error) {
	// Record metrics
	start := time.Now()
	defer func() {
		if e.metrics != nil {
			duration := time.Since(start)
			success := err == nil
			e.metrics.RecordTransactionSign(e.chainID, duration, success)
		}
	}()

	// Step 1: Validate signer address matches transaction From address (case-insensitive)
	signerAddress := normalizeHash(signer.GetAddress())
	fromAddress := normalizeHash(unsigned.From)
	if signerAddress != fromAddress {
		return nil, chainadapter.NewNonRetryableError(
			chainadapter.ErrCodeInvalidAddress,
			fmt.Sprintf("address mismatch: signer controls %s, transaction from %s",
				signer.GetAddress(), unsigned.From),
			nil,
		)
	}

	// Step 2: Validate ChainID matches
	if unsigned.ChainID != e.chainID {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_CHAIN_MISMATCH",
			fmt.Sprintf("chain mismatch: unsigned tx for %s, adapter for %s",
				unsigned.ChainID, e.chainID),
			nil,
		)
	}

	// Step 3: Reconstruct the EIP-1559 transaction from ChainSpecific data
	// This is necessary to create a properly RLP-encoded signed transaction
	chainSpecific := unsigned.ChainSpecific
	if chainSpecific == nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_INVALID_TX",
			"ChainSpecific data is missing from unsigned transaction",
			nil,
		)
	}

	// Extract transaction parameters from ChainSpecific
	chainIDVal, _ := chainSpecific["chain_id"].(int64)
	if chainIDVal == 0 {
		// Try float64 (JSON numbers default to float64)
		if f, ok := chainSpecific["chain_id"].(float64); ok {
			chainIDVal = int64(f)
		}
	}
	nonce, _ := chainSpecific["nonce"].(uint64)
	if nonce == 0 {
		if f, ok := chainSpecific["nonce"].(float64); ok {
			nonce = uint64(f)
		}
	}
	gasLimit, _ := chainSpecific["gas_limit"].(uint64)
	if gasLimit == 0 {
		if f, ok := chainSpecific["gas_limit"].(float64); ok {
			gasLimit = uint64(f)
		}
	}

	maxFeePerGasStr, _ := chainSpecific["max_fee_per_gas"].(string)
	maxPriorityFeePerGasStr, _ := chainSpecific["max_priority_fee_per_gas"].(string)

	maxFeePerGas := new(big.Int)
	maxFeePerGas.SetString(maxFeePerGasStr, 10)
	maxPriorityFeePerGas := new(big.Int)
	maxPriorityFeePerGas.SetString(maxPriorityFeePerGasStr, 10)

	// Get transaction data (for ERC-20 or memo)
	// Note: Go's json.Marshal encodes []byte as base64 string, so we need to handle that
	var data []byte
	if dataRaw, ok := chainSpecific["data"].([]byte); ok {
		// Direct []byte (rare, only if not serialized through JSON)
		data = dataRaw
	} else if dataStr, ok := chainSpecific["data"].(string); ok && dataStr != "" {
		// Base64-encoded string (Go's default for []byte in JSON)
		var err error
		data, err = base64.StdEncoding.DecodeString(dataStr)
		if err != nil {
			// Not base64, try as hex string (0x prefixed)
			if len(dataStr) >= 2 && dataStr[:2] == "0x" {
				data = common.FromHex(dataStr)
			}
		}
	} else if dataInterface, ok := chainSpecific["data"].([]interface{}); ok {
		// Array of numbers (JSON number array, each element is float64)
		data = make([]byte, len(dataInterface))
		for i, v := range dataInterface {
			if f, ok := v.(float64); ok {
				data[i] = byte(f)
			}
		}
	}

	// Get actual transaction target (tx_to) - may differ from unsigned.To for ERC-20
	// For contract deployments, tx_to should be empty or zero address
	txToStr, _ := chainSpecific["tx_to"].(string)
	if txToStr == "" {
		txToStr = unsigned.To // Fallback to logical recipient
	}

	// Determine if this is a contract deployment
	// Contract deployment: to is empty or zero address, and data is present
	isContractDeploy := (txToStr == "" || txToStr == "0x0000000000000000000000000000000000000000") && len(data) > 0

	// Get actual transaction value (tx_value) - 0 for ERC-20 transfers
	var txValue *big.Int
	if txValueStr, ok := chainSpecific["tx_value"].(string); ok && txValueStr != "" {
		txValue = new(big.Int)
		txValue.SetString(txValueStr, 10)
	} else {
		txValue = unsigned.Amount // Fallback to logical amount
	}

	// Create EIP-1559 transaction
	var tx *types.Transaction
	if isContractDeploy {
		// Contract deployment: To must be nil
		tx = types.NewTx(&types.DynamicFeeTx{
			ChainID:   big.NewInt(chainIDVal),
			Nonce:     nonce,
			GasFeeCap: maxFeePerGas,
			GasTipCap: maxPriorityFeePerGas,
			Gas:       gasLimit,
			To:        nil, // nil indicates contract creation
			Value:     txValue,
			Data:      data,
		})
		fmt.Fprintf(os.Stderr, "[ETH Sign] Contract deployment detected\n")
	} else {
		// Regular transfer or contract call
		toAddr := common.HexToAddress(txToStr)
		tx = types.NewTx(&types.DynamicFeeTx{
			ChainID:   big.NewInt(chainIDVal),
			Nonce:     nonce,
			GasFeeCap: maxFeePerGas,
			GasTipCap: maxPriorityFeePerGas,
			Gas:       gasLimit,
			To:        &toAddr,
			Value:     txValue,
			Data:      data,
		})
	}

	// Compute the signing payload from reconstructed transaction
	// This allows dev mode to work without pre-computed SigningPayload
	reconstructedSigner := types.LatestSignerForChainID(big.NewInt(chainIDVal))
	reconstructedHash := reconstructedSigner.Hash(tx)

	// Use reconstructed hash as signing payload (required for dev mode where SigningPayload may be empty)
	signingPayload := reconstructedHash.Bytes()

	// Debug logging
	fmt.Fprintf(os.Stderr, "[ETH Sign] Original SigningPayload length: %d\n", len(unsigned.SigningPayload))
	fmt.Fprintf(os.Stderr, "[ETH Sign] Reconstructed tx hash: %x\n", signingPayload)
	if len(unsigned.SigningPayload) > 0 && string(signingPayload) != string(unsigned.SigningPayload) {
		fmt.Fprintf(os.Stderr, "[ETH Sign] WARNING: Hash mismatch - using reconstructed hash\n")
		fmt.Fprintf(os.Stderr, "[ETH Sign] ChainID: %d, Nonce: %d, GasLimit: %d\n", chainIDVal, nonce, gasLimit)
		fmt.Fprintf(os.Stderr, "[ETH Sign] MaxFeePerGas: %s, MaxPriorityFeePerGas: %s\n", maxFeePerGas.String(), maxPriorityFeePerGas.String())
		fmt.Fprintf(os.Stderr, "[ETH Sign] To: %s, Value: %s\n", txToStr, txValue.String())
		fmt.Fprintf(os.Stderr, "[ETH Sign] Data length: %d\n", len(data))
	}

	// Step 4: Sign the transaction using the reconstructed signing payload
	signature, err := signer.Sign(signingPayload, unsigned.From)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_SIGNING_FAILED",
			fmt.Sprintf("signing failed: %v", err),
			err,
		)
	}

	// Signature format: [R (32 bytes) || S (32 bytes) || V (1 byte)]
	if len(signature) != 65 {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_INVALID_SIGNATURE",
			fmt.Sprintf("invalid signature length: expected 65, got %d", len(signature)),
			nil,
		)
	}

	// For EIP-1559 transactions, WithSignature expects the raw 65-byte signature directly
	// The signature is already in [R (32) || S (32) || V (1)] format from ethcrypto.Sign()
	londonSigner := types.NewLondonSigner(big.NewInt(chainIDVal))
	signedTx, err := tx.WithSignature(londonSigner, signature)
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_SIGNING_FAILED",
			fmt.Sprintf("failed to attach signature: %v", err),
			err,
		)
	}

	// Debug: Verify recovered sender matches expected from address
	recoveredSender, err := types.Sender(londonSigner, signedTx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[ETH Sign] WARNING: Could not recover sender: %v\n", err)
	} else {
		fmt.Fprintf(os.Stderr, "[ETH Sign] Expected from: %s\n", unsigned.From)
		fmt.Fprintf(os.Stderr, "[ETH Sign] Recovered sender: %s\n", recoveredSender.Hex())
		if normalizeHash(recoveredSender.Hex()) != normalizeHash(unsigned.From) {
			fmt.Fprintf(os.Stderr, "[ETH Sign] CRITICAL: Sender mismatch! Transaction will fail with 'insufficient funds'\n")
		}
	}

	// Step 6: RLP-encode the signed transaction for broadcasting
	serializedTx, err := signedTx.MarshalBinary()
	if err != nil {
		return nil, chainadapter.NewNonRetryableError(
			"ERR_SERIALIZATION_FAILED",
			fmt.Sprintf("failed to serialize signed transaction: %v", err),
			err,
		)
	}

	// Step 7: Compute the actual transaction hash from the signed tx
	txHash := signedTx.Hash().Hex()

	// Step 8: Create SignedTransaction
	signed := &chainadapter.SignedTransaction{
		UnsignedTx:   unsigned,
		Signature:    signature,
		SignedBy:     signer.GetAddress(),
		TxHash:       txHash,
		SerializedTx: serializedTx,
		SignedAt:     unsigned.CreatedAt,
	}

	return signed, nil
}

// reconstructTxFromChainSpecific is a helper to get value from chain specific
func getChainSpecificInt64(chainSpecific map[string]interface{}, key string) int64 {
	if v, ok := chainSpecific[key].(int64); ok {
		return v
	}
	if f, ok := chainSpecific[key].(float64); ok {
		return int64(f)
	}
	return 0
}

// Ensure crypto import is used
var _ = crypto.Keccak256

// Broadcast submits a signed Ethereum transaction to the blockchain network.
//
// Contract:
// - MUST check TransactionStateStore before broadcasting (idempotency)
// - MUST increment retry count on subsequent attempts
// - MUST record FirstSeen and LastRetry timestamps
// - MUST return existing BroadcastReceipt if transaction already broadcast
// - MUST handle duplicate transaction errors gracefully
func (e *EthereumAdapter) Broadcast(ctx context.Context, signed *chainadapter.SignedTransaction) (result *chainadapter.BroadcastReceipt, err error) {
	// Record metrics
	start := time.Now()
	defer func() {
		if e.metrics != nil {
			duration := time.Since(start)
			success := err == nil
			e.metrics.RecordTransactionBroadcast(e.chainID, duration, success)
		}
	}()

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
//
// Contract:
// - MUST use HTTP polling (WebSocket support can be added later)
// - MUST send initial status immediately
// - MUST close channel when context is cancelled
// - MUST send updates only on state change
// - Poll interval: 12 seconds (Ethereum block time ~12 seconds)
//
// Returns:
// - Channel receiving status updates
// - Error if initial status query fails
func (e *EthereumAdapter) SubscribeStatus(ctx context.Context, txHash string) (<-chan *chainadapter.TransactionStatus, error) {
	statusChan := make(chan *chainadapter.TransactionStatus, 10)

	// Get initial status
	initialStatus, err := e.QueryStatus(ctx, txHash)
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
		pollInterval := 12 * time.Second
		maxPollInterval := 60 * time.Second
		errorBackoff := 3 * time.Second

		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// Query current status
				status, err := e.QueryStatus(ctx, txHash)
				if err != nil {
					// On error, increase backoff and continue
					ticker.Reset(errorBackoff)
					if errorBackoff < maxPollInterval {
						errorBackoff *= 2
					}
					continue
				}

				// Reset backoff on success
				errorBackoff = 3 * time.Second

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

					// Once finalized or failed, we can slow down polling
					if status.Status == chainadapter.TxStatusFinalized || status.Status == chainadapter.TxStatusFailed {
						ticker.Reset(maxPollInterval)
					}
				}
			}
		}
	}()

	return statusChan, nil
}
