// Package storage - In-memory transaction state store implementation
package storage

import (
	"sort"
	"sync"
	"time"
)

// MemoryTxStore implements TransactionStateStore using an in-memory sync.Map.
// This implementation is thread-safe and suitable for testing or ephemeral use.
type MemoryTxStore struct {
	mu    sync.RWMutex
	store map[string]*TxState
}

// NewMemoryTxStore creates a new in-memory transaction state store.
func NewMemoryTxStore() *MemoryTxStore {
	return &MemoryTxStore{
		store: make(map[string]*TxState),
	}
}

// Get retrieves transaction state by hash.
func (m *MemoryTxStore) Get(txHash string) (*TxState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state, exists := m.store[txHash]
	if !exists {
		return nil, nil
	}

	// Return a copy to prevent external modification
	return m.copyState(state), nil
}

// Set stores or updates transaction state.
func (m *MemoryTxStore) Set(txHash string, state *TxState) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Store a copy to prevent external modification
	m.store[txHash] = m.copyState(state)
	return nil
}

// Delete removes transaction state.
func (m *MemoryTxStore) Delete(txHash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.store, txHash)
	return nil
}

// List returns all transaction states sorted by FirstSeen (newest first).
func (m *MemoryTxStore) List() ([]*TxState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*TxState, 0, len(m.store))
	for _, state := range m.store {
		result = append(result, m.copyState(state))
	}

	// Sort by FirstSeen (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].FirstSeen.After(result[j].FirstSeen)
	})

	return result, nil
}

// ListByStatus returns transactions with a specific status.
func (m *MemoryTxStore) ListByStatus(status TxStatus) ([]*TxState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*TxState, 0)
	for _, state := range m.store {
		if state.Status == status {
			result = append(result, m.copyState(state))
		}
	}

	// Sort by FirstSeen (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].FirstSeen.After(result[j].FirstSeen)
	})

	return result, nil
}

// Clean removes transaction states older than the specified duration.
func (m *MemoryTxStore) Clean(olderThan time.Duration) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cutoff := time.Now().Add(-olderThan)
	count := 0

	for txHash, state := range m.store {
		if state.FirstSeen.Before(cutoff) {
			delete(m.store, txHash)
			count++
		}
	}

	return count, nil
}

// copyState creates a deep copy of TxState to prevent external modification.
func (m *MemoryTxStore) copyState(state *TxState) *TxState {
	if state == nil {
		return nil
	}

	rawTxCopy := make([]byte, len(state.RawTx))
	copy(rawTxCopy, state.RawTx)

	return &TxState{
		TxHash:     state.TxHash,
		RetryCount: state.RetryCount,
		FirstSeen:  state.FirstSeen,
		LastRetry:  state.LastRetry,
		Status:     state.Status,
		ChainID:    state.ChainID,
		RawTx:      rawTxCopy,
	}
}
