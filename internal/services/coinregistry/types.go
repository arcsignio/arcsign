package coinregistry

import (
	"errors"
	"strings"

	"github.com/yourusername/arcsign/internal/models"
)

// KeyType represents the cryptographic key type for address derivation (v0.3.0+)
type KeyType string

const (
	KeyTypeSecp256k1 KeyType = "secp256k1" // Used by Bitcoin, Ethereum, most chains
	KeyTypeEd25519   KeyType = "ed25519"   // Used by Tezos, Stellar, Solana
	KeyTypeSr25519   KeyType = "sr25519"   // Used by Polkadot, Kusama (Substrate chains)
)

// CoinMetadata represents metadata for a cryptocurrency coin type
// as defined in the SLIP-44 registry
type CoinMetadata struct {
	Symbol        string                 // Ticker symbol (e.g., "BTC", "ETH")
	Name          string                 // Full name (e.g., "Bitcoin", "Ethereum")
	CoinType      uint32                 // SLIP-44 coin type index (e.g., 0 for Bitcoin, 60 for Ethereum)
	FormatterID   string                 // Address formatter identifier (e.g., "bitcoin", "ethereum", "ripple")
	MarketCapRank int                    // Market capitalization ranking (1 = highest, lower is better)
	KeyType       KeyType                // Cryptographic key type (v0.3.0+)
	Category      models.ChainCategory   // Blockchain category (v0.3.0+)
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

	// v0.3.0+: Validate Category field
	validCategories := []models.ChainCategory{
		models.ChainCategoryUTXO,
		models.ChainCategoryEVMMainnet,
		models.ChainCategoryLayer2,
		models.ChainCategoryCosmos,
		models.ChainCategorySubstrate,
		models.ChainCategoryCustom,
	}
	categoryValid := false
	for _, valid := range validCategories {
		if c.Category == valid {
			categoryValid = true
			break
		}
	}
	if !categoryValid && c.Category != "" {
		return errors.New("category must be one of: UTXO, EVM_Mainnet, Layer2, Cosmos_SDK, Substrate, Custom")
	}

	return nil
}
