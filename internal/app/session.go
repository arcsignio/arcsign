package app

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
	"golang.org/x/crypto/hkdf"
)

var (
	ErrInvalidToken   = errors.New("invalid or expired session token")
	ErrSessionExpired = errors.New("session has expired")
	ErrInvalidAuth    = errors.New("invalid authentication credentials")
)

// Server pepper for HKDF key derivation
// Security: This server-side secret prevents offline decryption attacks
// Even if token + EncryptedProviderKey are stolen, attacker cannot decrypt without this pepper
// TODO: In production, load from secure environment variable or key management system
const serverPepper = "arcsign-v2-session-encryption-pepper-2026-change-in-production"

// SessionManager manages user session tokens for authenticated operations
type SessionManager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
}

// Session represents an authenticated user session
// Security: Stores encrypted provider key, NEVER stores plain passwords
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

	// Encrypted provider key (for decrypting provider_config.enc)
	// Encrypted using AES-256-GCM with session token as key
	// This allows backend to access provider config without storing plain password
	EncryptedProviderKey []byte // AES-256-GCM(appPassword, key=deriveKey(token))
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

	// Encrypt app password for provider config access
	// Security: Encrypted with session token as key, stored only in session
	encryptedProviderKey, err := encryptProviderKey(appPassword, token)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt provider key: %w", err)
	}

	// Create session with 24-hour expiration
	// Security: Stores encrypted provider key, plain password is discarded after validation
	now := time.Now()
	session := &Session{
		Token:                token,
		UsbPath:              usbPath,
		CreatedAt:            now,
		ExpiresAt:            now.Add(24 * time.Hour),
		LastUsed:             now,
		DeviceId:             deviceId,
		DeviceIdHash:         deviceIdHash,
		Memberships:          memberships,
		LockedWalletIds:      lockedWalletIds,
		EncryptedProviderKey: encryptedProviderKey, // ✅ Store encrypted key
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

// RecalculateLockedWallets re-reads wallets from filesystem and updates the locked wallet list.
// This should be called after wallet creation or deletion to keep the lock status current.
func (sm *SessionManager) RecalculateLockedWallets(usbPath string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	for _, session := range sm.sessions {
		if session.UsbPath == usbPath && now.Before(session.ExpiresAt) {
			// Re-read wallets from filesystem
			walletsFromFS := loadWalletsFromFilesystem(usbPath)

			// Recalculate locked wallets based on current NFT count
			nftCount := len(session.Memberships)
			lockedIds := calculateLockedWallets(walletsFromFS, nftCount)

			// Update session
			session.LockedWalletIds = lockedIds

			fmt.Printf("[RecalculateLockedWallets] Updated locked wallets for %s: %v\n", usbPath, lockedIds)
			return
		}
	}
}

// ============================================================================
// Encryption helpers for provider key storage
// ============================================================================

// deriveKeyFromToken derives a 32-byte AES key from the session token using HKDF
// Security: Uses HKDF with server pepper to prevent offline decryption attacks
// Formula: aesKey = HKDF(SHA256(token), serverPepper, info="session-key")
// Benefits:
// - Token leak alone cannot decrypt the provider key
// - Attacker needs both token AND server pepper (which never leaves backend)
// - Token remains valid as session credential
func deriveKeyFromToken(token string) []byte {
	// Step 1: Hash the token (IKM - Input Keying Material)
	tokenHash := sha256.Sum256([]byte(token))

	// Step 2: Use HKDF to derive key with server pepper as salt
	// Salt: serverPepper (server-side secret)
	// IKM: SHA256(token)
	// Info: "session-key" (domain separation)
	// Output: 32 bytes for AES-256
	hkdfReader := hkdf.New(
		sha256.New,
		tokenHash[:],           // IKM: hashed token
		[]byte(serverPepper),   // Salt: server pepper (prevents offline attacks)
		[]byte("session-key"),  // Info: context string for domain separation
	)

	// Extract 32 bytes for AES-256 key
	key := make([]byte, 32)
	if _, err := io.ReadFull(hkdfReader, key); err != nil {
		// This should never happen with HKDF
		panic(fmt.Sprintf("HKDF failed: %v", err))
	}

	return key
}

// encryptProviderKey encrypts the app password using AES-256-GCM
// The session token is used to derive the encryption key
// Returns encrypted data with nonce prepended: [nonce(12 bytes)][ciphertext][tag(16 bytes)]
func encryptProviderKey(appPassword string, token string) ([]byte, error) {
	if appPassword == "" {
		return nil, errors.New("appPassword cannot be empty")
	}
	if token == "" {
		return nil, errors.New("token cannot be empty")
	}

	// Derive 32-byte key from token
	key := deriveKeyFromToken(token)
	defer zeroBytes(key) // Clear key from memory after use

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce (12 bytes for GCM)
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt plaintext
	plaintext := []byte(appPassword)
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

	// Clear plaintext from memory
	zeroBytes(plaintext)

	return ciphertext, nil
}

// decryptProviderKey decrypts the provider key using AES-256-GCM
// The session token is used to derive the decryption key
func decryptProviderKey(encrypted []byte, token string) (string, error) {
	if len(encrypted) == 0 {
		return "", errors.New("encrypted data is empty")
	}
	if token == "" {
		return "", errors.New("token cannot be empty")
	}

	// Derive 32-byte key from token
	key := deriveKeyFromToken(token)
	defer zeroBytes(key) // Clear key from memory after use

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(encrypted) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	// Extract nonce and ciphertext
	nonce := encrypted[:nonceSize]
	ciphertext := encrypted[nonceSize:]

	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %w", err)
	}

	password := string(plaintext)

	// Clear plaintext from memory
	zeroBytes(plaintext)

	return password, nil
}

// zeroBytes securely zeros a byte slice in memory
func zeroBytes(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// GetProviderKey retrieves and decrypts the provider key for a valid session
// This is the main method that APIs should use to get the provider key
func (sm *SessionManager) GetProviderKey(token string) (string, error) {
	// Validate token and get session
	session, err := sm.ValidateToken(token)
	if err != nil {
		return "", err
	}

	// Check if encrypted provider key exists
	if len(session.EncryptedProviderKey) == 0 {
		return "", errors.New("no provider key stored in session")
	}

	// Decrypt provider key using session token
	providerKey, err := decryptProviderKey(session.EncryptedProviderKey, token)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt provider key: %w", err)
	}

	return providerKey, nil
}
