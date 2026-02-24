package app

import (
	"sync"
	"testing"
	"time"
)

// newTestWalletSessionManager creates a WalletSessionManager without the cleanup goroutine
func newTestWalletSessionManager() *WalletSessionManager {
	return &WalletSessionManager{
		sessions: make(map[string]*WalletSession),
	}
}

// insertWalletSession is a test helper to directly insert a session
func insertWalletSession(wsm *WalletSessionManager, session *WalletSession) {
	wsm.mu.Lock()
	wsm.sessions[session.Token] = session
	wsm.mu.Unlock()
}

func TestValidateWalletToken_Valid(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	session := &WalletSession{
		Token:     "test-wallet-token-1",
		WalletID:  "wallet-abc",
		UsbPath:   "/dev/usb0",
		CreatedAt: now,
		ExpiresAt: now.Add(15 * time.Minute),
		LastUsed:  now,
	}
	insertWalletSession(wsm, session)

	result, err := wsm.ValidateWalletToken("test-wallet-token-1")
	if err != nil {
		t.Fatalf("ValidateWalletToken failed: %v", err)
	}
	if result.WalletID != "wallet-abc" {
		t.Errorf("WalletID: got %q, want wallet-abc", result.WalletID)
	}
}

func TestValidateWalletToken_NonExistent(t *testing.T) {
	wsm := newTestWalletSessionManager()

	_, err := wsm.ValidateWalletToken("nonexistent-token")
	if err != ErrInvalidWalletToken {
		t.Errorf("expected ErrInvalidWalletToken, got %v", err)
	}
}

func TestValidateWalletToken_Expired(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	session := &WalletSession{
		Token:     "expired-token",
		WalletID:  "wallet-1",
		UsbPath:   "/dev/usb0",
		CreatedAt: now.Add(-20 * time.Minute),
		ExpiresAt: now.Add(-5 * time.Minute), // expired 5 minutes ago
		LastUsed:  now.Add(-20 * time.Minute),
	}
	insertWalletSession(wsm, session)

	_, err := wsm.ValidateWalletToken("expired-token")
	if err != ErrWalletSessionExpired {
		t.Errorf("expected ErrWalletSessionExpired, got %v", err)
	}

	// Should also clean up the session
	if wsm.GetActiveWalletSessionCount() != 0 {
		t.Error("expired session should be removed")
	}
}

func TestValidateWalletToken_UpdatesLastUsed(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	oldLastUsed := now.Add(-5 * time.Minute)
	session := &WalletSession{
		Token:     "active-token",
		WalletID:  "wallet-1",
		UsbPath:   "/dev/usb0",
		CreatedAt: now.Add(-5 * time.Minute),
		ExpiresAt: now.Add(10 * time.Minute),
		LastUsed:  oldLastUsed,
	}
	insertWalletSession(wsm, session)

	result, err := wsm.ValidateWalletToken("active-token")
	if err != nil {
		t.Fatalf("ValidateWalletToken failed: %v", err)
	}

	if !result.LastUsed.After(oldLastUsed) {
		t.Error("LastUsed should be updated to current time")
	}
}

func TestValidateWalletToken_15MinuteExpiry(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	// Session created exactly 15 minutes ago, with exact 15-minute expiry
	session := &WalletSession{
		Token:     "exact-expiry-token",
		WalletID:  "wallet-1",
		UsbPath:   "/dev/usb0",
		CreatedAt: now.Add(-15 * time.Minute),
		ExpiresAt: now.Add(-1 * time.Millisecond), // just expired
		LastUsed:  now.Add(-15 * time.Minute),
	}
	insertWalletSession(wsm, session)

	_, err := wsm.ValidateWalletToken("exact-expiry-token")
	if err != ErrWalletSessionExpired {
		t.Errorf("expected ErrWalletSessionExpired for just-expired token, got %v", err)
	}
}

func TestRevokeWalletToken(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	session := &WalletSession{
		Token:     "revoke-me",
		WalletID:  "wallet-1",
		UsbPath:   "/dev/usb0",
		CreatedAt: now,
		ExpiresAt: now.Add(15 * time.Minute),
		LastUsed:  now,
	}
	insertWalletSession(wsm, session)

	wsm.RevokeWalletToken("revoke-me")

	_, err := wsm.ValidateWalletToken("revoke-me")
	if err != ErrInvalidWalletToken {
		t.Errorf("expected ErrInvalidWalletToken after revoke, got %v", err)
	}
}

func TestRevokeAllWalletSessions_ByWalletID(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	// Two sessions for wallet-1, one for wallet-2
	sessions := []*WalletSession{
		{Token: "t1", WalletID: "wallet-1", UsbPath: "/usb0", CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute)},
		{Token: "t2", WalletID: "wallet-1", UsbPath: "/usb0", CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute)},
		{Token: "t3", WalletID: "wallet-2", UsbPath: "/usb0", CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute)},
	}
	for _, s := range sessions {
		insertWalletSession(wsm, s)
	}

	wsm.RevokeAllWalletSessions("wallet-1")

	if wsm.GetActiveWalletSessionCount() != 1 {
		t.Errorf("expected 1 remaining session, got %d", wsm.GetActiveWalletSessionCount())
	}

	// wallet-2 session should still be valid
	_, err := wsm.ValidateWalletToken("t3")
	if err != nil {
		t.Errorf("wallet-2 session should still be valid: %v", err)
	}
}

func TestRevokeAllSessionsForDevice(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	sessions := []*WalletSession{
		{Token: "t1", WalletID: "w1", UsbPath: "/usb0", CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute)},
		{Token: "t2", WalletID: "w2", UsbPath: "/usb0", CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute)},
		{Token: "t3", WalletID: "w3", UsbPath: "/usb1", CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute)},
	}
	for _, s := range sessions {
		insertWalletSession(wsm, s)
	}

	wsm.RevokeAllSessionsForDevice("/usb0")

	if wsm.GetActiveWalletSessionCount() != 1 {
		t.Errorf("expected 1 remaining session, got %d", wsm.GetActiveWalletSessionCount())
	}

	// /usb1 session should still be valid
	_, err := wsm.ValidateWalletToken("t3")
	if err != nil {
		t.Errorf("/usb1 session should still be valid: %v", err)
	}
}

func TestGetActiveWalletSessionCount(t *testing.T) {
	wsm := newTestWalletSessionManager()

	if wsm.GetActiveWalletSessionCount() != 0 {
		t.Error("empty manager should have 0 sessions")
	}

	now := time.Now()
	insertWalletSession(wsm, &WalletSession{
		Token: "t1", WalletID: "w1", UsbPath: "/usb0",
		CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute),
	})

	if wsm.GetActiveWalletSessionCount() != 1 {
		t.Errorf("expected 1 session, got %d", wsm.GetActiveWalletSessionCount())
	}
}

func TestGenerateSecureWalletToken_Format(t *testing.T) {
	token, err := generateSecureWalletToken()
	if err != nil {
		t.Fatalf("generateSecureWalletToken error: %v", err)
	}

	// 32 bytes = 64 hex characters
	if len(token) != 64 {
		t.Errorf("token length: got %d, want 64", len(token))
	}
}

func TestGenerateSecureWalletToken_Unique(t *testing.T) {
	token1, _ := generateSecureWalletToken()
	token2, _ := generateSecureWalletToken()

	if token1 == token2 {
		t.Error("two token generations produced identical tokens")
	}
}

func TestConcurrentAccess(t *testing.T) {
	wsm := newTestWalletSessionManager()
	now := time.Now()

	// Insert some sessions
	for i := 0; i < 10; i++ {
		token, _ := generateSecureWalletToken()
		insertWalletSession(wsm, &WalletSession{
			Token: token, WalletID: "w1", UsbPath: "/usb0",
			CreatedAt: now, ExpiresAt: now.Add(15 * time.Minute),
		})
	}

	var wg sync.WaitGroup
	// Concurrent reads and writes
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			wsm.GetActiveWalletSessionCount()
		}()
	}
	wg.Wait()
	// No panic = success
}
