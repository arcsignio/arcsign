package wallet

import (
	"fmt"
	"time"
)

// T025 & T026: Address file and address struct definitions

// AddressCategory represents blockchain categories for UI filtering
type AddressCategory string

const (
	CategoryBaseChains     AddressCategory = "base"
	CategoryLayer2         AddressCategory = "layer2"
	CategoryRegional       AddressCategory = "regional"
	CategoryCosmos         AddressCategory = "cosmos"
	CategoryAlternativeEVM AddressCategory = "alt_evm"
	CategorySpecialized    AddressCategory = "specialized"
)

// Address represents a derived cryptocurrency address with BIP44 metadata
type Address struct {
	// Blockchain full name
	Blockchain string `json:"blockchain"`

	// Ticker symbol (uppercase, 2-10 chars)
	Symbol string `json:"symbol"`

	// SLIP-44 registered coin type
	CoinType uint32 `json:"coin_type"`

	// BIP44 account index (hardened) - currently always 0
	Account uint32 `json:"account"`

	// BIP44 change index (0 = external/receive, 1 = internal/change)
	Change uint32 `json:"change"`

	// BIP44 address index - currently always 0
	Index uint32 `json:"index"`

	// Derived cryptocurrency address string
	Address string `json:"address"`

	// Full BIP44 derivation path (e.g., "m/44'/0'/0'/0/0")
	Path string `json:"path"`

	// Blockchain category for filtering
	Category AddressCategory `json:"category"`
}

// AddressesFile represents the JSON file structure stored on USB
// Contains all derived addresses for a wallet with tamper detection
type AddressesFile struct {
	// Semantic version of file format (e.g., "1.0") for forward compatibility
	SchemaVersion string `json:"schema_version"`

	// Foreign key to parent wallet (UUID)
	WalletID string `json:"wallet_id"`

	// File generation timestamp in RFC3339 format
	GeneratedAt string `json:"generated_at"`

	// Total number of addresses (must equal 54)
	TotalCount uint32 `json:"total_count"`

	// SHA-256 hash of addresses array (hex string, 64 chars) for tamper detection
	Checksum string `json:"checksum"`

	// Array of all derived addresses with full metadata
	Addresses []Address `json:"addresses"`
}

// ChainMetadata represents blockchain configuration for address generation
type ChainMetadata struct {
	Symbol     string
	Name       string
	CoinType   uint32
	Category   AddressCategory
	MarketRank int // For sorting by market cap
}

// SupportedChains returns the list of all 54 supported blockchains
// Organized by category and market cap ranking
func SupportedChains() []ChainMetadata {
	return []ChainMetadata{
		// Base Chains (Top 30 by market cap)
		{Symbol: "BTC", Name: "Bitcoin", CoinType: 0, Category: CategoryBaseChains, MarketRank: 1},
		{Symbol: "ETH", Name: "Ethereum", CoinType: 60, Category: CategoryBaseChains, MarketRank: 2},
		{Symbol: "BNB", Name: "BNB Chain", CoinType: 714, Category: CategoryBaseChains, MarketRank: 3},
		{Symbol: "SOL", Name: "Solana", CoinType: 501, Category: CategoryBaseChains, MarketRank: 4},
		{Symbol: "ADA", Name: "Cardano", CoinType: 1815, Category: CategoryBaseChains, MarketRank: 5},
		{Symbol: "AVAX", Name: "Avalanche", CoinType: 9000, Category: CategoryBaseChains, MarketRank: 6},
		{Symbol: "DOT", Name: "Polkadot", CoinType: 354, Category: CategoryBaseChains, MarketRank: 7},
		{Symbol: "MATIC", Name: "Polygon", CoinType: 966, Category: CategoryBaseChains, MarketRank: 8},
		{Symbol: "LTC", Name: "Litecoin", CoinType: 2, Category: CategoryBaseChains, MarketRank: 9},
		{Symbol: "TRX", Name: "Tron", CoinType: 195, Category: CategoryBaseChains, MarketRank: 10},
		{Symbol: "ATOM", Name: "Cosmos Hub", CoinType: 118, Category: CategoryBaseChains, MarketRank: 11},
		{Symbol: "LINK", Name: "Chainlink", CoinType: 60, Category: CategoryBaseChains, MarketRank: 12}, // Uses ETH formatter
		{Symbol: "XLM", Name: "Stellar", CoinType: 148, Category: CategoryBaseChains, MarketRank: 13},
		{Symbol: "ALGO", Name: "Algorand", CoinType: 283, Category: CategoryBaseChains, MarketRank: 14},
		{Symbol: "NEAR", Name: "NEAR Protocol", CoinType: 397, Category: CategoryBaseChains, MarketRank: 15},
		{Symbol: "VET", Name: "VeChain", CoinType: 818, Category: CategoryBaseChains, MarketRank: 16},
		{Symbol: "HBAR", Name: "Hedera", CoinType: 3030, Category: CategoryBaseChains, MarketRank: 17},
		{Symbol: "FIL", Name: "Filecoin", CoinType: 461, Category: CategoryBaseChains, MarketRank: 18},
		{Symbol: "APT", Name: "Aptos", CoinType: 637, Category: CategoryBaseChains, MarketRank: 19},
		{Symbol: "SUI", Name: "Sui", CoinType: 784, Category: CategoryBaseChains, MarketRank: 20},
		{Symbol: "ETC", Name: "Ethereum Classic", CoinType: 61, Category: CategoryBaseChains, MarketRank: 21},
		{Symbol: "XMR", Name: "Monero", CoinType: 128, Category: CategoryBaseChains, MarketRank: 22},
		{Symbol: "XRP", Name: "Ripple", CoinType: 144, Category: CategoryBaseChains, MarketRank: 23},
		{Symbol: "BCH", Name: "Bitcoin Cash", CoinType: 145, Category: CategoryBaseChains, MarketRank: 24},
		{Symbol: "DOGE", Name: "Dogecoin", CoinType: 3, Category: CategoryBaseChains, MarketRank: 25},
		{Symbol: "EOS", Name: "EOS", CoinType: 194, Category: CategoryBaseChains, MarketRank: 26},
		{Symbol: "DASH", Name: "Dash", CoinType: 5, Category: CategoryBaseChains, MarketRank: 27},
		{Symbol: "ZEC", Name: "Zcash", CoinType: 133, Category: CategoryBaseChains, MarketRank: 28},
		{Symbol: "XTZ", Name: "Tezos", CoinType: 1729, Category: CategoryBaseChains, MarketRank: 29},
		{Symbol: "WAVES", Name: "Waves", CoinType: 5741564, Category: CategoryBaseChains, MarketRank: 30},

		// Layer 2 Solutions
		{Symbol: "ARB", Name: "Arbitrum", CoinType: 9001, Category: CategoryLayer2, MarketRank: 31},
		{Symbol: "OP", Name: "Optimism", CoinType: 614, Category: CategoryLayer2, MarketRank: 32},
		{Symbol: "BASE", Name: "Base", CoinType: 8453, Category: CategoryLayer2, MarketRank: 33},
		{Symbol: "ZKS", Name: "zkSync", CoinType: 324, Category: CategoryLayer2, MarketRank: 34},
		{Symbol: "STRK", Name: "Starknet", CoinType: 9004, Category: CategoryLayer2, MarketRank: 35},
		{Symbol: "LINEA", Name: "Linea", CoinType: 59144, Category: CategoryLayer2, MarketRank: 36},

		// Regional Chains
		{Symbol: "KLAY", Name: "Klaytn", CoinType: 8217, Category: CategoryRegional, MarketRank: 37},
		{Symbol: "CRO", Name: "Cronos", CoinType: 394, Category: CategoryRegional, MarketRank: 38},
		{Symbol: "HT", Name: "HECO", CoinType: 1010, Category: CategoryRegional, MarketRank: 39},
		{Symbol: "ONE", Name: "Harmony", CoinType: 1023, Category: CategoryRegional, MarketRank: 40},

		// Cosmos Ecosystem
		{Symbol: "OSMO", Name: "Osmosis", CoinType: 118, Category: CategoryCosmos, MarketRank: 41},
		{Symbol: "JUNO", Name: "Juno", CoinType: 118, Category: CategoryCosmos, MarketRank: 42},
		{Symbol: "EVMOS", Name: "Evmos", CoinType: 60, Category: CategoryCosmos, MarketRank: 43},
		{Symbol: "SCRT", Name: "Secret Network", CoinType: 529, Category: CategoryCosmos, MarketRank: 44},

		// Alternative EVM Chains
		{Symbol: "FTM", Name: "Fantom", CoinType: 60, Category: CategoryAlternativeEVM, MarketRank: 45},
		{Symbol: "CELO", Name: "Celo", CoinType: 52752, Category: CategoryAlternativeEVM, MarketRank: 46},
		{Symbol: "GLMR", Name: "Moonbeam", CoinType: 1284, Category: CategoryAlternativeEVM, MarketRank: 47},
		{Symbol: "METIS", Name: "Metis", CoinType: 1088, Category: CategoryAlternativeEVM, MarketRank: 48},
		{Symbol: "GNO", Name: "Gnosis", CoinType: 700, Category: CategoryAlternativeEVM, MarketRank: 49},

		// Specialized Chains
		{Symbol: "KSM", Name: "Kusama", CoinType: 434, Category: CategorySpecialized, MarketRank: 50},
		{Symbol: "ZIL", Name: "Zilliqa", CoinType: 313, Category: CategorySpecialized, MarketRank: 51},
		{Symbol: "WAN", Name: "Wanchain", CoinType: 5718350, Category: CategorySpecialized, MarketRank: 52},
		{Symbol: "ICX", Name: "ICON", CoinType: 74, Category: CategorySpecialized, MarketRank: 53},
		{Symbol: "IOST", Name: "IOST", CoinType: 291, Category: CategorySpecialized, MarketRank: 54},
	}
}

// GetChainByCoinType returns chain metadata for a given SLIP-44 coin type
func GetChainByCoinType(coinType uint32) *ChainMetadata {
	for _, chain := range SupportedChains() {
		if chain.CoinType == coinType {
			return &chain
		}
	}
	return nil
}

// FormatDerivationPath returns BIP44 derivation path string
func FormatDerivationPath(coinType, account, change, index uint32) string {
	return fmt.Sprintf("m/44'/%d'/%d'/%d/%d", coinType, account, change, index)
}

// NewAddress creates an Address instance with BIP44 metadata
func NewAddress(blockchain, symbol, address string, coinType uint32, category AddressCategory) Address {
	return Address{
		Blockchain: blockchain,
		Symbol:     symbol,
		CoinType:   coinType,
		Account:    0, // Always 0 for current implementation
		Change:     0, // Always 0 (external/receive)
		Index:      0, // Always 0 (first address)
		Address:    address,
		Path:       FormatDerivationPath(coinType, 0, 0, 0),
		Category:   category,
	}
}

// NewAddressesFile creates an AddressesFile with computed checksum
func NewAddressesFile(walletID string, addresses []Address) *AddressesFile {
	return &AddressesFile{
		SchemaVersion: "1.0",
		WalletID:      walletID,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		TotalCount:    uint32(len(addresses)),
		Checksum:      ComputeAddressesChecksum(addresses),
		Addresses:     addresses,
	}
}
