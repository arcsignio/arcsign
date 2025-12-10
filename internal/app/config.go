/**
 * Application-level configuration management
 * Feature: App-level authentication and configuration storage
 *
 * This module manages the app_config.enc file that stores:
 * - Wallet metadata list
 * - Provider configurations
 * - Global application settings
 *
 * Security:
 * - Encrypted with AES-256-GCM using user's app password
 * - Password derived using Argon2id
 * - Stored on USB drive at {usbPath}/app_config.enc
 */

package app

import (
	"encoding/json"
	"time"
)

// AppConfig represents the top-level application configuration
// This is encrypted and stored in app_config.enc
type AppConfig struct {
	Version   string          `json:"version"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
	Wallets   []WalletMetadata `json:"wallets"`
	Providers []ProviderConfig `json:"providers"`
	Settings  GlobalSettings   `json:"settings"`
}

// WalletMetadata contains metadata about a wallet without sensitive data
type WalletMetadata struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// ProviderConfig stores blockchain API provider configuration
type ProviderConfig struct {
	ProviderType string `json:"providerType"` // "alchemy", "infura", "quicknode"
	APIKey       string `json:"apiKey"`       // Encrypted API key
	Priority     int    `json:"priority"`     // Higher priority = used first (0-999)
	Enabled      bool   `json:"enabled"`      // Whether this provider is active
}

// GlobalSettings stores application-wide settings
type GlobalSettings struct {
	Theme    string `json:"theme"`    // "light" or "dark"
	Language string `json:"language"` // "en", "zh", etc.
}

// NewAppConfig creates a new AppConfig with default values
func NewAppConfig() *AppConfig {
	now := time.Now()
	return &AppConfig{
		Version:   "1.0.0",
		CreatedAt: now,
		UpdatedAt: now,
		Wallets:   []WalletMetadata{},
		Providers: []ProviderConfig{},
		Settings: GlobalSettings{
			Theme:    "light",
			Language: "en",
		},
	}
}

// AddWallet adds a wallet to the configuration
func (c *AppConfig) AddWallet(id, name string) {
	c.Wallets = append(c.Wallets, WalletMetadata{
		ID:        id,
		Name:      name,
		CreatedAt: time.Now(),
	})
	c.UpdatedAt = time.Now()
}

// RemoveWallet removes a wallet from the configuration
func (c *AppConfig) RemoveWallet(id string) bool {
	for i, wallet := range c.Wallets {
		if wallet.ID == id {
			c.Wallets = append(c.Wallets[:i], c.Wallets[i+1:]...)
			c.UpdatedAt = time.Now()
			return true
		}
	}
	return false
}

// UpdateWalletName updates the name of a wallet
func (c *AppConfig) UpdateWalletName(id, newName string) bool {
	for i, wallet := range c.Wallets {
		if wallet.ID == id {
			c.Wallets[i].Name = newName
			c.UpdatedAt = time.Now()
			return true
		}
	}
	return false
}

// AddProvider adds or updates a provider configuration
func (c *AppConfig) AddProvider(provider ProviderConfig) {
	// Check if provider already exists
	for i, p := range c.Providers {
		if p.ProviderType == provider.ProviderType {
			// Update existing provider
			c.Providers[i] = provider
			c.UpdatedAt = time.Now()
			return
		}
	}
	// Add new provider
	c.Providers = append(c.Providers, provider)
	c.UpdatedAt = time.Now()
}

// RemoveProvider removes a provider configuration
func (c *AppConfig) RemoveProvider(providerType string) bool {
	for i, p := range c.Providers {
		if p.ProviderType == providerType {
			c.Providers = append(c.Providers[:i], c.Providers[i+1:]...)
			c.UpdatedAt = time.Now()
			return true
		}
	}
	return false
}

// GetProvider retrieves a provider by type
func (c *AppConfig) GetProvider(providerType string) *ProviderConfig {
	for _, p := range c.Providers {
		if p.ProviderType == providerType {
			return &p
		}
	}
	return nil
}

// ToJSON serializes the AppConfig to JSON
func (c *AppConfig) ToJSON() ([]byte, error) {
	return json.MarshalIndent(c, "", "  ")
}

// FromJSON deserializes AppConfig from JSON
func FromJSON(data []byte) (*AppConfig, error) {
	var config AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}
	return &config, nil
}
