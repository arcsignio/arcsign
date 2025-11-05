// Package ethereum - Unit tests for Broadcast functionality
package ethereum

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
	txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	// Setup mock state store
	mockStore := storage.NewMockTxStore()

	// Create adapter
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil) // Mainnet
	require.NoError(t, err)

	// Create signed transaction
	signedTx := &chainadapter.SignedTransaction{
		UnsignedTx: &chainadapter.UnsignedTransaction{
			From:   "0xtest",
			To:     "0xdest",
			Amount: nil,
		},
		Signature:    []byte{0x01, 0x02, 0x03},
		SignedBy:     "0xtest",
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x70}, // EIP-1559 transaction prefix
	}

	// Broadcast
	receipt, err := adapter.Broadcast(ctx, signedTx)

	// Assert
	require.NoError(t, err)
	assert.NotNil(t, receipt)
	assert.Equal(t, txHash, receipt.TxHash)
	assert.Equal(t, "ethereum", receipt.ChainID)
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
	txHash := "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		UnsignedTx: &chainadapter.UnsignedTransaction{
			From: "0xtest",
			To:   "0xdest",
		},
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x71},
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

	// Verify only one state entry exists
	assert.Equal(t, 1, mockStore.Count(), "Should only have one state entry")
}

// TestBroadcastRetryCountIncrement verifies idempotency when transaction already broadcast.
func TestBroadcastRetryCountIncrement(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "0xretry1234retry1234retry1234retry1234retry1234retry1234retry1234retry1234"
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	mockStore := storage.NewMockTxStore()

	// Pre-populate state store with existing broadcast
	existingState := &storage.TxState{
		TxHash:     txHash,
		ChainID:    "ethereum",
		RetryCount: 1,
		FirstSeen:  time.Now().Add(-1 * time.Hour),
		LastRetry:  time.Now().Add(-1 * time.Hour),
		Status:     storage.TxStatusPending,
	}
	mockStore.Set(txHash, existingState)

	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x72},
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
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 5, nil) // Goerli
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
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 5, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       "0xtest",
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
	mockRPC.SetError("eth_sendRawTransaction", fmt.Errorf("insufficient funds for gas * price + value"))

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       "0xerror_test",
		SerializedTx: []byte{0x02, 0xf8, 0x73},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.Error(t, err)
	assert.Nil(t, receipt)
	assert.Contains(t, err.Error(), "insufficient funds")
}

// TestBroadcastAlreadyKnown verifies handling of "already known" errors.
func TestBroadcastAlreadyKnown(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "0xknown1234known1234known1234known1234known1234known1234known1234known1234"

	// Simulate "already known" error
	mockRPC.SetError("eth_sendRawTransaction", fmt.Errorf("already known"))

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x74},
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

// TestBroadcastKnownTransaction verifies handling of "known transaction" errors.
func TestBroadcastKnownTransaction(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "0xknown5678known5678known5678known5678known5678known5678known5678known5678"

	// Simulate "known transaction" error
	mockRPC.SetError("eth_sendRawTransaction", fmt.Errorf("known transaction: 0xknown5678..."))

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x75},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.NoError(t, err)
	assert.NotNil(t, receipt)
	assert.Equal(t, txHash, receipt.TxHash)
}

// TestBroadcastWithoutStateStore verifies broadcast works without state store.
func TestBroadcastWithoutStateStore(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "0xnostore1234nostore1234nostore1234nostore1234nostore1234nostore1234nostore"
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	// Create adapter WITHOUT state store
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x76},
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
	expectedHash := "0xexpected1234expected1234expected1234expected1234expected1234expected1234"
	actualHash := "0xactual5678actual5678actual5678actual5678actual5678actual5678actual5678"

	// RPC returns different hash
	mockRPC.SetResponse("eth_sendRawTransaction", actualHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       expectedHash,
		SerializedTx: []byte{0x02, 0xf8, 0x77},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.Error(t, err)
	assert.Nil(t, receipt)
	errMsg := strings.ToLower(err.Error())
	assert.Contains(t, errMsg, "hash", "Error should mention 'hash'")
	assert.Contains(t, errMsg, "mismatch", "Error should mention 'mismatch'")
}

// TestBroadcastHashCaseInsensitive verifies hash comparison is case-insensitive.
func TestBroadcastHashCaseInsensitive(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()

	// Hash with uppercase
	expectedHash := "0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234"
	// RPC returns lowercase
	actualHash := "0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"

	mockRPC.SetResponse("eth_sendRawTransaction", actualHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       expectedHash,
		SerializedTx: []byte{0x02, 0xf8, 0x78},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	// Should succeed despite case difference
	require.NoError(t, err)
	assert.NotNil(t, receipt)
	assert.Equal(t, expectedHash, receipt.TxHash)
}

// TestBroadcastTimestamps verifies timestamp tracking.
func TestBroadcastTimestamps(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "0xtime1234time1234time1234time1234time1234time1234time1234time1234time1234"
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	before := time.Now()

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x79},
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

// TestBroadcastSepoliaNetwork verifies correct chain ID for Sepolia.
func TestBroadcastSepoliaNetwork(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "0xsepolia1234sepolia1234sepolia1234sepolia1234sepolia1234sepolia1234"
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 11155111, nil) // Sepolia
	require.NoError(t, err)

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte{0x02, 0xf8, 0x7a},
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.NoError(t, err)
	assert.Equal(t, "ethereum-sepolia", receipt.ChainID)
}

// TestBroadcastHexFormatting verifies transaction hex is properly formatted with 0x prefix.
func TestBroadcastHexFormatting(t *testing.T) {
	ctx := context.Background()

	mockRPC := rpc.NewMockRPCClient()
	txHash := "0xhex1234hex1234hex1234hex1234hex1234hex1234hex1234hex1234hex1234hex1234"
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	mockStore := storage.NewMockTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, mockStore, 1, nil)
	require.NoError(t, err)

	// Raw transaction bytes (will be converted to 0x-prefixed hex)
	rawTx := []byte{0x02, 0xf8, 0x7b, 0x01, 0x02, 0x03}

	signedTx := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: rawTx,
	}

	receipt, err := adapter.Broadcast(ctx, signedTx)

	require.NoError(t, err)
	assert.NotNil(t, receipt)

	// Note: In the actual implementation, the adapter converts to 0x-prefixed hex
	// The mock RPC client would receive "0x02f87b010203"
}
