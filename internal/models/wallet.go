package models

import (
	"errors"
	"time"
)

// Wallet represents a hierarchical deterministic wallet created from a BIP39 mnemonic
type Wallet struct {
	ID                     string        `json:"id"`
	Name                   string        `json:"name,omitempty"`
	CreatedAt              time.Time     `json:"createdAt"`
	LastAccessedAt         time.Time     `json:"lastAccessedAt"`
	EncryptedMnemonicPath  string        `json:"encryptedMnemonicPath"`
	UsesPassphrase         bool          `json:"usesPassphrase"`
	AddressBook            *AddressBook  `json:"addressBook,omitempty"` // T016: v0.2.0+ multi-coin addresses (optional for backwards compatibility)
}

// ValidateWalletName validates the wallet name length and characters
func ValidateWalletName(name string) error {
	if len(name) > 64 {
		return errors.New("wallet name must be 64 characters or less")
	}
	return nil
}
