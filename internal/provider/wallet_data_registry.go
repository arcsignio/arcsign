package provider

import "github.com/arcsignio/arcsign/internal/rpc"

// bscPublicRPC returns a public BSC RPC endpoint (no key) for native BNB
// queries, or "" if unavailable.
func bscPublicRPC() string {
	endpoint, err := rpc.DefaultRegistry.GetRPCEndpoint("bsc")
	if err != nil {
		return ""
	}
	return endpoint
}

// Registry mapping a provider key to a WalletDataProvider factory. The factory
// receives the config store so each provider resolves its own API key (Alchemy
// requires one, NodeReal requires one, Glacier's is optional). This is the
// single place the FFI layer goes to turn a provider string (from
// GetProviderForNetwork) into a usable provider instance.

// wdpFactory builds a WalletDataProvider, resolving any needed API key from the
// store. Returns (nil, nil) when the provider is unavailable but that's not an
// error (e.g. Alchemy with no key configured) — callers skip a nil provider.
type wdpFactory func(store *ProviderConfigStore) (WalletDataProvider, error)

var walletDataFactories = map[string]wdpFactory{
	ProviderAlchemy: func(store *ProviderConfigStore) (WalletDataProvider, error) {
		key := LoadProviderAPIKey(store, ProviderAlchemy)
		if key == "" {
			// Alchemy needs a user key; without one its chains return nothing.
			return nil, nil
		}
		return NewAlchemyWDP(key), nil
	},
	ProviderNodeReal: func(store *ProviderConfigStore) (WalletDataProvider, error) {
		// Always available: even without a key we can return native BNB via a
		// public RPC. The key only unlocks the BEP-20 token-holdings list.
		key := LoadProviderAPIKey(store, ProviderNodeReal)
		return NewNodeRealWDP(key, bscPublicRPC()), nil
	},
	ProviderGlacier: func(store *ProviderConfigStore) (WalletDataProvider, error) {
		// Glacier has an anonymous tier — an empty key is fine.
		return NewGlacierWDP(LoadProviderAPIKey(store, ProviderGlacier)), nil
	},
}

// GetWalletDataProvider returns the WalletDataProvider for a provider key
// ("alchemy"/"nodereal"/"glacier"), resolving its API key from the store.
// Returns (nil, nil) when the provider is known but unavailable (e.g. missing
// required key) — callers should treat nil as "skip this provider".
func GetWalletDataProvider(providerType string, store *ProviderConfigStore) (WalletDataProvider, error) {
	factory, ok := walletDataFactories[providerType]
	if !ok {
		return nil, nil
	}
	return factory(store)
}

// LoadProviderAPIKey resolves the configured API key for a provider from the
// store, checking all known config-key aliases. Returns "" if none configured.
func LoadProviderAPIKey(store *ProviderConfigStore, providerType string) string {
	if store == nil {
		return ""
	}
	for _, key := range GetProviderConfigKeys(providerType) {
		config, err := store.Get("global", key)
		if err == nil && config != nil && config.Enabled && config.APIKey != "" {
			return config.APIKey
		}
	}
	return ""
}
