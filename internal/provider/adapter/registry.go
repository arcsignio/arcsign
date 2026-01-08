/**
 * Adapter Registry
 *
 * Centralized registry for all network adapters.
 * Provides unified access to adapter functions without knowing
 * which specific provider is being used.
 *
 * Usage:
 *   adapter.Register(&AlchemyAdapter{})
 *   adapter.Register(&NodeRealAdapter{})
 *
 *   // Get specific adapter
 *   alchemyAdapter := adapter.Get("alchemy")
 *
 *   // Or use unified functions that auto-select adapter
 *   providerNetwork := adapter.ToProvider("alchemy", "arbitrum-mainnet")
 *   internalNetwork := adapter.FromProvider("alchemy", "arb-mainnet")
 */

package adapter

import (
	"sync"
)

var (
	// adapters stores all registered network adapters
	adapters = make(map[string]NetworkAdapter)

	// networkToAdapter maps Internal Network ID to its preferred adapter
	networkToAdapter = make(map[string]NetworkAdapter)

	// mu protects concurrent access to the registry
	mu sync.RWMutex
)

// Register adds a network adapter to the registry
// Should be called in init() of each adapter implementation
func Register(adapter NetworkAdapter) {
	mu.Lock()
	defer mu.Unlock()

	adapters[adapter.Name()] = adapter

	// Map each supported network to this adapter
	for _, network := range adapter.SupportedNetworks() {
		networkToAdapter[network] = adapter
	}
}

// Get returns a specific adapter by provider name
// Returns nil if not found
func Get(providerName string) NetworkAdapter {
	mu.RLock()
	defer mu.RUnlock()
	return adapters[providerName]
}

// GetForNetwork returns the adapter for a given Internal Network ID
// Returns nil if no adapter supports this network
func GetForNetwork(internalNetwork string) NetworkAdapter {
	mu.RLock()
	defer mu.RUnlock()
	return networkToAdapter[internalNetwork]
}

// GetAll returns all registered adapters
func GetAll() map[string]NetworkAdapter {
	mu.RLock()
	defer mu.RUnlock()

	result := make(map[string]NetworkAdapter, len(adapters))
	for k, v := range adapters {
		result[k] = v
	}
	return result
}

// ================================================================================
// Unified Conversion Functions
// These automatically use the correct adapter based on provider name
// ================================================================================

// ToProvider converts Internal Network ID to provider-specific format
// Example: ToProvider("alchemy", "arbitrum-mainnet") → "arb-mainnet"
func ToProvider(providerName, internalNetwork string) string {
	if adapter := Get(providerName); adapter != nil {
		return adapter.ToProviderNetwork(internalNetwork)
	}
	return internalNetwork
}

// FromProvider converts provider-specific format to Internal Network ID
// Example: FromProvider("alchemy", "arb-mainnet") → "arbitrum-mainnet"
func FromProvider(providerName, providerNetwork string) string {
	if adapter := Get(providerName); adapter != nil {
		return adapter.FromProviderNetwork(providerNetwork)
	}
	return providerNetwork
}

// GetProviderForNetwork returns the provider name for a given Internal Network ID
// Example: GetProviderForNetwork("arbitrum-mainnet") → "alchemy"
func GetProviderForNetwork(internalNetwork string) string {
	if adapter := GetForNetwork(internalNetwork); adapter != nil {
		return adapter.Name()
	}
	return ""
}

// IsNetworkSupported checks if any adapter supports the given Internal Network ID
func IsNetworkSupported(internalNetwork string) bool {
	return GetForNetwork(internalNetwork) != nil
}

// GetRPCEndpoint returns the RPC endpoint for a network using its preferred adapter
func GetRPCEndpoint(internalNetwork, apiKey string) string {
	if adapter := GetForNetwork(internalNetwork); adapter != nil {
		return adapter.GetRPCEndpoint(internalNetwork, apiKey)
	}
	return ""
}

// GetTransferCategories returns transfer categories for a network
func GetTransferCategories(internalNetwork string) []string {
	if adapter := GetForNetwork(internalNetwork); adapter != nil {
		return adapter.GetTransferCategories(internalNetwork)
	}
	return []string{"external", "erc20", "erc721", "erc1155"}
}

// GetNetworkLabel returns human-readable label for a network
func GetNetworkLabel(internalNetwork string) string {
	if adapter := GetForNetwork(internalNetwork); adapter != nil {
		return adapter.GetNetworkLabel(internalNetwork)
	}
	return internalNetwork
}

// GetAllSupportedNetworks returns all Internal Network IDs supported by any adapter
func GetAllSupportedNetworks() []string {
	mu.RLock()
	defer mu.RUnlock()

	networks := make([]string, 0, len(networkToAdapter))
	for network := range networkToAdapter {
		networks = append(networks, network)
	}
	return networks
}
