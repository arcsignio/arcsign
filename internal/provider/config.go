package provider

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/yourusername/arcsign/internal/services/crypto"
)

// ProviderConfig represents the configuration for a blockchain data provider
type ProviderConfig struct {
	// ProviderType identifies the provider implementation ("alchemy", "infura", "quicknode", etc.)
	ProviderType string `json:"provider_type"`

	// APIKey is the authentication key for the provider service
	APIKey string `json:"api_key"`

	// ChainID is the blockchain this provider is configured for
	ChainID string `json:"chain_id"`

	// NetworkID is the specific network (e.g., "mainnet", "sepolia", "testnet3")
	NetworkID string `json:"network_id,omitempty"`

	// CustomEndpoint allows override of default provider endpoints (optional)
	CustomEndpoint string `json:"custom_endpoint,omitempty"`

	// Priority determines provider selection order (higher = preferred)
	// Used when multiple providers are configured for the same chain
	Priority int `json:"priority"`

	// Enabled allows disabling a provider without deleting configuration
	Enabled bool `json:"enabled"`

	// CreatedAt timestamp
	CreatedAt time.Time `json:"created_at"`

	// UpdatedAt timestamp
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderConfigStore manages encrypted storage of provider configurations
type ProviderConfigStore struct {
	configs    map[string]map[string]*ProviderConfig // chainID -> providerType -> config
	mutex      sync.RWMutex
	configPath string
	password   string // Used for encryption/decryption
}

// ProviderConfigFile represents the on-disk structure
type ProviderConfigFile struct {
	Version  string                                `json:"version"`
	Configs  map[string]map[string]*ProviderConfig `json:"configs"`
	UpdatedAt time.Time                            `json:"updated_at"`
}

// NewProviderConfigStore creates a new provider configuration store
//
// Parameters:
// - configPath: Path to encrypted configuration file
// - password: Password for encryption/decryption
func NewProviderConfigStore(configPath, password string) (*ProviderConfigStore, error) {
	store := &ProviderConfigStore{
		configs:    make(map[string]map[string]*ProviderConfig),
		configPath: configPath,
		password:   password,
	}

	// Try to load existing configuration
	if err := store.Load(); err != nil {
		// If file doesn't exist, initialize empty store
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to load provider config: %w", err)
		}
	}

	return store, nil
}

// Set adds or updates a provider configuration
func (s *ProviderConfigStore) Set(config *ProviderConfig) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if config.ChainID == "" {
		return fmt.Errorf("chain_id is required")
	}
	if config.ProviderType == "" {
		return fmt.Errorf("provider_type is required")
	}
	if config.APIKey == "" {
		return fmt.Errorf("api_key is required")
	}

	// Initialize chain map if needed
	if s.configs[config.ChainID] == nil {
		s.configs[config.ChainID] = make(map[string]*ProviderConfig)
	}

	// Update timestamps
	now := time.Now()
	if config.CreatedAt.IsZero() {
		config.CreatedAt = now
	}
	config.UpdatedAt = now

	// Store configuration
	s.configs[config.ChainID][config.ProviderType] = config

	// Persist to disk
	return s.save()
}

// Get retrieves a provider configuration for a specific chain and provider type
func (s *ProviderConfigStore) Get(chainID, providerType string) (*ProviderConfig, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	chainConfigs, ok := s.configs[chainID]
	if !ok {
		return nil, fmt.Errorf("no providers configured for chain: %s", chainID)
	}

	config, ok := chainConfigs[providerType]
	if !ok {
		return nil, fmt.Errorf("provider %s not configured for chain %s", providerType, chainID)
	}

	// Return a copy to prevent external mutation
	configCopy := *config
	return &configCopy, nil
}

// GetAllForChain retrieves all provider configurations for a specific chain
func (s *ProviderConfigStore) GetAllForChain(chainID string) ([]*ProviderConfig, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	chainConfigs, ok := s.configs[chainID]
	if !ok {
		return nil, fmt.Errorf("no providers configured for chain: %s", chainID)
	}

	configs := make([]*ProviderConfig, 0, len(chainConfigs))
	for _, config := range chainConfigs {
		if config.Enabled {
			configCopy := *config
			configs = append(configs, &configCopy)
		}
	}

	return configs, nil
}

// GetBestProvider returns the highest-priority enabled provider for a chain
func (s *ProviderConfigStore) GetBestProvider(chainID string) (*ProviderConfig, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	chainConfigs, ok := s.configs[chainID]
	if !ok {
		return nil, fmt.Errorf("no providers configured for chain: %s", chainID)
	}

	var best *ProviderConfig
	for _, config := range chainConfigs {
		if !config.Enabled {
			continue
		}
		if best == nil || config.Priority > best.Priority {
			best = config
		}
	}

	if best == nil {
		return nil, fmt.Errorf("no enabled providers for chain: %s", chainID)
	}

	// Return a copy
	configCopy := *best
	return &configCopy, nil
}

// Delete removes a provider configuration
func (s *ProviderConfigStore) Delete(chainID, providerType string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	chainConfigs, ok := s.configs[chainID]
	if !ok {
		return fmt.Errorf("no providers configured for chain: %s", chainID)
	}

	delete(chainConfigs, providerType)

	// Remove chain entry if no providers left
	if len(chainConfigs) == 0 {
		delete(s.configs, chainID)
	}

	// Persist to disk
	return s.save()
}

// ListChains returns all chains with configured providers
func (s *ProviderConfigStore) ListChains() []string {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	chains := make([]string, 0, len(s.configs))
	for chainID := range s.configs {
		chains = append(chains, chainID)
	}
	return chains
}

// Load reads and decrypts the provider configuration file
func (s *ProviderConfigStore) Load() error {
	fmt.Fprintf(os.Stderr, "[Go Provider] Load() called for path: %s\n", s.configPath)
	fmt.Fprintf(os.Stderr, "[Go Provider] Password length: %d\n", len(s.password))
	
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Read encrypted file
	encryptedData, err := os.ReadFile(s.configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Go Provider] Failed to read file: %v\n", err)
		return err
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] Read encrypted data, length: %d bytes\n", len(encryptedData))

	// Decrypt using AES-256-GCM (same as wallet encryption)
	decryptedData, err := crypto.Decrypt(encryptedData, s.password)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Go Provider] Decryption FAILED: %v\n", err)
		fmt.Fprintf(os.Stderr, "[Go Provider] Password used for decryption: '%s'\n", s.password)
		return fmt.Errorf("failed to decrypt provider config: %w", err)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] Decryption SUCCESS, decrypted data length: %d bytes\n", len(decryptedData))
	previewLen := 200
	if len(decryptedData) < previewLen {
		previewLen = len(decryptedData)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] Decrypted JSON preview (first %d chars): %s\n", previewLen, string(decryptedData[:previewLen]))

	// Parse JSON
	var configFile ProviderConfigFile
	if err := json.Unmarshal(decryptedData, &configFile); err != nil {
		fmt.Fprintf(os.Stderr, "[Go Provider] JSON parse FAILED: %v\n", err)
		return fmt.Errorf("failed to parse provider config: %w", err)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] JSON parse SUCCESS, version: %s\n", configFile.Version)

	// Validate version
	if configFile.Version != "1.0" {
		fmt.Fprintf(os.Stderr, "[Go Provider] Unsupported version: %s\n", configFile.Version)
		return fmt.Errorf("unsupported config version: %s", configFile.Version)
	}

	// Load configs
	s.configs = configFile.Configs
	if s.configs == nil {
		s.configs = make(map[string]map[string]*ProviderConfig)
	}

	return nil
}

// save encrypts and writes the provider configuration file (caller must hold lock)
func (s *ProviderConfigStore) save() error {
	fmt.Fprintf(os.Stderr, "[Go Provider] save() called for path: %s\n", s.configPath)
	fmt.Fprintf(os.Stderr, "[Go Provider] Password length: %d\n", len(s.password))
	
	// Create config file structure
	configFile := ProviderConfigFile{
		Version:   "1.0",
		Configs:   s.configs,
		UpdatedAt: time.Now(),
	}

	// Marshal to JSON
	jsonData, err := json.MarshalIndent(configFile, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Go Provider] JSON marshal FAILED: %v\n", err)
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] JSON marshal SUCCESS, data length: %d bytes\n", len(jsonData))
	previewLen := 200
	if len(jsonData) < previewLen {
		previewLen = len(jsonData)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] JSON preview (first %d chars): %s\n", previewLen, string(jsonData[:previewLen]))

	// Encrypt using AES-256-GCM
	encryptedData, err := crypto.Encrypt(jsonData, s.password)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Go Provider] Encryption FAILED: %v\n", err)
		fmt.Fprintf(os.Stderr, "[Go Provider] Password used for encryption: '%s'\n", s.password)
		return fmt.Errorf("failed to encrypt provider config: %w", err)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] Encryption SUCCESS, encrypted data length: %d bytes\n", len(encryptedData))

	// Ensure directory exists
	dir := filepath.Dir(s.configPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		fmt.Fprintf(os.Stderr, "[Go Provider] Failed to create directory: %v\n", err)
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Write to file atomically (write to temp, then rename)
	tempPath := s.configPath + ".tmp"
	if err := os.WriteFile(tempPath, encryptedData, 0600); err != nil {
		fmt.Fprintf(os.Stderr, "[Go Provider] Failed to write temp file: %v\n", err)
		return fmt.Errorf("failed to write temp config: %w", err)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] Wrote temp file: %s\n", tempPath)

	if err := os.Rename(tempPath, s.configPath); err != nil {
		os.Remove(tempPath) // Clean up temp file
		fmt.Fprintf(os.Stderr, "[Go Provider] Failed to rename file: %v\n", err)
		return fmt.Errorf("failed to rename config file: %w", err)
	}
	fmt.Fprintf(os.Stderr, "[Go Provider] File saved successfully: %s\n", s.configPath)

	return nil
}

// ValidateAPIKey performs a basic validation and test of the API key
func ValidateAPIKey(config *ProviderConfig) error {
	if config.APIKey == "" {
		return fmt.Errorf("API key is empty")
	}

	// Basic format validation (provider-specific logic can be added)
	switch config.ProviderType {
	case "alchemy":
		// Alchemy API keys are typically 32 characters alphanumeric
		if len(config.APIKey) < 20 {
			return fmt.Errorf("Alchemy API key appears too short")
		}
	case "infura":
		// Infura project IDs are 32 characters hex
		if len(config.APIKey) != 32 {
			return fmt.Errorf("Infura project ID should be 32 characters")
		}
	case "quicknode":
		// QuickNode endpoints include the full URL
		if config.CustomEndpoint == "" {
			return fmt.Errorf("QuickNode requires custom_endpoint")
		}
	}

	return nil
}
