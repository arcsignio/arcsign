package models

import (
	"errors"
	"time"
)

// Address represents a derived cryptocurrency address from a BIP44 path
type Address struct {
	AccountID      string    `json:"accountId"`
	Change         uint32    `json:"change"` // 0=external/receive, 1=internal/change
	AddressIndex   uint32    `json:"addressIndex"`
	DerivationPath string    `json:"derivationPath"`
	Address        string    `json:"address"`
	PublicKey      string    `json:"publicKey"` // hex-encoded compressed public key
	CreatedAt      time.Time `json:"createdAt"`
	Label          string    `json:"label,omitempty"`
}

// ValidateChange validates the change value is 0 or 1 per BIP44
func ValidateChange(change uint32) error {
	if change > 1 {
		return errors.New("change must be 0 (external/receive) or 1 (internal/change)")
	}
	return nil
}

// ValidateAddressIndex validates the address index is within acceptable range
func ValidateAddressIndex(index uint32) error {
	if index > 1000 {
		return errors.New("address index must be 1000 or less")
	}
	return nil
}
