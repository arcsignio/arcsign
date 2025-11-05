// Package storage provides transaction state persistence for broadcast idempotency
package storage

import (
	"time"
)

// TxStatus represents the status of a transaction
type TxStatus string

const (
	TxStatusPending   TxStatus = "pending"
	TxStatusConfirmed TxStatus = "confirmed"
	TxStatusFinalized TxStatus = "finalized"
	TxStatusFailed    TxStatus = "failed"
)

// TxState represents the persistent state of a transaction for idempotency tracking.
type TxState struct {
	TxHash      string    // Transaction hash (primary key)
	RetryCount  int       // Number of broadcast attempts
	FirstSeen   time.Time // First time transaction was seen
	LastRetry   time.Time // Last broadcast attempt
	Status      TxStatus  // Current status
	ChainID     string    // Chain identifier
	RawTx       []byte    // Raw transaction bytes (for retry)
}

// TransactionStateStore provides persistent storage for transaction state.
// Implementations MUST be thread-safe.
type TransactionStateStore interface {
	// Get retrieves transaction state by hash.
	//
	// Returns:
	// - TxState if found
	// - nil if not found
	// - Error only on storage failures
	Get(txHash string) (*TxState, error)

	// Set stores or updates transaction state.
	//
	// Contract:
	// - MUST be idempotent (can call multiple times safely)
	// - MUST atomically update RetryCount
	Set(txHash string, state *TxState) error

	// Delete removes transaction state.
	//
	// Contract:
	// - MUST be idempotent (deleting non-existent key returns nil)
	Delete(txHash string) error

	// List returns all transaction states.
	//
	// Contract:
	// - SHOULD return results sorted by FirstSeen (newest first)
	// - MAY apply pagination in future versions
	List() ([]*TxState, error)

	// ListByStatus returns transactions with a specific status.
	ListByStatus(status TxStatus) ([]*TxState, error)

	// Clean removes transaction states older than the specified duration.
	//
	// Parameters:
	// - olderThan: Remove transactions with FirstSeen older than this duration
	//
	// Returns:
	// - Number of entries removed
	// - Error on storage failures
	Clean(olderThan time.Duration) (int, error)
}
