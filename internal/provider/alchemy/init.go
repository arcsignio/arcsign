package alchemy

import (
	"github.com/yourusername/arcsign/internal/provider"
)

func init() {
	// Register Alchemy provider with global registry
	provider.RegisterProvider("alchemy", func(config *provider.ProviderConfig) (provider.BlockchainProvider, error) {
		return NewAlchemyProvider(config)
	})
}
