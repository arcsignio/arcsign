// Package mocks - Mock implementations for testing
package mocks

import (
	"context"
	"encoding/json"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
)

// MockRPCClient implements rpc.RPCClient for testing
type MockRPCClient struct {
	responses map[string]interface{}
}

// NewMockRPCClient creates a new mock RPC client
func NewMockRPCClient() *MockRPCClient {
	return &MockRPCClient{
		responses: make(map[string]interface{}),
	}
}

// SetResponse configures the mock response for a given RPC method
func (m *MockRPCClient) SetResponse(method string, response interface{}) {
	m.responses[method] = response
}

// Call implements rpc.RPCClient.Call
func (m *MockRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	if response, ok := m.responses[method]; ok {
		data, _ := json.Marshal(response)
		return data, nil
	}
	return nil, chainadapter.NewRetryableError(
		chainadapter.ErrCodeRPCUnavailable,
		"mock RPC method not configured: "+method,
		nil,
		nil,
	)
}

// CallBatch implements rpc.RPCClient.CallBatch
func (m *MockRPCClient) CallBatch(ctx context.Context, requests []rpc.RPCRequest) ([]json.RawMessage, error) {
	results := make([]json.RawMessage, len(requests))
	for i, req := range requests {
		result, err := m.Call(ctx, req.Method, req.Params)
		if err != nil {
			return nil, err
		}
		results[i] = result
	}
	return results, nil
}

// Close implements rpc.RPCClient.Close
func (m *MockRPCClient) Close() error {
	return nil
}
