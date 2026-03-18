package alchemy

import (
	"github.com/Jason-chen-taiwan/arcSignv2/internal/provider"
)

func init() {
	// Register Alchemy provider with global registry
	_ = provider.RegisterProvider("alchemy", func(config *provider.ProviderConfig) (provider.BlockchainProvider, error) {
		return NewAlchemyProvider(config)
	})
}
