// Package rpc - Mock RPC client for testing
package rpc

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// MockRPCClient is a mock implementation of RPCClient for testing.
type MockRPCClient struct {
	mu        sync.RWMutex
	responses map[string]interface{} // method -> response
	errors    map[string]error        // method -> error
	callCount map[string]int          // method -> call count
}

// NewMockRPCClient creates a new mock RPC client.
func NewMockRPCClient() *MockRPCClient {
	return &MockRPCClient{
		responses: make(map[string]interface{}),
		errors:    make(map[string]error),
		callCount: make(map[string]int),
	}
}

// Call executes an RPC method with the given parameters.
func (m *MockRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Increment call count
	m.callCount[method]++

	// Check if error is configured
	if err, exists := m.errors[method]; exists {
		return nil, err
	}

	// Check if response is configured
	response, exists := m.responses[method]
	if !exists {
		return nil, fmt.Errorf("no mock response configured for method: %s", method)
	}

	// Marshal response to JSON
	data, err := json.Marshal(response)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal mock response: %w", err)
	}

	return json.RawMessage(data), nil
}

// CallBatch executes multiple JSON-RPC calls in a single request.
func (m *MockRPCClient) CallBatch(ctx context.Context, requests []RPCRequest) ([]json.RawMessage, error) {
	// Simple implementation: execute each call individually
	results := make([]json.RawMessage, len(requests))
	for i, req := range requests {
		// Call individual method
		result, err := m.Call(ctx, req.Method, req.Params)
		if err != nil {
			return nil, err
		}

		results[i] = result
	}

	return results, nil
}

// Subscribe creates a subscription to an RPC event stream.
func (m *MockRPCClient) Subscribe(ctx context.Context, method string, params interface{}) (<-chan json.RawMessage, error) {
	// For now, return a channel that closes immediately
	ch := make(chan json.RawMessage)
	close(ch)
	return ch, nil
}

// SetResponse configures a mock response for a method.
func (m *MockRPCClient) SetResponse(method string, response interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.responses[method] = response
}

// SetError configures a mock error for a method.
func (m *MockRPCClient) SetError(method string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.errors[method] = err
}

// GetCallCount returns the number of times a method was called.
func (m *MockRPCClient) GetCallCount(method string) int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.callCount[method]
}

// Close closes the RPC client connection (no-op for mock).
func (m *MockRPCClient) Close() error {
	return nil
}

// Reset clears all mock configurations.
func (m *MockRPCClient) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.responses = make(map[string]interface{})
	m.errors = make(map[string]error)
	m.callCount = make(map[string]int)
}
