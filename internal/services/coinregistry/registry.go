package coinregistry

import (
	"errors"
	"sort"
	"strings"
)

// Registry manages the collection of supported cryptocurrency coins
type Registry struct {
	coins       []CoinMetadata
	symbolIndex map[string]int // Map symbol to index in coins slice
}

// NewRegistry creates and initializes a new coin registry
func NewRegistry() *Registry {
	r := &Registry{
		coins:       make([]CoinMetadata, 0),
		symbolIndex: make(map[string]int),
	}

	// T010: Populated with 30 mainstream cryptocurrencies sorted by market cap
	// Top 30 cryptocurrencies by market cap (as of planning phase)

	// Rank 1: Bitcoin
	r.addCoin(CoinMetadata{
		Symbol:        "BTC",
		Name:          "Bitcoin",
		CoinType:      0,
		FormatterID:   "bitcoin",
		MarketCapRank: 1,
	})

	// Rank 2: Ethereum
	r.addCoin(CoinMetadata{
		Symbol:        "ETH",
		Name:          "Ethereum",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 2,
	})

	// Rank 3: Tether (USDT) - ERC-20 token
	r.addCoin(CoinMetadata{
		Symbol:        "USDT",
		Name:          "Tether",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 3,
	})

	// Rank 4: BNB
	r.addCoin(CoinMetadata{
		Symbol:        "BNB",
		Name:          "BNB",
		CoinType:      714,
		FormatterID:   "ethereum",
		MarketCapRank: 4,
	})

	// Rank 5: Solana
	r.addCoin(CoinMetadata{
		Symbol:        "SOL",
		Name:          "Solana",
		CoinType:      501,
		FormatterID:   "solana",
		MarketCapRank: 5,
	})

	// Rank 6: USDC
	r.addCoin(CoinMetadata{
		Symbol:        "USDC",
		Name:          "USD Coin",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 6,
	})

	// Rank 7: XRP
	r.addCoin(CoinMetadata{
		Symbol:        "XRP",
		Name:          "XRP",
		CoinType:      144,
		FormatterID:   "ripple",
		MarketCapRank: 7,
	})

	// Rank 8: Dogecoin
	r.addCoin(CoinMetadata{
		Symbol:        "DOGE",
		Name:          "Dogecoin",
		CoinType:      3,
		FormatterID:   "dogecoin",
		MarketCapRank: 8,
	})

	// Rank 9: Cardano
	r.addCoin(CoinMetadata{
		Symbol:        "ADA",
		Name:          "Cardano",
		CoinType:      1815,
		FormatterID:   "cardano",
		MarketCapRank: 9,
	})

	// Rank 10: TRON
	r.addCoin(CoinMetadata{
		Symbol:        "TRX",
		Name:          "TRON",
		CoinType:      195,
		FormatterID:   "tron",
		MarketCapRank: 10,
	})

	// Rank 11: Avalanche
	r.addCoin(CoinMetadata{
		Symbol:        "AVAX",
		Name:          "Avalanche",
		CoinType:      9000,
		FormatterID:   "ethereum",
		MarketCapRank: 11,
	})

	// Rank 12: Shiba Inu
	r.addCoin(CoinMetadata{
		Symbol:        "SHIB",
		Name:          "Shiba Inu",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 12,
	})

	// Rank 13: Polkadot
	r.addCoin(CoinMetadata{
		Symbol:        "DOT",
		Name:          "Polkadot",
		CoinType:      354,
		FormatterID:   "polkadot",
		MarketCapRank: 13,
	})

	// Rank 14: Chainlink
	r.addCoin(CoinMetadata{
		Symbol:        "LINK",
		Name:          "Chainlink",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 14,
	})

	// Rank 15: Polygon
	r.addCoin(CoinMetadata{
		Symbol:        "MATIC",
		Name:          "Polygon",
		CoinType:      966,
		FormatterID:   "ethereum",
		MarketCapRank: 15,
	})

	// Rank 16: Litecoin
	r.addCoin(CoinMetadata{
		Symbol:        "LTC",
		Name:          "Litecoin",
		CoinType:      2,
		FormatterID:   "litecoin",
		MarketCapRank: 16,
	})

	// Rank 17: Bitcoin Cash
	r.addCoin(CoinMetadata{
		Symbol:        "BCH",
		Name:          "Bitcoin Cash",
		CoinType:      145,
		FormatterID:   "bitcoincash",
		MarketCapRank: 17,
	})

	// Rank 18: Stellar
	r.addCoin(CoinMetadata{
		Symbol:        "XLM",
		Name:          "Stellar",
		CoinType:      148,
		FormatterID:   "stellar",
		MarketCapRank: 18,
	})

	// Rank 19: Uniswap
	r.addCoin(CoinMetadata{
		Symbol:        "UNI",
		Name:          "Uniswap",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 19,
	})

	// Rank 20: Cosmos
	r.addCoin(CoinMetadata{
		Symbol:        "ATOM",
		Name:          "Cosmos",
		CoinType:      118,
		FormatterID:   "cosmos",
		MarketCapRank: 20,
	})

	// Rank 21: Ethereum Classic
	r.addCoin(CoinMetadata{
		Symbol:        "ETC",
		Name:          "Ethereum Classic",
		CoinType:      61,
		FormatterID:   "ethereum",
		MarketCapRank: 21,
	})

	// Rank 22: Monero
	r.addCoin(CoinMetadata{
		Symbol:        "XMR",
		Name:          "Monero",
		CoinType:      128,
		FormatterID:   "monero",
		MarketCapRank: 22,
	})

	// Rank 23: Filecoin
	r.addCoin(CoinMetadata{
		Symbol:        "FIL",
		Name:          "Filecoin",
		CoinType:      461,
		FormatterID:   "filecoin",
		MarketCapRank: 23,
	})

	// Rank 24: Hedera
	r.addCoin(CoinMetadata{
		Symbol:        "HBAR",
		Name:          "Hedera",
		CoinType:      3030,
		FormatterID:   "hedera",
		MarketCapRank: 24,
	})

	// Rank 25: Aptos
	r.addCoin(CoinMetadata{
		Symbol:        "APT",
		Name:          "Aptos",
		CoinType:      637,
		FormatterID:   "aptos",
		MarketCapRank: 25,
	})

	// Rank 26: VeChain
	r.addCoin(CoinMetadata{
		Symbol:        "VET",
		Name:          "VeChain",
		CoinType:      818,
		FormatterID:   "ethereum",
		MarketCapRank: 26,
	})

	// Rank 27: Algorand
	r.addCoin(CoinMetadata{
		Symbol:        "ALGO",
		Name:          "Algorand",
		CoinType:      283,
		FormatterID:   "algorand",
		MarketCapRank: 27,
	})

	// Rank 28: Near Protocol
	r.addCoin(CoinMetadata{
		Symbol:        "NEAR",
		Name:          "NEAR Protocol",
		CoinType:      397,
		FormatterID:   "near",
		MarketCapRank: 28,
	})

	// Rank 29: Zcash
	r.addCoin(CoinMetadata{
		Symbol:        "ZEC",
		Name:          "Zcash",
		CoinType:      133,
		FormatterID:   "zcash",
		MarketCapRank: 29,
	})

	// Rank 30: Dash
	r.addCoin(CoinMetadata{
		Symbol:        "DASH",
		Name:          "Dash",
		CoinType:      5,
		FormatterID:   "dash",
		MarketCapRank: 30,
	})

	return r
}

// addCoin adds a coin to the registry
func (r *Registry) addCoin(coin CoinMetadata) {
	r.coins = append(r.coins, coin)
	r.symbolIndex[coin.Symbol] = len(r.coins) - 1
}

// GetCoinBySymbol retrieves coin metadata by symbol (case-insensitive)
func (r *Registry) GetCoinBySymbol(symbol string) (*CoinMetadata, error) {
	// Normalize to uppercase for case-insensitive lookup
	symbol = strings.ToUpper(symbol)

	index, exists := r.symbolIndex[symbol]
	if !exists {
		return nil, errors.New("coin not found: " + symbol)
	}

	// Return pointer to element in slice (avoids unnecessary copy)
	return &r.coins[index], nil
}

// GetAllCoinsSortedByMarketCap returns all coins sorted by market capitalization rank
// (rank 1 = highest market cap, comes first)
func (r *Registry) GetAllCoinsSortedByMarketCap() []CoinMetadata {
	// Create a copy to avoid modifying the original slice
	sorted := make([]CoinMetadata, len(r.coins))
	copy(sorted, r.coins)

	// Sort by market cap rank (ascending - rank 1 first)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].MarketCapRank < sorted[j].MarketCapRank
	})

	return sorted
}
