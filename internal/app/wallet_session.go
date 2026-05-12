package app

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"github.com/arcsignio/arcsign/internal/services/wallet"
)

var (
	ErrInvalidWalletToken   = errors.New("invalid or expired wallet session token")
	ErrWalletSessionExpired = errors.New("wallet session has expired")
	ErrInvalidWalletAuth    = errors.New("invalid wallet credentials")
)

// WalletSessionManager manages wallet session tokens for authenticated wallet operations
type WalletSessionManager struct {
	sessions map[string]*WalletSession
	mu       sync.RWMutex
}

// WalletSession represents an authenticated wallet session
type WalletSession struct {
	Token     string
	WalletID  string
	UsbPath   string
	CreatedAt time.Time
	ExpiresAt time.Time
	LastUsed  time.Time
}

// NewWalletSessionManager creates a new wallet session manager instance
func NewWalletSessionManager() *WalletSessionManager {
	wsm := &WalletSessionManager{
		sessions: make(map[string]*WalletSession),
	}

	// Start cleanup goroutine for expired wallet sessions
	go wsm.cleanupExpiredSessions()

	return wsm
}

// CreateWalletSession validates wallet password and creates a new session token
func (wsm *WalletSessionManager) CreateWalletSession(walletID, password, usbPath string) (*WalletSession, error) {
	// Import wallet package for validation
	svc := wallet.NewWalletService(usbPath)

	// Validate wallet password by attempting to restore (decrypt) wallet
	mnemonic, err := svc.RestoreWallet(walletID, password)
	if err != nil {
		return nil, ErrInvalidWalletAuth
	}

	// Clear mnemonic from memory immediately
	for i := range []byte(mnemonic) {
		mnemonic = mnemonic[:i] + "\x00" + mnemonic[i+1:]
	}

	// Generate secure random token
	token, err := generateSecureWalletToken()
	if err != nil {
		return nil, err
	}

	// Create session with 15-minute expiration
	now := time.Now()
	session := &WalletSession{
		Token:     token,
		WalletID:  walletID,
		UsbPath:   usbPath,
		CreatedAt: now,
		ExpiresAt: now.Add(15 * time.Minute),
		LastUsed:  now,
	}

	// Store session
	wsm.mu.Lock()
	wsm.sessions[token] = session
	wsm.mu.Unlock()

	return session, nil
}

// ValidateWalletToken checks if a wallet token is valid and returns associated session
func (wsm *WalletSessionManager) ValidateWalletToken(token string) (*WalletSession, error) {
	wsm.mu.RLock()
	session, exists := wsm.sessions[token]
	wsm.mu.RUnlock()

	if !exists {
		return nil, ErrInvalidWalletToken
	}

	// Check expiration
	if time.Now().After(session.ExpiresAt) {
		wsm.RevokeWalletToken(token)
		return nil, ErrWalletSessionExpired
	}

	// Update last used time
	wsm.mu.Lock()
	session.LastUsed = time.Now()
	wsm.mu.Unlock()

	return session, nil
}

// RevokeWalletToken invalidates a wallet session token
func (wsm *WalletSessionManager) RevokeWalletToken(token string) {
	wsm.mu.Lock()
	delete(wsm.sessions, token)
	wsm.mu.Unlock()
}

// RevokeAllWalletSessions invalidates all sessions for a specific wallet
func (wsm *WalletSessionManager) RevokeAllWalletSessions(walletID string) {
	wsm.mu.Lock()
	defer wsm.mu.Unlock()

	for token, session := range wsm.sessions {
		if session.WalletID == walletID {
			delete(wsm.sessions, token)
		}
	}
}

// RevokeAllSessionsForDevice invalidates all wallet sessions for a USB device
func (wsm *WalletSessionManager) RevokeAllSessionsForDevice(usbPath string) {
	wsm.mu.Lock()
	defer wsm.mu.Unlock()

	for token, session := range wsm.sessions {
		if session.UsbPath == usbPath {
			delete(wsm.sessions, token)
		}
	}
}

// GetActiveWalletSessionCount returns the number of active wallet sessions
func (wsm *WalletSessionManager) GetActiveWalletSessionCount() int {
	wsm.mu.RLock()
	defer wsm.mu.RUnlock()
	return len(wsm.sessions)
}

// cleanupExpiredSessions runs periodically to remove expired wallet sessions
func (wsm *WalletSessionManager) cleanupExpiredSessions() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		wsm.mu.Lock()
		now := time.Now()
		for token, session := range wsm.sessions {
			if now.After(session.ExpiresAt) {
				delete(wsm.sessions, token)
			}
		}
		wsm.mu.Unlock()
	}
}

// generateSecureWalletToken generates a cryptographically secure random token
func generateSecureWalletToken() (string, error) {
	bytes := make([]byte, 32) // 256 bits
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
