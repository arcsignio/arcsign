// Package rpc - HTTP JSON-RPC client implementation
package rpc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// HTTPRPCClient implements RPCClient using HTTP JSON-RPC transport with failover support.
type HTTPRPCClient struct {
	endpoints     []string          // List of RPC endpoints
	currentIndex  int               // Current endpoint index (for round-robin)
	healthTracker RPCHealthTracker  // Health tracker for circuit breaker
	httpClient    *http.Client      // HTTP client with timeout
	requestID     atomic.Int64      // Atomic counter for JSON-RPC request IDs
	mu            sync.RWMutex      // Protects currentIndex
}

// NewHTTPRPCClient creates a new HTTP RPC client with failover support.
//
// Parameters:
// - endpoints: List of RPC endpoints (e.g., ["https://mainnet.infura.io", "https://cloudflare-eth.com"])
// - timeout: HTTP request timeout
// - healthTracker: Health tracker for circuit breaker (optional, will create default if nil)
func NewHTTPRPCClient(endpoints []string, timeout time.Duration, healthTracker RPCHealthTracker) (*HTTPRPCClient, error) {
	if len(endpoints) == 0 {
		return nil, fmt.Errorf("at least one RPC endpoint is required")
	}

	if healthTracker == nil {
		healthTracker = NewSimpleHealthTracker()
	}

	return &HTTPRPCClient{
		endpoints: endpoints,
		healthTracker: healthTracker,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Call executes a single JSON-RPC method call with automatic failover.
func (c *HTTPRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	request := RPCRequest{
		Method: method,
		Params: params,
	}

	// Try all endpoints with round-robin + health-based selection
	var lastErr error
	attemptedEndpoints := make(map[string]bool)

	for len(attemptedEndpoints) < len(c.endpoints) {
		endpoint := c.getNextHealthyEndpoint(attemptedEndpoints)
		if endpoint == "" {
			// All endpoints exhausted
			break
		}

		attemptedEndpoints[endpoint] = true

		result, err := c.callEndpoint(ctx, endpoint, request)
		if err == nil {
			return result, nil
		}

		lastErr = err
	}

	// All endpoints failed
	return nil, fmt.Errorf("all RPC endpoints failed, last error: %w", lastErr)
}

// CallBatch executes multiple JSON-RPC calls in a single batch request.
func (c *HTTPRPCClient) CallBatch(ctx context.Context, requests []RPCRequest) ([]json.RawMessage, error) {
	if len(requests) == 0 {
		return []json.RawMessage{}, nil
	}

	// Try all endpoints with failover
	var lastErr error
	attemptedEndpoints := make(map[string]bool)

	for len(attemptedEndpoints) < len(c.endpoints) {
		endpoint := c.getNextHealthyEndpoint(attemptedEndpoints)
		if endpoint == "" {
			break
		}

		attemptedEndpoints[endpoint] = true

		results, err := c.callBatchEndpoint(ctx, endpoint, requests)
		if err == nil {
			return results, nil
		}

		lastErr = err
	}

	return nil, fmt.Errorf("all RPC endpoints failed for batch request, last error: %w", lastErr)
}

// Close closes the HTTP client
func (c *HTTPRPCClient) Close() error {
	c.httpClient.CloseIdleConnections()
	return nil
}

// callEndpoint executes a single RPC call to a specific endpoint
func (c *HTTPRPCClient) callEndpoint(ctx context.Context, endpoint string, request RPCRequest) (json.RawMessage, error) {
	startTime := time.Now()

	// Build JSON-RPC request
	reqID := c.requestID.Add(1)
	rpcReq := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      reqID,
		"method":  request.Method,
		"params":  request.Params,
	}

	reqBody, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		c.healthTracker.RecordFailure(endpoint, err)
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.healthTracker.RecordFailure(endpoint, err)
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		c.healthTracker.RecordFailure(endpoint, fmt.Errorf("HTTP %d", resp.StatusCode))
		return nil, fmt.Errorf("HTTP error: %d, body: %s", resp.StatusCode, string(body))
	}

	// Parse JSON-RPC response
	var rpcResp RPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		c.healthTracker.RecordFailure(endpoint, err)
		return nil, fmt.Errorf("failed to parse JSON-RPC response: %w", err)
	}

	// Check for JSON-RPC error
	if rpcResp.Error != nil {
		c.healthTracker.RecordFailure(endpoint, rpcResp.Error)
		return nil, fmt.Errorf("JSON-RPC error: %s", rpcResp.Error.Message)
	}

	// Success
	duration := time.Since(startTime).Milliseconds()
	c.healthTracker.RecordSuccess(endpoint, duration)

	return rpcResp.Result, nil
}

// callBatchEndpoint executes a batch RPC call to a specific endpoint
func (c *HTTPRPCClient) callBatchEndpoint(ctx context.Context, endpoint string, requests []RPCRequest) ([]json.RawMessage, error) {
	startTime := time.Now()

	// Build batch request
	batchReq := make([]map[string]interface{}, len(requests))
	for i, req := range requests {
		reqID := c.requestID.Add(1)
		batchReq[i] = map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      reqID,
			"method":  req.Method,
			"params":  req.Params,
		}
	}

	reqBody, err := json.Marshal(batchReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal batch request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		c.healthTracker.RecordFailure(endpoint, err)
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.healthTracker.RecordFailure(endpoint, err)
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		c.healthTracker.RecordFailure(endpoint, fmt.Errorf("HTTP %d", resp.StatusCode))
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	// Parse batch response
	var batchResp []RPCResponse
	if err := json.Unmarshal(body, &batchResp); err != nil {
		c.healthTracker.RecordFailure(endpoint, err)
		return nil, fmt.Errorf("failed to parse batch response: %w", err)
	}

	// Extract results
	results := make([]json.RawMessage, len(batchResp))
	for i, resp := range batchResp {
		if resp.Error != nil {
			// Individual request failed
			results[i] = nil
		} else {
			results[i] = resp.Result
		}
	}

	// Success
	duration := time.Since(startTime).Milliseconds()
	c.healthTracker.RecordSuccess(endpoint, duration)

	return results, nil
}

// getNextHealthyEndpoint selects the next healthy endpoint using round-robin + health check
func (c *HTTPRPCClient) getNextHealthyEndpoint(attempted map[string]bool) string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Try to find a healthy endpoint
	for i := 0; i < len(c.endpoints); i++ {
		idx := (c.currentIndex + i) % len(c.endpoints)
		endpoint := c.endpoints[idx]

		if attempted[endpoint] {
			continue
		}

		if c.healthTracker.IsHealthy(endpoint) {
			c.currentIndex = (idx + 1) % len(c.endpoints)
			return endpoint
		}
	}

	// No healthy endpoints, try any unattempted endpoint
	for _, endpoint := range c.endpoints {
		if !attempted[endpoint] {
			return endpoint
		}
	}

	return ""
}
