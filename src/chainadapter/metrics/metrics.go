// Package metrics provides observability for ChainAdapter operations.
//
// This package exposes RPC health metrics, transaction success rates, and
// timing metrics in a format compatible with Prometheus and StatsD.
package metrics

import (
	"time"
)

// ChainMetrics defines the interface for recording and querying chain adapter metrics.
//
// Contract:
// - RecordRPCCall() MUST be thread-safe (concurrent calls allowed)
// - GetMetrics() MUST return accurate aggregated metrics
// - GetHealthStatus() MUST report degraded status when threshold exceeded
// - Export() MUST return Prometheus-compatible metrics
type ChainMetrics interface {
	// RecordRPCCall records a single RPC call with its duration and success status.
	//
	// Parameters:
	//   - method: The RPC method name (e.g., "eth_getTransactionCount", "getblock")
	//   - duration: Time taken for the RPC call
	//   - success: Whether the call succeeded (true) or failed (false)
	//
	// Thread-safe: YES - can be called concurrently from multiple goroutines
	RecordRPCCall(method string, duration time.Duration, success bool)

	// RecordTransactionBuild records a transaction Build() call.
	RecordTransactionBuild(chainID string, duration time.Duration, success bool)

	// RecordTransactionSign records a transaction Sign() call.
	RecordTransactionSign(chainID string, duration time.Duration, success bool)

	// RecordTransactionBroadcast records a transaction Broadcast() call.
	RecordTransactionBroadcast(chainID string, duration time.Duration, success bool)

	// GetMetrics returns aggregated metrics for all recorded operations.
	//
	// Returns:
	//   - AggregatedMetrics containing average response times, success rates, etc.
	GetMetrics() *AggregatedMetrics

	// GetRPCMetrics returns aggregated metrics for a specific RPC method.
	//
	// Parameters:
	//   - method: The RPC method name to query
	//
	// Returns:
	//   - MethodMetrics for the specified method, or nil if no data exists
	GetRPCMetrics(method string) *MethodMetrics

	// GetHealthStatus checks if the chain adapter is healthy based on metrics.
	//
	// Returns:
	//   - HealthStatus indicating OK, Degraded, or Down
	//
	// Degraded criteria:
	//   - Success rate < 90%
	//   - Average response time > 5 seconds
	//   - No successful call in last 5 minutes
	GetHealthStatus() HealthStatus

	// Export returns metrics in Prometheus text format.
	//
	// Returns:
	//   - String containing Prometheus-compatible metrics
	//
	// Example output:
	//   # HELP chainadapter_rpc_calls_total Total number of RPC calls
	//   # TYPE chainadapter_rpc_calls_total counter
	//   chainadapter_rpc_calls_total{method="eth_getTransactionCount",status="success"} 42
	Export() string

	// Reset clears all recorded metrics (useful for testing).
	Reset()
}

// AggregatedMetrics contains aggregated metrics across all operations.
type AggregatedMetrics struct {
	// RPC Metrics
	TotalRPCCalls      int64         // Total number of RPC calls
	SuccessfulRPCCalls int64         // Number of successful RPC calls
	FailedRPCCalls     int64         // Number of failed RPC calls
	RPCSuccessRate     float64       // Success rate (0.0 to 1.0)
	AvgRPCDuration     time.Duration // Average RPC call duration
	LastSuccessfulCall time.Time     // Timestamp of last successful RPC call

	// Transaction Metrics
	TotalBuilds      int64         // Total Build() calls
	SuccessfulBuilds int64         // Successful Build() calls
	FailedBuilds     int64         // Failed Build() calls
	BuildSuccessRate float64       // Build success rate (0.0 to 1.0)
	AvgBuildDuration time.Duration // Average Build() duration

	TotalSigns      int64         // Total Sign() calls
	SuccessfulSigns int64         // Successful Sign() calls
	FailedSigns     int64         // Failed Sign() calls
	SignSuccessRate float64       // Sign success rate (0.0 to 1.0)
	AvgSignDuration time.Duration // Average Sign() duration

	TotalBroadcasts      int64         // Total Broadcast() calls
	SuccessfulBroadcasts int64         // Successful Broadcast() calls
	FailedBroadcasts     int64         // Failed Broadcast() calls
	BroadcastSuccessRate float64       // Broadcast success rate (0.0 to 1.0)
	AvgBroadcastDuration time.Duration // Average Broadcast() duration
}

// MethodMetrics contains metrics for a specific RPC method.
type MethodMetrics struct {
	Method             string        // RPC method name
	TotalCalls         int64         // Total calls to this method
	SuccessfulCalls    int64         // Successful calls
	FailedCalls        int64         // Failed calls
	SuccessRate        float64       // Success rate (0.0 to 1.0)
	AvgDuration        time.Duration // Average call duration
	MinDuration        time.Duration // Minimum call duration
	MaxDuration        time.Duration // Maximum call duration
	LastSuccessfulCall time.Time     // Last successful call timestamp
	LastFailedCall     time.Time     // Last failed call timestamp
}

// HealthStatus represents the health status of a chain adapter.
type HealthStatus struct {
	Status  string    // "OK", "Degraded", or "Down"
	Message string    // Human-readable status message
	CheckedAt time.Time // Timestamp of health check

	// Degradation reasons
	LowSuccessRate    bool // Success rate < 90%
	HighLatency       bool // Avg response time > 5s
	NoRecentSuccess   bool // No successful call in last 5 minutes
}

// IsHealthy returns true if status is "OK".
func (h *HealthStatus) IsHealthy() bool {
	return h.Status == "OK"
}

// IsDegraded returns true if status is "Degraded".
func (h *HealthStatus) IsDegraded() bool {
	return h.Status == "Degraded"
}

// IsDown returns true if status is "Down".
func (h *HealthStatus) IsDown() bool {
	return h.Status == "Down"
}

// NoOpMetrics is a metrics implementation that does nothing.
// Useful for testing or when metrics are disabled.
type NoOpMetrics struct{}

func (n *NoOpMetrics) RecordRPCCall(method string, duration time.Duration, success bool) {}
func (n *NoOpMetrics) RecordTransactionBuild(chainID string, duration time.Duration, success bool) {}
func (n *NoOpMetrics) RecordTransactionSign(chainID string, duration time.Duration, success bool) {}
func (n *NoOpMetrics) RecordTransactionBroadcast(chainID string, duration time.Duration, success bool) {}
func (n *NoOpMetrics) GetMetrics() *AggregatedMetrics { return &AggregatedMetrics{} }
func (n *NoOpMetrics) GetRPCMetrics(method string) *MethodMetrics { return nil }
func (n *NoOpMetrics) GetHealthStatus() HealthStatus {
	return HealthStatus{Status: "OK", Message: "Metrics disabled", CheckedAt: time.Now()}
}
func (n *NoOpMetrics) Export() string { return "" }
func (n *NoOpMetrics) Reset() {}

// Ensure NoOpMetrics implements ChainMetrics
var _ ChainMetrics = (*NoOpMetrics)(nil)
