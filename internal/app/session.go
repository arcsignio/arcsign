package app

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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

	// Wallet lock status (calculated at login based on wallet limit)
	// Locked wallets can view balance but cannot send transactions
	LockedWalletIds []string // IDs of wallets that exceed the limit
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
	appConfig, err := LoadAppConfig(appPassword, usbPath)
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

	// Load wallet list from filesystem (more reliable than appConfig.Wallets)
	// appConfig.Wallets may be out of sync if wallets were created before the config
	walletsFromFS := loadWalletsFromFilesystem(usbPath)

	// Calculate locked wallets based on wallet limit
	// Wallets are sorted by CreatedAt, newest wallets get locked first
	lockedWalletIds := calculateLockedWallets(walletsFromFS, len(memberships))

	// Create session with 24-hour expiration
	// Security: Only cache public data, password is discarded after validation
	now := time.Now()
	session := &Session{
		Token:           token,
		UsbPath:         usbPath,
		CreatedAt:       now,
		ExpiresAt:       now.Add(24 * time.Hour),
		LastUsed:        now,
		DeviceId:        deviceId,
		DeviceIdHash:    deviceIdHash,
		Memberships:     memberships,
		LockedWalletIds: lockedWalletIds,
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

// loadWalletsFromFilesystem reads wallet metadata directly from the filesystem.
// This is more reliable than appConfig.Wallets which may be out of sync.
// Wallet directories are stored directly in the USB root as UUID folders containing wallet.json
func loadWalletsFromFilesystem(usbPath string) []WalletMetadata {
	wallets := make([]WalletMetadata, 0)

	fmt.Printf("[loadWalletsFromFilesystem] Reading wallets from USB root: %s\n", usbPath)

	entries, err := os.ReadDir(usbPath)
	if err != nil {
		fmt.Printf("[loadWalletsFromFilesystem] Error reading directory: %v\n", err)
		return wallets // Return empty list if directory doesn't exist
	}

	fmt.Printf("[loadWalletsFromFilesystem] Found %d entries in USB root\n", len(entries))

	for _, entry := range entries {
		// Skip non-directories and hidden directories (starting with .)
		if !entry.IsDir() || len(entry.Name()) == 0 || entry.Name()[0] == '.' {
			continue
		}

		walletID := entry.Name()
		metaPath := filepath.Join(usbPath, walletID, "wallet.json")

		// Check if wallet.json exists - this confirms it's a wallet directory
		data, err := os.ReadFile(metaPath)
		if err != nil {
			// Not a wallet directory, skip silently
			continue
		}

		fmt.Printf("[loadWalletsFromFilesystem] Found wallet directory: %s\n", walletID)

		// Parse wallet metadata to get CreatedAt
		var walletMeta struct {
			ID        string    `json:"id"`
			Name      string    `json:"name"`
			CreatedAt time.Time `json:"createdAt"`
		}
		if err := json.Unmarshal(data, &walletMeta); err != nil {
			fmt.Printf("[loadWalletsFromFilesystem] Error parsing JSON for %s: %v, using fallback\n", walletID, err)
			// If parsing fails, use directory info time as fallback
			info, _ := entry.Info()
			wallets = append(wallets, WalletMetadata{
				ID:        walletID,
				Name:      walletID,
				CreatedAt: info.ModTime(),
			})
			continue
		}

		fmt.Printf("[loadWalletsFromFilesystem] Loaded wallet: id=%s, name=%s, createdAt=%s\n",
			walletMeta.ID, walletMeta.Name, walletMeta.CreatedAt.Format(time.RFC3339))

		wallets = append(wallets, WalletMetadata{
			ID:        walletMeta.ID,
			Name:      walletMeta.Name,
			CreatedAt: walletMeta.CreatedAt,
		})
	}

	fmt.Printf("[loadWalletsFromFilesystem] Total wallets loaded: %d\n", len(wallets))
	return wallets
}

// calculateLockedWallets determines which wallets should be locked based on the wallet limit.
// Wallets are sorted by creation time (oldest first), and wallets beyond the limit are locked.
// Formula: walletLimit = 3 + (nftCount * 5)
func calculateLockedWallets(wallets []WalletMetadata, nftCount int) []string {
	walletLimit := 3 + (nftCount * 5)
	walletCount := len(wallets)

	fmt.Printf("[calculateLockedWallets] nftCount=%d, walletLimit=%d, walletCount=%d\n",
		nftCount, walletLimit, walletCount)

	// No wallets need to be locked
	if walletCount <= walletLimit {
		fmt.Printf("[calculateLockedWallets] No locking needed: %d <= %d\n", walletCount, walletLimit)
		return []string{}
	}

	// Sort wallets by CreatedAt (oldest first)
	// We need to make a copy to avoid modifying the original slice
	sortedWallets := make([]WalletMetadata, len(wallets))
	copy(sortedWallets, wallets)
	sort.Slice(sortedWallets, func(i, j int) bool {
		return sortedWallets[i].CreatedAt.Before(sortedWallets[j].CreatedAt)
	})

	fmt.Printf("[calculateLockedWallets] Sorted wallets (oldest first):\n")
	for i, w := range sortedWallets {
		fmt.Printf("  [%d] id=%s, name=%s, createdAt=%s\n", i, w.ID, w.Name, w.CreatedAt.Format(time.RFC3339))
	}

	// Lock wallets beyond the limit (newest wallets get locked)
	lockedIds := make([]string, 0, walletCount-walletLimit)
	for i := walletLimit; i < walletCount; i++ {
		fmt.Printf("[calculateLockedWallets] Locking wallet: %s\n", sortedWallets[i].ID)
		lockedIds = append(lockedIds, sortedWallets[i].ID)
	}

	fmt.Printf("[calculateLockedWallets] Total locked: %d, IDs: %v\n", len(lockedIds), lockedIds)
	return lockedIds
}

// IsWalletLocked checks if a wallet is in the locked list
func (s *Session) IsWalletLocked(walletId string) bool {
	for _, id := range s.LockedWalletIds {
		if id == walletId {
			return true
		}
	}
	return false
}

// GetSessionByUSBPath returns a valid session for the given USB path, if one exists.
// Returns nil if no valid session is found for the USB path.
func (sm *SessionManager) GetSessionByUSBPath(usbPath string) *Session {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	now := time.Now()
	for _, session := range sm.sessions {
		if session.UsbPath == usbPath && now.Before(session.ExpiresAt) {
			return session
		}
	}
	return nil
}
