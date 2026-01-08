/**
 * NodeReal Network Adapter
 *
 * Handles network ID conversions for NodeReal/BSCTrace API.
 *
 * NodeReal-specific formats:
 * - Uses "bsc-mainnet" for BSC (we use "bnb-mainnet" internally)
 *
 * Supported Networks:
 * - BSC (BNB Chain) mainnet only
 *
 * API: nr_getAssetTransfers (JSON-RPC 2.0)
 * Docs: https://docs.nodereal.io/reference/nr_getassettransfers
 *
 * Free Tier: 100M CU/month, 300 req/sec
 * nr_getAssetTransfers: 250 CU/request = ~400K queries/month
 */

package adapter

import "fmt"

const (
	// NodeRealBaseURL is the NodeReal MegaNode endpoint for BSC
	NodeRealBaseURL = "https://bsc-mainnet.nodereal.io/v1"

	// NodeRealPublicKey - NodeReal provides a public endpoint
	// For production, users should get their own key at https://dashboard.nodereal.io
	NodeRealPublicKey = "e7864b06cdbb4ec0a64c19c8bdcb3401"
)

func init() {
	Register(&NodeRealAdapter{})
}

// NodeRealAdapter implements NetworkAdapter for NodeReal/BSCTrace API
type NodeRealAdapter struct{}

// Name returns the provider identifier
func (a *NodeRealAdapter) Name() string {
	return "nodereal"
}

// ================================================================================
// Network ID Mappings
// Internal Network ID → NodeReal Network ID
// ================================================================================

var nodeRealNetworkMap = map[string]string{
	"bnb-mainnet": "bsc-mainnet", // We use "bnb-mainnet", NodeReal uses "bsc-mainnet"
}

var nodeRealReverseMap = reverseMap(nodeRealNetworkMap)

// ================================================================================
// Supported Networks
// ================================================================================

var nodeRealSupportedNetworks = []string{
	"bnb-mainnet",
}

// ================================================================================
// Network Labels
// ================================================================================

var nodeRealNetworkLabels = map[string]string{
	"bnb-mainnet": "BNB Chain",
}

// ================================================================================
// NetworkAdapter Interface Implementation
// ================================================================================

// ToProviderNetwork converts Internal Network ID to NodeReal format
func (a *NodeRealAdapter) ToProviderNetwork(internalNetwork string) string {
	if nodeRealID, ok := nodeRealNetworkMap[internalNetwork]; ok {
		return nodeRealID
	}
	return internalNetwork
}

// FromProviderNetwork converts NodeReal format to Internal Network ID
func (a *NodeRealAdapter) FromProviderNetwork(providerNetwork string) string {
	if internalID, ok := nodeRealReverseMap[providerNetwork]; ok {
		return internalID
	}
	return providerNetwork
}

// SupportedNetworks returns all Internal Network IDs supported by NodeReal
func (a *NodeRealAdapter) SupportedNetworks() []string {
	return nodeRealSupportedNetworks
}

// IsSupported checks if NodeReal supports the given Internal Network ID
func (a *NodeRealAdapter) IsSupported(internalNetwork string) bool {
	for _, network := range nodeRealSupportedNetworks {
		if network == internalNetwork {
			return true
		}
	}
	return false
}

// GetRPCEndpoint returns the NodeReal RPC endpoint for a network
func (a *NodeRealAdapter) GetRPCEndpoint(internalNetwork string, apiKey string) string {
	if !a.IsSupported(internalNetwork) {
		return ""
	}

	key := apiKey
	if key == "" {
		key = NodeRealPublicKey
	}

	return fmt.Sprintf("%s/%s", NodeRealBaseURL, key)
}

// GetTransferCategories returns transfer categories for transaction history
// BSCTrace uses different category names: "20" instead of "erc20"
func (a *NodeRealAdapter) GetTransferCategories(internalNetwork string) []string {
	// BSCTrace categories (different from Alchemy)
	return []string{"external", "internal", "20", "721", "1155"}
}

// GetNetworkLabel returns human-readable label for a network
func (a *NodeRealAdapter) GetNetworkLabel(internalNetwork string) string {
	if label, ok := nodeRealNetworkLabels[internalNetwork]; ok {
		return label
	}
	return internalNetwork
}
