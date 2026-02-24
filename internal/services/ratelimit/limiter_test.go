package ratelimit

import (
	"sync"
	"testing"
	"time"
)

func TestAllowAttempt_FirstAttempt(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	if !rl.AllowAttempt("wallet-1") {
		t.Error("first attempt should be allowed")
	}
}

func TestAllowAttempt_UnderLimit(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	if !rl.AllowAttempt("wallet-1") {
		t.Error("1st attempt should be allowed")
	}
	if !rl.AllowAttempt("wallet-1") {
		t.Error("2nd attempt should be allowed")
	}
}

func TestAllowAttempt_AtLimit(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	rl.AllowAttempt("wallet-1") // 1st
	rl.AllowAttempt("wallet-1") // 2nd
	rl.AllowAttempt("wallet-1") // 3rd

	if rl.AllowAttempt("wallet-1") {
		t.Error("4th attempt should be blocked (limit is 3)")
	}
}

func TestAllowAttempt_OverLimit(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	for i := 0; i < 3; i++ {
		rl.AllowAttempt("wallet-1")
	}

	if rl.AllowAttempt("wallet-1") {
		t.Error("4th attempt should be blocked")
	}
	if rl.AllowAttempt("wallet-1") {
		t.Error("5th attempt should be blocked")
	}
}

func TestAllowAttempt_WindowExpiry(t *testing.T) {
	// Use very short window for testing
	rl := NewRateLimiter(2, 50*time.Millisecond)

	rl.AllowAttempt("wallet-1") // 1st
	rl.AllowAttempt("wallet-1") // 2nd — at limit

	if rl.AllowAttempt("wallet-1") {
		t.Error("should be blocked before window expires")
	}

	// Wait for window to expire
	time.Sleep(60 * time.Millisecond)

	if !rl.AllowAttempt("wallet-1") {
		t.Error("should be allowed after window expiry")
	}
}

func TestGetRemainingAttempts_Fresh(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	remaining := rl.GetRemainingAttempts("wallet-1")
	if remaining != 3 {
		t.Errorf("expected 3 remaining, got %d", remaining)
	}
}

func TestGetRemainingAttempts_AfterAttempts(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	rl.AllowAttempt("wallet-1")
	rl.AllowAttempt("wallet-1")

	remaining := rl.GetRemainingAttempts("wallet-1")
	if remaining != 1 {
		t.Errorf("expected 1 remaining, got %d", remaining)
	}
}

func TestGetRemainingAttempts_AtLimit(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	for i := 0; i < 3; i++ {
		rl.AllowAttempt("wallet-1")
	}

	remaining := rl.GetRemainingAttempts("wallet-1")
	if remaining != 0 {
		t.Errorf("expected 0 remaining, got %d", remaining)
	}
}

func TestResetWallet_ClearsAttempts(t *testing.T) {
	rl := NewRateLimiter(3, 1*time.Minute)

	for i := 0; i < 3; i++ {
		rl.AllowAttempt("wallet-1")
	}

	rl.ResetWallet("wallet-1")

	remaining := rl.GetRemainingAttempts("wallet-1")
	if remaining != 3 {
		t.Errorf("expected 3 remaining after reset, got %d", remaining)
	}

	if !rl.AllowAttempt("wallet-1") {
		t.Error("attempt should be allowed after reset")
	}
}

func TestAllowAttempt_MultipleWallets(t *testing.T) {
	rl := NewRateLimiter(2, 1*time.Minute)

	rl.AllowAttempt("wallet-1")
	rl.AllowAttempt("wallet-1")

	// wallet-1 is now at limit, but wallet-2 should be independent
	if !rl.AllowAttempt("wallet-2") {
		t.Error("wallet-2 should have its own independent counter")
	}

	if rl.AllowAttempt("wallet-1") {
		t.Error("wallet-1 should still be blocked")
	}
}

func TestAllowAttempt_ConcurrentAccess(t *testing.T) {
	rl := NewRateLimiter(100, 1*time.Minute)

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rl.AllowAttempt("wallet-concurrent")
		}()
	}
	wg.Wait()

	// Should not panic or race
	remaining := rl.GetRemainingAttempts("wallet-concurrent")
	if remaining != 50 {
		t.Errorf("expected 50 remaining after 50 concurrent attempts, got %d", remaining)
	}
}
