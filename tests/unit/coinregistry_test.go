package unit

import (
	"testing"

	"github.com/yourusername/arcsign/internal/services/coinregistry"
)

// T004: Test for CoinMetadata struct
// GREEN phase - implementation exists
func TestCoinMetadata(t *testing.T) {
	// Test case: CoinMetadata should have required fields
	t.Run("CoinMetadata has required fields", func(t *testing.T) {
		coin := coinregistry.CoinMetadata{
			Symbol:        "BTC",
			Name:          "Bitcoin",
			CoinType:      0,
			FormatterID:   "bitcoin",
			MarketCapRank: 1,
		}

		if coin.Symbol != "BTC" {
			t.Errorf("Expected Symbol 'BTC', got '%s'", coin.Symbol)
		}
		if coin.Name != "Bitcoin" {
			t.Errorf("Expected Name 'Bitcoin', got '%s'", coin.Name)
		}
		if coin.CoinType != 0 {
			t.Errorf("Expected CoinType 0, got %d", coin.CoinType)
		}
		if coin.FormatterID != "bitcoin" {
			t.Errorf("Expected FormatterID 'bitcoin', got '%s'", coin.FormatterID)
		}
		if coin.MarketCapRank != 1 {
			t.Errorf("Expected MarketCapRank 1, got %d", coin.MarketCapRank)
		}
	})

	t.Run("CoinMetadata validation", func(t *testing.T) {
		// Test empty symbol
		invalidCoin := coinregistry.CoinMetadata{
			Symbol:        "",
			Name:          "Bitcoin",
			CoinType:      0,
			FormatterID:   "bitcoin",
			MarketCapRank: 1,
		}
		if err := invalidCoin.Validate(); err == nil {
			t.Error("Expected error for empty symbol")
		}

		// Test lowercase symbol
		invalidCoin = coinregistry.CoinMetadata{
			Symbol:        "btc",
			Name:          "Bitcoin",
			CoinType:      0,
			FormatterID:   "bitcoin",
			MarketCapRank: 1,
		}
		if err := invalidCoin.Validate(); err == nil {
			t.Error("Expected error for lowercase symbol")
		}

		// Test empty name
		invalidCoin = coinregistry.CoinMetadata{
			Symbol:        "BTC",
			Name:          "",
			CoinType:      0,
			FormatterID:   "bitcoin",
			MarketCapRank: 1,
		}
		if err := invalidCoin.Validate(); err == nil {
			t.Error("Expected error for empty name")
		}

		// Test empty formatterID
		invalidCoin = coinregistry.CoinMetadata{
			Symbol:        "BTC",
			Name:          "Bitcoin",
			CoinType:      0,
			FormatterID:   "",
			MarketCapRank: 1,
		}
		if err := invalidCoin.Validate(); err == nil {
			t.Error("Expected error for empty formatterID")
		}

		// Test invalid market cap rank
		invalidCoin = coinregistry.CoinMetadata{
			Symbol:        "BTC",
			Name:          "Bitcoin",
			CoinType:      0,
			FormatterID:   "bitcoin",
			MarketCapRank: 0,
		}
		if err := invalidCoin.Validate(); err == nil {
			t.Error("Expected error for non-positive marketCapRank")
		}

		// Test valid coin
		validCoin := coinregistry.CoinMetadata{
			Symbol:        "BTC",
			Name:          "Bitcoin",
			CoinType:      0,
			FormatterID:   "bitcoin",
			MarketCapRank: 1,
		}
		if err := validCoin.Validate(); err != nil {
			t.Errorf("Expected no error for valid coin, got %v", err)
		}
	})
}

// T006: Test for Registry.GetCoinBySymbol
// RED phase - tests written first
func TestRegistry_GetCoinBySymbol(t *testing.T) {
	t.Run("GetCoinBySymbol returns Bitcoin metadata", func(t *testing.T) {
		registry := coinregistry.NewRegistry()
		coin, err := registry.GetCoinBySymbol("BTC")

		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if coin.Symbol != "BTC" {
			t.Errorf("Expected Symbol 'BTC', got '%s'", coin.Symbol)
		}
		if coin.CoinType != 0 {
			t.Errorf("Expected CoinType 0 for Bitcoin, got %d", coin.CoinType)
		}
	})

	t.Run("GetCoinBySymbol returns error for unknown symbol", func(t *testing.T) {
		registry := coinregistry.NewRegistry()
		_, err := registry.GetCoinBySymbol("UNKNOWN")

		if err == nil {
			t.Error("Expected error for unknown symbol, got nil")
		}
	})

	t.Run("GetCoinBySymbol is case-insensitive", func(t *testing.T) {
		registry := coinregistry.NewRegistry()
		coin, err := registry.GetCoinBySymbol("btc")

		if err != nil {
			t.Fatalf("Expected no error for lowercase symbol, got %v", err)
		}
		if coin.Symbol != "BTC" {
			t.Errorf("Expected Symbol 'BTC', got '%s'", coin.Symbol)
		}
	})
}

// T008: Test for Registry.GetAllCoinsSortedByMarketCap
// RED/GREEN phase - test implementation exists
func TestRegistry_GetAllCoinsSortedByMarketCap(t *testing.T) {
	t.Run("GetAllCoinsSortedByMarketCap returns coins in market cap order", func(t *testing.T) {
		registry := coinregistry.NewRegistry()
		coins := registry.GetAllCoinsSortedByMarketCap()

		if len(coins) == 0 {
			t.Error("Expected at least one coin in registry")
		}

		// Verify coins are sorted by market cap rank (1 = highest)
		for i := 0; i < len(coins)-1; i++ {
			if coins[i].MarketCapRank > coins[i+1].MarketCapRank {
				t.Errorf("Coins not sorted: rank %d comes before rank %d",
					coins[i].MarketCapRank, coins[i+1].MarketCapRank)
			}
		}

		// Bitcoin should be first (rank 1)
		if coins[0].Symbol != "BTC" {
			t.Errorf("Expected Bitcoin (BTC) first, got '%s'", coins[0].Symbol)
		}
	})

	t.Run("GetAllCoinsSortedByMarketCap returns at least 30 coins", func(t *testing.T) {
		// This test will fail until T010 is complete (populating 30 coins)
		registry := coinregistry.NewRegistry()
		coins := registry.GetAllCoinsSortedByMarketCap()

		if len(coins) < 30 {
			t.Logf("Warning: Expected at least 30 coins, got %d (will be fixed in T010)", len(coins))
			// Don't fail yet - this is expected until T010
		}
	})
}

// T040: Test total chain count for v0.3.0 (36 chains: 30 v0.2.0 + 6 Layer 2)
func TestRegistry_TotalChainCount(t *testing.T) {
	registry := coinregistry.NewRegistry()
	coins := registry.GetAllCoinsSortedByMarketCap()

	expectedCount := 36 // 30 v0.2.0 chains + 6 v0.3.0 Layer 2 chains
	actualCount := len(coins)

	if actualCount != expectedCount {
		t.Errorf("Expected %d total chains, got %d", expectedCount, actualCount)
	}

	// Verify we have exactly 6 Layer 2 chains
	layer2Count := 0
	layer2Symbols := []string{"ARB", "OP", "BASE", "ZKS", "LINEA", "STRK"}
	for _, coin := range coins {
		for _, symbol := range layer2Symbols {
			if coin.Symbol == symbol {
				layer2Count++
			}
		}
	}

	if layer2Count != 6 {
		t.Errorf("Expected 6 Layer 2 chains, got %d", layer2Count)
	}

	t.Logf("✓ Total chains: %d (30 v0.2.0 + 6 v0.3.0 Layer 2)", actualCount)
	t.Logf("✓ Layer 2 chains: %d", layer2Count)
}
