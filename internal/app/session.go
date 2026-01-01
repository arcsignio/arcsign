package app

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
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
type Session struct {
	Token     string
	UsbPath   string
	CreatedAt time.Time
	ExpiresAt time.Time
	LastUsed  time.Time
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
	if err := ValidateAppPassword(usbPath, appPassword); err != nil {
		return nil, ErrInvalidAuth
	}

	// Generate secure random token
	token, err := generateSecureToken()
	if err != nil {
		return nil, err
	}

	// Create session with 24-hour expiration
	now := time.Now()
	session := &Session{
		Token:     token,
		UsbPath:   usbPath,
		CreatedAt: now,
		ExpiresAt: now.Add(24 * time.Hour),
		LastUsed:  now,
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
	delete(sm.sessions, token)
	sm.mu.Unlock()
}

// RevokeAllSessions invalidates all sessions for a USB device
func (sm *SessionManager) RevokeAllSessions(usbPath string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for token, session := range sm.sessions {
		if session.UsbPath == usbPath {
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
