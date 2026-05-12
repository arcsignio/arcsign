package contacts

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
	"unsafe"

	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/services/crypto"
	"github.com/arcsignio/arcsign/internal/utils"
)

// mustGenerateUUID generates a UUID v4 using the existing utils package
func mustGenerateUUID() string {
	id, err := utils.GenerateSecureUUID()
	if err != nil {
		// Fallback: this should never happen with crypto/rand
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return id
}

// Contact represents a saved contact address
type Contact struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Symbol    string    `json:"symbol"`
	CoinName  string    `json:"coinName"`
	Notes     string    `json:"notes,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ContactFile represents the on-disk structure
type ContactFile struct {
	Version   string    `json:"version"`
	Contacts  []Contact `json:"contacts"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ContactStore manages encrypted storage of contacts
type ContactStore struct {
	contacts   []Contact
	mutex      sync.RWMutex
	configPath string
	password   string
}

// NewContactStore creates a new contact store
func NewContactStore(configPath, password string) (*ContactStore, error) {
	store := &ContactStore{
		contacts:   []Contact{},
		configPath: configPath,
		password:   password,
	}

	if err := store.Load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to load contacts: %w", err)
		}
	}

	return store, nil
}

// Close securely zeros the password from memory
func (s *ContactStore) Close() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.password != "" {
		b := unsafe.Slice(unsafe.StringData(s.password), len(s.password))
		security.SecureZero(b)
		s.password = ""
	}
}

// List returns all contacts
func (s *ContactStore) List() []Contact {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	result := make([]Contact, len(s.contacts))
	copy(result, s.contacts)
	return result
}

// GetByID returns a contact by ID
func (s *ContactStore) GetByID(id string) (*Contact, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	for i := range s.contacts {
		if s.contacts[i].ID == id {
			c := s.contacts[i]
			return &c, nil
		}
	}
	return nil, fmt.Errorf("contact not found: %s", id)
}

// Add creates a new contact and persists to disk
func (s *ContactStore) Add(name, address, symbol, coinName, notes string) (*Contact, error) {
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if len(name) > 64 {
		return nil, fmt.Errorf("name must be 64 characters or less")
	}
	if address == "" {
		return nil, fmt.Errorf("address is required")
	}
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if len(notes) > 500 {
		return nil, fmt.Errorf("notes must be 500 characters or less")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	now := time.Now()
	contact := Contact{
		ID:        mustGenerateUUID(),
		Name:      name,
		Address:   address,
		Symbol:    symbol,
		CoinName:  coinName,
		Notes:     notes,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.contacts = append(s.contacts, contact)

	if err := s.save(); err != nil {
		// Rollback
		s.contacts = s.contacts[:len(s.contacts)-1]
		return nil, fmt.Errorf("failed to save contact: %w", err)
	}

	return &contact, nil
}

// Update modifies an existing contact
func (s *ContactStore) Update(id, name, address, symbol, coinName, notes string) (*Contact, error) {
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if len(name) > 64 {
		return nil, fmt.Errorf("name must be 64 characters or less")
	}
	if address == "" {
		return nil, fmt.Errorf("address is required")
	}
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if len(notes) > 500 {
		return nil, fmt.Errorf("notes must be 500 characters or less")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	idx := -1
	for i := range s.contacts {
		if s.contacts[i].ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return nil, fmt.Errorf("contact not found: %s", id)
	}

	// Save old values for rollback
	old := s.contacts[idx]

	s.contacts[idx].Name = name
	s.contacts[idx].Address = address
	s.contacts[idx].Symbol = symbol
	s.contacts[idx].CoinName = coinName
	s.contacts[idx].Notes = notes
	s.contacts[idx].UpdatedAt = time.Now()

	if err := s.save(); err != nil {
		s.contacts[idx] = old
		return nil, fmt.Errorf("failed to save contact: %w", err)
	}

	updated := s.contacts[idx]
	return &updated, nil
}

// Delete removes a contact by ID
func (s *ContactStore) Delete(id string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	idx := -1
	for i := range s.contacts {
		if s.contacts[i].ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return fmt.Errorf("contact not found: %s", id)
	}

	old := s.contacts[idx]
	s.contacts = append(s.contacts[:idx], s.contacts[idx+1:]...)

	if err := s.save(); err != nil {
		// Rollback: re-insert at same position
		s.contacts = append(s.contacts[:idx], append([]Contact{old}, s.contacts[idx:]...)...)
		return fmt.Errorf("failed to delete contact: %w", err)
	}

	return nil
}

// Load reads and decrypts the contacts file
func (s *ContactStore) Load() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	encryptedData, err := os.ReadFile(s.configPath)
	if err != nil {
		return err
	}

	decryptedData, err := crypto.Decrypt(encryptedData, s.password)
	if err != nil {
		return fmt.Errorf("failed to decrypt contacts: %w", err)
	}

	var file ContactFile
	if err := json.Unmarshal(decryptedData, &file); err != nil {
		return fmt.Errorf("failed to parse contacts: %w", err)
	}

	if file.Version != "1.0" {
		return fmt.Errorf("unsupported contacts version: %s", file.Version)
	}

	s.contacts = file.Contacts
	if s.contacts == nil {
		s.contacts = []Contact{}
	}

	return nil
}

// save encrypts and writes the contacts file (caller must hold lock)
func (s *ContactStore) save() error {
	file := ContactFile{
		Version:   "1.0",
		Contacts:  s.contacts,
		UpdatedAt: time.Now(),
	}

	jsonData, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal contacts: %w", err)
	}

	encryptedData, err := crypto.Encrypt(jsonData, s.password)
	if err != nil {
		return fmt.Errorf("failed to encrypt contacts: %w", err)
	}

	dir := filepath.Dir(s.configPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create contacts directory: %w", err)
	}

	tempPath := s.configPath + ".tmp"
	if err := os.WriteFile(tempPath, encryptedData, 0600); err != nil {
		return fmt.Errorf("failed to write temp contacts: %w", err)
	}

	if err := os.Rename(tempPath, s.configPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename contacts file: %w", err)
	}

	return nil
}
