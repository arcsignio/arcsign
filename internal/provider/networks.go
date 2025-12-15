/**
 * Network constants for Alchemy API
 * Feature: Token balance queries across multiple chains
 */

package provider

// Alchemy network identifiers
const (
	NetworkEthMainnet      = "eth-mainnet"
	NetworkPolygonMainnet  = "polygon-mainnet"
	NetworkArbitrumMainnet = "arb-mainnet"
	NetworkOptimismMainnet = "opt-mainnet"
	NetworkBaseMainnet     = "base-mainnet"
	NetworkBnbMainnet      = "bnb-mainnet"
)

// SupportedNetworks returns all networks supported for token balance queries
func SupportedNetworks() []string {
	return []string{
		NetworkEthMainnet,
		NetworkPolygonMainnet,
		NetworkArbitrumMainnet,
		NetworkOptimismMainnet,
		NetworkBaseMainnet,
		NetworkBnbMainnet,
	}
}

// ChainToAlchemyNetwork maps our internal chain names to Alchemy network identifiers
var ChainToAlchemyNetwork = map[string]string{
	"Ethereum":        NetworkEthMainnet,
	"ethereum":        NetworkEthMainnet,
	"eth":             NetworkEthMainnet,
	"Polygon":         NetworkPolygonMainnet,
	"polygon":         NetworkPolygonMainnet,
	"matic":           NetworkPolygonMainnet,
	"Arbitrum":        NetworkArbitrumMainnet,
	"arbitrum":        NetworkArbitrumMainnet,
	"arb":             NetworkArbitrumMainnet,
	"Optimism":        NetworkOptimismMainnet,
	"optimism":        NetworkOptimismMainnet,
	"opt":             NetworkOptimismMainnet,
	"Base":            NetworkBaseMainnet,
	"base":            NetworkBaseMainnet,
	"BNB":             NetworkBnbMainnet,
	"bnb":             NetworkBnbMainnet,
	"binance":         NetworkBnbMainnet,
	"bsc":             NetworkBnbMainnet,
	"binance-smart-chain": NetworkBnbMainnet,
}

// GetAlchemyNetwork converts a chain name to Alchemy network identifier
func GetAlchemyNetwork(chain string) (string, bool) {
	network, ok := ChainToAlchemyNetwork[chain]
	return network, ok
}
