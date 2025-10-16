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

// T012: DerivedAddress represents a pre-generated cryptocurrency address
// for a specific coin type (v0.2.0+ - multi-coin address generation feature)
type DerivedAddress struct {
	Symbol         string `json:"symbol"`         // Ticker symbol (e.g., "BTC", "ETH")
	CoinName       string `json:"coinName"`       // Full coin name (e.g., "Bitcoin", "Ethereum")
	CoinType       uint32 `json:"coinType"`       // SLIP-44 coin type (e.g., 0 for BTC, 60 for ETH)
	Address        string `json:"address"`        // Formatted address (plaintext - public key)
	DerivationPath string `json:"derivationPath"` // BIP44 path used to derive this address
	MarketCapRank  int    `json:"marketCapRank"`  // Market cap ranking (for sorting)
}

// Validate checks if the DerivedAddress has valid values
func (d *DerivedAddress) Validate() error {
	if d.Symbol == "" {
		return errors.New("symbol cannot be empty")
	}
	if d.Address == "" {
		return errors.New("address cannot be empty")
	}
	if d.DerivationPath == "" {
		return errors.New("derivation path cannot be empty")
	}
	return nil
}

// T014: AddressBook is a collection of pre-generated addresses for multiple cryptocurrencies
type AddressBook struct {
	Addresses []DerivedAddress `json:"addresses"` // All pre-generated addresses
}

// GetBySymbol retrieves an address by its symbol (case-insensitive)
func (ab *AddressBook) GetBySymbol(symbol string) (*DerivedAddress, error) {
	// Case-insensitive comparison
	upperSymbol := ""
	for _, c := range symbol {
		if c >= 'a' && c <= 'z' {
			upperSymbol += string(c - 32) // Convert to uppercase
		} else {
			upperSymbol += string(c)
		}
	}

	for i := range ab.Addresses {
		if ab.Addresses[i].Symbol == upperSymbol {
			return &ab.Addresses[i], nil
		}
	}

	return nil, errors.New("address not found for symbol: " + symbol)
}

// GetByCoinType retrieves an address by its SLIP-44 coin type
func (ab *AddressBook) GetByCoinType(coinType uint32) (*DerivedAddress, error) {
	for i := range ab.Addresses {
		if ab.Addresses[i].CoinType == coinType {
			return &ab.Addresses[i], nil
		}
	}

	return nil, errors.New("address not found for coin type")
}
