// Package rpc provides RPC client abstractions for blockchain communication
package rpc

import (
	"context"
	"encoding/json"
)

// RPCClient abstracts JSON-RPC communication with blockchain nodes.
// Implementations MUST support both HTTP and WebSocket transports.
type RPCClient interface {
	// Call executes a single JSON-RPC method call.
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - method: JSON-RPC method name (e.g., "eth_getBlockByNumber", "getblockcount")
	// - params: Method parameters (will be JSON-marshaled)
	//
	// Returns:
	// - Raw JSON result
	// - Error if RPC call fails
	Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error)

	// CallBatch executes multiple JSON-RPC calls in a single request.
	//
	// Contract:
	// - MUST preserve order of responses matching request order
	// - MUST return partial results if some calls fail
	//
	// Parameters:
	// - ctx: Context for timeout and cancellation
	// - requests: Batch of RPC requests
	//
	// Returns:
	// - Array of raw JSON results (same length as requests)
	// - Error only if entire batch fails (network error)
	CallBatch(ctx context.Context, requests []RPCRequest) ([]json.RawMessage, error)

	// Close closes the RPC client and releases resources
	Close() error
}

// RPCRequest represents a single JSON-RPC request
type RPCRequest struct {
	Method string      // JSON-RPC method name
	Params interface{} // Method parameters
}

// RPCResponse represents a JSON-RPC 2.0 response
type RPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError represents a JSON-RPC 2.0 error
type RPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *RPCError) Error() string {
	return e.Message
}

// RPCHealthTracker tracks RPC endpoint health for failover decisions
type RPCHealthTracker interface {
	// RecordSuccess records a successful RPC call
	RecordSuccess(endpoint string, duration int64)

	// RecordFailure records a failed RPC call
	RecordFailure(endpoint string, err error)

	// IsHealthy checks if an endpoint is healthy (circuit breaker open)
	IsHealthy(endpoint string) bool

	// GetBestEndpoint returns the healthiest endpoint from a list
	GetBestEndpoint(endpoints []string) string

	// Reset resets health statistics for an endpoint
	Reset(endpoint string)
}

// EndpointHealth represents the health status of an RPC endpoint
type EndpointHealth struct {
	Endpoint        string
	TotalCalls      int64
	SuccessfulCalls int64
	FailedCalls     int64
	AvgLatencyMs    int64
	LastSuccess     int64 // Unix timestamp
	LastFailure     int64 // Unix timestamp
	CircuitOpen     bool  // True if circuit breaker is open (endpoint degraded)
}
