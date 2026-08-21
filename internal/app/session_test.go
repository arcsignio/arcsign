package app

import (
	"testing"
	"time"
)

// --- SessionManager Token Validation Tests ---

func newTestSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
	}
}

func insertTestSession(sm *SessionManager, token, usbPath string, expiresAt, lastUsed time.Time) *Session {
	now := time.Now()
	session := &Session{
		Token:     token,
		UsbPath:   usbPath,
		CreatedAt: now,
		ExpiresAt: expiresAt,
		LastUsed:  lastUsed,
	}
	sm.mu.Lock()
	sm.sessions[token] = session
	sm.mu.Unlock()
	return session
}

func TestValidateToken_Valid(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	insertTestSession(sm, "valid-token", "/usb/path", now.Add(24*time.Hour), now)

	session, err := sm.ValidateToken("valid-token")
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}
	if session == nil {
		t.Fatal("session is nil")
	}
	if session.Token != "valid-token" {
		t.Errorf("token: got %q, want %q", session.Token, "valid-token")
	}
}

func TestValidateToken_NonExistent(t *testing.T) {
	sm := newTestSessionManager()

	_, err := sm.ValidateToken("nonexistent-token")
	if err == nil {
		t.Fatal("ValidateToken should fail for nonexistent token")
	}
	if err != ErrInvalidToken {
		t.Errorf("expected ErrInvalidToken, got: %v", err)
	}
}

func TestValidateToken_Expired(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	// Session that expired 1 hour ago
	insertTestSession(sm, "expired-token", "/usb/path", now.Add(-1*time.Hour), now.Add(-2*time.Hour))

	_, err := sm.ValidateToken("expired-token")
	if err == nil {
		t.Fatal("ValidateToken should fail for expired token")
	}
	if err != ErrSessionExpired {
		t.Errorf("expected ErrSessionExpired, got: %v", err)
	}
}

func TestValidateToken_IdleTimeout(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	// Session not expired but idle for >2 hours
	insertTestSession(sm, "idle-token", "/usb/path", now.Add(20*time.Hour), now.Add(-3*time.Hour))

	_, err := sm.ValidateToken("idle-token")
	if err == nil {
		t.Fatal("ValidateToken should fail for idle session")
	}
	if err != ErrSessionIdle {
		t.Errorf("expected ErrSessionIdle, got: %v", err)
	}
}

func TestValidateToken_UpdatesLastUsed(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()
	oldLastUsed := now.Add(-30 * time.Minute) // 30 min ago (within idle timeout)

	insertTestSession(sm, "update-token", "/usb/path", now.Add(24*time.Hour), oldLastUsed)

	session, err := sm.ValidateToken("update-token")
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	// LastUsed should be updated to approximately now
	if session.LastUsed.Before(now.Add(-1 * time.Second)) {
		t.Error("LastUsed was not updated after validation")
	}
}

// --- RevokeToken Tests ---

func TestRevokeToken_ExistingSession(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	insertTestSession(sm, "revoke-token", "/usb/path", now.Add(24*time.Hour), now)

	sm.RevokeToken("revoke-token")

	_, err := sm.ValidateToken("revoke-token")
	if err == nil {
		t.Fatal("revoked token should no longer be valid")
	}
}

func TestRevokeToken_NonExistent(t *testing.T) {
	sm := newTestSessionManager()

	// Should not panic
	sm.RevokeToken("nonexistent-token")
}

// --- RevokeAllSessions Tests ---

func TestRevokeAllSessions_ByUSBPath(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	// Create multiple sessions for the same USB path
	insertTestSession(sm, "token-1", "/usb/device1", now.Add(24*time.Hour), now)
	insertTestSession(sm, "token-2", "/usb/device1", now.Add(24*time.Hour), now)
	insertTestSession(sm, "token-3", "/usb/device2", now.Add(24*time.Hour), now) // different path

	sm.RevokeAllSessions("/usb/device1")

	// Tokens for device1 should be invalid
	if _, err := sm.ValidateToken("token-1"); err == nil {
		t.Error("token-1 should be revoked")
	}
	if _, err := sm.ValidateToken("token-2"); err == nil {
		t.Error("token-2 should be revoked")
	}

	// Token for device2 should still be valid
	if _, err := sm.ValidateToken("token-3"); err != nil {
		t.Errorf("token-3 should still be valid: %v", err)
	}
}

// --- GetActiveSessionCount Tests ---

func TestGetActiveSessionCount_Empty(t *testing.T) {
	sm := newTestSessionManager()

	if count := sm.GetActiveSessionCount(); count != 0 {
		t.Errorf("expected 0, got %d", count)
	}
}

func TestGetActiveSessionCount_WithSessions(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	insertTestSession(sm, "t1", "/usb/a", now.Add(24*time.Hour), now)
	insertTestSession(sm, "t2", "/usb/b", now.Add(24*time.Hour), now)
	insertTestSession(sm, "t3", "/usb/c", now.Add(24*time.Hour), now)

	if count := sm.GetActiveSessionCount(); count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

// --- EncryptDecryptProviderKey Tests ---

func TestEncryptDecryptProviderKey_RoundTrip(t *testing.T) {
	token := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	password := "test-app-password"

	encrypted, err := encryptProviderKey(password, token, CurrentPepperVersion)
	if err != nil {
		t.Fatalf("encryptProviderKey failed: %v", err)
	}

	decrypted, err := decryptProviderKey(encrypted, token, CurrentPepperVersion)
	if err != nil {
		t.Fatalf("decryptProviderKey failed: %v", err)
	}

	if decrypted != password {
		t.Errorf("round-trip failed: got %q, want %q", decrypted, password)
	}
}

func TestDecryptProviderKey_WrongToken(t *testing.T) {
	token := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	wrongToken := "0000001234567890abcdef1234567890abcdef1234567890abcdef1234567890"
	password := "test-app-password"

	encrypted, err := encryptProviderKey(password, token, CurrentPepperVersion)
	if err != nil {
		t.Fatalf("encryptProviderKey failed: %v", err)
	}

	_, err = decryptProviderKey(encrypted, wrongToken, CurrentPepperVersion)
	if err == nil {
		t.Fatal("decryptProviderKey should fail with wrong token")
	}
}

func TestDeriveKeyFromToken_InvalidPepper(t *testing.T) {
	_, err := deriveKeyFromToken("some-token", 999)
	if err == nil {
		t.Fatal("deriveKeyFromToken should fail with invalid pepper version")
	}
}

func TestDeriveKeyFromToken_ValidPepper(t *testing.T) {
	key, err := deriveKeyFromToken("test-token", CurrentPepperVersion)
	if err != nil {
		t.Fatalf("deriveKeyFromToken failed: %v", err)
	}
	if len(key) != 32 {
		t.Errorf("key length: got %d, want 32", len(key))
	}
}

func TestDeriveKeyFromToken_Deterministic(t *testing.T) {
	key1, _ := deriveKeyFromToken("same-token", CurrentPepperVersion)
	key2, _ := deriveKeyFromToken("same-token", CurrentPepperVersion)

	for i := range key1 {
		if key1[i] != key2[i] {
			t.Fatalf("key derivation is not deterministic: byte %d differs", i)
		}
	}
}

func TestDeriveKeyFromToken_DifferentTokensDifferentKeys(t *testing.T) {
	key1, _ := deriveKeyFromToken("token-a", CurrentPepperVersion)
	key2, _ := deriveKeyFromToken("token-b", CurrentPepperVersion)

	same := true
	for i := range key1 {
		if key1[i] != key2[i] {
			same = false
			break
		}
	}
	if same {
		t.Error("different tokens should derive different keys")
	}
}

// --- GetSessionByUSBPath Tests ---

func TestGetSessionByUSBPath_Found(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	insertTestSession(sm, "usb-token", "/usb/my-device", now.Add(24*time.Hour), now)

	session := sm.GetSessionByUSBPath("/usb/my-device")
	if session == nil {
		t.Fatal("should find session by USB path")
	}
	if session.Token != "usb-token" {
		t.Errorf("token: got %q, want %q", session.Token, "usb-token")
	}
}

func TestGetSessionByUSBPath_NotFound(t *testing.T) {
	sm := newTestSessionManager()

	session := sm.GetSessionByUSBPath("/usb/unknown")
	if session != nil {
		t.Error("should return nil for unknown USB path")
	}
}

func TestGetSessionByUSBPath_ExpiredIgnored(t *testing.T) {
	sm := newTestSessionManager()
	now := time.Now()

	// Expired session for this USB path
	insertTestSession(sm, "expired-usb", "/usb/device", now.Add(-1*time.Hour), now.Add(-2*time.Hour))

	session := sm.GetSessionByUSBPath("/usb/device")
	if session != nil {
		t.Error("should not return expired session")
	}
}

// --- generateSecureToken Tests ---

func TestGenerateSecureToken_Format(t *testing.T) {
	token, err := generateSecureToken()
	if err != nil {
		t.Fatalf("generateSecureToken failed: %v", err)
	}

	if len(token) != 64 { // 32 bytes = 64 hex chars
		t.Errorf("token length: got %d, want 64", len(token))
	}
}

func TestGenerateSecureToken_Uniqueness(t *testing.T) {
	token1, _ := generateSecureToken()
	token2, _ := generateSecureToken()

	if token1 == token2 {
		t.Error("two token generations produced identical tokens")
	}
}
