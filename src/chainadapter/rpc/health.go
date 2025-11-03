// Package rpc - RPC health tracking implementation
package rpc

import (
	"sync"
	"time"
)

// SimpleHealthTracker implements RPCHealthTracker with circuit breaker pattern.
type SimpleHealthTracker struct {
	mu     sync.RWMutex
	health map[string]*EndpointHealth

	// Circuit breaker thresholds
	failureThreshold  int           // Number of consecutive failures to open circuit
	successThreshold  int           // Number of consecutive successes to close circuit
	circuitOpenWindow time.Duration // How long to keep circuit open before retry
}

// NewSimpleHealthTracker creates a new health tracker with default settings.
func NewSimpleHealthTracker() *SimpleHealthTracker {
	return &SimpleHealthTracker{
		health:            make(map[string]*EndpointHealth),
		failureThreshold:  3,  // Open circuit after 3 consecutive failures
		successThreshold:  2,  // Close circuit after 2 consecutive successes
		circuitOpenWindow: 30 * time.Second,
	}
}

// RecordSuccess records a successful RPC call.
func (t *SimpleHealthTracker) RecordSuccess(endpoint string, duration int64) {
	t.mu.Lock()
	defer t.mu.Unlock()

	h := t.getOrCreateHealth(endpoint)
	h.TotalCalls++
	h.SuccessfulCalls++
	h.LastSuccess = time.Now().Unix()

	// Update average latency (rolling average)
	if h.AvgLatencyMs == 0 {
		h.AvgLatencyMs = duration
	} else {
		h.AvgLatencyMs = (h.AvgLatencyMs*9 + duration) / 10 // Weighted average
	}

	// Circuit breaker: Close circuit after threshold successes
	if h.CircuitOpen {
		consecutiveSuccesses := h.SuccessfulCalls - h.FailedCalls
		if consecutiveSuccesses >= int64(t.successThreshold) {
			h.CircuitOpen = false
		}
	}
}

// RecordFailure records a failed RPC call.
func (t *SimpleHealthTracker) RecordFailure(endpoint string, err error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	h := t.getOrCreateHealth(endpoint)
	h.TotalCalls++
	h.FailedCalls++
	h.LastFailure = time.Now().Unix()

	// Circuit breaker: Open circuit after threshold failures
	consecutiveFailures := h.FailedCalls - h.SuccessfulCalls
	if consecutiveFailures >= int64(t.failureThreshold) {
		h.CircuitOpen = true
	}
}

// IsHealthy checks if an endpoint is healthy (circuit breaker closed).
func (t *SimpleHealthTracker) IsHealthy(endpoint string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()

	h, exists := t.health[endpoint]
	if !exists {
		// New endpoint, assume healthy
		return true
	}

	// If circuit is open, check if enough time has passed to retry
	if h.CircuitOpen {
		timeSinceLastFailure := time.Now().Unix() - h.LastFailure
		if timeSinceLastFailure < int64(t.circuitOpenWindow.Seconds()) {
			return false
		}
		// Circuit open window expired, allow retry
	}

	return true
}

// GetBestEndpoint returns the healthiest endpoint from a list.
func (t *SimpleHealthTracker) GetBestEndpoint(endpoints []string) string {
	t.mu.RLock()
	defer t.mu.RUnlock()

	var bestEndpoint string
	var bestScore float64 = -1

	for _, endpoint := range endpoints {
		if !t.IsHealthy(endpoint) {
			continue
		}

		h, exists := t.health[endpoint]
		if !exists {
			// New endpoint, give it high priority
			return endpoint
		}

		// Calculate health score (success rate + latency factor)
		successRate := float64(h.SuccessfulCalls) / float64(h.TotalCalls)
		latencyFactor := 1.0 / (float64(h.AvgLatencyMs) + 1.0) // Lower latency = higher score
		score := successRate*0.7 + latencyFactor*0.3

		if score > bestScore {
			bestScore = score
			bestEndpoint = endpoint
		}
	}

	// If no healthy endpoint found, return first endpoint
	if bestEndpoint == "" && len(endpoints) > 0 {
		return endpoints[0]
	}

	return bestEndpoint
}

// Reset resets health statistics for an endpoint.
func (t *SimpleHealthTracker) Reset(endpoint string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	delete(t.health, endpoint)
}

// GetHealth returns the health status of an endpoint (for debugging/metrics).
func (t *SimpleHealthTracker) GetHealth(endpoint string) *EndpointHealth {
	t.mu.RLock()
	defer t.mu.RUnlock()

	h, exists := t.health[endpoint]
	if !exists {
		return &EndpointHealth{
			Endpoint: endpoint,
		}
	}

	// Return a copy to avoid race conditions
	return &EndpointHealth{
		Endpoint:        h.Endpoint,
		TotalCalls:      h.TotalCalls,
		SuccessfulCalls: h.SuccessfulCalls,
		FailedCalls:     h.FailedCalls,
		AvgLatencyMs:    h.AvgLatencyMs,
		LastSuccess:     h.LastSuccess,
		LastFailure:     h.LastFailure,
		CircuitOpen:     h.CircuitOpen,
	}
}

// getOrCreateHealth gets or creates health tracking for an endpoint (must hold lock).
func (t *SimpleHealthTracker) getOrCreateHealth(endpoint string) *EndpointHealth {
	h, exists := t.health[endpoint]
	if !exists {
		h = &EndpointHealth{
			Endpoint: endpoint,
		}
		t.health[endpoint] = h
	}
	return h
}
