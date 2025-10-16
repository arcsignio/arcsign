package coinregistry

import (
	"errors"
	"strings"
)

// CoinMetadata represents metadata for a cryptocurrency coin type
// as defined in the SLIP-44 registry
type CoinMetadata struct {
	Symbol        string // Ticker symbol (e.g., "BTC", "ETH")
	Name          string // Full name (e.g., "Bitcoin", "Ethereum")
	CoinType      uint32 // SLIP-44 coin type index (e.g., 0 for Bitcoin, 60 for Ethereum)
	FormatterID   string // Address formatter identifier (e.g., "bitcoin", "ethereum", "ripple")
	MarketCapRank int    // Market capitalization ranking (1 = highest, lower is better)
}

// Validate checks if the CoinMetadata has valid values
func (c *CoinMetadata) Validate() error {
	if c.Symbol == "" {
		return errors.New("symbol cannot be empty")
	}

	if c.Symbol != strings.ToUpper(c.Symbol) {
		return errors.New("symbol must be uppercase")
	}

	if c.Name == "" {
		return errors.New("name cannot be empty")
	}

	if c.FormatterID == "" {
		return errors.New("formatterID cannot be empty")
	}

	if c.MarketCapRank <= 0 {
		return errors.New("marketCapRank must be positive")
	}

	return nil
}
