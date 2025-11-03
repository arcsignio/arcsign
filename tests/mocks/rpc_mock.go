// Package mocks provides test mocks for ChainAdapter dependencies
package mocks

import (
	"context"
	"encoding/json"

	"github.com/stretchr/testify/mock"
)

// RPCRequest represents a single JSON-RPC request
type RPCRequest struct {
	Method string
	Params interface{}
}

// MockRPCClient is a mock implementation of RPCClient for testing.
type MockRPCClient struct {
	mock.Mock
}

// Call mocks the Call method.
func (m *MockRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	args := m.Called(ctx, method, params)

	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).(json.RawMessage), args.Error(1)
}

// CallBatch mocks the CallBatch method.
func (m *MockRPCClient) CallBatch(ctx context.Context, requests []RPCRequest) ([]json.RawMessage, error) {
	args := m.Called(ctx, requests)

	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).([]json.RawMessage), args.Error(1)
}

// Close mocks the Close method.
func (m *MockRPCClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

// MockHealthTracker is a mock implementation of RPCHealthTracker for testing.
type MockHealthTracker struct {
	mock.Mock
}

// RecordSuccess mocks the RecordSuccess method.
func (m *MockHealthTracker) RecordSuccess(endpoint string, duration int64) {
	m.Called(endpoint, duration)
}

// RecordFailure mocks the RecordFailure method.
func (m *MockHealthTracker) RecordFailure(endpoint string, err error) {
	m.Called(endpoint, err)
}

// IsHealthy mocks the IsHealthy method.
func (m *MockHealthTracker) IsHealthy(endpoint string) bool {
	args := m.Called(endpoint)
	return args.Bool(0)
}

// GetBestEndpoint mocks the GetBestEndpoint method.
func (m *MockHealthTracker) GetBestEndpoint(endpoints []string) string {
	args := m.Called(endpoints)
	return args.String(0)
}

// Reset mocks the Reset method.
func (m *MockHealthTracker) Reset(endpoint string) {
	m.Called(endpoint)
}
