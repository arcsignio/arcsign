// Package metrics - Unit tests for Prometheus metrics
package metrics

import (
	"strings"
	"testing"
	"time"
)

// TestPrometheusMetrics_RecordRPCCall tests basic RPC call recording.
func TestPrometheusMetrics_RecordRPCCall(t *testing.T) {
	metrics := NewPrometheusMetrics()

	// Record some calls
	metrics.RecordRPCCall("eth_getTransactionCount", 100*time.Millisecond, true)
	metrics.RecordRPCCall("eth_getTransactionCount", 150*time.Millisecond, true)
	metrics.RecordRPCCall("eth_getTransactionCount", 200*time.Millisecond, false)
	metrics.RecordRPCCall("eth_estimateGas", 50*time.Millisecond, true)

	// Get aggregated metrics
	agg := metrics.GetMetrics()

	// Verify totals
	if agg.TotalRPCCalls != 4 {
		t.Errorf("Expected 4 total calls, got %d", agg.TotalRPCCalls)
	}
	if agg.SuccessfulRPCCalls != 3 {
		t.Errorf("Expected 3 successful calls, got %d", agg.SuccessfulRPCCalls)
	}
	if agg.FailedRPCCalls != 1 {
		t.Errorf("Expected 1 failed call, got %d", agg.FailedRPCCalls)
	}

	// Verify success rate
	expectedRate := 3.0 / 4.0 // 0.75
	if agg.RPCSuccessRate != expectedRate {
		t.Errorf("Expected success rate %.2f, got %.2f", expectedRate, agg.RPCSuccessRate)
	}

	// Verify average duration (100 + 150 + 200 + 50) / 4 = 125ms
	expectedAvg := 125 * time.Millisecond
	if agg.AvgRPCDuration != expectedAvg {
		t.Errorf("Expected avg duration %v, got %v", expectedAvg, agg.AvgRPCDuration)
	}

	// Verify last successful call is recent
	if time.Since(agg.LastSuccessfulCall) > 1*time.Second {
		t.Errorf("LastSuccessfulCall should be recent, got %v", agg.LastSuccessfulCall)
	}
}

// TestPrometheusMetrics_GetRPCMetrics tests per-method metrics.
func TestPrometheusMetrics_GetRPCMetrics(t *testing.T) {
	metrics := NewPrometheusMetrics()

	// Record calls for specific method
	metrics.RecordRPCCall("eth_getTransactionCount", 100*time.Millisecond, true)
	metrics.RecordRPCCall("eth_getTransactionCount", 200*time.Millisecond, true)
	metrics.RecordRPCCall("eth_getTransactionCount", 150*time.Millisecond, false)

	// Get method-specific metrics
	methodMetrics := metrics.GetRPCMetrics("eth_getTransactionCount")
	if methodMetrics == nil {
		t.Fatal("Expected method metrics, got nil")
	}

	// Verify totals
	if methodMetrics.TotalCalls != 3 {
		t.Errorf("Expected 3 calls, got %d", methodMetrics.TotalCalls)
	}
	if methodMetrics.SuccessfulCalls != 2 {
		t.Errorf("Expected 2 successful calls, got %d", methodMetrics.SuccessfulCalls)
	}
	if methodMetrics.FailedCalls != 1 {
		t.Errorf("Expected 1 failed call, got %d", methodMetrics.FailedCalls)
	}

	// Verify success rate
	expectedRate := 2.0 / 3.0
	if methodMetrics.SuccessRate != expectedRate {
		t.Errorf("Expected success rate %.2f, got %.2f", expectedRate, methodMetrics.SuccessRate)
	}

	// Verify average duration (100 + 200 + 150) / 3 = 150ms
	expectedAvg := 150 * time.Millisecond
	if methodMetrics.AvgDuration != expectedAvg {
		t.Errorf("Expected avg duration %v, got %v", expectedAvg, methodMetrics.AvgDuration)
	}

	// Verify min/max duration
	if methodMetrics.MinDuration != 100*time.Millisecond {
		t.Errorf("Expected min duration 100ms, got %v", methodMetrics.MinDuration)
	}
	if methodMetrics.MaxDuration != 200*time.Millisecond {
		t.Errorf("Expected max duration 200ms, got %v", methodMetrics.MaxDuration)
	}

	// Test non-existent method
	nonExistent := metrics.GetRPCMetrics("non_existent_method")
	if nonExistent != nil {
		t.Errorf("Expected nil for non-existent method, got %v", nonExistent)
	}
}

// TestPrometheusMetrics_TransactionOperations tests transaction operation recording.
func TestPrometheusMetrics_TransactionOperations(t *testing.T) {
	metrics := NewPrometheusMetrics()

	// Record Build operations
	metrics.RecordTransactionBuild("ethereum", 500*time.Millisecond, true)
	metrics.RecordTransactionBuild("ethereum", 600*time.Millisecond, false)

	// Record Sign operations
	metrics.RecordTransactionSign("ethereum", 50*time.Millisecond, true)
	metrics.RecordTransactionSign("ethereum", 60*time.Millisecond, true)

	// Record Broadcast operations
	metrics.RecordTransactionBroadcast("ethereum", 1000*time.Millisecond, true)

	// Get aggregated metrics
	agg := metrics.GetMetrics()

	// Verify Build metrics
	if agg.TotalBuilds != 2 {
		t.Errorf("Expected 2 builds, got %d", agg.TotalBuilds)
	}
	if agg.SuccessfulBuilds != 1 {
		t.Errorf("Expected 1 successful build, got %d", agg.SuccessfulBuilds)
	}
	if agg.FailedBuilds != 1 {
		t.Errorf("Expected 1 failed build, got %d", agg.FailedBuilds)
	}
	expectedBuildRate := 1.0 / 2.0 // 0.5
	if agg.BuildSuccessRate != expectedBuildRate {
		t.Errorf("Expected build success rate %.2f, got %.2f", expectedBuildRate, agg.BuildSuccessRate)
	}
	expectedBuildAvg := 550 * time.Millisecond // (500 + 600) / 2
	if agg.AvgBuildDuration != expectedBuildAvg {
		t.Errorf("Expected avg build duration %v, got %v", expectedBuildAvg, agg.AvgBuildDuration)
	}

	// Verify Sign metrics
	if agg.TotalSigns != 2 {
		t.Errorf("Expected 2 signs, got %d", agg.TotalSigns)
	}
	if agg.SuccessfulSigns != 2 {
		t.Errorf("Expected 2 successful signs, got %d", agg.SuccessfulSigns)
	}
	if agg.SignSuccessRate != 1.0 {
		t.Errorf("Expected sign success rate 1.0, got %.2f", agg.SignSuccessRate)
	}
	expectedSignAvg := 55 * time.Millisecond // (50 + 60) / 2
	if agg.AvgSignDuration != expectedSignAvg {
		t.Errorf("Expected avg sign duration %v, got %v", expectedSignAvg, agg.AvgSignDuration)
	}

	// Verify Broadcast metrics
	if agg.TotalBroadcasts != 1 {
		t.Errorf("Expected 1 broadcast, got %d", agg.TotalBroadcasts)
	}
	if agg.SuccessfulBroadcasts != 1 {
		t.Errorf("Expected 1 successful broadcast, got %d", agg.SuccessfulBroadcasts)
	}
}

// TestPrometheusMetrics_HealthStatus tests health status detection.
func TestPrometheusMetrics_HealthStatus(t *testing.T) {
	t.Run("Healthy - no calls", func(t *testing.T) {
		metrics := NewPrometheusMetrics()
		health := metrics.GetHealthStatus()

		if health.Status != "OK" {
			t.Errorf("Expected OK status with no calls, got %s", health.Status)
		}
		if !health.IsHealthy() {
			t.Error("IsHealthy() should return true")
		}
	})

	t.Run("Healthy - high success rate", func(t *testing.T) {
		metrics := NewPrometheusMetrics()
		// 95% success rate, fast responses
		for i := 0; i < 95; i++ {
			metrics.RecordRPCCall("test_method", 100*time.Millisecond, true)
		}
		for i := 0; i < 5; i++ {
			metrics.RecordRPCCall("test_method", 100*time.Millisecond, false)
		}

		health := metrics.GetHealthStatus()
		if health.Status != "OK" {
			t.Errorf("Expected OK status, got %s: %s", health.Status, health.Message)
		}
		if health.LowSuccessRate {
			t.Error("LowSuccessRate should be false")
		}
		if health.HighLatency {
			t.Error("HighLatency should be false")
		}
	})

	t.Run("Degraded - low success rate", func(t *testing.T) {
		metrics := NewPrometheusMetrics()
		// 80% success rate (below 90% threshold)
		for i := 0; i < 80; i++ {
			metrics.RecordRPCCall("test_method", 100*time.Millisecond, true)
		}
		for i := 0; i < 20; i++ {
			metrics.RecordRPCCall("test_method", 100*time.Millisecond, false)
		}

		health := metrics.GetHealthStatus()
		if health.Status != "Degraded" {
			t.Errorf("Expected Degraded status, got %s", health.Status)
		}
		if !health.LowSuccessRate {
			t.Error("LowSuccessRate should be true")
		}
		if !health.IsDegraded() {
			t.Error("IsDegraded() should return true")
		}
		if !strings.Contains(health.Message, "low success rate") {
			t.Errorf("Message should mention low success rate, got: %s", health.Message)
		}
	})

	t.Run("Degraded - high latency", func(t *testing.T) {
		metrics := NewPrometheusMetrics()
		// 100% success but very slow (>5s threshold)
		for i := 0; i < 10; i++ {
			metrics.RecordRPCCall("test_method", 6*time.Second, true)
		}

		health := metrics.GetHealthStatus()
		if health.Status != "Degraded" {
			t.Errorf("Expected Degraded status, got %s", health.Status)
		}
		if !health.HighLatency {
			t.Error("HighLatency should be true")
		}
		if !strings.Contains(health.Message, "high latency") {
			t.Errorf("Message should mention high latency, got: %s", health.Message)
		}
	})

	t.Run("Degraded - no recent success", func(t *testing.T) {
		metrics := NewPrometheusMetrics()
		// Simulate old successful call
		metrics.RecordRPCCall("test_method", 100*time.Millisecond, true)

		// Manually set lastSuccessfulCall to 10 minutes ago
		metrics.mu.Lock()
		metrics.lastSuccessfulCall = time.Now().Add(-10 * time.Minute)
		metrics.mu.Unlock()

		health := metrics.GetHealthStatus()
		if health.Status != "Degraded" {
			t.Errorf("Expected Degraded status, got %s", health.Status)
		}
		if !health.NoRecentSuccess {
			t.Error("NoRecentSuccess should be true")
		}
		if !strings.Contains(health.Message, "no recent success") {
			t.Errorf("Message should mention no recent success, got: %s", health.Message)
		}
	})
}

// TestPrometheusMetrics_Export tests Prometheus text format export.
func TestPrometheusMetrics_Export(t *testing.T) {
	metrics := NewPrometheusMetrics()

	// Record some metrics
	metrics.RecordRPCCall("eth_getTransactionCount", 100*time.Millisecond, true)
	metrics.RecordRPCCall("eth_getTransactionCount", 150*time.Millisecond, false)
	metrics.RecordRPCCall("eth_estimateGas", 50*time.Millisecond, true)
	metrics.RecordTransactionBuild("ethereum", 500*time.Millisecond, true)
	metrics.RecordTransactionSign("ethereum", 50*time.Millisecond, true)
	metrics.RecordTransactionBroadcast("ethereum", 1000*time.Millisecond, false)

	// Export to Prometheus format
	exported := metrics.Export()

	// Verify format contains expected sections
	if !strings.Contains(exported, "# HELP chainadapter_rpc_calls_total") {
		t.Error("Export should contain RPC calls help text")
	}
	if !strings.Contains(exported, "# TYPE chainadapter_rpc_calls_total counter") {
		t.Error("Export should contain RPC calls type declaration")
	}
	if !strings.Contains(exported, "chainadapter_rpc_calls_total{method=\"eth_getTransactionCount\",status=\"success\"} 1") {
		t.Error("Export should contain eth_getTransactionCount success count")
	}
	if !strings.Contains(exported, "chainadapter_rpc_calls_total{method=\"eth_getTransactionCount\",status=\"failure\"} 1") {
		t.Error("Export should contain eth_getTransactionCount failure count")
	}
	if !strings.Contains(exported, "chainadapter_rpc_calls_total{method=\"eth_estimateGas\",status=\"success\"} 1") {
		t.Error("Export should contain eth_estimateGas success count")
	}

	// Verify duration metrics
	if !strings.Contains(exported, "# HELP chainadapter_rpc_duration_seconds") {
		t.Error("Export should contain RPC duration help text")
	}
	if !strings.Contains(exported, "chainadapter_rpc_duration_seconds{method=\"eth_getTransactionCount\",quantile=\"avg\"}") {
		t.Error("Export should contain avg duration metric")
	}
	if !strings.Contains(exported, "chainadapter_rpc_duration_seconds{method=\"eth_getTransactionCount\",quantile=\"min\"}") {
		t.Error("Export should contain min duration metric")
	}
	if !strings.Contains(exported, "chainadapter_rpc_duration_seconds{method=\"eth_getTransactionCount\",quantile=\"max\"}") {
		t.Error("Export should contain max duration metric")
	}

	// Verify transaction operations
	if !strings.Contains(exported, "# HELP chainadapter_tx_operations_total") {
		t.Error("Export should contain tx operations help text")
	}
	if !strings.Contains(exported, "chainadapter_tx_operations_total{operation=\"build\",status=\"success\"} 1") {
		t.Error("Export should contain build success count")
	}
	if !strings.Contains(exported, "chainadapter_tx_operations_total{operation=\"sign\",status=\"success\"} 1") {
		t.Error("Export should contain sign success count")
	}
	if !strings.Contains(exported, "chainadapter_tx_operations_total{operation=\"broadcast\",status=\"failure\"} 1") {
		t.Error("Export should contain broadcast failure count")
	}

	// Verify health status
	if !strings.Contains(exported, "# HELP chainadapter_health_status") {
		t.Error("Export should contain health status help text")
	}
	if !strings.Contains(exported, "chainadapter_health_status") {
		t.Error("Export should contain health status gauge")
	}

	t.Logf("Prometheus export:\n%s", exported)
}

// TestPrometheusMetrics_Reset tests metric reset functionality.
func TestPrometheusMetrics_Reset(t *testing.T) {
	metrics := NewPrometheusMetrics()

	// Record some metrics
	metrics.RecordRPCCall("eth_getTransactionCount", 100*time.Millisecond, true)
	metrics.RecordTransactionBuild("ethereum", 500*time.Millisecond, true)

	// Verify metrics exist
	agg := metrics.GetMetrics()
	if agg.TotalRPCCalls == 0 {
		t.Error("Expected metrics before reset")
	}

	// Reset metrics
	metrics.Reset()

	// Verify metrics cleared
	agg = metrics.GetMetrics()
	if agg.TotalRPCCalls != 0 {
		t.Errorf("Expected 0 RPC calls after reset, got %d", agg.TotalRPCCalls)
	}
	if agg.TotalBuilds != 0 {
		t.Errorf("Expected 0 builds after reset, got %d", agg.TotalBuilds)
	}
	if !agg.LastSuccessfulCall.IsZero() {
		t.Error("Expected zero time for LastSuccessfulCall after reset")
	}
}

// TestNoOpMetrics_DoesNothing tests that NoOpMetrics is a valid no-op implementation.
func TestNoOpMetrics_DoesNothing(t *testing.T) {
	metrics := &NoOpMetrics{}

	// All operations should be no-ops (not panic)
	metrics.RecordRPCCall("test", 100*time.Millisecond, true)
	metrics.RecordTransactionBuild("ethereum", 100*time.Millisecond, true)
	metrics.RecordTransactionSign("ethereum", 100*time.Millisecond, true)
	metrics.RecordTransactionBroadcast("ethereum", 100*time.Millisecond, true)
	metrics.Reset()

	// Get methods should return safe defaults
	agg := metrics.GetMetrics()
	if agg == nil {
		t.Error("GetMetrics() should return empty metrics, not nil")
	}
	if agg.TotalRPCCalls != 0 {
		t.Error("NoOpMetrics should return zero metrics")
	}

	methodMetrics := metrics.GetRPCMetrics("test")
	if methodMetrics != nil {
		t.Error("NoOpMetrics should return nil for GetRPCMetrics")
	}

	health := metrics.GetHealthStatus()
	if health.Status != "OK" {
		t.Errorf("NoOpMetrics should return OK status, got %s", health.Status)
	}

	exported := metrics.Export()
	if exported != "" {
		t.Error("NoOpMetrics should return empty string for Export()")
	}
}

// TestPrometheusMetrics_ConcurrentAccess tests thread safety.
func TestPrometheusMetrics_ConcurrentAccess(t *testing.T) {
	metrics := NewPrometheusMetrics()

	// Spawn multiple goroutines recording metrics concurrently
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 100; j++ {
				metrics.RecordRPCCall("test_method", 10*time.Millisecond, true)
				metrics.RecordTransactionBuild("ethereum", 100*time.Millisecond, true)
				_ = metrics.GetMetrics()
				_ = metrics.GetHealthStatus()
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines to finish
	for i := 0; i < 10; i++ {
		<-done
	}

	// Verify final metrics
	agg := metrics.GetMetrics()
	expectedRPCCalls := int64(10 * 100) // 10 goroutines * 100 calls each
	if agg.TotalRPCCalls != expectedRPCCalls {
		t.Errorf("Expected %d RPC calls, got %d", expectedRPCCalls, agg.TotalRPCCalls)
	}

	expectedBuilds := int64(10 * 100)
	if agg.TotalBuilds != expectedBuilds {
		t.Errorf("Expected %d builds, got %d", expectedBuilds, agg.TotalBuilds)
	}

	// All calls should be successful
	if agg.RPCSuccessRate != 1.0 {
		t.Errorf("Expected 100%% success rate, got %.2f", agg.RPCSuccessRate*100)
	}

	t.Logf("Concurrent test passed: %d RPC calls, %d builds", agg.TotalRPCCalls, agg.TotalBuilds)
}
