/**
 * Network mapping utilities
 * Feature: Token balance queries across multiple chains
 *
 * Architecture:
 * - ChainToInternalNetwork: Maps chain names (e.g., "Ethereum") to Internal Network IDs
 * - Internal Network IDs are defined in chains.go (e.g., "arbitrum-mainnet")
 * - Provider adapters (e.g., ToAlchemyNetwork) convert Internal IDs to provider-specific format
 */

package provider

// SupportedNetworks returns all networks supported for token balance queries
// Returns Internal Network IDs (canonical format)
func SupportedNetworks() []string {
	return AllMainnetNetworks()
}

// ChainToInternalNetwork maps chain names to Internal Network IDs
// This is used to convert user-friendly names to our canonical Internal format
// The Internal IDs are then converted to provider-specific format by adapters
var ChainToInternalNetwork = map[string]string{
	// Ethereum
	"Ethereum": NetworkEthMainnet,
	"ethereum": NetworkEthMainnet,
	"eth":      NetworkEthMainnet,
	// Polygon
	"Polygon": NetworkPolygonMainnet,
	"polygon": NetworkPolygonMainnet,
	"matic":   NetworkPolygonMainnet,
	// Arbitrum - Internal format is "arbitrum-mainnet"
	"Arbitrum":         NetworkArbitrumMainnet,
	"arbitrum":         NetworkArbitrumMainnet,
	"arb":              NetworkArbitrumMainnet,
	"arbitrum-mainnet": NetworkArbitrumMainnet,
	"arb-mainnet":      NetworkArbitrumMainnet, // Alchemy format -> Internal
	// Optimism - Internal format is "optimism-mainnet"
	"Optimism":         NetworkOptimismMainnet,
	"optimism":         NetworkOptimismMainnet,
	"opt":              NetworkOptimismMainnet,
	"optimism-mainnet": NetworkOptimismMainnet,
	"opt-mainnet":      NetworkOptimismMainnet, // Alchemy format -> Internal
	// Base
	"Base":         NetworkBaseMainnet,
	"base":         NetworkBaseMainnet,
	"base-mainnet": NetworkBaseMainnet,
	// BNB Chain
	"BNB Chain":           NetworkBnbMainnet,
	"BNB":                 NetworkBnbMainnet,
	"bnb":                 NetworkBnbMainnet,
	"binance":             NetworkBnbMainnet,
	"bsc":                 NetworkBnbMainnet,
	"binance-smart-chain": NetworkBnbMainnet,
	"bnb-mainnet":         NetworkBnbMainnet,
	// Avalanche C-Chain (wallet CoinName is "Avalanche")
	"Avalanche":          NetworkAvalancheMainnet,
	"avalanche":          NetworkAvalancheMainnet,
	"avax":               NetworkAvalancheMainnet,
	"AVAX":               NetworkAvalancheMainnet,
	"avalanche-mainnet":  NetworkAvalancheMainnet,
	"avax-mainnet":       NetworkAvalancheMainnet,
	// Testnets (for development)
	"Ethereum Sepolia": NetworkEthSepolia,
	"ethereum-sepolia": NetworkEthSepolia,
	"sepolia":          NetworkEthSepolia,
	"eth-sepolia":      NetworkEthSepolia,
	// Testnet aliases for Alchemy format
	"arb-sepolia": NetworkArbitrumSepolia,
	"opt-sepolia": NetworkOptimismSepolia,
}

// GetAlchemyNetwork converts a chain name to Internal Network ID
// Deprecated: Use GetInternalNetwork instead, then ToAlchemyNetwork for Alchemy calls
func GetAlchemyNetwork(chain string) (string, bool) {
	network, ok := ChainToInternalNetwork[chain]
	return network, ok
}

// GetInternalNetwork converts a chain name to Internal Network ID
func GetInternalNetwork(chain string) (string, bool) {
	network, ok := ChainToInternalNetwork[chain]
	return network, ok
}
