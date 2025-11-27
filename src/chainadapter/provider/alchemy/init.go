package alchemy

import (
	"github.com/arcsign/chainadapter/provider"
)

func init() {
	// Register Alchemy provider with global registry
	provider.RegisterProvider("alchemy", func(config *provider.ProviderConfig) (provider.BlockchainProvider, error) {
		return NewAlchemyProvider(config)
	})
}
