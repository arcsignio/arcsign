// Package mocks - Mock implementation for TransactionStateStore
package mocks

import (
	"time"

	"github.com/stretchr/testify/mock"
)

// TxStatus represents the status of a transaction (duplicated for mock independence)
type TxStatus string

const (
	TxStatusPending   TxStatus = "pending"
	TxStatusConfirmed TxStatus = "confirmed"
	TxStatusFinalized TxStatus = "finalized"
	TxStatusFailed    TxStatus = "failed"
)

// TxState represents the persistent state of a transaction
type TxState struct {
	TxHash     string
	RetryCount int
	FirstSeen  time.Time
	LastRetry  time.Time
	Status     TxStatus
	ChainID    string
	RawTx      []byte
}

// MockTxStore is a mock implementation of TransactionStateStore for testing.
type MockTxStore struct {
	mock.Mock
}

// Get mocks the Get method.
func (m *MockTxStore) Get(txHash string) (*TxState, error) {
	args := m.Called(txHash)

	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).(*TxState), args.Error(1)
}

// Set mocks the Set method.
func (m *MockTxStore) Set(txHash string, state *TxState) error {
	args := m.Called(txHash, state)
	return args.Error(0)
}

// Delete mocks the Delete method.
func (m *MockTxStore) Delete(txHash string) error {
	args := m.Called(txHash)
	return args.Error(0)
}

// List mocks the List method.
func (m *MockTxStore) List() ([]*TxState, error) {
	args := m.Called()

	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).([]*TxState), args.Error(1)
}

// ListByStatus mocks the ListByStatus method.
func (m *MockTxStore) ListByStatus(status TxStatus) ([]*TxState, error) {
	args := m.Called(status)

	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).([]*TxState), args.Error(1)
}

// Clean mocks the Clean method.
func (m *MockTxStore) Clean(olderThan time.Duration) (int, error) {
	args := m.Called(olderThan)
	return args.Int(0), args.Error(1)
}
