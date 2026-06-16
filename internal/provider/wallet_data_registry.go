package provider

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
		// Always available: without a key we serve a degraded path (native +
		// common-token balances via public RPCs). The key unlocks full token
		// discovery, NFTs and transaction history.
		return NewAlchemyWDP(LoadProviderAPIKey(store, ProviderAlchemy)), nil
	},
	ProviderNodeReal: func(store *ProviderConfigStore) (WalletDataProvider, error) {
		// Always available: without a key BSC uses the unified degraded path
		// (native BNB + common BEP-20s via public RPC). The key unlocks full
		// BEP-20 holdings discovery, NFTs and transaction history.
		return NewNodeRealWDP(LoadProviderAPIKey(store, ProviderNodeReal)), nil
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
