// Package storage - Mock transaction state store for testing
package storage

import (
	"fmt"
	"sync"
	"time"
)

// MockTxStore is an in-memory implementation of TransactionStateStore for testing.
type MockTxStore struct {
	mu     sync.RWMutex
	states map[string]*TxState
}

// NewMockTxStore creates a new mock transaction state store.
func NewMockTxStore() *MockTxStore {
	return &MockTxStore{
		states: make(map[string]*TxState),
	}
}

// Get retrieves transaction state by hash.
func (m *MockTxStore) Get(txHash string) (*TxState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	state, exists := m.states[txHash]
	if !exists {
		return nil, nil // Not found
	}

	// Return a copy to prevent external modification
	stateCopy := *state
	return &stateCopy, nil
}

// Set stores or updates transaction state.
func (m *MockTxStore) Set(txHash string, state *TxState) error {
	if state == nil {
		return fmt.Errorf("state cannot be nil")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Store a copy
	stateCopy := *state
	m.states[txHash] = &stateCopy

	return nil
}

// Delete removes transaction state.
func (m *MockTxStore) Delete(txHash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.states, txHash)
	return nil
}

// List returns all transaction states.
func (m *MockTxStore) List() ([]*TxState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	states := make([]*TxState, 0, len(m.states))
	for _, state := range m.states {
		stateCopy := *state
		states = append(states, &stateCopy)
	}

	return states, nil
}

// ListByStatus returns transactions with a specific status.
func (m *MockTxStore) ListByStatus(status TxStatus) ([]*TxState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var states []*TxState
	for _, state := range m.states {
		if state.Status == status {
			stateCopy := *state
			states = append(states, &stateCopy)
		}
	}

	return states, nil
}

// Clean removes transaction states older than the specified duration.
func (m *MockTxStore) Clean(olderThan time.Duration) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-olderThan)
	count := 0

	for hash, state := range m.states {
		if state.FirstSeen.Before(cutoff) {
			delete(m.states, hash)
			count++
		}
	}

	return count, nil
}

// Reset clears all stored states (for testing).
func (m *MockTxStore) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.states = make(map[string]*TxState)
}

// Count returns the number of stored transactions (for testing).
func (m *MockTxStore) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return len(m.states)
}
