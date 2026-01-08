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

// SupportedChains returns the list of supported blockchains for address generation
// Currently supported: BTC, ETH, BNB, MATIC, ARB, OP, BASE (full transaction support)
// Next phase: SOL, TRX, AVAX, ZKS, STRK, LINEA (coming soon)
func SupportedChains() []ChainMetadata {
	return []ChainMetadata{
		// Currently Supported - Full transaction support
		{Symbol: "BTC", Name: "Bitcoin", CoinType: 0, Category: CategoryBaseChains, MarketRank: 1},
		{Symbol: "ETH", Name: "Ethereum", CoinType: 60, Category: CategoryBaseChains, MarketRank: 2},
		{Symbol: "BNB", Name: "BNB Chain", CoinType: 714, Category: CategoryBaseChains, MarketRank: 3},
		{Symbol: "MATIC", Name: "Polygon", CoinType: 966, Category: CategoryBaseChains, MarketRank: 4},

		// Currently Supported - Layer 2 (EVM compatible)
		{Symbol: "ARB", Name: "Arbitrum", CoinType: 9001, Category: CategoryLayer2, MarketRank: 5},
		{Symbol: "OP", Name: "Optimism", CoinType: 614, Category: CategoryLayer2, MarketRank: 6},
		{Symbol: "BASE", Name: "Base", CoinType: 8453, Category: CategoryLayer2, MarketRank: 7},

		// Next Phase - Coming Soon (address generation enabled)
		{Symbol: "SOL", Name: "Solana", CoinType: 501, Category: CategoryBaseChains, MarketRank: 8},
		{Symbol: "TRX", Name: "Tron", CoinType: 195, Category: CategoryBaseChains, MarketRank: 9},
		{Symbol: "AVAX", Name: "Avalanche", CoinType: 9000, Category: CategoryBaseChains, MarketRank: 10},
		{Symbol: "ZKS", Name: "zkSync", CoinType: 324, Category: CategoryLayer2, MarketRank: 11},
		{Symbol: "STRK", Name: "Starknet", CoinType: 9004, Category: CategoryLayer2, MarketRank: 12},
		{Symbol: "LINEA", Name: "Linea", CoinType: 59144, Category: CategoryLayer2, MarketRank: 13},
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
