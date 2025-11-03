// Package contract - State storage contract tests
package contract

import (
	"context"
	"testing"
	"time"

	"github.com/arcsign/chainadapter/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestTransactionHashLookup verifies TC-014: Transaction state store MUST enable hash lookup.
//
// Contract:
// - Store signed transaction before broadcast
// - Lookup by transaction hash must return stored state
// - State must include broadcast attempts and timestamps
//
// This test should be run against all TransactionStateStore implementations.
func TestTransactionHashLookup(t *testing.T, store storage.TransactionStateStore) {
	ctx := context.Background()

	// Arrange: Create test transaction state
	txHash := "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	chainID := "ethereum"
	state := &storage.TransactionState{
		TxHash:          txHash,
		ChainID:         chainID,
		SignedTx:        []byte("signed_transaction_data"),
		BroadcastCount:  0,
		FirstBroadcast:  time.Time{},
		LastBroadcast:   time.Time{},
		Confirmed:       false,
		BlockNumber:     0,
		BlockHash:       "",
		Confirmations:   0,
	}

	// Act: Store the transaction state
	err := store.Store(ctx, state)
	require.NoError(t, err, "Store() should succeed")

	// Act: Lookup by transaction hash
	retrieved, err := store.Lookup(ctx, txHash)

	// Assert: Lookup should succeed
	require.NoError(t, err, "Lookup() should succeed")
	require.NotNil(t, retrieved, "Retrieved state should not be nil")

	// Assert: Retrieved state should match stored state
	assert.Equal(t, state.TxHash, retrieved.TxHash, "TxHash should match")
	assert.Equal(t, state.ChainID, retrieved.ChainID, "ChainID should match")
	assert.Equal(t, state.SignedTx, retrieved.SignedTx, "SignedTx should match")
	assert.Equal(t, state.BroadcastCount, retrieved.BroadcastCount, "BroadcastCount should match")
	assert.Equal(t, state.Confirmed, retrieved.Confirmed, "Confirmed should match")
}

// TestBroadcastCountIncrement verifies that broadcast count increments correctly.
func TestBroadcastCountIncrement(t *testing.T, store storage.TransactionStateStore) {
	ctx := context.Background()

	txHash := "0x1111111111111111111111111111111111111111111111111111111111111111"
	chainID := "bitcoin"

	// Initial state
	state := &storage.TransactionState{
		TxHash:         txHash,
		ChainID:        chainID,
		SignedTx:       []byte("bitcoin_signed_tx"),
		BroadcastCount: 0,
		FirstBroadcast: time.Time{},
		LastBroadcast:  time.Time{},
		Confirmed:      false,
	}

	// Store initial state
	err := store.Store(ctx, state)
	require.NoError(t, err)

	// First broadcast
	now1 := time.Now()
	state.BroadcastCount = 1
	state.FirstBroadcast = now1
	state.LastBroadcast = now1
	err = store.Store(ctx, state)
	require.NoError(t, err)

	// Lookup after first broadcast
	retrieved1, err := store.Lookup(ctx, txHash)
	require.NoError(t, err)
	assert.Equal(t, 1, retrieved1.BroadcastCount, "BroadcastCount should be 1 after first broadcast")
	assert.False(t, retrieved1.FirstBroadcast.IsZero(), "FirstBroadcast should be set")

	// Second broadcast
	time.Sleep(10 * time.Millisecond) // Small delay
	now2 := time.Now()
	state.BroadcastCount = 2
	state.LastBroadcast = now2
	err = store.Store(ctx, state)
	require.NoError(t, err)

	// Lookup after second broadcast
	retrieved2, err := store.Lookup(ctx, txHash)
	require.NoError(t, err)
	assert.Equal(t, 2, retrieved2.BroadcastCount, "BroadcastCount should be 2 after second broadcast")
	assert.True(t, retrieved2.LastBroadcast.After(retrieved2.FirstBroadcast),
		"LastBroadcast should be after FirstBroadcast")
}

// TestConfirmationTracking verifies that confirmation state is tracked correctly.
func TestConfirmationTracking(t *testing.T, store storage.TransactionStateStore) {
	ctx := context.Background()

	txHash := "0x2222222222222222222222222222222222222222222222222222222222222222"
	chainID := "ethereum"

	// Initial unconfirmed state
	state := &storage.TransactionState{
		TxHash:         txHash,
		ChainID:        chainID,
		SignedTx:       []byte("eth_signed_tx"),
		BroadcastCount: 1,
		FirstBroadcast: time.Now(),
		LastBroadcast:  time.Now(),
		Confirmed:      false,
		BlockNumber:    0,
		BlockHash:      "",
		Confirmations:  0,
	}

	err := store.Store(ctx, state)
	require.NoError(t, err)

	// Update to confirmed state
	state.Confirmed = true
	state.BlockNumber = 12345678
	state.BlockHash = "0xblockhash1234567890"
	state.Confirmations = 6

	err = store.Store(ctx, state)
	require.NoError(t, err)

	// Lookup confirmed state
	retrieved, err := store.Lookup(ctx, txHash)
	require.NoError(t, err)
	require.NotNil(t, retrieved)

	assert.True(t, retrieved.Confirmed, "Transaction should be confirmed")
	assert.Equal(t, uint64(12345678), retrieved.BlockNumber, "BlockNumber should match")
	assert.Equal(t, "0xblockhash1234567890", retrieved.BlockHash, "BlockHash should match")
	assert.Equal(t, 6, retrieved.Confirmations, "Confirmations should match")
}

// TestLookupNonExistentHash verifies behavior when looking up non-existent hash.
func TestLookupNonExistentHash(t *testing.T, store storage.TransactionStateStore) {
	ctx := context.Background()

	// Lookup non-existent hash
	nonExistentHash := "0x9999999999999999999999999999999999999999999999999999999999999999"
	retrieved, err := store.Lookup(ctx, nonExistentHash)

	// Should return error or nil (implementation-specific)
	// Most implementations will return storage.ErrNotFound
	if err == nil {
		assert.Nil(t, retrieved, "Retrieved state should be nil for non-existent hash")
	} else {
		assert.Error(t, err, "Should return error for non-existent hash")
		// Could check for specific error type if defined
		// assert.Equal(t, storage.ErrNotFound, err)
	}
}

// TestMultipleChains verifies that different chains can store transactions with same hash.
//
// Note: In practice, different chains will have different transaction hashes,
// but the state store should support storing transactions from multiple chains.
func TestMultipleChains(t *testing.T, store storage.TransactionStateStore) {
	ctx := context.Background()

	// Bitcoin transaction
	btcState := &storage.TransactionState{
		TxHash:         "btc_tx_hash_123",
		ChainID:        "bitcoin",
		SignedTx:       []byte("btc_signed_tx"),
		BroadcastCount: 1,
		FirstBroadcast: time.Now(),
		LastBroadcast:  time.Now(),
	}

	// Ethereum transaction
	ethState := &storage.TransactionState{
		TxHash:         "0xeth_tx_hash_456",
		ChainID:        "ethereum",
		SignedTx:       []byte("eth_signed_tx"),
		BroadcastCount: 1,
		FirstBroadcast: time.Now(),
		LastBroadcast:  time.Now(),
	}

	// Store both
	err := store.Store(ctx, btcState)
	require.NoError(t, err, "Bitcoin transaction should be stored")

	err = store.Store(ctx, ethState)
	require.NoError(t, err, "Ethereum transaction should be stored")

	// Lookup both
	btcRetrieved, err := store.Lookup(ctx, "btc_tx_hash_123")
	require.NoError(t, err)
	require.NotNil(t, btcRetrieved)
	assert.Equal(t, "bitcoin", btcRetrieved.ChainID)

	ethRetrieved, err := store.Lookup(ctx, "0xeth_tx_hash_456")
	require.NoError(t, err)
	require.NotNil(t, ethRetrieved)
	assert.Equal(t, "ethereum", ethRetrieved.ChainID)
}
