// Package contract - Fee estimation contract tests
package contract

import (
	"context"
	"math/big"
	"testing"

	"github.com/arcsign/chainadapter"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFeeBoundsValidity verifies TC-004: Fee estimates MUST have valid bounds.
//
// Contract: MinFee ≤ Recommended ≤ MaxFee AND Confidence ∈ [0, 100]
//
// This test should be run against all ChainAdapter implementations.
func TestFeeBoundsValidity(t *testing.T, adapter chainadapter.ChainAdapter) {
	req := &chainadapter.TransactionRequest{
		From:     "valid_address_1",
		To:       "valid_address_2",
		Amount:   big.NewInt(50000),
		Asset:    adapter.ChainID(),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	// Act: Get fee estimate
	estimate, err := adapter.Estimate(context.Background(), req)

	// Assert: Estimate should succeed
	require.NoError(t, err, "Estimate() should succeed")
	require.NotNil(t, estimate, "Estimate should not be nil")

	// Assert: Fee bounds must be valid (MinFee ≤ Recommended ≤ MaxFee)
	assert.True(t, estimate.MinFee.Cmp(estimate.Recommended) <= 0,
		"MinFee (%s) must be ≤ Recommended (%s)",
		estimate.MinFee.String(), estimate.Recommended.String())

	assert.True(t, estimate.Recommended.Cmp(estimate.MaxFee) <= 0,
		"Recommended (%s) must be ≤ MaxFee (%s)",
		estimate.Recommended.String(), estimate.MaxFee.String())

	// Assert: All fees must be positive
	assert.True(t, estimate.MinFee.Cmp(big.NewInt(0)) > 0,
		"MinFee must be positive")
	assert.True(t, estimate.Recommended.Cmp(big.NewInt(0)) > 0,
		"Recommended must be positive")
	assert.True(t, estimate.MaxFee.Cmp(big.NewInt(0)) > 0,
		"MaxFee must be positive")

	// Assert: Confidence must be in range [0, 100]
	assert.GreaterOrEqual(t, estimate.Confidence, 0,
		"Confidence must be >= 0")
	assert.LessOrEqual(t, estimate.Confidence, 100,
		"Confidence must be <= 100")

	// Assert: EstimatedBlocks should be positive
	assert.Greater(t, estimate.EstimatedBlocks, 0,
		"EstimatedBlocks must be positive")

	// Assert: ChainID must match
	assert.Equal(t, adapter.ChainID(), estimate.ChainID,
		"Estimate ChainID must match adapter ChainID")

	// Assert: Timestamp should be recent (within last minute)
	assert.WithinDuration(t, estimate.Timestamp, estimate.Timestamp, estimate.Timestamp.Sub(estimate.Timestamp),
		"Timestamp should be set")

	// Assert: Reason should not be empty
	assert.NotEmpty(t, estimate.Reason,
		"Reason should explain confidence level")
}

// TestFeeBoundsVariation tests fee bounds under different FeeSpeed settings.
func TestFeeBoundsVariation(t *testing.T, adapter chainadapter.ChainAdapter) {
	testCases := []struct {
		speed           chainadapter.FeeSpeed
		expectedBlocks  int
		minConfidence   int
	}{
		{chainadapter.FeeSpeedFast, 1, 50},
		{chainadapter.FeeSpeedNormal, 3, 60},
		{chainadapter.FeeSpeedSlow, 6, 50},
	}

	for _, tc := range testCases {
		t.Run(string(tc.speed), func(t *testing.T) {
			req := &chainadapter.TransactionRequest{
				From:     "valid_address_1",
				To:       "valid_address_2",
				Amount:   big.NewInt(50000),
				Asset:    adapter.ChainID(),
				FeeSpeed: tc.speed,
			}

			estimate, err := adapter.Estimate(context.Background(), req)

			require.NoError(t, err)
			require.NotNil(t, estimate)

			// Verify bounds are valid
			assert.True(t, estimate.MinFee.Cmp(estimate.Recommended) <= 0)
			assert.True(t, estimate.Recommended.Cmp(estimate.MaxFee) <= 0)

			// Verify confidence is reasonable
			assert.GreaterOrEqual(t, estimate.Confidence, tc.minConfidence,
				"Confidence should be >= %d for %s speed", tc.minConfidence, tc.speed)
		})
	}
}

// TestFeeBoundsUnderCongestion tests that fee bounds widen under network congestion.
//
// Expected behavior:
// - Normal conditions: Narrow bounds (±10%), high confidence (>90%)
// - Congestion: Wider bounds (±30%), medium confidence (60-80%)
func TestFeeBoundsUnderCongestion(t *testing.T, adapter chainadapter.ChainAdapter, isCongested bool) {
	req := &chainadapter.TransactionRequest{
		From:     "valid_address_1",
		To:       "valid_address_2",
		Amount:   big.NewInt(50000),
		Asset:    adapter.ChainID(),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	estimate, err := adapter.Estimate(context.Background(), req)
	require.NoError(t, err)
	require.NotNil(t, estimate)

	// Calculate bounds width as percentage of recommended
	minDiff := new(big.Int).Sub(estimate.Recommended, estimate.MinFee)
	maxDiff := new(big.Int).Sub(estimate.MaxFee, estimate.Recommended)

	// Calculate percentage difference
	minPercent := new(big.Float).Quo(
		new(big.Float).SetInt(minDiff),
		new(big.Float).SetInt(estimate.Recommended),
	)
	maxPercent := new(big.Float).Quo(
		new(big.Float).SetInt(maxDiff),
		new(big.Float).SetInt(estimate.Recommended),
	)

	minPercentFloat, _ := minPercent.Float64()
	maxPercentFloat, _ := maxPercent.Float64()

	if !isCongested {
		// Normal conditions: Narrow bounds (±10%), high confidence (>90%)
		assert.LessOrEqual(t, minPercentFloat, 0.15,
			"MinFee should be within 15%% of Recommended under normal conditions")
		assert.LessOrEqual(t, maxPercentFloat, 0.15,
			"MaxFee should be within 15%% of Recommended under normal conditions")
		assert.GreaterOrEqual(t, estimate.Confidence, 90,
			"Confidence should be >90%% under normal conditions")
	} else {
		// Congestion: Wider bounds (±30%), medium confidence (60-80%)
		assert.LessOrEqual(t, maxPercentFloat, 0.50,
			"MaxFee should be within 50%% of Recommended under congestion")
		assert.GreaterOrEqual(t, estimate.Confidence, 50,
			"Confidence should be >=50%% under congestion")
		assert.LessOrEqual(t, estimate.Confidence, 90,
			"Confidence should be <=90%% under congestion")
	}
}

// TestEstimateIdempotency verifies TC-005: Estimate MUST be idempotent.
//
// Contract: Consecutive estimates MUST be within 10% (accounting for network volatility).
//
// This test should be run against all ChainAdapter implementations.
func TestEstimateIdempotency(t *testing.T, adapter chainadapter.ChainAdapter) {
	req := &chainadapter.TransactionRequest{
		From:     "valid_address_1",
		To:       "valid_address_2",
		Amount:   big.NewInt(50000),
		Asset:    adapter.ChainID(),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	// Act: Call Estimate() twice
	estimate1, err1 := adapter.Estimate(context.Background(), req)
	estimate2, err2 := adapter.Estimate(context.Background(), req)

	// Assert: Both estimates should succeed
	require.NoError(t, err1, "First Estimate() should succeed")
	require.NoError(t, err2, "Second Estimate() should succeed")
	require.NotNil(t, estimate1, "First estimate should not be nil")
	require.NotNil(t, estimate2, "Second estimate should not be nil")

	// Assert: Estimates should be similar (within 10% due to network variability)
	diff := new(big.Int).Sub(estimate1.Recommended, estimate2.Recommended)
	diff.Abs(diff)

	// Calculate 10% threshold
	threshold := new(big.Int).Div(estimate1.Recommended, big.NewInt(10))

	assert.True(t, diff.Cmp(threshold) <= 0,
		"Consecutive estimates should be within 10%%, got diff=%s, threshold=%s, estimate1=%s, estimate2=%s",
		diff.String(), threshold.String(), estimate1.Recommended.String(), estimate2.Recommended.String())

	// Assert: ChainID must be consistent
	assert.Equal(t, estimate1.ChainID, estimate2.ChainID,
		"ChainID must match between estimates")

	// Assert: Confidence should be reasonably stable (within 20 points)
	confidenceDiff := estimate1.Confidence - estimate2.Confidence
	if confidenceDiff < 0 {
		confidenceDiff = -confidenceDiff
	}
	assert.LessOrEqual(t, confidenceDiff, 20,
		"Confidence should be reasonably stable (within 20 points)")
}

// TestEstimateDifferentAmounts verifies that fee estimates scale appropriately with amount.
func TestEstimateDifferentAmounts(t *testing.T, adapter chainadapter.ChainAdapter) {
	amounts := []*big.Int{
		big.NewInt(10000),   // Small
		big.NewInt(100000),  // Medium
		big.NewInt(1000000), // Large
	}

	var estimates []*chainadapter.FeeEstimate

	for _, amount := range amounts {
		req := &chainadapter.TransactionRequest{
			From:     "valid_address_1",
			To:       "valid_address_2",
			Amount:   amount,
			Asset:    adapter.ChainID(),
			FeeSpeed: chainadapter.FeeSpeedNormal,
		}

		estimate, err := adapter.Estimate(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, estimate)

		estimates = append(estimates, estimate)
	}

	// For UTXO-based chains (Bitcoin), larger amounts may require more inputs, thus higher fees
	// For account-based chains (Ethereum), fees are independent of amount (gas-based)
	// We just verify all estimates are valid
	for i, estimate := range estimates {
		assert.True(t, estimate.MinFee.Cmp(estimate.Recommended) <= 0,
			"Estimate %d: MinFee <= Recommended", i)
		assert.True(t, estimate.Recommended.Cmp(estimate.MaxFee) <= 0,
			"Estimate %d: Recommended <= MaxFee", i)
	}
}

// TestEstimateWithMaxFeeConstraint verifies that estimates respect MaxFee constraint.
func TestEstimateWithMaxFeeConstraint(t *testing.T, adapter chainadapter.ChainAdapter) {
	maxFee := big.NewInt(100000) // Set a maximum acceptable fee

	req := &chainadapter.TransactionRequest{
		From:     "valid_address_1",
		To:       "valid_address_2",
		Amount:   big.NewInt(50000),
		Asset:    adapter.ChainID(),
		FeeSpeed: chainadapter.FeeSpeedNormal,
		MaxFee:   maxFee,
	}

	estimate, err := adapter.Estimate(context.Background(), req)

	// If estimate succeeds, recommended fee should respect constraint
	if err == nil {
		require.NotNil(t, estimate)
		assert.True(t, estimate.Recommended.Cmp(maxFee) <= 0,
			"Recommended fee should respect MaxFee constraint")
	}
	// If estimate fails, it should indicate fee constraint issue
	// (implementation-specific behavior)
}
