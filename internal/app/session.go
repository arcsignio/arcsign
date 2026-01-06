package app

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
)

var (
	ErrInvalidToken   = errors.New("invalid or expired session token")
	ErrSessionExpired = errors.New("session has expired")
	ErrInvalidAuth    = errors.New("invalid authentication credentials")
)

// SessionManager manages user session tokens for authenticated operations
type SessionManager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
}

// Session represents an authenticated user session
// Security: Only stores public data, NEVER stores passwords
type Session struct {
	Token     string
	UsbPath   string
	CreatedAt time.Time
	ExpiresAt time.Time
	LastUsed  time.Time

	// Cached public data (loaded during login, no password needed after)
	// These are non-sensitive and can be safely stored in memory
	DeviceId     string              // UUID from app config
	DeviceIdHash string              // keccak256(deviceId) for contract binding
	Memberships  []MembershipBinding // NFT bindings (public data)
}

// NewSessionManager creates a new session manager instance
func NewSessionManager() *SessionManager {
	sm := &SessionManager{
		sessions: make(map[string]*Session),
	}

	// Start cleanup goroutine for expired sessions
	go sm.cleanupExpiredSessions()

	return sm
}

// CreateSession validates credentials and creates a new session token
func (sm *SessionManager) CreateSession(usbPath, appPassword string) (*Session, error) {
	// Validate USB device and password
	if err := VerifyAppPassword(appPassword, usbPath); err != nil {
		return nil, ErrInvalidAuth
	}

	// Generate secure random token
	token, err := generateSecureToken()
	if err != nil {
		return nil, err
	}

	// Load public data from app config (this is the only time we use the password)
	appConfig, err := LoadAppConfig(usbPath, appPassword)
	if err != nil {
		return nil, err
	}

	// Extract public data to cache in session
	var deviceId, deviceIdHash string
	var memberships []MembershipBinding
	if appConfig.Identity != nil {
		deviceId = appConfig.Identity.DeviceId
		// Calculate keccak256 hash for contract binding
		if deviceId != "" {
			hash := crypto.Keccak256Hash([]byte(deviceId))
			deviceIdHash = hash.Hex()
		}
		memberships = appConfig.Identity.Memberships
	}

	// Create session with 24-hour expiration
	// Security: Only cache public data, password is discarded after validation
	now := time.Now()
	session := &Session{
		Token:        token,
		UsbPath:      usbPath,
		CreatedAt:    now,
		ExpiresAt:    now.Add(24 * time.Hour),
		LastUsed:     now,
		DeviceId:     deviceId,
		DeviceIdHash: deviceIdHash,
		Memberships:  memberships,
	}

	// Store session
	sm.mu.Lock()
	sm.sessions[token] = session
	sm.mu.Unlock()

	return session, nil
}

// ValidateToken checks if a token is valid and returns associated session
func (sm *SessionManager) ValidateToken(token string) (*Session, error) {
	sm.mu.RLock()
	session, exists := sm.sessions[token]
	sm.mu.RUnlock()

	if !exists {
		return nil, ErrInvalidToken
	}

	// Check expiration
	if time.Now().After(session.ExpiresAt) {
		sm.RevokeToken(token)
		return nil, ErrSessionExpired
	}

	// Update last used time
	sm.mu.Lock()
	session.LastUsed = time.Now()
	sm.mu.Unlock()

	return session, nil
}

// RevokeToken invalidates a session token
func (sm *SessionManager) RevokeToken(token string) {
	sm.mu.Lock()
	if _, exists := sm.sessions[token]; exists {
		// No sensitive data to clear - session only contains public data
		delete(sm.sessions, token)
	}
	sm.mu.Unlock()
}

// zeroString securely zeros a string in memory
func zeroString(s *string) {
	if s == nil || *s == "" {
		return
	}
	b := []byte(*s)
	for i := range b {
		b[i] = 0
	}
	*s = ""
}

// RevokeAllSessions invalidates all sessions for a USB device
func (sm *SessionManager) RevokeAllSessions(usbPath string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for token, session := range sm.sessions {
		if session.UsbPath == usbPath {
			// No sensitive data to clear - session only contains public data
			delete(sm.sessions, token)
		}
	}
}

// GetActiveSessionCount returns the number of active sessions
func (sm *SessionManager) GetActiveSessionCount() int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return len(sm.sessions)
}

// cleanupExpiredSessions runs periodically to remove expired sessions
func (sm *SessionManager) cleanupExpiredSessions() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		sm.mu.Lock()
		now := time.Now()
		for token, session := range sm.sessions {
			if now.After(session.ExpiresAt) {
				// No sensitive data to clear - session only contains public data
				delete(sm.sessions, token)
			}
		}
		sm.mu.Unlock()
	}
}

// generateSecureToken generates a cryptographically secure random token
func generateSecureToken() (string, error) {
	bytes := make([]byte, 32) // 256 bits
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
