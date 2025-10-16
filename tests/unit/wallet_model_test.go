package unit

import (
	"testing"

	"github.com/yourusername/arcsign/internal/models"
)

// T015: Test for Wallet extension with AddressBook
// RED phase - tests written first
func TestWallet_WithAddressBook(t *testing.T) {
	t.Run("Wallet has optional AddressBook field", func(t *testing.T) {
		// Test v0.2.0+ wallet with AddressBook
		wallet := models.Wallet{
			ID:   "test-wallet-123",
			Name: "My Multi-Coin Wallet",
			AddressBook: &models.AddressBook{
				Addresses: []models.DerivedAddress{
					{
						Symbol:         "BTC",
						CoinName:       "Bitcoin",
						CoinType:       0,
						Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
						DerivationPath: "m/44'/0'/0'/0/0",
						MarketCapRank:  1,
					},
				},
			},
		}

		if wallet.AddressBook == nil {
			t.Error("AddressBook should not be nil")
		}
		if len(wallet.AddressBook.Addresses) != 1 {
			t.Errorf("Expected 1 address, got %d", len(wallet.AddressBook.Addresses))
		}
	})

	t.Run("Wallet backwards compatible without AddressBook", func(t *testing.T) {
		// Test v0.1.0 wallet without AddressBook
		wallet := models.Wallet{
			ID:          "test-wallet-old",
			Name:        "My Old Wallet",
			AddressBook: nil, // v0.1.0 wallets don't have AddressBook
		}

		if wallet.AddressBook != nil {
			t.Error("AddressBook should be nil for v0.1.0 wallets")
		}
	})

	t.Run("Wallet with empty AddressBook", func(t *testing.T) {
		wallet := models.Wallet{
			ID:   "test-wallet-empty",
			Name: "Empty Address Book Wallet",
			AddressBook: &models.AddressBook{
				Addresses: []models.DerivedAddress{},
			},
		}

		if wallet.AddressBook == nil {
			t.Error("AddressBook should not be nil")
		}
		if len(wallet.AddressBook.Addresses) != 0 {
			t.Errorf("Expected 0 addresses, got %d", len(wallet.AddressBook.Addresses))
		}
	})
}
