// Package ethereum - Fee estimation implementation for EIP-1559
package ethereum

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/arcsign/chainadapter"
)

// FeeEstimator estimates transaction fees for Ethereum using EIP-1559 (baseFee + priorityFee).
type FeeEstimator struct {
	rpcHelper *RPCHelper
	chainID   uint64
}

// NewFeeEstimator creates a new Ethereum fee estimator.
func NewFeeEstimator(rpcHelper *RPCHelper, chainID uint64) *FeeEstimator {
	return &FeeEstimator{
		rpcHelper: rpcHelper,
		chainID:   chainID,
	}
}

// SubscribeFeeUpdates provides real-time fee estimate updates by polling for new blocks.
//
// Note: This implementation uses polling. For production with WebSocket support,
// use eth_subscribe("newHeads") for real-time block notifications.
//
// Parameters:
// - ctx: Context for cancellation
// - req: Transaction request (used for fee speed calculation)
// - pollInterval: How often to check for new blocks (e.g., 12 seconds for Ethereum)
//
// Returns:
// - Channel receiving fee estimate updates
// - Error if subscription setup fails
func (f *FeeEstimator) SubscribeFeeUpdates(ctx context.Context, req *chainadapter.TransactionRequest, pollInterval time.Duration) (<-chan *chainadapter.FeeEstimate, error) {
	estimateChan := make(chan *chainadapter.FeeEstimate, 10)

	go func() {
		defer close(estimateChan)

		// Track last block number to detect new blocks
		var lastBlockNumber uint64
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()

		// Send initial estimate immediately
		if estimate, err := f.Estimate(ctx, req); err == nil {
			select {
			case estimateChan <- estimate:
			case <-ctx.Done():
				return
			}
		}

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// Check current block number
				blockNumber, err := f.rpcHelper.GetBlockNumber(ctx)
				if err != nil {
					// RPC error, skip this iteration
					continue
				}

				// New block detected
				if blockNumber > lastBlockNumber {
					lastBlockNumber = blockNumber

					// Re-estimate fees
					estimate, err := f.Estimate(ctx, req)
					if err != nil {
						// Estimation failed, skip
						continue
					}

					// Send updated estimate
					select {
					case estimateChan <- estimate:
					case <-ctx.Done():
						return
					default:
						// Channel full, drop old estimate
					}
				}
			}
		}
	}()

	return estimateChan, nil
}

// Estimate calculates fee estimates with confidence bounds for Ethereum EIP-1559.
//
// Strategy:
// 1. Get current base fee from latest block
// 2. Get priority fee from eth_feeHistory (50th percentile)
// 3. Apply multipliers based on FeeSpeed
// 4. Calculate min/max bounds with confidence
func (f *FeeEstimator) Estimate(ctx context.Context, req *chainadapter.TransactionRequest) (*chainadapter.FeeEstimate, error) {
	// Get base fee from latest block
	baseFee, err := f.rpcHelper.GetBaseFee(ctx)
	if err != nil {
		// RPC failure - use fallback estimates with low confidence
		return f.fallbackEstimate(req.FeeSpeed), nil
	}

	// Get priority fee from fee history
	priorityFee, err := f.rpcHelper.GetFeeHistory(ctx, 10) // Last 10 blocks
	if err != nil {
		// Use default priority fee if fee history fails
		priorityFee = big.NewInt(2e9) // 2 Gwei default
	}

	// Determine multipliers based on FeeSpeed
	var baseMultiplier int64
	var priorityMultiplier int64
	var estimatedBlocks int

	switch req.FeeSpeed {
	case chainadapter.FeeSpeedFast:
		baseMultiplier = 3      // 3x base fee for fast inclusion
		priorityMultiplier = 3  // 3x priority fee
		estimatedBlocks = 1
	case chainadapter.FeeSpeedNormal:
		baseMultiplier = 2      // 2x base fee for normal inclusion
		priorityMultiplier = 2  // 2x priority fee
		estimatedBlocks = 3
	case chainadapter.FeeSpeedSlow:
		baseMultiplier = 1      // 1x base fee for slow inclusion
		priorityMultiplier = 1  // 1x priority fee
		estimatedBlocks = 6
	default:
		baseMultiplier = 2
		priorityMultiplier = 2
		estimatedBlocks = 3
	}

	// Calculate recommended max fee per gas: (baseFee * multiplier) + priorityFee
	maxFeePerGas := new(big.Int).Mul(baseFee, big.NewInt(baseMultiplier))
	maxFeePerGas.Add(maxFeePerGas, new(big.Int).Mul(priorityFee, big.NewInt(priorityMultiplier)))

	// Calculate min fee (80% of recommended)
	minMaxFeePerGas := new(big.Int).Mul(maxFeePerGas, big.NewInt(80))
	minMaxFeePerGas.Div(minMaxFeePerGas, big.NewInt(100))

	// Calculate max fee (150% of recommended)
	maxMaxFeePerGas := new(big.Int).Mul(maxFeePerGas, big.NewInt(150))
	maxMaxFeePerGas.Div(maxMaxFeePerGas, big.NewInt(100))

	// Estimate gas limit (21000 for simple ETH transfer)
	// For contract calls, this would need to be estimated via eth_estimateGas
	gasLimit := int64(21000)

	// Calculate total fees
	minFee := new(big.Int).Mul(minMaxFeePerGas, big.NewInt(gasLimit))
	recommendedFee := new(big.Int).Mul(maxFeePerGas, big.NewInt(gasLimit))
	maxFee := new(big.Int).Mul(maxMaxFeePerGas, big.NewInt(gasLimit))

	// Calculate confidence based on base fee stability
	confidence := f.calculateConfidence(baseFee, priorityFee)

	// Generate reason
	reason := f.generateReason(confidence, baseFee, priorityFee)

	return &chainadapter.FeeEstimate{
		ChainID:         "ethereum", // Will be overridden by adapter
		Timestamp:       time.Now(),
		MinFee:          minFee,
		MaxFee:          maxFee,
		Recommended:     recommendedFee,
		Confidence:      confidence,
		Reason:          reason,
		EstimatedBlocks: estimatedBlocks,
		BaseFee:         baseFee, // EIP-1559 base fee
	}, nil
}

// calculateConfidence calculates confidence level (0-100) based on base fee stability.
//
// High confidence when:
// - Base fee is stable (not spiking)
// - Priority fee is reasonable (< 10 Gwei)
// - Network not congested
func (f *FeeEstimator) calculateConfidence(baseFee, priorityFee *big.Int) int {
	// Base confidence starts at 80%
	confidence := 80

	// Penalize high base fees (> 100 Gwei indicates congestion)
	baseFeeGwei := new(big.Int).Div(baseFee, big.NewInt(1e9))
	if baseFeeGwei.Cmp(big.NewInt(100)) > 0 {
		confidence -= 15 // High congestion
	} else if baseFeeGwei.Cmp(big.NewInt(50)) > 0 {
		confidence -= 10 // Medium congestion
	}

	// Penalize high priority fees (> 10 Gwei indicates competition)
	priorityFeeGwei := new(big.Int).Div(priorityFee, big.NewInt(1e9))
	if priorityFeeGwei.Cmp(big.NewInt(10)) > 0 {
		confidence -= 10 // High competition
	} else if priorityFeeGwei.Cmp(big.NewInt(5)) > 0 {
		confidence -= 5 // Medium competition
	}

	// Clamp to [50, 100] range
	if confidence < 50 {
		confidence = 50
	}
	if confidence > 100 {
		confidence = 100
	}

	return confidence
}

// generateReason generates human-readable explanation for confidence level.
func (f *FeeEstimator) generateReason(confidence int, baseFee, priorityFee *big.Int) string {
	baseFeeGwei := new(big.Int).Div(baseFee, big.NewInt(1e9))
	priorityFeeGwei := new(big.Int).Div(priorityFee, big.NewInt(1e9))

	switch {
	case confidence >= 80:
		return fmt.Sprintf("Network stable, base fee %s Gwei, priority fee %s Gwei",
			baseFeeGwei.String(), priorityFeeGwei.String())
	case confidence >= 65:
		return fmt.Sprintf("Network conditions normal, base fee %s Gwei, priority fee %s Gwei",
			baseFeeGwei.String(), priorityFeeGwei.String())
	case confidence >= 50:
		return fmt.Sprintf("Network congested, base fee %s Gwei may fluctuate",
			baseFeeGwei.String())
	default:
		return "Insufficient data for reliable estimate, using fallback rates"
	}
}

// fallbackEstimate returns conservative estimates when RPC is unavailable.
func (f *FeeEstimator) fallbackEstimate(speed chainadapter.FeeSpeed) *chainadapter.FeeEstimate {
	var baseFeeGwei int64
	var priorityFeeGwei int64
	var estimatedBlocks int

	// Fallback rates (conservative)
	switch speed {
	case chainadapter.FeeSpeedFast:
		baseFeeGwei = 50       // 50 Gwei base fee
		priorityFeeGwei = 3    // 3 Gwei priority fee
		estimatedBlocks = 1
	case chainadapter.FeeSpeedNormal:
		baseFeeGwei = 30       // 30 Gwei base fee
		priorityFeeGwei = 2    // 2 Gwei priority fee
		estimatedBlocks = 3
	case chainadapter.FeeSpeedSlow:
		baseFeeGwei = 20       // 20 Gwei base fee
		priorityFeeGwei = 1    // 1 Gwei priority fee
		estimatedBlocks = 6
	default:
		baseFeeGwei = 30
		priorityFeeGwei = 2
		estimatedBlocks = 3
	}

	// Calculate max fee per gas
	maxFeePerGas := big.NewInt((baseFeeGwei + priorityFeeGwei) * 1e9)

	// Estimate gas limit for simple transfer
	gasLimit := int64(21000)

	minFee := new(big.Int).Mul(maxFeePerGas, big.NewInt(gasLimit))
	minFee.Mul(minFee, big.NewInt(80)).Div(minFee, big.NewInt(100))

	recommendedFee := new(big.Int).Mul(maxFeePerGas, big.NewInt(gasLimit))

	maxFee := new(big.Int).Mul(maxFeePerGas, big.NewInt(gasLimit))
	maxFee.Mul(maxFee, big.NewInt(150)).Div(maxFee, big.NewInt(100))

	return &chainadapter.FeeEstimate{
		ChainID:         "ethereum",
		Timestamp:       time.Now(),
		MinFee:          minFee,
		MaxFee:          maxFee,
		Recommended:     recommendedFee,
		Confidence:      50, // Low confidence for fallback
		Reason:          "Using fallback estimates (RPC unavailable)",
		EstimatedBlocks: estimatedBlocks,
		BaseFee:         big.NewInt(baseFeeGwei * 1e9),
	}
}

// EstimateWithGasLimit estimates fees based on actual gas limit from eth_estimateGas.
//
// This provides more accurate estimates by considering the actual transaction complexity.
func (f *FeeEstimator) EstimateWithGasLimit(ctx context.Context, req *chainadapter.TransactionRequest, gasLimit uint64) (*chainadapter.FeeEstimate, error) {
	// Get base estimate
	baseEstimate, err := f.Estimate(ctx, req)
	if err != nil {
		return nil, err
	}

	// Recalculate fees based on actual gas limit
	// MaxFeePerGas = Recommended / 21000 (get per-gas rate from base estimate)
	maxFeePerGas := new(big.Int).Div(baseEstimate.Recommended, big.NewInt(21000))

	// Apply actual gas limit
	actualGasLimit := int64(gasLimit)

	minFee := new(big.Int).Mul(maxFeePerGas, big.NewInt(actualGasLimit))
	minFee.Mul(minFee, big.NewInt(80)).Div(minFee, big.NewInt(100))

	recommendedFee := new(big.Int).Mul(maxFeePerGas, big.NewInt(actualGasLimit))

	maxFee := new(big.Int).Mul(maxFeePerGas, big.NewInt(actualGasLimit))
	maxFee.Mul(maxFee, big.NewInt(150)).Div(maxFee, big.NewInt(100))

	return &chainadapter.FeeEstimate{
		ChainID:         baseEstimate.ChainID,
		Timestamp:       baseEstimate.Timestamp,
		MinFee:          minFee,
		MaxFee:          maxFee,
		Recommended:     recommendedFee,
		Confidence:      baseEstimate.Confidence,
		Reason:          baseEstimate.Reason,
		EstimatedBlocks: baseEstimate.EstimatedBlocks,
		BaseFee:         baseEstimate.BaseFee,
	}, nil
}
