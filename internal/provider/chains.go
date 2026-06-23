/**
 * Centralized provider-chain mapping for transaction history queries
 *
 * Architecture:
 * 1. Internal Network IDs - Canonical format used throughout codebase
 *    (arbitrum-mainnet, optimism-mainnet, etc.)
 * 2. Provider Adapters - Convert Internal IDs to provider-specific format
 *    (Alchemy uses arb-mainnet, opt-mainnet)
 *
 * Provider Coverage Summary:
 * - Alchemy: ETH, Polygon, Arbitrum, Optimism, Base (5 EVM chains)
 * - NodeReal/BSCTrace: BSC only (for transaction history)
 *
 * Note: "internal" transfer category is only supported on ETH and Polygon mainnet
 */

package provider

// ================================================================================
// INTERNAL NETWORK IDs - Canonical format used throughout the codebase
// These are OUR standard identifiers. Provider adapters convert these to
// provider-specific formats when making API calls.
// ================================================================================

const (
	// Mainnet networks (Internal canonical format)
	NetworkEthMainnet      = "eth-mainnet"
	NetworkPolygonMainnet  = "polygon-mainnet"
	NetworkArbitrumMainnet = "arbitrum-mainnet" // Internal format (Alchemy uses "arb-mainnet")
	NetworkOptimismMainnet = "optimism-mainnet" // Internal format (Alchemy uses "opt-mainnet")
	NetworkBaseMainnet     = "base-mainnet"
	NetworkBnbMainnet      = "bnb-mainnet"
	NetworkAvalancheMainnet = "avalanche-mainnet"

	// Testnet networks (Internal canonical format)
	NetworkEthSepolia      = "eth-sepolia"
	NetworkPolygonAmoy     = "polygon-amoy"
	NetworkArbitrumSepolia = "arbitrum-sepolia" // Internal format (Alchemy uses "arb-sepolia")
	NetworkOptimismSepolia = "optimism-sepolia" // Internal format (Alchemy uses "opt-sepolia")
	NetworkBaseSepolia     = "base-sepolia"
)

// Provider type constants
const (
	ProviderAlchemy  = "alchemy"
	ProviderNodeReal = "nodereal"
	ProviderBSCTrace = "bsctrace" // Alias for nodereal
	ProviderGlacier  = "glacier"  // Avalanche Data API (anonymous, no API key)

	// ProviderSelfHosted is the feature-dimension provider for BALANCE queries:
	// public RPC pool + Multicall3 + DefiLlama prices, no API key, all chains.
	// NFT / transaction-history queries still use the chain-dimension providers
	// above (Alchemy / NodeReal / Glacier) via GetProviderForNetwork — only
	// balances route here, via GetBalanceProviderForNetwork.
	ProviderSelfHosted = "self-hosted"
)

// ================================================================================
// PROVIDER CAPABILITIES
// ================================================================================

// ProviderCapability defines what a provider can do for transaction history
type ProviderCapability struct {
	// SupportedNetworks lists all networks this provider handles (using Internal IDs)
	SupportedNetworks []string

	// InternalTransferNetworks indicates which networks support "internal" category
	InternalTransferNetworks []string

	// TransferCategories lists available transfer types for this provider
	TransferCategories []string

	// RequiresAPIKey indicates if this provider needs user-provided API key
	RequiresAPIKey bool

	// ConfigKey is the key used in provider_config.enc to lookup API key
	ConfigKey string
}

// ProviderCapabilities defines what each provider supports
var ProviderCapabilities = map[string]ProviderCapability{
	ProviderAlchemy: {
		SupportedNetworks: []string{
			NetworkEthMainnet,
			NetworkPolygonMainnet,
			NetworkArbitrumMainnet,
			NetworkOptimismMainnet,
			NetworkBaseMainnet,
			// Testnets
			NetworkEthSepolia,
			NetworkPolygonAmoy,
			NetworkArbitrumSepolia,
			NetworkOptimismSepolia,
			NetworkBaseSepolia,
		},
		// "internal" category only supported on ETH and Polygon mainnet
		InternalTransferNetworks: []string{
			NetworkEthMainnet,
			NetworkPolygonMainnet,
		},
		TransferCategories: []string{"external", "erc20", "erc721", "erc1155"},
		RequiresAPIKey:     true,
		ConfigKey:          "alchemy",
	},
	ProviderNodeReal: {
		SupportedNetworks: []string{
			NetworkBnbMainnet,
		},
		InternalTransferNetworks: []string{
			NetworkBnbMainnet,
		},
		// BSCTrace uses different category names: "20" instead of "erc20"
		TransferCategories: []string{"external", "internal", "20", "721", "1155"},
		RequiresAPIKey:     true,
		ConfigKey:          "nodereal",
	},
	ProviderGlacier: {
		SupportedNetworks: []string{
			NetworkAvalancheMainnet,
		},
		InternalTransferNetworks: []string{
			NetworkAvalancheMainnet,
		},
		TransferCategories: []string{"external", "erc20", "erc721", "erc1155"},
		// Glacier has an anonymous (no key) tier — users do not need to register.
		RequiresAPIKey: false,
		ConfigKey:      "glacier",
	},
}

// ================================================================================
// NETWORK TO PROVIDER MAPPING
// ================================================================================

// NetworkToProvider maps Internal Network ID to its preferred provider
var NetworkToProvider = map[string]string{
	// Alchemy networks
	NetworkEthMainnet:      ProviderAlchemy,
	NetworkPolygonMainnet:  ProviderAlchemy,
	NetworkArbitrumMainnet: ProviderAlchemy,
	NetworkOptimismMainnet: ProviderAlchemy,
	NetworkBaseMainnet:     ProviderAlchemy,
	// Testnets
	NetworkEthSepolia:      ProviderAlchemy,
	NetworkPolygonAmoy:     ProviderAlchemy,
	NetworkArbitrumSepolia: ProviderAlchemy,
	NetworkOptimismSepolia: ProviderAlchemy,
	NetworkBaseSepolia:     ProviderAlchemy,
	// NodeReal/BSCTrace networks
	NetworkBnbMainnet: ProviderNodeReal,
	// Glacier (Avalanche Data API, anonymous)
	NetworkAvalancheMainnet: ProviderGlacier,
}

// GetProviderForNetwork returns the provider type for a given Internal Network ID
func GetProviderForNetwork(network string) string {
	// First normalize the network ID to internal format
	normalized := NormalizeToInternalNetwork(network)
	if provider, ok := NetworkToProvider[normalized]; ok {
		return provider
	}
	// Default to Alchemy for unknown networks
	return ProviderAlchemy
}

// GetBalanceProviderForNetwork returns the provider type for BALANCE queries on
// a given network. Unlike GetProviderForNetwork (chain-dimension routing, used
// by NFTs/history), balances are decentralized: every chain routes to the
// self-hosted public-RPC + Multicall3 path, requiring no API key. The network
// argument is accepted (and normalized) so callers stay symmetric with
// GetProviderForNetwork and so this can become per-chain in the future if some
// chain ever needs a different balance backend.
func GetBalanceProviderForNetwork(network string) string {
	_ = NormalizeToInternalNetwork(network)
	return ProviderSelfHosted
}

// ================================================================================
// NETWORK ID NORMALIZATION (External -> Internal)
// ================================================================================

// NormalizeToInternalNetwork converts any network ID format to Internal canonical format
// This handles legacy formats or provider-specific formats that might come from external sources
func NormalizeToInternalNetwork(network string) string {
	switch network {
	// Alchemy format -> Internal format
	case "arb-mainnet":
		return NetworkArbitrumMainnet
	case "opt-mainnet":
		return NetworkOptimismMainnet
	case "arb-sepolia":
		return NetworkArbitrumSepolia
	case "opt-sepolia":
		return NetworkOptimismSepolia
	default:
		return network
	}
}

// ================================================================================
// PROVIDER ADAPTER INTERFACE
// Each provider implements this to convert Internal IDs to provider-specific format
// ================================================================================

// ProviderNetworkAdapter converts Internal Network IDs to provider-specific format
type ProviderNetworkAdapter interface {
	// ToProviderNetwork converts Internal Network ID to provider-specific format
	ToProviderNetwork(internalNetwork string) string

	// FromProviderNetwork converts provider-specific format back to Internal Network ID
	FromProviderNetwork(providerNetwork string) string

	// GetRPCEndpoint returns the RPC endpoint URL for a network
	GetRPCEndpoint(internalNetwork string) string

	// GetTransferCategories returns the transfer categories for a network
	GetTransferCategories(internalNetwork string) []string
}

// ================================================================================
// HELPER FUNCTIONS
// ================================================================================

// IsNetworkSupported checks if a network is supported by any provider
func IsNetworkSupported(network string) bool {
	normalized := NormalizeToInternalNetwork(network)
	_, ok := NetworkToProvider[normalized]
	return ok
}

// GetSupportedNetworks returns all supported Internal Network IDs
func GetSupportedNetworks() []string {
	networks := make([]string, 0, len(NetworkToProvider))
	for network := range NetworkToProvider {
		networks = append(networks, network)
	}
	return networks
}

// SupportsInternalTransfers checks if a network supports "internal" transfer category
func SupportsInternalTransfers(network string) bool {
	normalized := NormalizeToInternalNetwork(network)
	providerType := GetProviderForNetwork(normalized)
	cap, ok := ProviderCapabilities[providerType]
	if !ok {
		return false
	}

	for _, n := range cap.InternalTransferNetworks {
		if n == normalized {
			return true
		}
	}
	return false
}

// GetTransferCategoriesForNetwork returns the appropriate categories for a network
func GetTransferCategoriesForNetwork(network string) []string {
	normalized := NormalizeToInternalNetwork(network)
	providerType := GetProviderForNetwork(normalized)
	cap, ok := ProviderCapabilities[providerType]
	if !ok {
		return []string{"external", "erc20", "erc721", "erc1155"}
	}

	categories := make([]string, len(cap.TransferCategories))
	copy(categories, cap.TransferCategories)

	// Add "internal" only if this network supports it
	if SupportsInternalTransfers(normalized) && providerType == ProviderAlchemy {
		categories = append(categories, "internal")
	}

	return categories
}

// GetProviderConfigKeys returns the config keys to check for a provider
func GetProviderConfigKeys(providerType string) []string {
	switch providerType {
	case ProviderNodeReal, ProviderBSCTrace:
		return []string{"nodereal", "bsctrace"}
	default:
		return []string{providerType}
	}
}

// AllMainnetNetworks returns all mainnet Internal Network IDs for UI display
func AllMainnetNetworks() []string {
	return []string{
		NetworkEthMainnet,
		NetworkPolygonMainnet,
		NetworkArbitrumMainnet,
		NetworkOptimismMainnet,
		NetworkBaseMainnet,
		NetworkBnbMainnet,
		NetworkAvalancheMainnet,
	}
}

// NetworkLabels provides human-readable names for Internal Network IDs
var NetworkLabels = map[string]string{
	NetworkEthMainnet:      "Ethereum",
	NetworkPolygonMainnet:  "Polygon",
	NetworkArbitrumMainnet: "Arbitrum",
	NetworkOptimismMainnet: "Optimism",
	NetworkBaseMainnet:     "Base",
	NetworkBnbMainnet:      "BNB Chain",
	NetworkAvalancheMainnet: "Avalanche",
	// Testnets
	NetworkEthSepolia:      "Ethereum Sepolia",
	NetworkPolygonAmoy:     "Polygon Amoy",
	NetworkArbitrumSepolia: "Arbitrum Sepolia",
	NetworkOptimismSepolia: "Optimism Sepolia",
	NetworkBaseSepolia:     "Base Sepolia",
}

// GetNetworkLabel returns human-readable label for an Internal Network ID
func GetNetworkLabel(network string) string {
	normalized := NormalizeToInternalNetwork(network)
	if label, ok := NetworkLabels[normalized]; ok {
		return label
	}
	return network
}
