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
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// AppConfig represents the top-level application configuration
// This is encrypted and stored in app_config.enc
type AppConfig struct {
	Version   string           `json:"version"`
	CreatedAt time.Time        `json:"createdAt"`
	UpdatedAt time.Time        `json:"updatedAt"`
	Wallets   []WalletMetadata `json:"wallets"`
	Providers []ProviderConfig `json:"providers"`
	Settings  GlobalSettings   `json:"settings"`
	Identity  *UsbIdentity     `json:"identity,omitempty"` // USB device identity for membership
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

// UsbIdentity represents the unique identity of this USB device
// Used for NFT membership binding and verification
type UsbIdentity struct {
	// DeviceId is a UUID generated on first setup, never changes
	DeviceId string `json:"deviceId"`

	// CreatedAt is when this USB identity was created
	CreatedAt time.Time `json:"createdAt"`

	// Memberships are the NFT memberships bound to this device
	Memberships []MembershipBinding `json:"memberships"`
}

// MembershipBinding represents an NFT membership bound to this USB device
type MembershipBinding struct {
	// NFT identification
	NftTokenId  string `json:"nftTokenId"`  // Token ID of the NFT
	NftContract string `json:"nftContract"` // NFT contract address
	ChainId     string `json:"chainId"`     // Chain ID (e.g., "bnb")

	// Binding info
	BoundAddress string    `json:"boundAddress"` // Address that owns the NFT
	BoundAt      time.Time `json:"boundAt"`      // When the binding was created
	Signature    string    `json:"signature"`    // Signature of deviceId by boundAddress

	// Cached verification (updated periodically)
	LastVerified time.Time `json:"lastVerified,omitempty"` // Last time verified on-chain
	IsValid      bool      `json:"isValid,omitempty"`      // Cached validity status
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

// ============ USB Identity Management ============

// generateUUID generates a random UUID v4
func generateUUID() (string, error) {
	uuid := make([]byte, 16)
	if _, err := rand.Read(uuid); err != nil {
		return "", fmt.Errorf("failed to generate UUID: %w", err)
	}
	// Set version (4) and variant (RFC 4122)
	uuid[6] = (uuid[6] & 0x0f) | 0x40 // Version 4
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // Variant RFC 4122

	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(uuid[0:4]),
		hex.EncodeToString(uuid[4:6]),
		hex.EncodeToString(uuid[6:8]),
		hex.EncodeToString(uuid[8:10]),
		hex.EncodeToString(uuid[10:16])), nil
}

// EnsureIdentity ensures the USB identity exists, creating it if needed
// Returns the deviceId (existing or newly created)
func (c *AppConfig) EnsureIdentity() (string, error) {
	if c.Identity != nil && c.Identity.DeviceId != "" {
		// Identity already exists
		return c.Identity.DeviceId, nil
	}

	// Generate new identity
	deviceId, err := generateUUID()
	if err != nil {
		return "", err
	}

	c.Identity = &UsbIdentity{
		DeviceId:    deviceId,
		CreatedAt:   time.Now(),
		Memberships: []MembershipBinding{},
	}
	c.UpdatedAt = time.Now()

	return deviceId, nil
}

// GetDeviceId returns the device ID, or empty string if not initialized
func (c *AppConfig) GetDeviceId() string {
	if c.Identity == nil {
		return ""
	}
	return c.Identity.DeviceId
}

// AddMembership adds a new membership binding
func (c *AppConfig) AddMembership(binding MembershipBinding) error {
	if c.Identity == nil {
		return fmt.Errorf("USB identity not initialized")
	}

	// Check if membership already exists
	for i, m := range c.Identity.Memberships {
		if m.NftTokenId == binding.NftTokenId && m.NftContract == binding.NftContract {
			// Update existing membership
			c.Identity.Memberships[i] = binding
			c.UpdatedAt = time.Now()
			return nil
		}
	}

	// Add new membership
	c.Identity.Memberships = append(c.Identity.Memberships, binding)
	c.UpdatedAt = time.Now()
	return nil
}

// RemoveMembership removes a membership binding
func (c *AppConfig) RemoveMembership(nftTokenId, nftContract string) bool {
	if c.Identity == nil {
		return false
	}

	for i, m := range c.Identity.Memberships {
		if m.NftTokenId == nftTokenId && m.NftContract == nftContract {
			c.Identity.Memberships = append(c.Identity.Memberships[:i], c.Identity.Memberships[i+1:]...)
			c.UpdatedAt = time.Now()
			return true
		}
	}
	return false
}

// GetMemberships returns all membership bindings
func (c *AppConfig) GetMemberships() []MembershipBinding {
	if c.Identity == nil {
		return []MembershipBinding{}
	}
	return c.Identity.Memberships
}

// CountValidMemberships returns the number of valid memberships
func (c *AppConfig) CountValidMemberships() int {
	if c.Identity == nil {
		return 0
	}
	count := 0
	for _, m := range c.Identity.Memberships {
		if m.IsValid {
			count++
		}
	}
	return count
}

// GetWalletLimit returns the maximum number of wallets allowed
// Formula: 1 + (nftCount * 3)
// - Free (0 NFT): 1 wallet
// - Pro (1 NFT): 4 wallets
// - Pro (n NFTs): 1 + (n * 3) wallets
func (c *AppConfig) GetWalletLimit() int {
	return 1 + (c.CountValidMemberships() * 3)
}

// CanCreateWallet checks if a new wallet can be created
func (c *AppConfig) CanCreateWallet() bool {
	return len(c.Wallets) < c.GetWalletLimit()
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
