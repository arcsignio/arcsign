package provider

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/services/crypto"
)

// This file implements per-user "table B": the set of tokens an address has
// interacted with that are NOT in the curated common-token list (common_tokens.go).
// These come from swap outputs, airdrops discovered by incremental scanning, or
// manual import. It is stored encrypted on the USB (touched_tokens.enc) using the
// same AES-256-GCM scheme + atomic write as ProviderConfigStore — balances are
// still fetched live via the self-hosted path; only the token *list* is persisted.
//
// Privacy: this never leaves the device. There is no central index of which
// tokens a user holds — discovery is the user's own machine scanning its own
// addresses. See GetSelfHostedTokenBalances for how the list feeds balance reads.

const touchedTokenStoreVersion = "1.0"

// TokenRef identifies a token an address has touched, with enough metadata to
// query its balance later without an extra eth_call for symbol/decimals.
type TokenRef struct {
	Address  string `json:"address"` // contract address (stored lowercase)
	Network  string `json:"network"` // internal network id
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
}

// touchedTokenFile is the on-disk structure.
type touchedTokenFile struct {
	Version          string                `json:"version"`
	DiscoveredTokens map[string][]TokenRef `json:"discovered_tokens"` // userAddress -> tokens
	LastScannedBlock map[string]uint64     `json:"last_scanned_block"` // network -> block
	UpdatedAt        time.Time             `json:"updated_at"`
}

// TouchedTokenStore manages encrypted per-user discovered-token storage.
//
// The password is held as a []byte (heap, writable) rather than a string so that
// Close() can SecureZero it. Zeroing the backing bytes of a Go string literal
// would fault (string constants live in read-only memory), so callers may safely
// pass a literal password — we copy it into a writable buffer here.
type TouchedTokenStore struct {
	mutex            sync.RWMutex
	path             string
	password         []byte
	discoveredTokens map[string][]TokenRef
	lastScannedBlock map[string]uint64
}

// NewTouchedTokenStore opens (or initializes) the encrypted touched-token store.
// A missing file starts an empty store; a present file that fails to decrypt
// (wrong password / corruption) is an error.
func NewTouchedTokenStore(path, password string) (*TouchedTokenStore, error) {
	s := &TouchedTokenStore{
		path:             path,
		password:         []byte(password), // copy into writable heap memory for SecureZero
		discoveredTokens: make(map[string][]TokenRef),
		lastScannedBlock: make(map[string]uint64),
	}
	if err := s.load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
	}
	return s, nil
}

// Close securely zeros the password from memory. Defer this after creation.
func (s *TouchedTokenStore) Close() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if len(s.password) > 0 {
		security.SecureZero(s.password)
		s.password = nil
	}
}

// AddToken records that userAddress has interacted with tok. Idempotent: a token
// already present for that user (same network + contract address, case-insensitive)
// is not duplicated. Contract address is normalized to lowercase.
func (s *TouchedTokenStore) AddToken(userAddress string, tok TokenRef) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	tok.Address = strings.ToLower(tok.Address)
	tok.Network = NormalizeToInternalNetwork(tok.Network)

	existing := s.discoveredTokens[userAddress]
	for _, e := range existing {
		if e.Network == tok.Network && strings.ToLower(e.Address) == tok.Address {
			return nil // already known, no-op
		}
	}
	s.discoveredTokens[userAddress] = append(existing, tok)
	return s.save()
}

// TokensForAddress returns a copy of the tokens recorded for userAddress.
func (s *TouchedTokenStore) TokensForAddress(userAddress string) []TokenRef {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	src := s.discoveredTokens[userAddress]
	out := make([]TokenRef, len(src))
	copy(out, src)
	return out
}

// GetLastScannedBlock returns the last scanned block for a network (0 if never).
func (s *TouchedTokenStore) GetLastScannedBlock(network string) uint64 {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.lastScannedBlock[NormalizeToInternalNetwork(network)]
}

// SetLastScannedBlock persists the incremental-scan cursor for a network.
func (s *TouchedTokenStore) SetLastScannedBlock(network string, block uint64) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.lastScannedBlock[NormalizeToInternalNetwork(network)] = block
	return s.save()
}

// load reads and decrypts the store file (acquires lock).
func (s *TouchedTokenStore) load() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	encrypted, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	decrypted, err := crypto.Decrypt(encrypted, string(s.password))
	if err != nil {
		return fmt.Errorf("failed to decrypt touched-token store: %w", err)
	}
	var f touchedTokenFile
	if err := json.Unmarshal(decrypted, &f); err != nil {
		return fmt.Errorf("failed to parse touched-token store: %w", err)
	}
	if f.Version != touchedTokenStoreVersion {
		return fmt.Errorf("unsupported touched-token store version: %s", f.Version)
	}
	if f.DiscoveredTokens != nil {
		s.discoveredTokens = f.DiscoveredTokens
	}
	if f.LastScannedBlock != nil {
		s.lastScannedBlock = f.LastScannedBlock
	}
	return nil
}

// save encrypts and atomically writes the store (caller must hold the lock).
func (s *TouchedTokenStore) save() error {
	f := touchedTokenFile{
		Version:          touchedTokenStoreVersion,
		DiscoveredTokens: s.discoveredTokens,
		LastScannedBlock: s.lastScannedBlock,
		UpdatedAt:        time.Now(),
	}
	jsonData, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal touched-token store: %w", err)
	}
	encrypted, err := crypto.Encrypt(jsonData, string(s.password))
	if err != nil {
		return fmt.Errorf("failed to encrypt touched-token store: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		return fmt.Errorf("failed to create store directory: %w", err)
	}
	tempPath := s.path + ".tmp"
	if err := os.WriteFile(tempPath, encrypted, 0600); err != nil {
		return fmt.Errorf("failed to write temp store: %w", err)
	}
	if err := os.Rename(tempPath, s.path); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename store file: %w", err)
	}
	return nil
}
