// Package contract provides contract tests that MUST pass for all ChainAdapter implementations.
// These tests verify the interface contract guarantees specified in the ChainAdapter documentation.
package contract

import (
	"context"
	"math/big"
	"testing"

	"github.com/arcsign/chainadapter"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestBuildIdempotency verifies TC-001: Build method MUST be deterministic.
//
// Contract: Same TransactionRequest MUST produce identical UnsignedTransaction ID and SigningPayload.
//
// This test should be run against all ChainAdapter implementations.
func TestBuildIdempotency(t *testing.T, adapter chainadapter.ChainAdapter) {
	// Arrange: Create a transaction request
	req := &chainadapter.TransactionRequest{
		From:     "test_address_1",
		To:       "test_address_2",
		Amount:   big.NewInt(100000),
		Asset:    adapter.ChainID(),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	// Act: Build the same transaction twice
	unsigned1, err1 := adapter.Build(context.Background(), req)
	unsigned2, err2 := adapter.Build(context.Background(), req)

	// Assert: Both builds should succeed
	require.NoError(t, err1, "First Build() call should succeed")
	require.NoError(t, err2, "Second Build() call should succeed")
	require.NotNil(t, unsigned1, "First unsigned transaction should not be nil")
	require.NotNil(t, unsigned2, "Second unsigned transaction should not be nil")

	// Assert: Transaction IDs must be identical
	assert.Equal(t, unsigned1.ID, unsigned2.ID,
		"Same TransactionRequest must produce identical transaction ID")

	// Assert: Signing payloads must be identical
	assert.Equal(t, unsigned1.SigningPayload, unsigned2.SigningPayload,
		"Same TransactionRequest must produce identical signing payload")

	// Additional assertions for determinism
	assert.Equal(t, unsigned1.From, unsigned2.From, "From address must match")
	assert.Equal(t, unsigned1.To, unsigned2.To, "To address must match")
	assert.Equal(t, unsigned1.Amount.Cmp(unsigned2.Amount), 0, "Amount must match")
	assert.Equal(t, unsigned1.Fee.Cmp(unsigned2.Fee), 0, "Fee must match")
	assert.Equal(t, unsigned1.ChainID, unsigned2.ChainID, "ChainID must match")
}

// TestBroadcastIdempotency verifies TC-002: Broadcast MUST be idempotent.
//
// Contract: Broadcasting same SignedTransaction 3+ times MUST return identical TxHash without errors.
//
// This test should be run against all ChainAdapter implementations.
func TestBroadcastIdempotency(t *testing.T, adapter chainadapter.ChainAdapter, signed *chainadapter.SignedTransaction) {
	// Act: Broadcast the same signed transaction 3 times
	receipt1, err1 := adapter.Broadcast(context.Background(), signed)
	receipt2, err2 := adapter.Broadcast(context.Background(), signed)
	receipt3, err3 := adapter.Broadcast(context.Background(), signed)

	// Assert: All broadcasts should succeed
	require.NoError(t, err1, "First Broadcast() should succeed")
	require.NoError(t, err2, "Second Broadcast() should succeed (idempotent)")
	require.NoError(t, err3, "Third Broadcast() should succeed (idempotent)")
	require.NotNil(t, receipt1, "First receipt should not be nil")
	require.NotNil(t, receipt2, "Second receipt should not be nil")
	require.NotNil(t, receipt3, "Third receipt should not be nil")

	// Assert: All transaction hashes must be identical
	assert.Equal(t, receipt1.TxHash, receipt2.TxHash,
		"Second broadcast must return same TxHash")
	assert.Equal(t, receipt1.TxHash, receipt3.TxHash,
		"Third broadcast must return same TxHash")

	// Assert: ChainID must be consistent
	assert.Equal(t, receipt1.ChainID, receipt2.ChainID, "ChainID must match")
	assert.Equal(t, receipt1.ChainID, receipt3.ChainID, "ChainID must match")
}

// TestEstimateIdempotency verifies TC-005: Estimate MUST be idempotent.
//
// Contract: Consecutive estimates MUST be within 10% (accounting for network volatility).
//
// This test should be run against all ChainAdapter implementations.
func TestEstimateIdempotency(t *testing.T, adapter chainadapter.ChainAdapter) {
	// Arrange: Create a transaction request
	req := &chainadapter.TransactionRequest{
		From:     "test_address_1",
		To:       "test_address_2",
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
		"Consecutive estimates should be within 10%%, got diff=%s, threshold=%s",
		diff.String(), threshold.String())

	// Assert: ChainID must be consistent
	assert.Equal(t, estimate1.ChainID, estimate2.ChainID, "ChainID must match")
}
