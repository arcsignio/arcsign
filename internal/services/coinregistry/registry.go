package coinregistry

import (
	"errors"
	"sort"
	"strings"

	"github.com/yourusername/arcsign/internal/models"
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

	// Supported chains: Bitcoin + EVM ecosystem

	// Rank 1: Bitcoin
	r.addCoin(CoinMetadata{
		Symbol:        "BTC",
		Name:          "Bitcoin",
		CoinType:      0,
		FormatterID:   "bitcoin",
		MarketCapRank: 1,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryUTXO,
	})

	// Rank 2: Ethereum
	r.addCoin(CoinMetadata{
		Symbol:        "ETH",
		Name:          "Ethereum",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 2,
	})

	// Rank 4: BNB
	r.addCoin(CoinMetadata{
		Symbol:        "BNB",
		Name:          "BNB",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 4,
	})

	// Rank 11: Avalanche
	r.addCoin(CoinMetadata{
		Symbol:        "AVAX",
		Name:          "Avalanche",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 11,
	})

	// Rank 15: Polygon
	r.addCoin(CoinMetadata{
		Symbol:        "MATIC",
		Name:          "Polygon",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 15,
	})

	// Rank 19: Uniswap
	r.addCoin(CoinMetadata{
		Symbol:        "UNI",
		Name:          "Uniswap",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 19,
	})

	// Rank 21: Ethereum Classic
	r.addCoin(CoinMetadata{
		Symbol:        "ETC",
		Name:          "Ethereum Classic",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 21,
	})

	// Rank 26: VeChain
	r.addCoin(CoinMetadata{
		Symbol:        "VET",
		Name:          "VeChain",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 26,
	})

	// Layer 2 Networks

	// Arbitrum
	r.addCoin(CoinMetadata{
		Symbol:        "ARB",
		Name:          "Arbitrum",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 31,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryLayer2,
	})

	// Optimism
	r.addCoin(CoinMetadata{
		Symbol:        "OP",
		Name:          "Optimism",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 32,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryLayer2,
	})

	// Base
	r.addCoin(CoinMetadata{
		Symbol:        "BASE",
		Name:          "Base",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 33,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryLayer2,
	})

	// zkSync
	r.addCoin(CoinMetadata{
		Symbol:        "ZKS",
		Name:          "zkSync",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 34,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryLayer2,
	})

	// Linea
	r.addCoin(CoinMetadata{
		Symbol:        "LINEA",
		Name:          "Linea",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 35,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryLayer2,
	})

	// Regional Chains

	// Klaytn
	r.addCoin(CoinMetadata{
		Symbol:        "KLAY",
		Name:          "Klaytn",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 37,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryCustom,
	})

	// Cronos
	r.addCoin(CoinMetadata{
		Symbol:        "CRO",
		Name:          "Cronos",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 38,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryCustom,
	})

	// HECO
	r.addCoin(CoinMetadata{
		Symbol:        "HT",
		Name:          "HECO",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 39,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryCustom,
	})

	// Alternative EVM Chains

	// Fantom
	r.addCoin(CoinMetadata{
		Symbol:        "FTM",
		Name:          "Fantom",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 45,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryEVMMainnet,
	})

	// Celo
	r.addCoin(CoinMetadata{
		Symbol:        "CELO",
		Name:          "Celo",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 46,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryEVMMainnet,
	})

	// Moonbeam
	r.addCoin(CoinMetadata{
		Symbol:        "GLMR",
		Name:          "Moonbeam",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 47,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryEVMMainnet,
	})

	// Metis
	r.addCoin(CoinMetadata{
		Symbol:        "METIS",
		Name:          "Metis",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 48,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryEVMMainnet,
	})

	// Gnosis
	r.addCoin(CoinMetadata{
		Symbol:        "GNO",
		Name:          "Gnosis",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 49,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryEVMMainnet,
	})

	// Wanchain
	r.addCoin(CoinMetadata{
		Symbol:        "WAN",
		Name:          "Wanchain",
		CoinType:      60,
		FormatterID:   "ethereum",
		MarketCapRank: 50,
		KeyType:       KeyTypeSecp256k1,
		Category:      models.ChainCategoryEVMMainnet,
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
