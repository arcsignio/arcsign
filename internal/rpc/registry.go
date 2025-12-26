// Package rpc provides a unified registry for blockchain RPC endpoints.
// This centralizes all RPC configuration to ensure consistent endpoint usage
// across the application (transactions, queries, etc.)
//
// Design Principles:
// 1. Free public RPCs for transaction operations (no API key required)
// 2. Alchemy/third-party APIs for enhanced data queries (optional)
// 3. Each chain has primary + backup endpoints for reliability
package rpc

import (
	"fmt"
	"sync"
)

// ChainInfo contains all RPC endpoints and metadata for a blockchain
type ChainInfo struct {
	// ChainID is the EVM chain ID (e.g., 1 for Ethereum, 56 for BSC)
	ChainID int

	// Name is the human-readable chain name
	Name string

	// Symbol is the native token symbol (e.g., ETH, BNB)
	Symbol string

	// PrimaryRPC is the main free public RPC endpoint
	PrimaryRPC string

	// BackupRPCs are fallback endpoints if primary fails
	BackupRPCs []string

	// AlchemyNetwork is the Alchemy network slug (empty if not supported)
	AlchemyNetwork string

	// NativeTokenDecimals is typically 18 for EVM chains
	NativeTokenDecimals int

	// BlockExplorerURL for transaction links
	BlockExplorerURL string
}

// Registry manages RPC endpoints for all supported chains
type Registry struct {
	chains map[string]*ChainInfo // key: chainId string (e.g., "ethereum", "bsc")
	mu     sync.RWMutex
}

// DefaultRegistry is the global RPC registry instance
var DefaultRegistry = NewRegistry()

// NewRegistry creates a new RPC registry with all supported chains
func NewRegistry() *Registry {
	r := &Registry{
		chains: make(map[string]*ChainInfo),
	}
	r.initializeChains()
	return r
}

// initializeChains populates the registry with all supported chains
func (r *Registry) initializeChains() {
	// Ethereum Mainnet
	r.registerChain("ethereum", &ChainInfo{
		ChainID:             1,
		Name:                "Ethereum",
		Symbol:              "ETH",
		PrimaryRPC:          "https://eth.llamarpc.com",
		BackupRPCs:          []string{"https://rpc.ankr.com/eth", "https://ethereum.publicnode.com"},
		AlchemyNetwork:      "eth-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://etherscan.io",
	})

	// Ethereum Sepolia Testnet
	r.registerChain("ethereum-sepolia", &ChainInfo{
		ChainID:             11155111,
		Name:                "Ethereum Sepolia",
		Symbol:              "ETH",
		PrimaryRPC:          "https://rpc.sepolia.org",
		BackupRPCs:          []string{"https://rpc.ankr.com/eth_sepolia", "https://ethereum-sepolia.publicnode.com"},
		AlchemyNetwork:      "eth-sepolia",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://sepolia.etherscan.io",
	})

	// Ethereum Goerli Testnet (deprecated but still supported)
	r.registerChain("ethereum-goerli", &ChainInfo{
		ChainID:             5,
		Name:                "Ethereum Goerli",
		Symbol:              "ETH",
		PrimaryRPC:          "https://rpc.ankr.com/eth_goerli",
		BackupRPCs:          []string{"https://ethereum-goerli.publicnode.com"},
		AlchemyNetwork:      "eth-goerli",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://goerli.etherscan.io",
	})

	// BSC (BNB Chain) Mainnet - Always use free Binance RPCs
	bscMainnet := &ChainInfo{
		ChainID:             56,
		Name:                "BNB Chain",
		Symbol:              "BNB",
		PrimaryRPC:          "https://bsc-dataseed1.binance.org",
		BackupRPCs:          []string{"https://bsc-dataseed2.binance.org", "https://bsc-dataseed3.binance.org", "https://bsc-dataseed4.binance.org"},
		AlchemyNetwork:      "", // BSC not supported by Alchemy free tier
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://bscscan.com",
	}
	r.registerChain("bsc", bscMainnet)
	r.registerChain("bsc-mainnet", bscMainnet)
	r.registerChain("bnb", bscMainnet)

	// BSC Testnet
	bscTestnet := &ChainInfo{
		ChainID:             97,
		Name:                "BNB Chain Testnet",
		Symbol:              "tBNB",
		PrimaryRPC:          "https://bsc-testnet-rpc.publicnode.com",
		BackupRPCs:          []string{"https://data-seed-prebsc-1-s1.binance.org:8545", "https://data-seed-prebsc-2-s1.binance.org:8545"},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://testnet.bscscan.com",
	}
	r.registerChain("bsc-testnet", bscTestnet)
	r.registerChain("bnb-testnet", bscTestnet)

	// Polygon Mainnet
	r.registerChain("polygon", &ChainInfo{
		ChainID:             137,
		Name:                "Polygon",
		Symbol:              "MATIC",
		PrimaryRPC:          "https://polygon-rpc.com",
		BackupRPCs:          []string{"https://rpc.ankr.com/polygon", "https://polygon-mainnet.public.blastapi.io"},
		AlchemyNetwork:      "polygon-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://polygonscan.com",
	})
	r.registerChain("polygon-mainnet", r.chains["polygon"])

	// Arbitrum One
	r.registerChain("arbitrum", &ChainInfo{
		ChainID:             42161,
		Name:                "Arbitrum One",
		Symbol:              "ETH",
		PrimaryRPC:          "https://arb1.arbitrum.io/rpc",
		BackupRPCs:          []string{"https://rpc.ankr.com/arbitrum", "https://arbitrum-one.public.blastapi.io"},
		AlchemyNetwork:      "arb-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://arbiscan.io",
	})
	r.registerChain("arbitrum-mainnet", r.chains["arbitrum"])

	// Optimism
	r.registerChain("optimism", &ChainInfo{
		ChainID:             10,
		Name:                "Optimism",
		Symbol:              "ETH",
		PrimaryRPC:          "https://mainnet.optimism.io",
		BackupRPCs:          []string{"https://rpc.ankr.com/optimism", "https://optimism-mainnet.public.blastapi.io"},
		AlchemyNetwork:      "opt-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://optimistic.etherscan.io",
	})
	r.registerChain("optimism-mainnet", r.chains["optimism"])

	// Base
	r.registerChain("base", &ChainInfo{
		ChainID:             8453,
		Name:                "Base",
		Symbol:              "ETH",
		PrimaryRPC:          "https://mainnet.base.org",
		BackupRPCs:          []string{"https://rpc.ankr.com/base", "https://base-mainnet.public.blastapi.io"},
		AlchemyNetwork:      "base-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://basescan.org",
	})
	r.registerChain("base-mainnet", r.chains["base"])

	// Avalanche C-Chain
	r.registerChain("avalanche", &ChainInfo{
		ChainID:             43114,
		Name:                "Avalanche C-Chain",
		Symbol:              "AVAX",
		PrimaryRPC:          "https://api.avax.network/ext/bc/C/rpc",
		BackupRPCs:          []string{"https://rpc.ankr.com/avalanche", "https://avalanche-c-chain.publicnode.com"},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://snowtrace.io",
	})
	r.registerChain("avax", r.chains["avalanche"])

	// Fantom
	r.registerChain("fantom", &ChainInfo{
		ChainID:             250,
		Name:                "Fantom Opera",
		Symbol:              "FTM",
		PrimaryRPC:          "https://rpc.ftm.tools",
		BackupRPCs:          []string{"https://rpc.ankr.com/fantom", "https://fantom-mainnet.public.blastapi.io"},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://ftmscan.com",
	})

	// Bitcoin networks (non-EVM, for reference)
	r.registerChain("bitcoin", &ChainInfo{
		ChainID:             0, // Bitcoin doesn't use EVM chain ID
		Name:                "Bitcoin",
		Symbol:              "BTC",
		PrimaryRPC:          "http://127.0.0.1:8332",
		BackupRPCs:          []string{},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 8,
		BlockExplorerURL:    "https://mempool.space",
	})

	r.registerChain("bitcoin-testnet", &ChainInfo{
		ChainID:             0,
		Name:                "Bitcoin Testnet",
		Symbol:              "tBTC",
		PrimaryRPC:          "http://127.0.0.1:18332",
		BackupRPCs:          []string{},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 8,
		BlockExplorerURL:    "https://mempool.space/testnet",
	})

	r.registerChain("bitcoin-regtest", &ChainInfo{
		ChainID:             0,
		Name:                "Bitcoin Regtest",
		Symbol:              "rBTC",
		PrimaryRPC:          "http://127.0.0.1:18443",
		BackupRPCs:          []string{},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 8,
		BlockExplorerURL:    "",
	})
}

// registerChain adds a chain to the registry
func (r *Registry) registerChain(chainID string, info *ChainInfo) {
	r.chains[chainID] = info
}

// GetChain returns chain info by chainID string
func (r *Registry) GetChain(chainID string) (*ChainInfo, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	info, exists := r.chains[chainID]
	if !exists {
		return nil, fmt.Errorf("unsupported chain: %s", chainID)
	}
	return info, nil
}

// GetRPCEndpoint returns the primary RPC endpoint for a chain
// This is the main function to use for transaction operations
func (r *Registry) GetRPCEndpoint(chainID string) (string, error) {
	info, err := r.GetChain(chainID)
	if err != nil {
		return "", err
	}
	return info.PrimaryRPC, nil
}

// GetAllRPCEndpoints returns primary + backup endpoints for a chain
func (r *Registry) GetAllRPCEndpoints(chainID string) ([]string, error) {
	info, err := r.GetChain(chainID)
	if err != nil {
		return nil, err
	}

	endpoints := make([]string, 0, 1+len(info.BackupRPCs))
	endpoints = append(endpoints, info.PrimaryRPC)
	endpoints = append(endpoints, info.BackupRPCs...)
	return endpoints, nil
}

// GetAlchemyEndpoint returns the Alchemy RPC URL for enhanced API calls
// Returns empty string if chain doesn't support Alchemy
func (r *Registry) GetAlchemyEndpoint(chainID, apiKey string) (string, error) {
	info, err := r.GetChain(chainID)
	if err != nil {
		return "", err
	}

	if info.AlchemyNetwork == "" {
		return "", fmt.Errorf("chain %s does not support Alchemy API", chainID)
	}

	return fmt.Sprintf("https://%s.g.alchemy.com/v2/%s", info.AlchemyNetwork, apiKey), nil
}

// GetEVMChainID returns the numeric EVM chain ID
func (r *Registry) GetEVMChainID(chainID string) (int, error) {
	info, err := r.GetChain(chainID)
	if err != nil {
		return 0, err
	}
	return info.ChainID, nil
}

// IsAlchemySupported checks if a chain supports Alchemy enhanced APIs
func (r *Registry) IsAlchemySupported(chainID string) bool {
	info, err := r.GetChain(chainID)
	if err != nil {
		return false
	}
	return info.AlchemyNetwork != ""
}

// ListSupportedChains returns all supported chain IDs
func (r *Registry) ListSupportedChains() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	chains := make([]string, 0, len(r.chains))
	seen := make(map[string]bool)

	for id, info := range r.chains {
		// Avoid duplicates (aliases point to same ChainInfo)
		key := fmt.Sprintf("%d-%s", info.ChainID, info.Name)
		if !seen[key] {
			chains = append(chains, id)
			seen[key] = true
		}
	}
	return chains
}

// Helper functions using DefaultRegistry

// GetRPC returns the primary RPC endpoint for a chain using the default registry
func GetRPC(chainID string) (string, error) {
	return DefaultRegistry.GetRPCEndpoint(chainID)
}

// GetChainInfo returns chain info using the default registry
func GetChainInfo(chainID string) (*ChainInfo, error) {
	return DefaultRegistry.GetChain(chainID)
}

// GetAlchemyRPC returns the Alchemy endpoint for a chain using the default registry
func GetAlchemyRPC(chainID, apiKey string) (string, error) {
	return DefaultRegistry.GetAlchemyEndpoint(chainID, apiKey)
}

// MustGetRPC returns RPC endpoint or panics (use only in init/startup)
func MustGetRPC(chainID string) string {
	rpc, err := GetRPC(chainID)
	if err != nil {
		panic(fmt.Sprintf("failed to get RPC for %s: %v", chainID, err))
	}
	return rpc
}
