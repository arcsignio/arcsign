package txlabels

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/Jason-chen-taiwan/arcSignv2/internal/security"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/crypto"
)

// TxLabel represents a user-assigned label for a transaction
type TxLabel struct {
	Name      string    `json:"name"`
	Category  string    `json:"category,omitempty"`
	Notes     string    `json:"notes,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// TxLabelFile represents the on-disk structure
type TxLabelFile struct {
	Version   string              `json:"version"`
	Labels    map[string]*TxLabel `json:"labels"` // key: "network:txHash"
	UpdatedAt time.Time           `json:"updatedAt"`
}

// TxLabelStore manages encrypted storage of transaction labels
type TxLabelStore struct {
	labels     map[string]*TxLabel
	mutex      sync.RWMutex
	configPath string
	password   string
}

// NewTxLabelStore creates a new transaction label store
func NewTxLabelStore(configPath, password string) (*TxLabelStore, error) {
	store := &TxLabelStore{
		labels:     make(map[string]*TxLabel),
		configPath: configPath,
		password:   password,
	}

	if err := store.Load(); err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to load tx labels: %w", err)
		}
	}

	return store, nil
}

// Close securely zeros the password from memory
func (s *TxLabelStore) Close() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.password != "" {
		b := unsafe.Slice(unsafe.StringData(s.password), len(s.password))
		security.SecureZero(b)
		s.password = ""
	}
}

// makeKey creates a composite key from network and txHash
func makeKey(network, txHash string) string {
	return network + ":" + txHash
}

// Set adds or updates a transaction label (upsert)
func (s *TxLabelStore) Set(network, txHash, name, category, notes string) (*TxLabel, error) {
	if network == "" {
		return nil, fmt.Errorf("network is required")
	}
	if txHash == "" {
		return nil, fmt.Errorf("txHash is required")
	}
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if len(name) > 100 {
		return nil, fmt.Errorf("name must be 100 characters or less")
	}
	if len(notes) > 500 {
		return nil, fmt.Errorf("notes must be 500 characters or less")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	key := makeKey(network, txHash)
	now := time.Now()

	existing, exists := s.labels[key]
	label := &TxLabel{
		Name:      name,
		Category:  category,
		Notes:     notes,
		UpdatedAt: now,
	}
	if exists {
		label.CreatedAt = existing.CreatedAt
	} else {
		label.CreatedAt = now
	}

	s.labels[key] = label

	if err := s.save(); err != nil {
		if exists {
			s.labels[key] = existing
		} else {
			delete(s.labels, key)
		}
		return nil, fmt.Errorf("failed to save tx label: %w", err)
	}

	return label, nil
}

// Get returns a transaction label by network and txHash
func (s *TxLabelStore) Get(network, txHash string) (*TxLabel, bool) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	label, ok := s.labels[makeKey(network, txHash)]
	if !ok {
		return nil, false
	}
	copy := *label
	return &copy, true
}

// Delete removes a transaction label
func (s *TxLabelStore) Delete(network, txHash string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	key := makeKey(network, txHash)
	old, exists := s.labels[key]
	if !exists {
		return fmt.Errorf("label not found for %s", key)
	}

	delete(s.labels, key)

	if err := s.save(); err != nil {
		s.labels[key] = old
		return fmt.Errorf("failed to delete tx label: %w", err)
	}

	return nil
}

// LabelEntry represents a label with its key components for API responses
type LabelEntry struct {
	Network string  `json:"network"`
	TxHash  string  `json:"txHash"`
	Label   TxLabel `json:"label"`
}

// ListByNetwork returns all labels for a specific network
func (s *TxLabelStore) ListByNetwork(network string) []LabelEntry {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	prefix := network + ":"
	var result []LabelEntry
	for key, label := range s.labels {
		if strings.HasPrefix(key, prefix) {
			txHash := strings.TrimPrefix(key, prefix)
			result = append(result, LabelEntry{
				Network: network,
				TxHash:  txHash,
				Label:   *label,
			})
		}
	}
	return result
}

// ListAll returns all labels
func (s *TxLabelStore) ListAll() []LabelEntry {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	result := make([]LabelEntry, 0, len(s.labels))
	for key, label := range s.labels {
		parts := strings.SplitN(key, ":", 2)
		if len(parts) != 2 {
			continue
		}
		result = append(result, LabelEntry{
			Network: parts[0],
			TxHash:  parts[1],
			Label:   *label,
		})
	}
	return result
}

// Load reads and decrypts the labels file
func (s *TxLabelStore) Load() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	encryptedData, err := os.ReadFile(s.configPath)
	if err != nil {
		return err
	}

	decryptedData, err := crypto.Decrypt(encryptedData, s.password)
	if err != nil {
		return fmt.Errorf("failed to decrypt tx labels: %w", err)
	}

	var file TxLabelFile
	if err := json.Unmarshal(decryptedData, &file); err != nil {
		return fmt.Errorf("failed to parse tx labels: %w", err)
	}

	if file.Version != "1.0" {
		return fmt.Errorf("unsupported tx labels version: %s", file.Version)
	}

	s.labels = file.Labels
	if s.labels == nil {
		s.labels = make(map[string]*TxLabel)
	}

	return nil
}

// save encrypts and writes the labels file (caller must hold lock)
func (s *TxLabelStore) save() error {
	file := TxLabelFile{
		Version:   "1.0",
		Labels:    s.labels,
		UpdatedAt: time.Now(),
	}

	jsonData, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal tx labels: %w", err)
	}

	encryptedData, err := crypto.Encrypt(jsonData, s.password)
	if err != nil {
		return fmt.Errorf("failed to encrypt tx labels: %w", err)
	}

	dir := filepath.Dir(s.configPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create tx labels directory: %w", err)
	}

	tempPath := s.configPath + ".tmp"
	if err := os.WriteFile(tempPath, encryptedData, 0600); err != nil {
		return fmt.Errorf("failed to write temp tx labels: %w", err)
	}

	if err := os.Rename(tempPath, s.configPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename tx labels file: %w", err)
	}

	return nil
}
