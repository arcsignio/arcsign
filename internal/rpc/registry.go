// Package rpc provides a unified registry for blockchain RPC endpoints.
// This centralizes all RPC configuration to ensure consistent endpoint usage
// across the application (transactions, queries, etc.)
//
// Design Principles:
// 1. Free public RPCs for transaction operations (no API key required)
// 2. Alchemy/third-party APIs for enhanced data queries (optional)
// 3. Each chain has primary + backup endpoints for reliability
// 4. Chain-specific gas fee strategies (EIP-1559, Legacy, L2)
package rpc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"
)

// FeeStrategy defines which gas fee calculation strategy to use for a chain
type FeeStrategy int

const (
	// FeeStrategyEIP1559 uses eth_feeHistory for EIP-1559 compatible chains
	// Supported: Ethereum, Polygon, Avalanche
	// Uses: baseFee + maxPriorityFeePerGas
	FeeStrategyEIP1559 FeeStrategy = iota

	// FeeStrategyLegacy uses eth_gasPrice for chains without proper EIP-1559
	// Supported: BSC, Fantom (baseFee ≈ 0 or not reliable)
	// Uses: gasPrice only
	FeeStrategyLegacy

	// FeeStrategyL2 uses special L2 fee calculation
	// Supported: Arbitrum, Optimism, Base (has L1 data fee + L2 execution fee)
	// Uses: L2-specific fee oracle contracts
	FeeStrategyL2
)

// String returns human-readable name for the fee strategy
func (fs FeeStrategy) String() string {
	switch fs {
	case FeeStrategyEIP1559:
		return "EIP-1559"
	case FeeStrategyLegacy:
		return "Legacy"
	case FeeStrategyL2:
		return "L2"
	default:
		return "Unknown"
	}
}

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

	// FeeStrategy determines which gas fee calculation method to use
	// Default: FeeStrategyEIP1559 (most EVM chains support it)
	FeeStrategy FeeStrategy
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
	// =========================================================================
	// EIP-1559 Chains - Use eth_feeHistory for gas estimation
	// =========================================================================

	// Ethereum Mainnet - Full EIP-1559 support
	r.registerChain("ethereum", &ChainInfo{
		ChainID:             1,
		Name:                "Ethereum",
		Symbol:              "ETH",
		// publicnode is the working keyless endpoint (verified 2026-06); llamarpc
		// started returning 521 and ankr now requires an API key, so they're demoted
		// to backups (kept in case they recover).
		PrimaryRPC:          "https://ethereum-rpc.publicnode.com",
		BackupRPCs:          []string{"https://eth.llamarpc.com", "https://rpc.ankr.com/eth"},
		AlchemyNetwork:      "eth-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://etherscan.io",
		FeeStrategy:         FeeStrategyEIP1559,
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
		FeeStrategy:         FeeStrategyEIP1559,
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
		FeeStrategy:         FeeStrategyEIP1559,
	})

	// Polygon Mainnet - EIP-1559 support
	r.registerChain("polygon", &ChainInfo{
		ChainID:             137,
		Name:                "Polygon",
		Symbol:              "MATIC",
		// publicnode is the working keyless endpoint (verified 2026-06); the
		// previous primary/backups all started requiring API keys or shut down
		// (polygon-rpc.com → tenant disabled, ankr → key required, blastapi → EOL).
		PrimaryRPC:          "https://polygon-bor-rpc.publicnode.com",
		BackupRPCs:          []string{"https://polygon-rpc.com", "https://rpc.ankr.com/polygon"},
		AlchemyNetwork:      "polygon-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://polygonscan.com",
		FeeStrategy:         FeeStrategyEIP1559,
	})
	r.registerChain("polygon-mainnet", r.chains["polygon"])

	// Avalanche C-Chain - EIP-1559 support
	r.registerChain("avalanche", &ChainInfo{
		ChainID:             43114,
		Name:                "Avalanche C-Chain",
		Symbol:              "AVAX",
		PrimaryRPC:          "https://api.avax.network/ext/bc/C/rpc",
		BackupRPCs:          []string{"https://rpc.ankr.com/avalanche", "https://avalanche-c-chain.publicnode.com"},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://snowtrace.io",
		FeeStrategy:         FeeStrategyEIP1559,
	})
	r.registerChain("avax", r.chains["avalanche"])

	// =========================================================================
	// Legacy Chains - Use eth_gasPrice (no reliable EIP-1559)
	// These chains have baseFee ≈ 0 or don't properly support eth_feeHistory
	// =========================================================================

	// BSC (BNB Chain) Mainnet - Legacy gasPrice only
	// BSC has EIP-1559 but baseFee is always ~0, making it unreliable
	bscMainnet := &ChainInfo{
		ChainID:             56,
		Name:                "BNB Chain",
		Symbol:              "BNB",
		PrimaryRPC:          "https://bsc-dataseed1.binance.org",
		BackupRPCs:          []string{"https://bsc-dataseed2.binance.org", "https://bsc-dataseed3.binance.org", "https://bsc-dataseed4.binance.org"},
		AlchemyNetwork:      "", // BSC not supported by Alchemy free tier
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://bscscan.com",
		FeeStrategy:         FeeStrategyLegacy,
	}
	r.registerChain("bsc", bscMainnet)
	r.registerChain("bsc-mainnet", bscMainnet)
	r.registerChain("bnb", bscMainnet)

	// BSC Testnet - Legacy gasPrice
	bscTestnet := &ChainInfo{
		ChainID:             97,
		Name:                "BNB Chain Testnet",
		Symbol:              "tBNB",
		PrimaryRPC:          "https://bsc-testnet-rpc.publicnode.com",
		BackupRPCs:          []string{"https://data-seed-prebsc-1-s1.binance.org:8545", "https://data-seed-prebsc-2-s1.binance.org:8545"},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://testnet.bscscan.com",
		FeeStrategy:         FeeStrategyLegacy,
	}
	r.registerChain("bsc-testnet", bscTestnet)
	r.registerChain("bnb-testnet", bscTestnet)

	// Fantom - Legacy gasPrice (eth_feeHistory not reliable)
	r.registerChain("fantom", &ChainInfo{
		ChainID:             250,
		Name:                "Fantom Opera",
		Symbol:              "FTM",
		PrimaryRPC:          "https://rpc.ftm.tools",
		BackupRPCs:          []string{"https://rpc.ankr.com/fantom", "https://fantom-mainnet.public.blastapi.io"},
		AlchemyNetwork:      "",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://ftmscan.com",
		FeeStrategy:         FeeStrategyLegacy,
	})

	// =========================================================================
	// L2 Chains - Use L2-specific fee calculation
	// These chains have separate L1 data fee + L2 execution fee
	// =========================================================================

	// Arbitrum One - L2 with special fee handling
	r.registerChain("arbitrum", &ChainInfo{
		ChainID:             42161,
		Name:                "Arbitrum One",
		Symbol:              "ETH",
		PrimaryRPC:          "https://arb1.arbitrum.io/rpc",
		BackupRPCs:          []string{"https://rpc.ankr.com/arbitrum", "https://arbitrum-one.public.blastapi.io"},
		AlchemyNetwork:      "arb-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://arbiscan.io",
		FeeStrategy:         FeeStrategyL2,
	})
	r.registerChain("arbitrum-mainnet", r.chains["arbitrum"])

	// Optimism - L2 with L1 data fee oracle
	r.registerChain("optimism", &ChainInfo{
		ChainID:             10,
		Name:                "Optimism",
		Symbol:              "ETH",
		PrimaryRPC:          "https://mainnet.optimism.io",
		BackupRPCs:          []string{"https://rpc.ankr.com/optimism", "https://optimism-mainnet.public.blastapi.io"},
		AlchemyNetwork:      "opt-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://optimistic.etherscan.io",
		FeeStrategy:         FeeStrategyL2,
	})
	r.registerChain("optimism-mainnet", r.chains["optimism"])

	// Base - L2 (OP Stack, same as Optimism)
	r.registerChain("base", &ChainInfo{
		ChainID:             8453,
		Name:                "Base",
		Symbol:              "ETH",
		PrimaryRPC:          "https://mainnet.base.org",
		BackupRPCs:          []string{"https://rpc.ankr.com/base", "https://base-mainnet.public.blastapi.io"},
		AlchemyNetwork:      "base-mainnet",
		NativeTokenDecimals: 18,
		BlockExplorerURL:    "https://basescan.org",
		FeeStrategy:         FeeStrategyL2,
	})
	r.registerChain("base-mainnet", r.chains["base"])

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

// GetFeeStrategy returns the gas fee calculation strategy for a chain
func GetFeeStrategy(chainID string) FeeStrategy {
	info, err := DefaultRegistry.GetChain(chainID)
	if err != nil {
		// Default to EIP-1559 for unknown chains
		return FeeStrategyEIP1559
	}
	return info.FeeStrategy
}

// GetFeeStrategyByEVMChainID returns the fee strategy for an EVM chain ID (numeric)
// This is useful when you only have the chain ID number (e.g., 56 for BSC)
func GetFeeStrategyByEVMChainID(evmChainID int64) FeeStrategy {
	// Map common EVM chain IDs to their fee strategies
	switch evmChainID {
	// Legacy chains (use eth_gasPrice)
	case 56, 97: // BSC Mainnet, BSC Testnet
		return FeeStrategyLegacy
	case 250: // Fantom
		return FeeStrategyLegacy

	// L2 chains (special L1+L2 fee handling)
	case 42161: // Arbitrum One
		return FeeStrategyL2
	case 10: // Optimism
		return FeeStrategyL2
	case 8453: // Base
		return FeeStrategyL2

	// EIP-1559 chains (default for most EVM chains)
	default:
		return FeeStrategyEIP1559
	}
}

// IsLegacyChain returns true if the chain should use legacy gasPrice
func IsLegacyChain(evmChainID int64) bool {
	return GetFeeStrategyByEVMChainID(evmChainID) == FeeStrategyLegacy
}

// IsL2Chain returns true if the chain is an L2 with special fee handling
func IsL2Chain(evmChainID int64) bool {
	return GetFeeStrategyByEVMChainID(evmChainID) == FeeStrategyL2
}

// ============================================================================
// Gas Price Functions
// ============================================================================

// GetGasPrice fetches the current gas price from the blockchain via eth_gasPrice RPC.
// If the RPC call fails, it returns a sensible fallback based on the chain.
//
// Parameters:
// - chainID: Chain identifier (e.g., "ethereum", "bsc", "polygon")
//
// Returns:
// - Gas price in wei (e.g., 1000000000 for 1 Gwei)
// - Error if RPC fails and no fallback is available
func GetGasPrice(chainID string) (*big.Int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return GetGasPriceWithContext(ctx, chainID)
}

// GetGasPriceWithContext fetches gas price with a custom context for timeout control.
func GetGasPriceWithContext(ctx context.Context, chainID string) (*big.Int, error) {
	// Get RPC endpoint
	rpcEndpoint, err := GetRPC(chainID)
	if err != nil {
		return getDefaultGasPrice(chainID), nil
	}

	// Call eth_gasPrice
	gasPrice, err := callEthGasPrice(ctx, rpcEndpoint)
	if err != nil {
		// Fallback to default on error
		return getDefaultGasPrice(chainID), nil
	}

	// Apply a small buffer (1.1x) for safety margin
	// This helps ensure transactions don't get stuck
	buffered := new(big.Int).Mul(gasPrice, big.NewInt(110))
	buffered.Div(buffered, big.NewInt(100))

	return buffered, nil
}

// callEthGasPrice makes an eth_gasPrice JSON-RPC call
func callEthGasPrice(ctx context.Context, rpcEndpoint string) (*big.Int, error) {
	// Build JSON-RPC request
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "eth_gasPrice",
		"params":  []interface{}{},
		"id":      1,
	}
	reqBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", rpcEndpoint, bytes.NewReader(reqBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("RPC request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse JSON-RPC response
	var rpcResp struct {
		Result string `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error: %s", rpcResp.Error.Message)
	}

	// Parse hex result (e.g., "0x3b9aca00" = 1000000000 = 1 Gwei)
	gasPrice := new(big.Int)
	hexStr := strings.TrimPrefix(rpcResp.Result, "0x")
	if _, ok := gasPrice.SetString(hexStr, 16); !ok {
		return nil, fmt.Errorf("failed to parse gas price hex: %s", rpcResp.Result)
	}

	return gasPrice, nil
}

// getDefaultGasPrice returns a sensible default gas price for a chain
// when RPC is unavailable. Values are in wei.
func getDefaultGasPrice(chainID string) *big.Int {
	// Normalize chainID
	normalized := strings.ToLower(chainID)

	switch {
	// BSC - very low gas (0.05-1 Gwei typical)
	case strings.Contains(normalized, "bsc") || strings.Contains(normalized, "bnb"):
		return big.NewInt(1e9) // 1 Gwei

	// Polygon - moderate gas (30-100 Gwei typical)
	case strings.Contains(normalized, "polygon") || strings.Contains(normalized, "matic"):
		return big.NewInt(50e9) // 50 Gwei

	// Arbitrum - very low gas
	case strings.Contains(normalized, "arbitrum") || strings.Contains(normalized, "arb"):
		return big.NewInt(100000000) // 0.1 Gwei

	// Optimism/Base - very low gas
	case strings.Contains(normalized, "optimism") || strings.Contains(normalized, "opt"):
		return big.NewInt(10000000) // 0.01 Gwei
	case strings.Contains(normalized, "base"):
		return big.NewInt(10000000) // 0.01 Gwei

	// Avalanche - moderate gas
	case strings.Contains(normalized, "avax") || strings.Contains(normalized, "avalanche"):
		return big.NewInt(25e9) // 25 Gwei

	// Fantom - low gas
	case strings.Contains(normalized, "fantom") || strings.Contains(normalized, "ftm"):
		return big.NewInt(100e9) // 100 Gwei (Fantom has higher but still cheap)

	// Ethereum - default to conservative estimate
	default:
		return big.NewInt(30e9) // 30 Gwei
	}
}
