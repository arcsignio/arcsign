// Package bitcoin - Fee estimation implementation
package bitcoin

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/arcsign/chainadapter"
)

// FeeEstimator estimates transaction fees for Bitcoin using estimatesmartfee and mempool analysis.
type FeeEstimator struct {
	rpcHelper *RPCHelper
	network   string
}

// NewFeeEstimator creates a new Bitcoin fee estimator.
func NewFeeEstimator(rpcHelper *RPCHelper, network string) *FeeEstimator {
	return &FeeEstimator{
		rpcHelper: rpcHelper,
		network:   network,
	}
}

// Estimate calculates fee estimates with confidence bounds.
//
// Strategy:
// 1. Use estimatesmartfee for target confirmation blocks
// 2. Query multiple targets to establish min/max bounds
// 3. Calculate confidence based on RPC reliability and network conditions
func (f *FeeEstimator) Estimate(ctx context.Context, req *chainadapter.TransactionRequest) (*chainadapter.FeeEstimate, error) {
	// Determine target blocks based on FeeSpeed
	var targetBlocks int
	var estimatedBlocks int

	switch req.FeeSpeed {
	case chainadapter.FeeSpeedFast:
		targetBlocks = 1
		estimatedBlocks = 1
	case chainadapter.FeeSpeedNormal:
		targetBlocks = 3
		estimatedBlocks = 3
	case chainadapter.FeeSpeedSlow:
		targetBlocks = 6
		estimatedBlocks = 6
	default:
		targetBlocks = 3
		estimatedBlocks = 3
	}

	// Get fee rate for target blocks
	feeRateSatPerByte, err := f.rpcHelper.EstimateSmartFee(ctx, targetBlocks)
	if err != nil {
		// RPC failure - use fallback estimates with low confidence
		return f.fallbackEstimate(req.FeeSpeed), nil
	}

	// Get fee rates for min/max bounds
	minFeeRate, _ := f.rpcHelper.EstimateSmartFee(ctx, targetBlocks*2)   // Slower = cheaper
	maxFeeRate, _ := f.rpcHelper.EstimateSmartFee(ctx, targetBlocks/2+1) // Faster = more expensive

	if minFeeRate == 0 {
		minFeeRate = feeRateSatPerByte * 80 / 100 // 80% of recommended
	}
	if maxFeeRate == 0 {
		maxFeeRate = feeRateSatPerByte * 150 / 100 // 150% of recommended
	}

	// Ensure min < recommended < max
	if minFeeRate > feeRateSatPerByte {
		minFeeRate = feeRateSatPerByte * 90 / 100
	}
	if maxFeeRate < feeRateSatPerByte {
		maxFeeRate = feeRateSatPerByte * 120 / 100
	}

	// Estimate transaction size (conservative estimate)
	// P2WPKH transaction: ~140 vbytes for 1 input, 2 outputs
	estimatedSize := int64(140)

	// Calculate total fees
	minFee := big.NewInt(minFeeRate * estimatedSize)
	recommendedFee := big.NewInt(feeRateSatPerByte * estimatedSize)
	maxFee := big.NewInt(maxFeeRate * estimatedSize)

	// Calculate confidence based on bounds width
	confidence := f.calculateConfidence(minFeeRate, feeRateSatPerByte, maxFeeRate)

	// Generate reason
	reason := f.generateReason(confidence, feeRateSatPerByte)

	return &chainadapter.FeeEstimate{
		ChainID:         "bitcoin", // Will be overridden by adapter
		Timestamp:       time.Now(),
		MinFee:          minFee,
		MaxFee:          maxFee,
		Recommended:     recommendedFee,
		Confidence:      confidence,
		Reason:          reason,
		EstimatedBlocks: estimatedBlocks,
		BaseFee:         nil, // Bitcoin doesn't have base fee (UTXO-based)
	}, nil
}

// calculateConfidence calculates confidence level (0-100) based on fee rate stability.
func (f *FeeEstimator) calculateConfidence(minRate, recommended, maxRate int64) int {
	if recommended == 0 {
		return 50 // Low confidence if no data
	}

	// Calculate bounds width as percentage of recommended
	lowerSpread := float64(recommended-minRate) / float64(recommended)
	upperSpread := float64(maxRate-recommended) / float64(recommended)

	// Average spread
	avgSpread := (lowerSpread + upperSpread) / 2

	// Confidence inversely proportional to spread
	// Narrow spread (±5%) = high confidence (95%)
	// Wide spread (±50%) = low confidence (50%)
	confidence := 100 - int(avgSpread*100)

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
func (f *FeeEstimator) generateReason(confidence int, feeRate int64) string {
	switch {
	case confidence >= 90:
		return fmt.Sprintf("Network stable, fee rate %d sat/byte with high certainty", feeRate)
	case confidence >= 70:
		return fmt.Sprintf("Network conditions normal, fee rate %d sat/byte", feeRate)
	case confidence >= 50:
		return fmt.Sprintf("Network volatile, fee rate %d sat/byte may fluctuate", feeRate)
	default:
		return "Insufficient data for reliable estimate, using fallback rates"
	}
}

// fallbackEstimate returns conservative estimates when RPC is unavailable.
func (f *FeeEstimator) fallbackEstimate(speed chainadapter.FeeSpeed) *chainadapter.FeeEstimate {
	var feeRateSatPerByte int64
	var estimatedBlocks int

	switch speed {
	case chainadapter.FeeSpeedFast:
		feeRateSatPerByte = 50 // 50 sat/byte
		estimatedBlocks = 1
	case chainadapter.FeeSpeedNormal:
		feeRateSatPerByte = 20 // 20 sat/byte
		estimatedBlocks = 3
	case chainadapter.FeeSpeedSlow:
		feeRateSatPerByte = 10 // 10 sat/byte
		estimatedBlocks = 6
	default:
		feeRateSatPerByte = 20
		estimatedBlocks = 3
	}

	estimatedSize := int64(140) // Conservative P2WPKH estimate

	minFee := big.NewInt(feeRateSatPerByte * 80 / 100 * estimatedSize)
	recommendedFee := big.NewInt(feeRateSatPerByte * estimatedSize)
	maxFee := big.NewInt(feeRateSatPerByte * 150 / 100 * estimatedSize)

	return &chainadapter.FeeEstimate{
		ChainID:         "bitcoin",
		Timestamp:       time.Now(),
		MinFee:          minFee,
		MaxFee:          maxFee,
		Recommended:     recommendedFee,
		Confidence:      50, // Low confidence for fallback
		Reason:          "Using fallback estimates (RPC unavailable)",
		EstimatedBlocks: estimatedBlocks,
		BaseFee:         nil,
	}
}

// EstimateWithUTXOs estimates fees based on actual UTXO selection.
//
// This provides more accurate estimates by considering the actual transaction size.
func (f *FeeEstimator) EstimateWithUTXOs(ctx context.Context, req *chainadapter.TransactionRequest, utxos []UTXO) (*chainadapter.FeeEstimate, error) {
	// Get base estimate
	baseEstimate, err := f.Estimate(ctx, req)
	if err != nil {
		return nil, err
	}

	// Calculate actual transaction size based on UTXOs
	// P2WPKH: 10 bytes overhead + (input_count * 68) + (output_count * 31)
	numInputs := len(utxos)
	numOutputs := 2 // Recipient + change (conservative)

	if req.Memo != "" {
		numOutputs++ // OP_RETURN output
	}

	actualSize := int64(10 + numInputs*68 + numOutputs*31)

	// Adjust fees based on actual size
	sizeRatio := float64(actualSize) / 140.0 // 140 was our estimate

	minFee := new(big.Int).Mul(baseEstimate.MinFee, big.NewInt(int64(sizeRatio*100)))
	minFee.Div(minFee, big.NewInt(100))

	recommendedFee := new(big.Int).Mul(baseEstimate.Recommended, big.NewInt(int64(sizeRatio*100)))
	recommendedFee.Div(recommendedFee, big.NewInt(100))

	maxFee := new(big.Int).Mul(baseEstimate.MaxFee, big.NewInt(int64(sizeRatio*100)))
	maxFee.Div(maxFee, big.NewInt(100))

	return &chainadapter.FeeEstimate{
		ChainID:         baseEstimate.ChainID,
		Timestamp:       baseEstimate.Timestamp,
		MinFee:          minFee,
		MaxFee:          maxFee,
		Recommended:     recommendedFee,
		Confidence:      baseEstimate.Confidence,
		Reason:          baseEstimate.Reason,
		EstimatedBlocks: baseEstimate.EstimatedBlocks,
		BaseFee:         nil,
	}, nil
}
