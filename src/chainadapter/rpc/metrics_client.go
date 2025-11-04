// Package rpc - Metrics-aware RPC client wrapper
package rpc

import (
	"context"
	"encoding/json"
	"time"

	"github.com/arcsign/chainadapter/metrics"
)

// MetricsRPCClient wraps an RPCClient and records metrics for all RPC calls.
//
// This wrapper is transparent and implements the RPCClient interface.
// All RPC calls are recorded with their duration and success status.
type MetricsRPCClient struct {
	client  RPCClient
	metrics metrics.ChainMetrics
}

// NewMetricsRPCClient creates a new metrics-aware RPC client wrapper.
//
// Parameters:
//   - client: The underlying RPC client to wrap
//   - metrics: The metrics recorder to use
//
// Returns:
//   - A new MetricsRPCClient that records metrics for all RPC calls
func NewMetricsRPCClient(client RPCClient, metricsRecorder metrics.ChainMetrics) *MetricsRPCClient {
	return &MetricsRPCClient{
		client:  client,
		metrics: metricsRecorder,
	}
}

// Call executes a single JSON-RPC method call with metrics recording.
//
// Metrics recorded:
//   - Method name
//   - Call duration
//   - Success/failure status
func (m *MetricsRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	start := time.Now()
	result, err := m.client.Call(ctx, method, params)
	duration := time.Since(start)

	// Record metrics
	success := err == nil
	m.metrics.RecordRPCCall(method, duration, success)

	return result, err
}

// CallBatch executes multiple JSON-RPC method calls with metrics recording.
//
// Note: Batch calls record metrics per request, not per batch.
func (m *MetricsRPCClient) CallBatch(ctx context.Context, requests []RPCRequest) ([]json.RawMessage, error) {
	start := time.Now()
	results, err := m.client.CallBatch(ctx, requests)
	duration := time.Since(start)

	// Record metrics for batch call
	// We record one metric per request in the batch
	success := err == nil
	avgDuration := duration
	if len(requests) > 0 {
		avgDuration = duration / time.Duration(len(requests))
	}

	for _, req := range requests {
		m.metrics.RecordRPCCall(req.Method, avgDuration, success)
	}

	return results, err
}

// Close closes the underlying RPC client.
func (m *MetricsRPCClient) Close() error {
	return m.client.Close()
}

// Ensure MetricsRPCClient implements RPCClient
var _ RPCClient = (*MetricsRPCClient)(nil)
