package ratelimit

import (
	"sync"
	"time"
)

// RateLimiter implements a sliding window rate limiter for password attempts
// Thread-safe for concurrent access
type RateLimiter struct {
	maxAttempts int           // Maximum attempts allowed in window
	window      time.Duration // Time window for rate limiting
	attempts    map[string][]time.Time // Wallet ID -> attempt timestamps
	mu          sync.Mutex    // Protects attempts map
}

// NewRateLimiter creates a new rate limiter
// maxAttempts: Number of attempts allowed within the time window
// window: Duration of the sliding window (e.g., 1 minute)
func NewRateLimiter(maxAttempts int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		maxAttempts: maxAttempts,
		window:      window,
		attempts:    make(map[string][]time.Time),
	}
}

// AllowAttempt checks if an authentication attempt is allowed for the given wallet ID
// Returns true if attempt is allowed, false if rate limit exceeded
// Automatically cleans up expired attempts from the sliding window
func (rl *RateLimiter) AllowAttempt(walletID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// Get existing attempts for this wallet
	timestamps := rl.attempts[walletID]

	// Remove expired attempts (outside the window)
	validAttempts := []time.Time{}
	for _, timestamp := range timestamps {
		if now.Sub(timestamp) < rl.window {
			validAttempts = append(validAttempts, timestamp)
		}
	}

	// Check if we're under the limit
	if len(validAttempts) >= rl.maxAttempts {
		// Rate limit exceeded
		rl.attempts[walletID] = validAttempts
		return false
	}

	// Record this attempt
	validAttempts = append(validAttempts, now)
	rl.attempts[walletID] = validAttempts

	return true
}

// GetRemainingAttempts returns the number of attempts remaining before rate limit
// Useful for displaying to users (e.g., "2 attempts remaining")
func (rl *RateLimiter) GetRemainingAttempts(walletID string) int {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	timestamps := rl.attempts[walletID]

	// Count valid attempts within window
	validCount := 0
	for _, timestamp := range timestamps {
		if now.Sub(timestamp) < rl.window {
			validCount++
		}
	}

	remaining := rl.maxAttempts - validCount
	if remaining < 0 {
		return 0
	}
	return remaining
}

// ResetWallet clears all rate limit data for a wallet
// Called after successful authentication to reset the counter
func (rl *RateLimiter) ResetWallet(walletID string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	delete(rl.attempts, walletID)
}
