/**
 * Alchemy API client for token balance queries
 * Feature: Query token balances across multiple chains
 *
 * Network ID Conversion:
 * Uses adapter.AlchemyAdapter for converting between Internal and Alchemy formats.
 * All API responses are normalized to Internal Network IDs before returning.
 */

package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strconv"
	"strings"

	"github.com/yourusername/arcsign/internal/provider/adapter"
)

const (
	AlchemyAPIBaseURL = "https://api.g.alchemy.com/data/v1"
)

// AlchemyClient handles communication with Alchemy API
type AlchemyClient struct {
	apiKey     string
	httpClient *http.Client
}

// NewAlchemyClient creates a new Alchemy API client
func NewAlchemyClient(apiKey string) *AlchemyClient {
	return &AlchemyClient{
		apiKey:     apiKey,
		httpClient: &http.Client{},
	}
}

// ================================================================================
// ALCHEMY NETWORK ADAPTER (Delegated to adapter package)
// ================================================================================

// alchemyAdapter is a cached reference to the Alchemy adapter
var alchemyAdapter = adapter.Get("alchemy")

// ToAlchemyNetwork converts Internal Network ID to Alchemy's format
// Delegates to adapter.AlchemyAdapter.ToProviderNetwork()
func ToAlchemyNetwork(internalNetwork string) string {
	if alchemyAdapter != nil {
		return alchemyAdapter.ToProviderNetwork(internalNetwork)
	}
	return internalNetwork
}

// FromAlchemyNetwork converts Alchemy's format back to Internal Network ID
// Delegates to adapter.AlchemyAdapter.FromProviderNetwork()
func FromAlchemyNetwork(alchemyNetwork string) string {
	if alchemyAdapter != nil {
		return alchemyAdapter.FromProviderNetwork(alchemyNetwork)
	}
	return alchemyNetwork
}

// GetTokenBalancesByAddress queries token balances for multiple addresses across networks
func (c *AlchemyClient) GetTokenBalancesByAddress(addresses []AlchemyAddressWithNetworks) (*AlchemyTokenBalanceResponse, error) {
	// Convert Internal Network IDs to Alchemy format before sending request
	alchemyAddresses := make([]AlchemyAddressWithNetworks, len(addresses))
	for i, addr := range addresses {
		alchemyNetworks := make([]string, len(addr.Networks))
		for j, network := range addr.Networks {
			alchemyNetworks[j] = ToAlchemyNetwork(network)
		}
		alchemyAddresses[i] = AlchemyAddressWithNetworks{
			Address:  addr.Address,
			Networks: alchemyNetworks,
		}
	}

	// Build request with Alchemy-format network IDs
	requestBody := AlchemyTokenBalanceRequest{
		Addresses: alchemyAddresses,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Construct URL
	url := fmt.Sprintf("%s/%s/assets/tokens/by-address", AlchemyAPIBaseURL, c.apiKey)

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var response AlchemyTokenBalanceResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

// SimplifyTokenBalances converts Alchemy response to simplified format
func SimplifyTokenBalances(alchemyResponse *AlchemyTokenBalanceResponse) []SimplifiedTokenBalance {
	var result []SimplifiedTokenBalance

	for _, token := range alchemyResponse.Data.Tokens {
		// Fix decimals for native tokens (Alchemy returns 0 for native tokens)
		decimals := token.TokenMetadata.Decimals
		if token.TokenAddress == "" && decimals == 0 {
			// Native tokens typically use 18 decimals
			decimals = 18
		}
		
		// Convert raw balance to human-readable format
		balance := formatTokenBalance(token.TokenBalance, decimals)

		// Get USD price and value
		var priceUSD float64
		var usdValue float64
		if len(token.TokenPrices) > 0 {
			for _, price := range token.TokenPrices {
				if price.Currency == "usd" {
					priceUSD, _ = strconv.ParseFloat(price.Value, 64)
					break
				}
			}
		}

		// Calculate USD value
		if balanceFloat, err := strconv.ParseFloat(balance, 64); err == nil {
			usdValue = balanceFloat * priceUSD
		}

		// Convert Alchemy network ID to Internal format for consistent API response
		// This ensures frontend always receives Internal Network IDs (e.g., "arbitrum-mainnet")
		// regardless of which provider returned the data
		internalNetwork := FromAlchemyNetwork(token.Network)

		// Get human-readable network label using Internal Network ID
		networkLabel := getNetworkLabel(internalNetwork)

		result = append(result, SimplifiedTokenBalance{
			Address:      token.Address,
			Network:      internalNetwork, // Return Internal Network ID, not Alchemy format
			NetworkLabel: networkLabel,
			TokenAddress: token.TokenAddress,
			TokenSymbol:  token.TokenMetadata.Symbol,
			TokenName:    token.TokenMetadata.Name,
			TokenLogo:    token.TokenMetadata.Logo,
			Balance:      balance,
			RawBalance:   token.TokenBalance,
			Decimals:     decimals,
			USDValue:     usdValue,
			PriceUSD:     priceUSD,
			Error:        token.Error,
		})
	}

	return result
}

// formatTokenBalance converts raw balance string to human-readable format
func formatTokenBalance(rawBalance string, decimals int) string {
	// Handle hex format (0x prefix)
	var balance *big.Int
	var ok bool
	
	if strings.HasPrefix(rawBalance, "0x") || strings.HasPrefix(rawBalance, "0X") {
		// Parse as hexadecimal (remove 0x prefix)
		balance = new(big.Int)
		_, ok = balance.SetString(rawBalance[2:], 16)
	} else {
		// Parse as decimal
		balance, ok = new(big.Int).SetString(rawBalance, 10)
	}
	
	if !ok {
		return "0"
	}

	// Create divisor (10^decimals)
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)

	// Divide: quotient and remainder
	quotient := new(big.Int).Div(balance, divisor)
	remainder := new(big.Int).Mod(balance, divisor)

	// Format with decimals
	if remainder.Sign() == 0 {
		return quotient.String()
	}

	// Pad remainder with leading zeros
	remainderStr := remainder.String()
	paddingNeeded := decimals - len(remainderStr)
	if paddingNeeded > 0 {
		remainderStr = strings.Repeat("0", paddingNeeded) + remainderStr
	}

	// Trim trailing zeros
	remainderStr = strings.TrimRight(remainderStr, "0")

	if remainderStr == "" {
		return quotient.String()
	}

	return fmt.Sprintf("%s.%s", quotient.String(), remainderStr)
}

// getNetworkLabel converts Internal Network ID to human-readable label
// Delegates to adapter.GetNetworkLabel() for centralized label management
func getNetworkLabel(network string) string {
	return adapter.GetNetworkLabel(network)
}

// AssetTransfer represents a single transfer from Alchemy getAssetTransfers API
type AssetTransfer struct {
	BlockNum        string                 `json:"blockNum"`
	UniqueID        string                 `json:"uniqueId"`
	Hash            string                 `json:"hash"`
	From            string                 `json:"from"`
	To              string                 `json:"to"`
	Value           float64                `json:"value"`
	Asset           string                 `json:"asset"`
	Category        string                 `json:"category"` // "external", "internal", "erc20", "erc721", "erc1155"
	ERC721TokenID   *string                `json:"erc721TokenId,omitempty"`
	ERC1155Metadata []ERC1155MetadataItem  `json:"erc1155Metadata,omitempty"`
	TokenID         *string                `json:"tokenId,omitempty"`
	RawContract     RawContractInfo        `json:"rawContract"`
	Metadata        *TransferMetadataBlock `json:"metadata,omitempty"`
}

// ERC1155MetadataItem represents metadata for ERC1155 transfers
type ERC1155MetadataItem struct {
	TokenID string `json:"tokenId"`
	Value   string `json:"value"`
}

// RawContractInfo contains raw contract information
type RawContractInfo struct {
	Value   string  `json:"value"`
	Address *string `json:"address,omitempty"`
	Decimal string  `json:"decimal"`
}

// TransferMetadataBlock contains block metadata for transfers
type TransferMetadataBlock struct {
	BlockTimestamp string `json:"blockTimestamp"`
}

// AssetTransfersResponse represents the response from alchemy_getAssetTransfers
type AssetTransfersResponse struct {
	Transfers []AssetTransfer `json:"transfers"`
	PageKey   string          `json:"pageKey"`
}

// alchemyRPCRequest represents a JSON-RPC request
type alchemyRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

// alchemyRPCResponse represents a JSON-RPC response
type alchemyRPCResponse struct {
	JSONRPC string                  `json:"jsonrpc"`
	ID      int                     `json:"id"`
	Result  *AssetTransfersResponse `json:"result,omitempty"`
	Error   *alchemyRPCError        `json:"error,omitempty"`
}

// alchemyRPCError represents a JSON-RPC error
type alchemyRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// networkToRPCEndpoint maps Alchemy network identifiers to RPC endpoints
// IMPORTANT: Keys must match Alchemy's network ID format exactly
// Alchemy uses: arb-mainnet (not arbitrum-mainnet), opt-mainnet (not optimism-mainnet)
var networkToRPCEndpoint = map[string]string{
	// Mainnets (using Alchemy's exact network IDs)
	"eth-mainnet":     "https://eth-mainnet.g.alchemy.com/v2",
	"polygon-mainnet": "https://polygon-mainnet.g.alchemy.com/v2",
	"arb-mainnet":     "https://arb-mainnet.g.alchemy.com/v2",  // Arbitrum
	"opt-mainnet":     "https://opt-mainnet.g.alchemy.com/v2",  // Optimism
	"base-mainnet":    "https://base-mainnet.g.alchemy.com/v2",
	"bnb-mainnet":     "https://bnb-mainnet.g.alchemy.com/v2",
	// Testnets
	"eth-sepolia":  "https://eth-sepolia.g.alchemy.com/v2",
	"polygon-amoy": "https://polygon-amoy.g.alchemy.com/v2",
	"arb-sepolia":  "https://arb-sepolia.g.alchemy.com/v2", // Arbitrum Sepolia
	"opt-sepolia":  "https://opt-sepolia.g.alchemy.com/v2", // Optimism Sepolia
	"base-sepolia": "https://base-sepolia.g.alchemy.com/v2",
}

// getCategoriesForNetwork returns the appropriate transfer categories based on network.
// Delegates to the centralized GetTransferCategoriesForNetwork in chains.go
// See: https://docs.alchemy.com/reference/alchemy-getassettransfers
func getCategoriesForNetwork(network string) []string {
	return GetTransferCategoriesForNetwork(network)
}

// GetAssetTransfers queries transaction history for an address using Alchemy API
// Supports Ethereum, Polygon, Arbitrum, Optimism, Base
// Note: BSC requires NodeReal/BSCTrace provider - handled in exports.go
func (c *AlchemyClient) GetAssetTransfers(address, network string, maxCount int, pageKey string) ([]AssetTransfer, string, error) {
	// Special handling for BSC - use BSCTrace (NodeReal) API instead of Alchemy
	if network == "bnb-mainnet" || network == NetworkBnbMainnet {
		return nil, "", fmt.Errorf("BSC network requires BSCTrace provider - use GetAssetTransfersBSC directly")
	}

	// Convert Internal Network ID to Alchemy format
	alchemyNetwork := ToAlchemyNetwork(network)

	// Get RPC endpoint for Alchemy network
	baseURL, ok := networkToRPCEndpoint[alchemyNetwork]
	if !ok {
		return nil, "", fmt.Errorf("unsupported network: %s (alchemy: %s)", network, alchemyNetwork)
	}

	url := fmt.Sprintf("%s/%s", baseURL, c.apiKey)

	// Build params for alchemy_getAssetTransfers
	// We query both incoming (toAddress) and outgoing (fromAddress) transfers
	// Use network-specific categories to avoid "internal not supported" errors
	params := map[string]interface{}{
		"fromBlock":        "0x0",
		"toBlock":          "latest",
		"withMetadata":     true,
		"excludeZeroValue": true,
		"maxCount":         fmt.Sprintf("0x%x", maxCount),
		"order":            "desc",
		"category":         getCategoriesForNetwork(network),
	}

	if pageKey != "" {
		params["pageKey"] = pageKey
	}

	// Query incoming transfers (to address)
	incomingParams := copyMap(params)
	incomingParams["toAddress"] = address

	incomingTransfers, incomingPageKey, err := c.executeAssetTransfersRequest(url, incomingParams)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get incoming transfers: %w", err)
	}

	// Query outgoing transfers (from address)
	outgoingParams := copyMap(params)
	outgoingParams["fromAddress"] = address

	outgoingTransfers, _, err := c.executeAssetTransfersRequest(url, outgoingParams)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get outgoing transfers: %w", err)
	}

	// Merge and deduplicate transfers
	allTransfers := append(incomingTransfers, outgoingTransfers...)
	uniqueTransfers := deduplicateTransfers(allTransfers)

	// Sort by block number (descending - newest first)
	SortTransfersByBlock(uniqueTransfers)

	// Limit to maxCount
	if len(uniqueTransfers) > maxCount {
		uniqueTransfers = uniqueTransfers[:maxCount]
	}

	return uniqueTransfers, incomingPageKey, nil
}

// executeAssetTransfersRequest executes a single alchemy_getAssetTransfers request
func (c *AlchemyClient) executeAssetTransfersRequest(url string, params map[string]interface{}) ([]AssetTransfer, string, error) {
	// Build JSON-RPC request
	rpcRequest := alchemyRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "alchemy_getAssetTransfers",
		Params:  []interface{}{params},
	}

	jsonData, err := json.Marshal(rpcRequest)
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse JSON-RPC response
	var rpcResponse alchemyRPCResponse
	if err := json.Unmarshal(body, &rpcResponse); err != nil {
		return nil, "", fmt.Errorf("failed to parse response: %w", err)
	}

	// Check for JSON-RPC error
	if rpcResponse.Error != nil {
		return nil, "", fmt.Errorf("API error: %s (code: %d)", rpcResponse.Error.Message, rpcResponse.Error.Code)
	}

	if rpcResponse.Result == nil {
		return []AssetTransfer{}, "", nil
	}

	return rpcResponse.Result.Transfers, rpcResponse.Result.PageKey, nil
}

// copyMap creates a shallow copy of a map
func copyMap(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range m {
		result[k] = v
	}
	return result
}

// deduplicateTransfers removes duplicate transfers based on uniqueId
func deduplicateTransfers(transfers []AssetTransfer) []AssetTransfer {
	seen := make(map[string]bool)
	result := make([]AssetTransfer, 0)

	for _, t := range transfers {
		if !seen[t.UniqueID] {
			seen[t.UniqueID] = true
			result = append(result, t)
		}
	}

	return result
}

// SortTransfersByBlock sorts transfers by block number (descending)
// Exported for use by other packages that need to merge and sort transfers
func SortTransfersByBlock(transfers []AssetTransfer) {
	// Simple bubble sort (good enough for small lists)
	for i := 0; i < len(transfers); i++ {
		for j := i + 1; j < len(transfers); j++ {
			blockI := parseHexToInt(transfers[i].BlockNum)
			blockJ := parseHexToInt(transfers[j].BlockNum)
			if blockJ > blockI {
				transfers[i], transfers[j] = transfers[j], transfers[i]
			}
		}
	}
}

// parseHexToInt parses a hex string to int64
func parseHexToInt(hex string) int64 {
	if len(hex) > 2 && (hex[:2] == "0x" || hex[:2] == "0X") {
		hex = hex[2:]
	}
	val, _ := strconv.ParseInt(hex, 16, 64)
	return val
}
