// Package metrics - Prometheus-compatible metrics exporter
package metrics

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

// PrometheusMetrics implements ChainMetrics with Prometheus-compatible export.
//
// Thread-safe implementation using sync.RWMutex for concurrent access.
type PrometheusMetrics struct {
	mu sync.RWMutex

	// Per-method RPC metrics
	rpcMetrics map[string]*methodStats

	// Transaction operation metrics
	buildStats     *operationStats
	signStats      *operationStats
	broadcastStats *operationStats

	// Global counters
	totalRPCCalls      int64
	successfulRPCCalls int64
	failedRPCCalls     int64
	lastSuccessfulCall time.Time
}

// methodStats tracks statistics for a single RPC method.
type methodStats struct {
	totalCalls         int64
	successfulCalls    int64
	failedCalls        int64
	totalDuration      time.Duration
	minDuration        time.Duration
	maxDuration        time.Duration
	lastSuccessfulCall time.Time
	lastFailedCall     time.Time
}

// operationStats tracks statistics for transaction operations (Build, Sign, Broadcast).
type operationStats struct {
	totalCalls      int64
	successfulCalls int64
	failedCalls     int64
	totalDuration   time.Duration
}

// NewPrometheusMetrics creates a new Prometheus-compatible metrics recorder.
func NewPrometheusMetrics() *PrometheusMetrics {
	return &PrometheusMetrics{
		rpcMetrics:     make(map[string]*methodStats),
		buildStats:     &operationStats{},
		signStats:      &operationStats{},
		broadcastStats: &operationStats{},
	}
}

// RecordRPCCall records a single RPC call with its duration and success status.
//
// Thread-safe: YES
func (p *PrometheusMetrics) RecordRPCCall(method string, duration time.Duration, success bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Update global counters
	p.totalRPCCalls++
	if success {
		p.successfulRPCCalls++
		p.lastSuccessfulCall = time.Now()
	} else {
		p.failedRPCCalls++
	}

	// Get or create method stats
	stats, exists := p.rpcMetrics[method]
	if !exists {
		stats = &methodStats{
			minDuration: duration, // Initialize with first duration
			maxDuration: duration,
		}
		p.rpcMetrics[method] = stats
	}

	// Update method stats
	stats.totalCalls++
	stats.totalDuration += duration

	if success {
		stats.successfulCalls++
		stats.lastSuccessfulCall = time.Now()
	} else {
		stats.failedCalls++
		stats.lastFailedCall = time.Now()
	}

	// Update min/max duration
	if duration < stats.minDuration || stats.minDuration == 0 {
		stats.minDuration = duration
	}
	if duration > stats.maxDuration {
		stats.maxDuration = duration
	}
}

// RecordTransactionBuild records a transaction Build() call.
func (p *PrometheusMetrics) RecordTransactionBuild(chainID string, duration time.Duration, success bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.buildStats.totalCalls++
	p.buildStats.totalDuration += duration
	if success {
		p.buildStats.successfulCalls++
	} else {
		p.buildStats.failedCalls++
	}
}

// RecordTransactionSign records a transaction Sign() call.
func (p *PrometheusMetrics) RecordTransactionSign(chainID string, duration time.Duration, success bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.signStats.totalCalls++
	p.signStats.totalDuration += duration
	if success {
		p.signStats.successfulCalls++
	} else {
		p.signStats.failedCalls++
	}
}

// RecordTransactionBroadcast records a transaction Broadcast() call.
func (p *PrometheusMetrics) RecordTransactionBroadcast(chainID string, duration time.Duration, success bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.broadcastStats.totalCalls++
	p.broadcastStats.totalDuration += duration
	if success {
		p.broadcastStats.successfulCalls++
	} else {
		p.broadcastStats.failedCalls++
	}
}

// GetMetrics returns aggregated metrics for all recorded operations.
func (p *PrometheusMetrics) GetMetrics() *AggregatedMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Calculate RPC metrics
	var totalRPCDuration time.Duration
	for _, stats := range p.rpcMetrics {
		totalRPCDuration += stats.totalDuration
	}

	rpcSuccessRate := 0.0
	if p.totalRPCCalls > 0 {
		rpcSuccessRate = float64(p.successfulRPCCalls) / float64(p.totalRPCCalls)
	}

	avgRPCDuration := time.Duration(0)
	if p.totalRPCCalls > 0 {
		avgRPCDuration = totalRPCDuration / time.Duration(p.totalRPCCalls)
	}

	// Calculate Build metrics
	buildSuccessRate := 0.0
	if p.buildStats.totalCalls > 0 {
		buildSuccessRate = float64(p.buildStats.successfulCalls) / float64(p.buildStats.totalCalls)
	}
	avgBuildDuration := time.Duration(0)
	if p.buildStats.totalCalls > 0 {
		avgBuildDuration = p.buildStats.totalDuration / time.Duration(p.buildStats.totalCalls)
	}

	// Calculate Sign metrics
	signSuccessRate := 0.0
	if p.signStats.totalCalls > 0 {
		signSuccessRate = float64(p.signStats.successfulCalls) / float64(p.signStats.totalCalls)
	}
	avgSignDuration := time.Duration(0)
	if p.signStats.totalCalls > 0 {
		avgSignDuration = p.signStats.totalDuration / time.Duration(p.signStats.totalCalls)
	}

	// Calculate Broadcast metrics
	broadcastSuccessRate := 0.0
	if p.broadcastStats.totalCalls > 0 {
		broadcastSuccessRate = float64(p.broadcastStats.successfulCalls) / float64(p.broadcastStats.totalCalls)
	}
	avgBroadcastDuration := time.Duration(0)
	if p.broadcastStats.totalCalls > 0 {
		avgBroadcastDuration = p.broadcastStats.totalDuration / time.Duration(p.broadcastStats.totalCalls)
	}

	return &AggregatedMetrics{
		TotalRPCCalls:        p.totalRPCCalls,
		SuccessfulRPCCalls:   p.successfulRPCCalls,
		FailedRPCCalls:       p.failedRPCCalls,
		RPCSuccessRate:       rpcSuccessRate,
		AvgRPCDuration:       avgRPCDuration,
		LastSuccessfulCall:   p.lastSuccessfulCall,
		TotalBuilds:          p.buildStats.totalCalls,
		SuccessfulBuilds:     p.buildStats.successfulCalls,
		FailedBuilds:         p.buildStats.failedCalls,
		BuildSuccessRate:     buildSuccessRate,
		AvgBuildDuration:     avgBuildDuration,
		TotalSigns:           p.signStats.totalCalls,
		SuccessfulSigns:      p.signStats.successfulCalls,
		FailedSigns:          p.signStats.failedCalls,
		SignSuccessRate:      signSuccessRate,
		AvgSignDuration:      avgSignDuration,
		TotalBroadcasts:      p.broadcastStats.totalCalls,
		SuccessfulBroadcasts: p.broadcastStats.successfulCalls,
		FailedBroadcasts:     p.broadcastStats.failedCalls,
		BroadcastSuccessRate: broadcastSuccessRate,
		AvgBroadcastDuration: avgBroadcastDuration,
	}
}

// GetRPCMetrics returns aggregated metrics for a specific RPC method.
func (p *PrometheusMetrics) GetRPCMetrics(method string) *MethodMetrics {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats, exists := p.rpcMetrics[method]
	if !exists {
		return nil
	}

	successRate := 0.0
	if stats.totalCalls > 0 {
		successRate = float64(stats.successfulCalls) / float64(stats.totalCalls)
	}

	avgDuration := time.Duration(0)
	if stats.totalCalls > 0 {
		avgDuration = stats.totalDuration / time.Duration(stats.totalCalls)
	}

	return &MethodMetrics{
		Method:             method,
		TotalCalls:         stats.totalCalls,
		SuccessfulCalls:    stats.successfulCalls,
		FailedCalls:        stats.failedCalls,
		SuccessRate:        successRate,
		AvgDuration:        avgDuration,
		MinDuration:        stats.minDuration,
		MaxDuration:        stats.maxDuration,
		LastSuccessfulCall: stats.lastSuccessfulCall,
		LastFailedCall:     stats.lastFailedCall,
	}
}

// GetHealthStatus checks if the chain adapter is healthy based on metrics.
//
// Degraded criteria:
//   - Success rate < 90%
//   - Average response time > 5 seconds
//   - No successful call in last 5 minutes
func (p *PrometheusMetrics) GetHealthStatus() HealthStatus {
	p.mu.RLock()
	defer p.mu.RUnlock()

	status := HealthStatus{
		CheckedAt: time.Now(),
	}

	// Calculate success rate
	successRate := 0.0
	if p.totalRPCCalls > 0 {
		successRate = float64(p.successfulRPCCalls) / float64(p.totalRPCCalls)
	}

	// Calculate average duration
	var totalDuration time.Duration
	for _, stats := range p.rpcMetrics {
		totalDuration += stats.totalDuration
	}
	avgDuration := time.Duration(0)
	if p.totalRPCCalls > 0 {
		avgDuration = totalDuration / time.Duration(p.totalRPCCalls)
	}

	// Check degradation conditions
	status.LowSuccessRate = successRate < 0.90 && p.totalRPCCalls > 0
	status.HighLatency = avgDuration > 5*time.Second
	status.NoRecentSuccess = !p.lastSuccessfulCall.IsZero() &&
		time.Since(p.lastSuccessfulCall) > 5*time.Minute

	// Determine status
	if p.totalRPCCalls == 0 {
		status.Status = "OK"
		status.Message = "No RPC calls recorded yet"
		return status
	}

	if status.LowSuccessRate || status.HighLatency || status.NoRecentSuccess {
		status.Status = "Degraded"
		messages := []string{}
		if status.LowSuccessRate {
			messages = append(messages, fmt.Sprintf("low success rate (%.1f%%)", successRate*100))
		}
		if status.HighLatency {
			messages = append(messages, fmt.Sprintf("high latency (%v)", avgDuration))
		}
		if status.NoRecentSuccess {
			messages = append(messages, fmt.Sprintf("no recent success (%v ago)", time.Since(p.lastSuccessfulCall)))
		}
		status.Message = strings.Join(messages, ", ")
		return status
	}

	status.Status = "OK"
	status.Message = fmt.Sprintf("Success rate: %.1f%%, Avg latency: %v", successRate*100, avgDuration)
	return status
}

// Export returns metrics in Prometheus text format.
//
// Example output:
//
//	# HELP chainadapter_rpc_calls_total Total number of RPC calls
//	# TYPE chainadapter_rpc_calls_total counter
//	chainadapter_rpc_calls_total{method="eth_getTransactionCount",status="success"} 42
func (p *PrometheusMetrics) Export() string {
	p.mu.RLock()
	defer p.mu.RUnlock()

	var sb strings.Builder

	// RPC calls total
	sb.WriteString("# HELP chainadapter_rpc_calls_total Total number of RPC calls\n")
	sb.WriteString("# TYPE chainadapter_rpc_calls_total counter\n")
	for method, stats := range p.rpcMetrics {
		sb.WriteString(fmt.Sprintf("chainadapter_rpc_calls_total{method=\"%s\",status=\"success\"} %d\n",
			method, stats.successfulCalls))
		sb.WriteString(fmt.Sprintf("chainadapter_rpc_calls_total{method=\"%s\",status=\"failure\"} %d\n",
			method, stats.failedCalls))
	}
	sb.WriteString("\n")

	// RPC duration
	sb.WriteString("# HELP chainadapter_rpc_duration_seconds RPC call duration in seconds\n")
	sb.WriteString("# TYPE chainadapter_rpc_duration_seconds summary\n")
	for method, stats := range p.rpcMetrics {
		if stats.totalCalls > 0 {
			avgSec := stats.totalDuration.Seconds() / float64(stats.totalCalls)
			sb.WriteString(fmt.Sprintf("chainadapter_rpc_duration_seconds{method=\"%s\",quantile=\"avg\"} %.6f\n",
				method, avgSec))
			sb.WriteString(fmt.Sprintf("chainadapter_rpc_duration_seconds{method=\"%s\",quantile=\"min\"} %.6f\n",
				method, stats.minDuration.Seconds()))
			sb.WriteString(fmt.Sprintf("chainadapter_rpc_duration_seconds{method=\"%s\",quantile=\"max\"} %.6f\n",
				method, stats.maxDuration.Seconds()))
		}
	}
	sb.WriteString("\n")

	// Transaction operations
	sb.WriteString("# HELP chainadapter_tx_operations_total Total number of transaction operations\n")
	sb.WriteString("# TYPE chainadapter_tx_operations_total counter\n")
	sb.WriteString(fmt.Sprintf("chainadapter_tx_operations_total{operation=\"build\",status=\"success\"} %d\n",
		p.buildStats.successfulCalls))
	sb.WriteString(fmt.Sprintf("chainadapter_tx_operations_total{operation=\"build\",status=\"failure\"} %d\n",
		p.buildStats.failedCalls))
	sb.WriteString(fmt.Sprintf("chainadapter_tx_operations_total{operation=\"sign\",status=\"success\"} %d\n",
		p.signStats.successfulCalls))
	sb.WriteString(fmt.Sprintf("chainadapter_tx_operations_total{operation=\"sign\",status=\"failure\"} %d\n",
		p.signStats.failedCalls))
	sb.WriteString(fmt.Sprintf("chainadapter_tx_operations_total{operation=\"broadcast\",status=\"success\"} %d\n",
		p.broadcastStats.successfulCalls))
	sb.WriteString(fmt.Sprintf("chainadapter_tx_operations_total{operation=\"broadcast\",status=\"failure\"} %d\n",
		p.broadcastStats.failedCalls))
	sb.WriteString("\n")

	// Health status
	health := p.getHealthStatusInternal()
	healthValue := 0.0
	if health.Status == "OK" {
		healthValue = 1.0
	} else if health.Status == "Degraded" {
		healthValue = 0.5
	}
	sb.WriteString("# HELP chainadapter_health_status Health status (1=OK, 0.5=Degraded, 0=Down)\n")
	sb.WriteString("# TYPE chainadapter_health_status gauge\n")
	sb.WriteString(fmt.Sprintf("chainadapter_health_status %.1f\n", healthValue))

	return sb.String()
}

// getHealthStatusInternal is an internal helper that assumes lock is already held.
func (p *PrometheusMetrics) getHealthStatusInternal() HealthStatus {
	status := HealthStatus{
		CheckedAt: time.Now(),
	}

	successRate := 0.0
	if p.totalRPCCalls > 0 {
		successRate = float64(p.successfulRPCCalls) / float64(p.totalRPCCalls)
	}

	var totalDuration time.Duration
	for _, stats := range p.rpcMetrics {
		totalDuration += stats.totalDuration
	}
	avgDuration := time.Duration(0)
	if p.totalRPCCalls > 0 {
		avgDuration = totalDuration / time.Duration(p.totalRPCCalls)
	}

	status.LowSuccessRate = successRate < 0.90 && p.totalRPCCalls > 0
	status.HighLatency = avgDuration > 5*time.Second
	status.NoRecentSuccess = !p.lastSuccessfulCall.IsZero() &&
		time.Since(p.lastSuccessfulCall) > 5*time.Minute

	if p.totalRPCCalls == 0 {
		status.Status = "OK"
		status.Message = "No RPC calls recorded yet"
		return status
	}

	if status.LowSuccessRate || status.HighLatency || status.NoRecentSuccess {
		status.Status = "Degraded"
		messages := []string{}
		if status.LowSuccessRate {
			messages = append(messages, fmt.Sprintf("low success rate (%.1f%%)", successRate*100))
		}
		if status.HighLatency {
			messages = append(messages, fmt.Sprintf("high latency (%v)", avgDuration))
		}
		if status.NoRecentSuccess {
			messages = append(messages, fmt.Sprintf("no recent success (%v ago)", time.Since(p.lastSuccessfulCall)))
		}
		status.Message = strings.Join(messages, ", ")
		return status
	}

	status.Status = "OK"
	status.Message = fmt.Sprintf("Success rate: %.1f%%, Avg latency: %v", successRate*100, avgDuration)
	return status
}

// Reset clears all recorded metrics.
func (p *PrometheusMetrics) Reset() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.rpcMetrics = make(map[string]*methodStats)
	p.buildStats = &operationStats{}
	p.signStats = &operationStats{}
	p.broadcastStats = &operationStats{}
	p.totalRPCCalls = 0
	p.successfulRPCCalls = 0
	p.failedRPCCalls = 0
	p.lastSuccessfulCall = time.Time{}
}

// Ensure PrometheusMetrics implements ChainMetrics
var _ ChainMetrics = (*PrometheusMetrics)(nil)
