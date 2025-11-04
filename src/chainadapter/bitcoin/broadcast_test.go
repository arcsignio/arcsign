// Package bitcoin - Unit tests for Broadcast functionality
package bitcoin

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestBroadcastSuccess verifies successful transaction broadcast.
func TestBroadcastSuccess(t *testing.T) {
	ctx := context.Background()

	// Setup mock RPC client
	mockRPC := rpc.NewMockRPCClient()
	txHash := "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	mockRPC.SetResponse("sendrawtransaction", txHash)

	// Setup mock state store
	mockStore := storage.NewMockTxStore()

	// Create adapter
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "testnet3", nil)
	require.NoError(t, err)

	// Create signed transaction
	signedTx := &chainadapter.SignedTransaction{
		UnsignedTx: &chainadapter.UnsignedTransaction{
			From:   "tb1qtest",
			To:     "tb1qdest",
			Amount: nil,
		},
		Signature:    []byte{0x01, 0x02, 0x03},
		SignedBy:     "tb1qtest",
		TxHash:       txHash,
		SerializedTx: []byte{0x01, 0x00, 0x00, 0x00}, // Minimal transaction bytes
	}

	// Broadcast
	receipt, err := adapter.Broadcast(ctx, signedTx)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, receipt)
	assert.Equal(t, txHash, receipt.TxHash)
	assert.Equal(t, "bitcoin-testnet", receipt.ChainID)
	assert.False(t, receipt.SubmittedAt.IsZero())

	// Verify state store was updated
	state, err := mockStore.Get(txHash)
	require.NoError(t, err)
	require.NotNil(t, state)
	assert.Equal(t, 1, state.RetryCount)
	assert.Equal(t, storage.TxStatusPending, state.Status)
	assert.False(t, state.FirstSeen.IsZero())
	assert.False(t, state.LastRetry.IsZero())
}

// TestBroadcastIdempotency verifies that broadcasting the same transaction twice is idempotent.
func TestBroadcastIdempotency(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
	mockRPC.SetResponse("sendrawtransaction", txHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "mainnet", nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		UnsignedTx: &chainadapter.UnsignedTransaction{
			From: "bc1qtest",
			To:   "bc1qdest",
		},
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0x00, 0x00, 0x00},
	}

	// First broadcast
	receipt1, err := adapter.Broadcast(ctx, signedTx)
	require.NoError(t, err)
	assert.Equal(t, txHash, receipt1.TxHash)

	// Get first broadcast time
	state1, _ := mockStore.Get(txHash)
	firstBroadcast := state1.FirstSeen

	// Wait a bit to ensure timestamp difference
	time.Sleep(10 * time.Millisecond)

	// Second broadcast (should return cached result)
	receipt2, err := adapter.Broadcast(ctx, signedTx)
	require.NoError(t, err)
	assert.Equal(t, txHash, receipt2.TxHash)

	// Verify state was NOT duplicated
	state2, err := mockStore.Get(txHash)
	require.NoError(t, err)
	assert.Equal(t, firstBroadcast, state2.FirstSeen, "FirstSeen should not change on retry")

	// Verify RPC was only called once (idempotency)
	// Note: In current implementation, RPC is still called but error is handled
	assert.Equal(t, 1, mockStore.Count(), "Should only have one state entry")
}

// TestBroadcastRetryCountIncrement verifies idempotency when transaction already broadcast.
func TestBroadcastRetryCountIncrement(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "retry1234retry1234retry1234retry1234retry1234retry1234retry1234retry1234"
	mockRPC.SetResponse("sendrawtransaction", txHash)

	mockStore := storage.NewMockTxStore()

	// Pre-populate state store with existing broadcast
	existingState := &storage.TxState{
		TxHash:     txHash,
		ChainID:    "bitcoin",
		RetryCount: 1,
		FirstSeen:  time.Now().Add(-1 * time.Hour),
		LastRetry:  time.Now().Add(-1 * time.Hour),
		Status:     storage.TxStatusPending,
	}
	mockStore.Set(txHash, existingState)

	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "mainnet", nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x03, 0x00, 0x00, 0x00},
	}

	// Broadcast again (should be idempotent)
	receipt, err := adapter.Broadcast(ctx, signedTx)
	require.NoError(t, err)
	assert.NotNil(t, receipt)

	// Verify retry count was NOT incremented (idempotency)
	state, err := mockStore.Get(txHash)
	require.NoError(t, err)
	assert.Equal(t, 1, state.RetryCount, "RetryCount should remain 1 (idempotent)")
	assert.Equal(t, existingState.FirstSeen, state.FirstSeen, "FirstSeen should remain unchanged")
	// LastRetry should also be unchanged due to idempotency
	assert.Equal(t, existingState.LastRetry, state.LastRetry, "LastRetry should remain unchanged (idempotent)")
}

// TestBroadcastNilInput verifies error handling for nil input.
func TestBroadcastNilInput(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	mockStore := storage.NewMockTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "testnet3", nil)
	require.NoError(t, err)

	// Broadcast nil transaction
	receipt, err := adapter.Broadcast(ctx, nil)

	// Assert error
	require.Error(t, err)
	assert.Nil(t, receipt)
	assert.Contains(t, err.Error(), "signed transaction is nil")
}

// TestBroadcastEmptySerializedTx verifies error handling for empty serialized tx.
func TestBroadcastEmptySerializedTx(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	mockStore := storage.NewMockTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "testnet3", nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       "test",
		SerializedTx: []byte{}, // Empty
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.Error(t, err)
	assert.Nil(t, receipt)
	assert.Contains(t, err.Error(), "SerializedTx is empty")
}

// TestBroadcastRPCError verifies error handling for RPC failures.
func TestBroadcastRPCError(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	mockRPC.SetError("sendrawtransaction", fmt.Errorf("network error"))

	mockStore := storage.NewMockTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "testnet3", nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       "error_test",
		SerializedTx: []byte{0x04, 0x00, 0x00, 0x00},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.Error(t, err)
	assert.Nil(t, receipt)
	assert.Contains(t, err.Error(), "network error")
}

// TestBroadcastAlreadyKnown verifies handling of "already known" errors.
func TestBroadcastAlreadyKnown(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "known1234known1234known1234known1234known1234known1234known1234known1234"

	// Simulate "already in block chain" error
	mockRPC.SetError("sendrawtransaction", fmt.Errorf("txn-already-in-block-chain"))

	mockStore := storage.NewMockTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "mainnet", nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x05, 0x00, 0x00, 0x00},
	}

	// Should treat "already known" as success
	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.NoError(t, err)
	assert.NotNil(t, receipt)
	assert.Equal(t, txHash, receipt.TxHash)

	// Verify state was stored
	state, err := mockStore.Get(txHash)
	require.NoError(t, err)
	assert.Equal(t, 1, state.RetryCount)
}

// TestBroadcastWithoutStateStore verifies broadcast works without state store.
func TestBroadcastWithoutStateStore(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "nostore1234nostore1234nostore1234nostore1234nostore1234nostore1234nostore"
	mockRPC.SetResponse("sendrawtransaction", txHash)

	// Create adapter WITHOUT state store
	adapter, err := NewBitcoinAdapter(mockRPC, nil, "testnet3", nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x06, 0x00, 0x00, 0x00},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.NoError(t, err)
	assert.NotNil(t, receipt)
	assert.Equal(t, txHash, receipt.TxHash)
}

// TestBroadcastHashMismatch verifies error when broadcasted hash doesn't match.
func TestBroadcastHashMismatch(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	expectedHash := "expected1234expected1234expected1234expected1234expected1234expected1234"
	actualHash := "actual5678actual5678actual5678actual5678actual5678actual5678actual5678"

	// RPC returns different hash
	mockRPC.SetResponse("sendrawtransaction", actualHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "mainnet", nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       expectedHash,
		SerializedTx: []byte{0x07, 0x00, 0x00, 0x00},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.Error(t, err)
	assert.Nil(t, receipt)
	errMsg := strings.ToLower(err.Error())
	assert.Contains(t, errMsg, "hash", "Error should mention 'hash'")
	assert.Contains(t, errMsg, "mismatch", "Error should mention 'mismatch'")
}

// TestBroadcastTimestamps verifies timestamp tracking.
func TestBroadcastTimestamps(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "time1234time1234time1234time1234time1234time1234time1234time1234time1234"
	mockRPC.SetResponse("sendrawtransaction", txHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, mockStore, "testnet3", nil)
	require.NoError(t, err)

	before := time.Now()

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x08, 0x00, 0x00, 0x00},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)
	require.NoError(t, err)

	after := time.Now()

	// Verify receipt timestamp is within range
	assert.True(t, receipt.SubmittedAt.After(before) || receipt.SubmittedAt.Equal(before))
	assert.True(t, receipt.SubmittedAt.Before(after) || receipt.SubmittedAt.Equal(after))

	// Verify state timestamps
	state, err := mockStore.Get(txHash)
	require.NoError(t, err)
	assert.True(t, state.FirstSeen.After(before) || state.FirstSeen.Equal(before))
	assert.True(t, state.LastRetry.After(before) || state.LastRetry.Equal(before))
	assert.Equal(t, state.FirstSeen, state.LastRetry, "On first broadcast, FirstSeen should equal LastRetry")
}
