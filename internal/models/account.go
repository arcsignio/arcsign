package models

import (
	"errors"
	"time"
)

// Account represents a BIP44 account within a wallet (m/44'/coin_type'/account')
type Account struct {
	WalletID         string    `json:"walletId"`
	AccountIndex     uint32    `json:"accountIndex"`
	CoinType         uint32    `json:"coinType"`
	Name             string    `json:"name,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	NextAddressIndex uint32    `json:"nextAddressIndex"`
	NextChangeIndex  uint32    `json:"nextChangeIndex"`
}

// ValidateAccountIndex validates the account index is within acceptable range
func ValidateAccountIndex(index uint32) error {
	if index > 100 {
		return errors.New("account index must be 100 or less")
	}
	return nil
}

// ValidateCoinType validates the coin type is a registered SLIP-44 coin type
// For Phase 1, we accept common coin types
func ValidateCoinType(coinType uint32) error {
	// Common SLIP-44 coin types
	validCoinTypes := map[uint32]bool{
		0:   true, // Bitcoin
		2:   true, // Litecoin
		3:   true, // Dogecoin
		60:  true, // Ethereum
		501: true, // Solana
		// Add more as needed
	}

	if !validCoinTypes[coinType] {
		return errors.New("unsupported coin type (not in SLIP-44 registry)")
	}
	return nil
}
