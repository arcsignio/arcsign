package unit

import (
	"testing"
	"time"

	"github.com/yourusername/arcsign/internal/services/ratelimit"
)

// T051: Test for basic rate limiting
func TestRateLimiter(t *testing.T) {
	t.Run("allows initial attempt", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		allowed := limiter.AllowAttempt("wallet-123")
		if !allowed {
			t.Error("First attempt should be allowed")
		}
	})

	t.Run("allows attempts under limit", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		for i := 0; i < 3; i++ {
			if !limiter.AllowAttempt("wallet-123") {
				t.Errorf("Attempt %d should be allowed (under limit)", i+1)
			}
		}
	})

	t.Run("blocks attempts over limit", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		// Use up the 3 allowed attempts
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-123")
		}

		// 4th attempt should be blocked
		if limiter.AllowAttempt("wallet-123") {
			t.Error("Attempt over limit should be blocked")
		}
	})

	t.Run("tracks different wallet IDs independently", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		// Use up attempts for wallet-1
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-1")
		}

		// wallet-2 should still be allowed
		if !limiter.AllowAttempt("wallet-2") {
			t.Error("Different wallet ID should have independent rate limit")
		}
	})
}

// T052: Test for rate limit window reset
func TestRateLimiterReset(t *testing.T) {
	t.Run("resets after window expires", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 100*time.Millisecond)

		// Use up all attempts
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-123")
		}

		// Should be blocked immediately
		if limiter.AllowAttempt("wallet-123") {
			t.Error("Should be blocked before window expires")
		}

		// Wait for window to expire
		time.Sleep(150 * time.Millisecond)

		// Should be allowed again
		if !limiter.AllowAttempt("wallet-123") {
			t.Error("Should be allowed after window expires")
		}
	})

	t.Run("partial reset when oldest attempts expire", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(2, 100*time.Millisecond)

		// First attempt
		limiter.AllowAttempt("wallet-123")

		// Wait 60ms
		time.Sleep(60 * time.Millisecond)

		// Second attempt (both within window)
		limiter.AllowAttempt("wallet-123")

		// Should be blocked (2 attempts within 100ms)
		if limiter.AllowAttempt("wallet-123") {
			t.Error("Should be blocked with 2 recent attempts")
		}

		// Wait 50ms more (total 110ms from first attempt)
		time.Sleep(50 * time.Millisecond)

		// First attempt should have expired, second still valid
		// Should be allowed now
		if !limiter.AllowAttempt("wallet-123") {
			t.Error("Should be allowed after oldest attempt expires")
		}
	})
}

// T053: Test for GetRemainingAttempts()
func TestGetRemainingAttempts(t *testing.T) {
	t.Run("returns max attempts initially", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(5, 1*time.Second)

		remaining := limiter.GetRemainingAttempts("wallet-123")
		if remaining != 5 {
			t.Errorf("Expected 5 remaining attempts, got %d", remaining)
		}
	})

	t.Run("decrements with each attempt", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(5, 1*time.Second)

		limiter.AllowAttempt("wallet-123")
		if limiter.GetRemainingAttempts("wallet-123") != 4 {
			t.Error("Expected 4 remaining after 1 attempt")
		}

		limiter.AllowAttempt("wallet-123")
		if limiter.GetRemainingAttempts("wallet-123") != 3 {
			t.Error("Expected 3 remaining after 2 attempts")
		}
	})

	t.Run("returns 0 when limit exceeded", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		// Use up all attempts
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-123")
		}

		remaining := limiter.GetRemainingAttempts("wallet-123")
		if remaining != 0 {
			t.Errorf("Expected 0 remaining attempts, got %d", remaining)
		}
	})

	t.Run("increases as attempts expire", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 100*time.Millisecond)

		// Use 2 attempts
		limiter.AllowAttempt("wallet-123")
		limiter.AllowAttempt("wallet-123")

		// Should have 1 remaining
		if limiter.GetRemainingAttempts("wallet-123") != 1 {
			t.Error("Expected 1 remaining attempt")
		}

		// Wait for attempts to expire
		time.Sleep(150 * time.Millisecond)

		// Should be back to 3
		if limiter.GetRemainingAttempts("wallet-123") != 3 {
			t.Error("Expected 3 remaining after window expires")
		}
	})
}

// T054: Test for ResetWallet()
func TestResetWallet(t *testing.T) {
	t.Run("resets specific wallet rate limit", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		// Use up all attempts
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-123")
		}

		// Should be blocked
		if limiter.AllowAttempt("wallet-123") {
			t.Error("Should be blocked before reset")
		}

		// Reset
		limiter.ResetWallet("wallet-123")

		// Should be allowed again
		if !limiter.AllowAttempt("wallet-123") {
			t.Error("Should be allowed after reset")
		}
	})

	t.Run("reset doesn't affect other wallets", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		// Block wallet-1
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-1")
		}

		// Block wallet-2
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-2")
		}

		// Reset only wallet-1
		limiter.ResetWallet("wallet-1")

		// wallet-1 should be allowed
		if !limiter.AllowAttempt("wallet-1") {
			t.Error("wallet-1 should be allowed after reset")
		}

		// wallet-2 should still be blocked
		if limiter.AllowAttempt("wallet-2") {
			t.Error("wallet-2 should still be blocked")
		}
	})

	t.Run("reset on successful authentication", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 1*time.Second)

		// Simulate 2 failed attempts
		limiter.AllowAttempt("wallet-123")
		limiter.AllowAttempt("wallet-123")

		// Should have 1 remaining
		if limiter.GetRemainingAttempts("wallet-123") != 1 {
			t.Error("Expected 1 remaining attempt")
		}

		// Successful login - reset
		limiter.ResetWallet("wallet-123")

		// Should be back to full attempts
		if limiter.GetRemainingAttempts("wallet-123") != 3 {
			t.Error("Expected full attempts after successful auth")
		}
	})
}

// Integration test
func TestRateLimiterIntegration(t *testing.T) {
	t.Run("simulates brute force attack prevention", func(t *testing.T) {
		// 3 attempts per 500ms window
		limiter := ratelimit.NewRateLimiter(3, 500*time.Millisecond)

		// Simulate rapid failed attempts (brute force)
		attempts := 0
		for i := 0; i < 10; i++ {
			if limiter.AllowAttempt("wallet-123") {
				attempts++
			}
		}

		// Should only allow 3 attempts
		if attempts != 3 {
			t.Errorf("Expected 3 allowed attempts, got %d", attempts)
		}
	})

	t.Run("allows legitimate retry after lockout", func(t *testing.T) {
		limiter := ratelimit.NewRateLimiter(3, 200*time.Millisecond)

		// User makes 3 failed attempts
		for i := 0; i < 3; i++ {
			limiter.AllowAttempt("wallet-123")
		}

		// Locked out
		if limiter.AllowAttempt("wallet-123") {
			t.Error("Should be locked out")
		}

		// User waits for lockout to expire
		time.Sleep(250 * time.Millisecond)

		// User successfully authenticates
		if !limiter.AllowAttempt("wallet-123") {
			t.Error("Should be allowed after waiting")
		}

		// Reset on success
		limiter.ResetWallet("wallet-123")

		// Full attempts available again
		if limiter.GetRemainingAttempts("wallet-123") != 3 {
			t.Error("Should have full attempts after successful auth")
		}
	})
}
