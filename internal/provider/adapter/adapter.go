/**
 * Network Adapter Interface
 *
 * Defines the contract for Provider-specific network ID conversions.
 * Each provider (Alchemy, NodeReal, etc.) implements this interface
 * to handle their specific network ID formats.
 *
 * Architecture:
 * - Internal Network ID: Canonical format used throughout the codebase
 *   (e.g., "arbitrum-mainnet", "optimism-mainnet", "bnb-mainnet")
 * - Provider Network ID: Provider-specific format
 *   (e.g., Alchemy uses "arb-mainnet", NodeReal uses "bsc-mainnet")
 *
 * Data Flow:
 *   Request:  Internal ID → ToProviderNetwork() → Provider API
 *   Response: Provider API → FromProviderNetwork() → Internal ID
 */

package adapter

// NetworkAdapter defines the interface for provider-specific network conversions
type NetworkAdapter interface {
	// Name returns the provider identifier (e.g., "alchemy", "nodereal")
	Name() string

	// ToProviderNetwork converts Internal Network ID to provider-specific format
	// Example: "arbitrum-mainnet" → "arb-mainnet" (for Alchemy)
	ToProviderNetwork(internalNetwork string) string

	// FromProviderNetwork converts provider-specific format to Internal Network ID
	// Example: "arb-mainnet" → "arbitrum-mainnet" (from Alchemy)
	FromProviderNetwork(providerNetwork string) string

	// SupportedNetworks returns all Internal Network IDs this adapter supports
	SupportedNetworks() []string

	// IsSupported checks if an Internal Network ID is supported by this provider
	IsSupported(internalNetwork string) bool

	// GetRPCEndpoint returns the RPC endpoint URL for a given Internal Network ID
	GetRPCEndpoint(internalNetwork string, apiKey string) string

	// GetTransferCategories returns the transfer categories for transaction history
	// Different providers may use different category names (e.g., "erc20" vs "20")
	GetTransferCategories(internalNetwork string) []string

	// GetNetworkLabel returns human-readable label for an Internal Network ID
	GetNetworkLabel(internalNetwork string) string
}

// reverseMap creates a reverse mapping from a string map
func reverseMap(m map[string]string) map[string]string {
	reversed := make(map[string]string, len(m))
	for k, v := range m {
		reversed[v] = k
	}
	return reversed
}
