// Package storage - File-based transaction state store implementation
package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// FileTxStore implements TransactionStateStore using JSON file persistence.
// This implementation is thread-safe and persists data to disk.
type FileTxStore struct {
	mu       sync.RWMutex
	filePath string
	store    map[string]*TxState
}

// NewFileTxStore creates a new file-based transaction state store.
//
// Parameters:
// - filePath: Path to JSON file for persistence (will be created if doesn't exist)
func NewFileTxStore(filePath string) (*FileTxStore, error) {
	store := &FileTxStore{
		filePath: filePath,
		store:    make(map[string]*TxState),
	}

	// Load existing data if file exists
	if err := store.load(); err != nil {
		return nil, fmt.Errorf("failed to load transaction state from file: %w", err)
	}

	return store, nil
}

// Get retrieves transaction state by hash.
func (f *FileTxStore) Get(txHash string) (*TxState, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	state, exists := f.store[txHash]
	if !exists {
		return nil, nil
	}

	return f.copyState(state), nil
}

// Set stores or updates transaction state.
func (f *FileTxStore) Set(txHash string, state *TxState) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.store[txHash] = f.copyState(state)

	// Persist to disk
	return f.persist()
}

// Delete removes transaction state.
func (f *FileTxStore) Delete(txHash string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	delete(f.store, txHash)

	// Persist to disk
	return f.persist()
}

// List returns all transaction states sorted by FirstSeen (newest first).
func (f *FileTxStore) List() ([]*TxState, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	result := make([]*TxState, 0, len(f.store))
	for _, state := range f.store {
		result = append(result, f.copyState(state))
	}

	// Sort by FirstSeen (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].FirstSeen.After(result[j].FirstSeen)
	})

	return result, nil
}

// ListByStatus returns transactions with a specific status.
func (f *FileTxStore) ListByStatus(status TxStatus) ([]*TxState, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	result := make([]*TxState, 0)
	for _, state := range f.store {
		if state.Status == status {
			result = append(result, f.copyState(state))
		}
	}

	// Sort by FirstSeen (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].FirstSeen.After(result[j].FirstSeen)
	})

	return result, nil
}

// Clean removes transaction states older than the specified duration.
func (f *FileTxStore) Clean(olderThan time.Duration) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	cutoff := time.Now().Add(-olderThan)
	count := 0

	for txHash, state := range f.store {
		if state.FirstSeen.Before(cutoff) {
			delete(f.store, txHash)
			count++
		}
	}

	// Persist to disk
	if err := f.persist(); err != nil {
		return count, err
	}

	return count, nil
}

// load loads transaction state from file.
func (f *FileTxStore) load() error {
	// Check if file exists
	if _, err := os.Stat(f.filePath); os.IsNotExist(err) {
		// File doesn't exist, start with empty store
		return nil
	}

	// Read file
	data, err := os.ReadFile(f.filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Empty file
	if len(data) == 0 {
		return nil
	}

	// Parse JSON
	var states map[string]*TxState
	if err := json.Unmarshal(data, &states); err != nil {
		return fmt.Errorf("failed to parse JSON: %w", err)
	}

	f.store = states
	return nil
}

// persist saves transaction state to file (must hold write lock).
func (f *FileTxStore) persist() error {
	// Ensure directory exists
	dir := filepath.Dir(f.filePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Marshal to JSON
	data, err := json.MarshalIndent(f.store, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// Write to temporary file
	tmpPath := f.filePath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write temporary file: %w", err)
	}

	// Atomic rename
	if err := os.Rename(tmpPath, f.filePath); err != nil {
		return fmt.Errorf("failed to rename file: %w", err)
	}

	return nil
}

// copyState creates a deep copy of TxState.
func (f *FileTxStore) copyState(state *TxState) *TxState {
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
