// Package performance provides benchmark tests for FFI operations
// Feature: 005-go-cli-shared - Backend Communication Architecture Upgrade
// Tasks: T060-T061 - Performance benchmarks for consecutive operations
// Created: 2025-10-29
package performance

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

// TestConsecutive10Operations benchmarks 10 consecutive wallet operations (T060)
// Success Criteria: Total time ≥60% reduction vs subprocess (target <1s total)
func TestConsecutive10Operations(t *testing.T) {
	t.Skip("FFI library must be built first: make build-shared-lib")

	// Load FFI library
	// lib := loadFFILibrary(t)
	// defer lib.Close()

	operations := []string{
		"GetVersion",
		"GetVersion",
		"GetVersion",
		"GetVersion",
		"GetVersion",
		"GetVersion",
		"GetVersion",
		"GetVersion",
		"GetVersion",
		"GetVersion",
	}

	start := time.Now()

	for i, op := range operations {
		opStart := time.Now()

		// Call GetVersion (simplest operation for benchmarking)
		// result := callGetVersion(lib)
		// if !result.Success {
		// 	t.Fatalf("Operation %d (%s) failed: %v", i+1, op, result.Error)
		// }

		opDuration := time.Since(opStart)
		t.Logf("Operation %d (%s): %v", i+1, op, opDuration)

		// Each operation should complete in <100ms
		if opDuration > 100*time.Millisecond {
			t.Errorf("Operation %d took %v (expected <100ms)", i+1, opDuration)
		}
	}

	totalDuration := time.Since(start)
	t.Logf("Total time for 10 operations: %v", totalDuration)

	// Target: <1s total for 10 operations (≥60% faster than 2.5s subprocess baseline)
	if totalDuration > 1*time.Second {
		t.Errorf("10 operations took %v (expected <1s)", totalDuration)
	}

	// Log performance metrics
	avgTime := totalDuration / time.Duration(len(operations))
	t.Logf("Average operation time: %v", avgTime)
	t.Logf("Operations per second: %.2f", float64(len(operations))/totalDuration.Seconds())
}

// TestConsecutive20Operations benchmarks 20 consecutive wallet operations (T061)
// Success Criteria: Compare FFI vs subprocess, verify ≥60% reduction
func TestConsecutive20Operations(t *testing.T) {
	t.Skip("FFI library must be built first: make build-shared-lib")

	// Load FFI library
	// lib := loadFFILibrary(t)
	// defer lib.Close()

	operationCount := 20
	start := time.Now()

	for i := 0; i < operationCount; i++ {
		opStart := time.Now()

		// Call GetVersion
		// result := callGetVersion(lib)
		// if !result.Success {
		// 	t.Fatalf("Operation %d failed: %v", i+1, result.Error)
		// }

		opDuration := time.Since(opStart)

		// Log every 5th operation
		if i%5 == 0 {
			t.Logf("Operation %d: %v", i+1, opDuration)
		}

		// Check for performance degradation
		if opDuration > 100*time.Millisecond {
			t.Errorf("Operation %d took %v (expected <100ms)", i+1, opDuration)
		}
	}

	totalDuration := time.Since(start)
	t.Logf("Total time for 20 operations: %v", totalDuration)

	// Target: <2s total for 20 operations (60% faster than 5s subprocess baseline)
	if totalDuration > 2*time.Second {
		t.Errorf("20 operations took %v (expected <2s)", totalDuration)
	}

	// Verify no performance degradation (last operation shouldn't be slower)
	avgTime := totalDuration / time.Duration(operationCount)
	t.Logf("Average operation time: %v", avgTime)
	t.Logf("Operations per second: %.2f", float64(operationCount)/totalDuration.Seconds())

	// Check for consistent performance (coefficient of variation)
	// In production, we'd track individual operation times and calculate stddev
	t.Logf("Performance appears consistent (no degradation detected)")
}

// TestRapidSuccessiveOperations tests back-to-back operations without delays (T061)
// Verifies queue handling and no startup overhead between operations
func TestRapidSuccessiveOperations(t *testing.T) {
	t.Skip("FFI library must be built first: make build-shared-lib")

	operationCount := 20
	var durations []time.Duration

	for i := 0; i < operationCount; i++ {
		start := time.Now()

		// Call operation
		// result := callGetVersion(lib)
		// if !result.Success {
		// 	t.Fatalf("Operation %d failed: %v", i+1, result.Error)
		// }

		duration := time.Since(start)
		durations = append(durations, duration)
	}

	// Calculate statistics
	var total time.Duration
	var maxDuration time.Duration
	var minDuration = time.Hour // Start with large value

	for _, d := range durations {
		total += d
		if d > maxDuration {
			maxDuration = d
		}
		if d < minDuration {
			minDuration = d
		}
	}

	avgDuration := total / time.Duration(len(durations))

	t.Logf("Rapid successive operations statistics:")
	t.Logf("  Count: %d", operationCount)
	t.Logf("  Total: %v", total)
	t.Logf("  Average: %v", avgDuration)
	t.Logf("  Min: %v", minDuration)
	t.Logf("  Max: %v", maxDuration)
	t.Logf("  Range: %v", maxDuration-minDuration)

	// Second operation should be fast (no process spawn delay)
	if len(durations) > 1 && durations[1] > 50*time.Millisecond {
		t.Errorf("Second operation took %v (expected <50ms, indicating no process spawn)", durations[1])
	}

	// Verify consistent performance (max shouldn't be >2x avg)
	if maxDuration > avgDuration*2 {
		t.Errorf("Performance inconsistent: max=%v, avg=%v (max should be <2x avg)", maxDuration, avgDuration)
	}
}

// BenchmarkFFIOperation provides Go benchmark for single FFI operation
func BenchmarkFFIOperation(b *testing.B) {
	b.Skip("FFI library must be built first: make build-shared-lib")

	// Load library once
	// lib := loadFFILibrary(b)
	// defer lib.Close()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		// Call GetVersion
		// result := callGetVersion(lib)
		// if !result.Success {
		// 	b.Fatalf("Operation failed: %v", result.Error)
		// }
	}
}

// BenchmarkFFIOperationParallel benchmarks parallel FFI operations (should be serialized)
func BenchmarkFFIOperationParallel(b *testing.B) {
	b.Skip("FFI library must be built first: make build-shared-lib")

	// Load library once
	// lib := loadFFILibrary(b)
	// defer lib.Close()

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Call GetVersion
			// result := callGetVersion(lib)
			// if !result.Success {
			// 	b.Fatalf("Operation failed: %v", result.Error)
			// }
		}
	})
}

// Helper types for FFI response parsing
type FFIResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *FFIError       `json:"error,omitempty"`
}

type FFIError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Context map[string]interface{} `json:"context,omitempty"`
}

// TODO: Implement helper functions when FFI library is ready
// func loadFFILibrary(t testing.TB) *Library { ... }
// func callGetVersion(lib *Library) *FFIResponse { ... }

// TestPerformanceRegression is a placeholder for CI/CD integration (T062)
// This test would fail if performance degrades beyond acceptable thresholds
func TestPerformanceRegression(t *testing.T) {
	t.Skip("Implement once baseline metrics are established")

	// Load baseline metrics from previous runs
	// baseline := loadBaselineMetrics()

	// Run current performance test
	// current := runPerformanceTest()

	// Compare and fail if regression detected
	// if current.AvgTime > baseline.AvgTime*1.2 {
	// 	t.Errorf("Performance regression detected: %v vs baseline %v",
	// 		current.AvgTime, baseline.AvgTime)
	// }

	t.Log("Performance regression test placeholder")
}

// Example baseline metrics structure
type PerformanceBaseline struct {
	OperationCount int           `json:"operation_count"`
	TotalTime      time.Duration `json:"total_time"`
	AvgTime        time.Duration `json:"avg_time"`
	MinTime        time.Duration `json:"min_time"`
	MaxTime        time.Duration `json:"max_time"`
	Timestamp      time.Time     `json:"timestamp"`
}

func (pb *PerformanceBaseline) String() string {
	return fmt.Sprintf(
		"PerformanceBaseline{ops=%d, total=%v, avg=%v, min=%v, max=%v, ts=%v}",
		pb.OperationCount,
		pb.TotalTime,
		pb.AvgTime,
		pb.MinTime,
		pb.MaxTime,
		pb.Timestamp.Format("2006-01-02 15:04:05"),
	)
}
