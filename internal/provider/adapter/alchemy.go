/**
 * Alchemy Network Adapter
 *
 * Handles network ID conversions for Alchemy API.
 *
 * Alchemy-specific formats:
 * - Uses "arb-mainnet" instead of "arbitrum-mainnet"
 * - Uses "opt-mainnet" instead of "optimism-mainnet"
 * - Uses "arb-sepolia" instead of "arbitrum-sepolia"
 * - Uses "opt-sepolia" instead of "optimism-sepolia"
 *
 * Supported Networks:
 * - Ethereum (mainnet, sepolia)
 * - Polygon (mainnet, amoy)
 * - Arbitrum (mainnet, sepolia)
 * - Optimism (mainnet, sepolia)
 * - Base (mainnet, sepolia)
 *
 * Note: BSC is NOT supported by Alchemy - use NodeReal adapter instead
 */

package adapter

import "fmt"

func init() {
	Register(&AlchemyAdapter{})
}

// AlchemyAdapter implements NetworkAdapter for Alchemy API
type AlchemyAdapter struct{}

// Name returns the provider identifier
func (a *AlchemyAdapter) Name() string {
	return "alchemy"
}

// ================================================================================
// Network ID Mappings
// Internal Network ID → Alchemy Network ID
// ================================================================================

var alchemyNetworkMap = map[string]string{
	// Mainnets that need conversion
	"arbitrum-mainnet": "arb-mainnet",
	"optimism-mainnet": "opt-mainnet",

	// Testnets that need conversion
	"arbitrum-sepolia": "arb-sepolia",
	"optimism-sepolia": "opt-sepolia",

	// Networks that use same ID (no conversion needed, but listed for completeness)
	// "eth-mainnet":      "eth-mainnet",
	// "polygon-mainnet":  "polygon-mainnet",
	// "base-mainnet":     "base-mainnet",
}

var alchemyReverseMap = reverseMap(alchemyNetworkMap)

// ================================================================================
// Supported Networks
// ================================================================================

var alchemySupportedNetworks = []string{
	// Mainnets
	"eth-mainnet",
	"polygon-mainnet",
	"arbitrum-mainnet",
	"optimism-mainnet",
	"base-mainnet",
	// Testnets
	"eth-sepolia",
	"polygon-amoy",
	"arbitrum-sepolia",
	"optimism-sepolia",
	"base-sepolia",
}

// Networks that support "internal" transfer category
var alchemyInternalTransferNetworks = map[string]bool{
	"eth-mainnet":     true,
	"polygon-mainnet": true,
}

// ================================================================================
// RPC Endpoints
// ================================================================================

var alchemyRPCEndpoints = map[string]string{
	// Mainnets (using Alchemy's network IDs as keys)
	"eth-mainnet":     "https://eth-mainnet.g.alchemy.com/v2",
	"polygon-mainnet": "https://polygon-mainnet.g.alchemy.com/v2",
	"arb-mainnet":     "https://arb-mainnet.g.alchemy.com/v2",
	"opt-mainnet":     "https://opt-mainnet.g.alchemy.com/v2",
	"base-mainnet":    "https://base-mainnet.g.alchemy.com/v2",
	// Testnets
	"eth-sepolia":  "https://eth-sepolia.g.alchemy.com/v2",
	"polygon-amoy": "https://polygon-amoy.g.alchemy.com/v2",
	"arb-sepolia":  "https://arb-sepolia.g.alchemy.com/v2",
	"opt-sepolia":  "https://opt-sepolia.g.alchemy.com/v2",
	"base-sepolia": "https://base-sepolia.g.alchemy.com/v2",
}

// ================================================================================
// Network Labels
// ================================================================================

var alchemyNetworkLabels = map[string]string{
	"eth-mainnet":      "Ethereum",
	"polygon-mainnet":  "Polygon",
	"arbitrum-mainnet": "Arbitrum",
	"optimism-mainnet": "Optimism",
	"base-mainnet":     "Base",
	// Testnets
	"eth-sepolia":      "Ethereum Sepolia",
	"polygon-amoy":     "Polygon Amoy",
	"arbitrum-sepolia": "Arbitrum Sepolia",
	"optimism-sepolia": "Optimism Sepolia",
	"base-sepolia":     "Base Sepolia",
}

// ================================================================================
// NetworkAdapter Interface Implementation
// ================================================================================

// ToProviderNetwork converts Internal Network ID to Alchemy format
func (a *AlchemyAdapter) ToProviderNetwork(internalNetwork string) string {
	if alchemyID, ok := alchemyNetworkMap[internalNetwork]; ok {
		return alchemyID
	}
	return internalNetwork
}

// FromProviderNetwork converts Alchemy format to Internal Network ID
func (a *AlchemyAdapter) FromProviderNetwork(providerNetwork string) string {
	if internalID, ok := alchemyReverseMap[providerNetwork]; ok {
		return internalID
	}
	return providerNetwork
}

// SupportedNetworks returns all Internal Network IDs supported by Alchemy
func (a *AlchemyAdapter) SupportedNetworks() []string {
	return alchemySupportedNetworks
}

// IsSupported checks if Alchemy supports the given Internal Network ID
func (a *AlchemyAdapter) IsSupported(internalNetwork string) bool {
	for _, network := range alchemySupportedNetworks {
		if network == internalNetwork {
			return true
		}
	}
	return false
}

// GetRPCEndpoint returns the Alchemy RPC endpoint for a network
func (a *AlchemyAdapter) GetRPCEndpoint(internalNetwork string, apiKey string) string {
	// Convert to Alchemy format first
	alchemyNetwork := a.ToProviderNetwork(internalNetwork)

	baseURL, ok := alchemyRPCEndpoints[alchemyNetwork]
	if !ok {
		return ""
	}

	return fmt.Sprintf("%s/%s", baseURL, apiKey)
}

// GetTransferCategories returns transfer categories for transaction history
// "internal" category is only supported on ETH and Polygon mainnet
func (a *AlchemyAdapter) GetTransferCategories(internalNetwork string) []string {
	categories := []string{"external", "erc20", "erc721", "erc1155"}

	// Add "internal" only for networks that support it
	if alchemyInternalTransferNetworks[internalNetwork] {
		categories = append(categories, "internal")
	}

	return categories
}

// GetNetworkLabel returns human-readable label for a network
func (a *AlchemyAdapter) GetNetworkLabel(internalNetwork string) string {
	if label, ok := alchemyNetworkLabels[internalNetwork]; ok {
		return label
	}
	return internalNetwork
}
