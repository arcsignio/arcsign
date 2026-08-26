package clearsign

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/services/crypto"
)

// DescriptorStore persists a downloaded descriptor snapshot on the USB,
// encrypted with the same AES-256-GCM scheme + atomic write as
// TouchedTokenStore and ProviderConfigStore.
//
// The password is held as []byte (writable heap) so Close can SecureZero it:
// zeroing the backing memory of a Go string literal would fault, since string
// constants live in read-only memory. Callers may therefore pass a literal.
type DescriptorStore struct {
	mutex    sync.RWMutex
	path     string
	password []byte
	payload  []byte // decrypted snapshot JSON; nil when the store is empty
}

// NewDescriptorStore opens (or initializes) the encrypted descriptor store.
// A missing file starts empty. A present file that fails to decrypt — wrong
// password or tampering, which AES-GCM authenticates — is an error.
func NewDescriptorStore(path, password string) (*DescriptorStore, error) {
	s := &DescriptorStore{
		path:     path,
		password: []byte(password), // copy into writable heap memory for SecureZero
	}
	if err := s.load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
	}
	return s, nil
}

// Close securely zeros the password from memory. Defer this after creation.
func (s *DescriptorStore) Close() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if len(s.password) > 0 {
		security.SecureZero(s.password)
		s.password = nil
	}
}

// Load returns the stored snapshot JSON, or false when the store is empty.
// The returned slice is a copy: callers cannot mutate the store through it.
func (s *DescriptorStore) Load() ([]byte, bool) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	if len(s.payload) == 0 {
		return nil, false
	}
	out := make([]byte, len(s.payload))
	copy(out, s.payload)
	return out, true
}

// Save encrypts and atomically writes a snapshot.
func (s *DescriptorStore) Save(snapshot []byte) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	encrypted, err := crypto.Encrypt(snapshot, string(s.password))
	if err != nil {
		return fmt.Errorf("clearsign: encrypt descriptor store: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return fmt.Errorf("clearsign: create store directory: %w", err)
	}
	tempPath := s.path + ".tmp"
	if err := os.WriteFile(tempPath, encrypted, 0o600); err != nil {
		return fmt.Errorf("clearsign: write temp store: %w", err)
	}
	if err := os.Rename(tempPath, s.path); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("clearsign: rename store file: %w", err)
	}
	s.payload = append([]byte(nil), snapshot...)
	return nil
}

func (s *DescriptorStore) load() error {
	encrypted, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	decrypted, err := crypto.Decrypt(encrypted, string(s.password))
	if err != nil {
		return fmt.Errorf("clearsign: decrypt %s: %w", filepath.Base(s.path), err)
	}
	s.payload = decrypted
	return nil
}
