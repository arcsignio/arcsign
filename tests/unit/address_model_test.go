package unit

import (
	"testing"

	"github.com/yourusername/arcsign/internal/models"
)

// T011: Test for DerivedAddress struct
// RED phase - tests written first
func TestDerivedAddress(t *testing.T) {
	t.Run("DerivedAddress has required fields", func(t *testing.T) {
		addr := models.DerivedAddress{
			Symbol:         "BTC",
			CoinName:       "Bitcoin",
			CoinType:       0,
			Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			DerivationPath: "m/44'/0'/0'/0/0",
			MarketCapRank:  1,
		}

		if addr.Symbol != "BTC" {
			t.Errorf("Expected Symbol 'BTC', got '%s'", addr.Symbol)
		}
		if addr.CoinName != "Bitcoin" {
			t.Errorf("Expected CoinName 'Bitcoin', got '%s'", addr.CoinName)
		}
		if addr.CoinType != 0 {
			t.Errorf("Expected CoinType 0, got %d", addr.CoinType)
		}
		if addr.Address == "" {
			t.Error("Address should not be empty")
		}
		if addr.DerivationPath != "m/44'/0'/0'/0/0" {
			t.Errorf("Expected path 'm/44'/0'/0'/0/0', got '%s'", addr.DerivationPath)
		}
		if addr.MarketCapRank != 1 {
			t.Errorf("Expected MarketCapRank 1, got %d", addr.MarketCapRank)
		}
	})

	t.Run("DerivedAddress validation", func(t *testing.T) {
		// Test empty symbol
		invalidAddr := models.DerivedAddress{
			Symbol:         "",
			CoinName:       "Bitcoin",
			CoinType:       0,
			Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			DerivationPath: "m/44'/0'/0'/0/0",
			MarketCapRank:  1,
		}
		if err := invalidAddr.Validate(); err == nil {
			t.Error("Expected error for empty symbol")
		}

		// Test empty address
		invalidAddr = models.DerivedAddress{
			Symbol:         "BTC",
			CoinName:       "Bitcoin",
			CoinType:       0,
			Address:        "",
			DerivationPath: "m/44'/0'/0'/0/0",
			MarketCapRank:  1,
		}
		if err := invalidAddr.Validate(); err == nil {
			t.Error("Expected error for empty address")
		}

		// Test empty derivation path
		invalidAddr = models.DerivedAddress{
			Symbol:         "BTC",
			CoinName:       "Bitcoin",
			CoinType:       0,
			Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			DerivationPath: "",
			MarketCapRank:  1,
		}
		if err := invalidAddr.Validate(); err == nil {
			t.Error("Expected error for empty derivation path")
		}

		// Test valid address
		validAddr := models.DerivedAddress{
			Symbol:         "BTC",
			CoinName:       "Bitcoin",
			CoinType:       0,
			Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			DerivationPath: "m/44'/0'/0'/0/0",
			MarketCapRank:  1,
		}
		if err := validAddr.Validate(); err != nil {
			t.Errorf("Expected no error for valid address, got %v", err)
		}
	})
}

// T013: Test for AddressBook struct
// RED phase - tests written first
func TestAddressBook(t *testing.T) {
	t.Run("AddressBook stores multiple addresses", func(t *testing.T) {
		book := models.AddressBook{
			Addresses: []models.DerivedAddress{
				{
					Symbol:         "BTC",
					CoinName:       "Bitcoin",
					CoinType:       0,
					Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
					DerivationPath: "m/44'/0'/0'/0/0",
					MarketCapRank:  1,
				},
				{
					Symbol:         "ETH",
					CoinName:       "Ethereum",
					CoinType:       60,
					Address:        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
					DerivationPath: "m/44'/60'/0'/0/0",
					MarketCapRank:  2,
				},
			},
		}

		if len(book.Addresses) != 2 {
			t.Errorf("Expected 2 addresses, got %d", len(book.Addresses))
		}
	})

	t.Run("AddressBook can find address by symbol", func(t *testing.T) {
		book := models.AddressBook{
			Addresses: []models.DerivedAddress{
				{
					Symbol:         "BTC",
					CoinName:       "Bitcoin",
					CoinType:       0,
					Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
					DerivationPath: "m/44'/0'/0'/0/0",
					MarketCapRank:  1,
				},
				{
					Symbol:         "ETH",
					CoinName:       "Ethereum",
					CoinType:       60,
					Address:        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
					DerivationPath: "m/44'/60'/0'/0/0",
					MarketCapRank:  2,
				},
			},
		}

		addr, err := book.GetBySymbol("BTC")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if addr.Symbol != "BTC" {
			t.Errorf("Expected Symbol 'BTC', got '%s'", addr.Symbol)
		}

		// Test case-insensitive lookup
		addr, err = book.GetBySymbol("eth")
		if err != nil {
			t.Fatalf("Expected no error for lowercase symbol, got %v", err)
		}
		if addr.Symbol != "ETH" {
			t.Errorf("Expected Symbol 'ETH', got '%s'", addr.Symbol)
		}

		// Test not found
		_, err = book.GetBySymbol("XRP")
		if err == nil {
			t.Error("Expected error for unknown symbol")
		}
	})

	t.Run("AddressBook can find address by coin type", func(t *testing.T) {
		book := models.AddressBook{
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
		}

		addr, err := book.GetByCoinType(0)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if addr.CoinType != 0 {
			t.Errorf("Expected CoinType 0, got %d", addr.CoinType)
		}

		// Test not found
		_, err = book.GetByCoinType(144)
		if err == nil {
			t.Error("Expected error for unknown coin type")
		}
	})
}
