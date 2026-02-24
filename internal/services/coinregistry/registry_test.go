package coinregistry

import (
	"strings"
	"testing"
)

func TestNewRegistry_HasCoins(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	if len(coins) == 0 {
		t.Fatal("registry should have coins")
	}
}

func TestNewRegistry_CoinCount(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	// We have a specific set of registered coins (see registry.go)
	// Count should be stable for snapshot testing
	if len(coins) < 30 {
		t.Errorf("expected at least 30 coins, got %d", len(coins))
	}
}

func TestGetCoinBySymbol_BTC(t *testing.T) {
	r := NewRegistry()
	coin, err := r.GetCoinBySymbol("BTC")

	if err != nil {
		t.Fatalf("GetCoinBySymbol(BTC) error: %v", err)
	}
	if coin.Symbol != "BTC" {
		t.Errorf("symbol: got %q, want BTC", coin.Symbol)
	}
	if coin.Name != "Bitcoin" {
		t.Errorf("name: got %q, want Bitcoin", coin.Name)
	}
	if coin.CoinType != 0 {
		t.Errorf("coinType: got %d, want 0", coin.CoinType)
	}
	if coin.MarketCapRank != 1 {
		t.Errorf("marketCapRank: got %d, want 1", coin.MarketCapRank)
	}
}

func TestGetCoinBySymbol_ETH(t *testing.T) {
	r := NewRegistry()
	coin, err := r.GetCoinBySymbol("ETH")

	if err != nil {
		t.Fatalf("GetCoinBySymbol(ETH) error: %v", err)
	}
	if coin.CoinType != 60 {
		t.Errorf("coinType: got %d, want 60", coin.CoinType)
	}
	if coin.FormatterID != "ethereum" {
		t.Errorf("formatterID: got %q, want ethereum", coin.FormatterID)
	}
}

func TestGetCoinBySymbol_CaseInsensitive(t *testing.T) {
	r := NewRegistry()

	tests := []struct {
		input  string
		expect string
	}{
		{"btc", "BTC"},
		{"Btc", "BTC"},
		{"BTC", "BTC"},
		{"eth", "ETH"},
		{"sol", "SOL"},
	}

	for _, tt := range tests {
		coin, err := r.GetCoinBySymbol(tt.input)
		if err != nil {
			t.Errorf("GetCoinBySymbol(%q) error: %v", tt.input, err)
			continue
		}
		if coin.Symbol != tt.expect {
			t.Errorf("GetCoinBySymbol(%q): got symbol %q, want %q", tt.input, coin.Symbol, tt.expect)
		}
	}
}

func TestGetCoinBySymbol_NotFound(t *testing.T) {
	r := NewRegistry()
	_, err := r.GetCoinBySymbol("NOTEXIST")

	if err == nil {
		t.Error("expected error for non-existent coin")
	}
}

func TestGetAllCoinsSortedByMarketCap_Order(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	// Verify sorted by market cap rank (ascending)
	for i := 1; i < len(coins); i++ {
		if coins[i].MarketCapRank < coins[i-1].MarketCapRank {
			t.Errorf("coins not sorted: rank %d at index %d came before rank %d at index %d",
				coins[i-1].MarketCapRank, i-1, coins[i].MarketCapRank, i)
		}
	}
}

func TestGetAllCoinsSortedByMarketCap_BTCFirst(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	if coins[0].Symbol != "BTC" {
		t.Errorf("first coin should be BTC (rank 1), got %q (rank %d)",
			coins[0].Symbol, coins[0].MarketCapRank)
	}
}

func TestGetAllCoinsSortedByMarketCap_ETHSecond(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	if coins[1].Symbol != "ETH" {
		t.Errorf("second coin should be ETH (rank 2), got %q (rank %d)",
			coins[1].Symbol, coins[1].MarketCapRank)
	}
}

func TestEVMChains_ShareCoinType60(t *testing.T) {
	r := NewRegistry()
	evmSymbols := []string{"ETH", "BNB", "AVAX", "MATIC", "ARB", "OP", "BASE", "ZKS", "LINEA"}

	for _, sym := range evmSymbols {
		coin, err := r.GetCoinBySymbol(sym)
		if err != nil {
			t.Errorf("GetCoinBySymbol(%q) error: %v", sym, err)
			continue
		}
		if coin.CoinType != 60 {
			t.Errorf("%s: coinType got %d, want 60", sym, coin.CoinType)
		}
	}
}

func TestNoDuplicateSymbols(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	seen := make(map[string]bool)
	for _, coin := range coins {
		if seen[coin.Symbol] {
			t.Errorf("duplicate symbol: %s", coin.Symbol)
		}
		seen[coin.Symbol] = true
	}
}

func TestAllSymbolsUppercase(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	for _, coin := range coins {
		if coin.Symbol != strings.ToUpper(coin.Symbol) {
			t.Errorf("symbol %q is not uppercase", coin.Symbol)
		}
	}
}

func TestAllCoinsHaveFormatterID(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	for _, coin := range coins {
		if coin.FormatterID == "" {
			t.Errorf("coin %s has empty FormatterID", coin.Symbol)
		}
	}
}

func TestAllCoinsHaveName(t *testing.T) {
	r := NewRegistry()
	coins := r.GetAllCoinsSortedByMarketCap()

	for _, coin := range coins {
		if coin.Name == "" {
			t.Errorf("coin %s has empty Name", coin.Symbol)
		}
	}
}

func TestCoinMetadata_Validate_Valid(t *testing.T) {
	coin := CoinMetadata{
		Symbol:        "TEST",
		Name:          "Test Coin",
		CoinType:      999,
		FormatterID:   "test",
		MarketCapRank: 1,
	}
	if err := coin.Validate(); err != nil {
		t.Errorf("valid coin should not error: %v", err)
	}
}

func TestCoinMetadata_Validate_EmptySymbol(t *testing.T) {
	coin := CoinMetadata{
		Symbol:        "",
		Name:          "Test",
		CoinType:      0,
		FormatterID:   "test",
		MarketCapRank: 1,
	}
	if err := coin.Validate(); err == nil {
		t.Error("empty symbol should fail validation")
	}
}

func TestCoinMetadata_Validate_LowercaseSymbol(t *testing.T) {
	coin := CoinMetadata{
		Symbol:        "btc",
		Name:          "Bitcoin",
		CoinType:      0,
		FormatterID:   "bitcoin",
		MarketCapRank: 1,
	}
	if err := coin.Validate(); err == nil {
		t.Error("lowercase symbol should fail validation")
	}
}

func TestCoinMetadata_Validate_EmptyName(t *testing.T) {
	coin := CoinMetadata{
		Symbol:        "TEST",
		Name:          "",
		CoinType:      0,
		FormatterID:   "test",
		MarketCapRank: 1,
	}
	if err := coin.Validate(); err == nil {
		t.Error("empty name should fail validation")
	}
}

func TestCoinMetadata_Validate_EmptyFormatterID(t *testing.T) {
	coin := CoinMetadata{
		Symbol:        "TEST",
		Name:          "Test",
		CoinType:      0,
		FormatterID:   "",
		MarketCapRank: 1,
	}
	if err := coin.Validate(); err == nil {
		t.Error("empty formatterID should fail validation")
	}
}

func TestCoinMetadata_Validate_ZeroRank(t *testing.T) {
	coin := CoinMetadata{
		Symbol:        "TEST",
		Name:          "Test",
		CoinType:      0,
		FormatterID:   "test",
		MarketCapRank: 0,
	}
	if err := coin.Validate(); err == nil {
		t.Error("zero rank should fail validation")
	}
}

func TestCoinMetadata_Validate_NegativeRank(t *testing.T) {
	coin := CoinMetadata{
		Symbol:        "TEST",
		Name:          "Test",
		CoinType:      0,
		FormatterID:   "test",
		MarketCapRank: -1,
	}
	if err := coin.Validate(); err == nil {
		t.Error("negative rank should fail validation")
	}
}

func TestLayer2Chains_Category(t *testing.T) {
	r := NewRegistry()
	layer2Symbols := []string{"ARB", "OP", "BASE", "ZKS", "LINEA", "STRK"}

	for _, sym := range layer2Symbols {
		coin, err := r.GetCoinBySymbol(sym)
		if err != nil {
			t.Errorf("GetCoinBySymbol(%q) error: %v", sym, err)
			continue
		}
		if coin.Category != "Layer2" {
			t.Errorf("%s: category got %q, want Layer2", sym, coin.Category)
		}
	}
}
