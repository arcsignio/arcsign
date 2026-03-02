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
	CategoryAlternativeEVM AddressCategory = "alt_evm"
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

// SupportedChains returns the list of supported blockchains for address generation
// Supported: BTC + 21 EVM chains (all EVM chains use coinType 60)
func SupportedChains() []ChainMetadata {
	return []ChainMetadata{
		// Bitcoin
		{Symbol: "BTC", Name: "Bitcoin", CoinType: 0, Category: CategoryBaseChains, MarketRank: 1},

		// EVM Mainnet
		{Symbol: "ETH", Name: "Ethereum", CoinType: 60, Category: CategoryBaseChains, MarketRank: 2},
		{Symbol: "BNB", Name: "BNB Chain", CoinType: 60, Category: CategoryBaseChains, MarketRank: 3},
		{Symbol: "MATIC", Name: "Polygon", CoinType: 60, Category: CategoryBaseChains, MarketRank: 4},
		{Symbol: "AVAX", Name: "Avalanche", CoinType: 60, Category: CategoryBaseChains, MarketRank: 5},
		{Symbol: "ETC", Name: "Ethereum Classic", CoinType: 60, Category: CategoryBaseChains, MarketRank: 6},
		{Symbol: "VET", Name: "VeChain", CoinType: 60, Category: CategoryBaseChains, MarketRank: 7},

		// Layer 2
		{Symbol: "ARB", Name: "Arbitrum", CoinType: 60, Category: CategoryLayer2, MarketRank: 8},
		{Symbol: "OP", Name: "Optimism", CoinType: 60, Category: CategoryLayer2, MarketRank: 9},
		{Symbol: "BASE", Name: "Base", CoinType: 60, Category: CategoryLayer2, MarketRank: 10},
		{Symbol: "ZKS", Name: "zkSync", CoinType: 60, Category: CategoryLayer2, MarketRank: 11},
		{Symbol: "LINEA", Name: "Linea", CoinType: 60, Category: CategoryLayer2, MarketRank: 12},

		// Regional EVM
		{Symbol: "KLAY", Name: "Klaytn", CoinType: 60, Category: CategoryRegional, MarketRank: 13},
		{Symbol: "CRO", Name: "Cronos", CoinType: 60, Category: CategoryRegional, MarketRank: 14},
		{Symbol: "HT", Name: "HECO", CoinType: 60, Category: CategoryRegional, MarketRank: 15},

		// Alt EVM
		{Symbol: "FTM", Name: "Fantom", CoinType: 60, Category: CategoryAlternativeEVM, MarketRank: 16},
		{Symbol: "CELO", Name: "Celo", CoinType: 60, Category: CategoryAlternativeEVM, MarketRank: 17},
		{Symbol: "GLMR", Name: "Moonbeam", CoinType: 60, Category: CategoryAlternativeEVM, MarketRank: 18},
		{Symbol: "METIS", Name: "Metis", CoinType: 60, Category: CategoryAlternativeEVM, MarketRank: 19},
		{Symbol: "GNO", Name: "Gnosis", CoinType: 60, Category: CategoryAlternativeEVM, MarketRank: 20},
		{Symbol: "WAN", Name: "Wanchain", CoinType: 60, Category: CategoryAlternativeEVM, MarketRank: 21},
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
