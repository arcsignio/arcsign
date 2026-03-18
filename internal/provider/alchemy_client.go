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

	"github.com/Jason-chen-taiwan/arcSignv2/internal/provider/adapter"
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

// GetNFTsByAddress queries NFT holdings for multiple addresses across networks
func (c *AlchemyClient) GetNFTsByAddress(addresses []AlchemyAddressWithNetworks) (*AlchemyNFTResponse, error) {
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

	requestBody := AlchemyNFTRequest{
		Addresses: alchemyAddresses,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/%s/assets/nfts/by-address", AlchemyAPIBaseURL, c.apiKey)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var response AlchemyNFTResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

// SimplifyNFTs converts Alchemy NFT response to simplified format
func SimplifyNFTs(alchemyResponse *AlchemyNFTResponse) []SimplifiedNFT {
	var result []SimplifiedNFT

	for _, nft := range alchemyResponse.Data.NFTs {
		// Convert Alchemy network ID to Internal format
		internalNetwork := FromAlchemyNetwork(nft.Network)
		networkLabel := getNetworkLabel(internalNetwork)

		// Pick best available image URL
		imageURL := nft.Image.CachedURL
		if imageURL == "" {
			imageURL = nft.Image.PNGOriginal
		}
		if imageURL == "" {
			imageURL = nft.Image.OriginalURL
		}

		thumbnailURL := nft.Image.ThumbnailURL
		if thumbnailURL == "" {
			thumbnailURL = imageURL
		}

		result = append(result, SimplifiedNFT{
			Address:         nft.Address,
			Network:         internalNetwork,
			NetworkLabel:    networkLabel,
			ContractAddress: nft.ContractAddress,
			TokenID:         nft.TokenID,
			TokenType:       nft.TokenType,
			Name:            nft.Name,
			Description:     nft.Description,
			ImageURL:        imageURL,
			ThumbnailURL:    thumbnailURL,
			CollectionName:  nft.Collection.Name,
			CollectionSlug:  nft.Collection.Slug,
			Balance:         nft.Balance,
		})
	}

	return result
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

// ================================================================================
// Token Approval Queries (eth_getLogs + eth_call)
// ================================================================================

// approvalEventTopic0 is keccak256("Approval(address,address,uint256)")
const approvalEventTopic0 = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"

// genericRPCResponse is a JSON-RPC response with a generic result field
type genericRPCResponse struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      int              `json:"id"`
	Result  json.RawMessage  `json:"result,omitempty"`
	Error   *alchemyRPCError `json:"error,omitempty"`
}

// approvalLogEntry represents a single Approval event log from eth_getLogs
type approvalLogEntry struct {
	Address     string   `json:"address"`     // Token contract address
	Topics      []string `json:"topics"`      // [topic0, owner, spender]
	Data        string   `json:"data"`        // Encoded approval amount
	BlockNumber string   `json:"blockNumber"` // Hex block number
}

// approvalKey uniquely identifies an approval by (token, spender)
type approvalKey struct {
	Token   string
	Spender string
}

// getBlockNumber calls eth_blockNumber to get the latest block number for a chain
func (c *AlchemyClient) getBlockNumber(rpcURL string) (int64, error) {
	rpcRequest := alchemyRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "eth_blockNumber",
		Params:  []interface{}{},
	}

	jsonData, err := json.Marshal(rpcRequest)
	if err != nil {
		return 0, err
	}

	req, err := http.NewRequest("POST", rpcURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	var rpcResp genericRPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return 0, err
	}
	if rpcResp.Error != nil {
		return 0, fmt.Errorf("eth_blockNumber error: %s", rpcResp.Error.Message)
	}

	var hexResult string
	if err := json.Unmarshal(rpcResp.Result, &hexResult); err != nil {
		return 0, err
	}

	blockNum, err := strconv.ParseInt(strings.TrimPrefix(hexResult, "0x"), 16, 64)
	if err != nil {
		return 0, err
	}
	return blockNum, nil
}

// GetApprovalEvents queries all active ERC-20 approvals for an address on a given network.
// It uses eth_getLogs to find Approval events, then eth_call to verify current allowance.
func (c *AlchemyClient) GetApprovalEvents(ownerAddress, network string) ([]ApprovalEntry, error) {
	// Convert Internal Network ID to Alchemy format
	alchemyNetwork := ToAlchemyNetwork(network)

	// Get RPC endpoint
	baseURL, ok := networkToRPCEndpoint[alchemyNetwork]
	if !ok {
		return nil, fmt.Errorf("unsupported network: %s (alchemy: %s)", network, alchemyNetwork)
	}

	url := fmt.Sprintf("%s/%s", baseURL, c.apiKey)
	networkLabel := getNetworkLabel(network)

	// Pad owner address to 32 bytes for topic filter
	cleanOwner := strings.TrimPrefix(strings.ToLower(ownerAddress), "0x")
	ownerTopic := "0x000000000000000000000000" + cleanOwner

	// Step 1: Get current block number and calculate lookback range
	// Querying from block 0 causes "limit exceeded" on most RPC providers
	fromBlock := "0x0"
	latestBlock, err := c.getBlockNumber(url)
	if err == nil && latestBlock > 0 {
		// Lookback periods per chain (approximate blocks for ~1 year):
		// ETH: ~2.6M (12s blocks), Polygon: ~15.7M (2s), BSC: ~10.5M (3s),
		// Arbitrum: ~262M (0.25s L2 blocks), Optimism/Base: ~15.7M (2s)
		var lookback int64
		switch alchemyNetwork {
		case "arb-mainnet":
			lookback = 260_000_000 // Arbitrum: very fast L2 blocks
		case "polygon-mainnet", "opt-mainnet", "base-mainnet":
			lookback = 15_000_000 // ~2s block time chains
		case "bnb-mainnet":
			lookback = 10_000_000 // BSC: ~3s blocks
		default:
			lookback = 2_500_000 // ETH mainnet: ~12s blocks
		}
		start := latestBlock - lookback
		if start < 0 {
			start = 0
		}
		fromBlock = fmt.Sprintf("0x%x", start)
	}

	// Step 2: Query Approval event logs
	logsParams := []interface{}{
		map[string]interface{}{
			"fromBlock": fromBlock,
			"toBlock":   "latest",
			"topics":    []interface{}{approvalEventTopic0, ownerTopic},
		},
	}

	rpcRequest := alchemyRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "eth_getLogs",
		Params:  logsParams,
	}

	jsonData, err := json.Marshal(rpcRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal eth_getLogs request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("eth_getLogs request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("eth_getLogs failed with status %d: %s", resp.StatusCode, string(body))
	}

	var rpcResp genericRPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse eth_getLogs response: %w", err)
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("eth_getLogs error: %s (code: %d)", rpcResp.Error.Message, rpcResp.Error.Code)
	}

	var logs []approvalLogEntry
	if err := json.Unmarshal(rpcResp.Result, &logs); err != nil {
		return nil, fmt.Errorf("failed to parse logs: %w", err)
	}

	// Step 3: Deduplicate by (token, spender), keeping latest
	latestApprovals := make(map[approvalKey]approvalLogEntry)
	for _, log := range logs {
		if len(log.Topics) < 3 {
			continue
		}
		// Extract spender from topic[2] (remove padding)
		spender := "0x" + log.Topics[2][26:]
		key := approvalKey{
			Token:   strings.ToLower(log.Address),
			Spender: strings.ToLower(spender),
		}
		// Later logs overwrite earlier ones (logs are returned in ascending order)
		latestApprovals[key] = log
	}

	if len(latestApprovals) == 0 {
		return []ApprovalEntry{}, nil
	}

	// Step 4: Check current allowance for each (token, spender) pair
	// allowance(address,address) selector: 0xdd62ed3e
	var results []ApprovalEntry
	threshold := new(big.Int).Exp(big.NewInt(2), big.NewInt(128), nil) // 2^128

	for key := range latestApprovals {
		allowance, err := c.ethCallAllowance(url, key.Token, ownerAddress, key.Spender)
		if err != nil {
			continue // skip entries we can't verify
		}

		// Filter out zero allowances (already revoked)
		if allowance.Sign() == 0 {
			continue
		}

		// Get token metadata
		tokenName, tokenSymbol := c.getTokenMetadata(url, key.Token)

		entry := ApprovalEntry{
			TokenAddress: key.Token,
			TokenName:    tokenName,
			TokenSymbol:  tokenSymbol,
			Spender:      key.Spender,
			Allowance:    allowance.String(),
			IsUnlimited:  allowance.Cmp(threshold) >= 0,
			Network:      network,
			NetworkLabel: networkLabel,
			OwnerAddress: ownerAddress,
		}
		results = append(results, entry)
	}

	return results, nil
}

// ethCallAllowance calls allowance(owner, spender) on a token contract
func (c *AlchemyClient) ethCallAllowance(rpcURL, tokenAddress, owner, spender string) (*big.Int, error) {
	// allowance(address,address) selector: 0xdd62ed3e
	cleanOwner := strings.TrimPrefix(strings.ToLower(owner), "0x")
	cleanSpender := strings.TrimPrefix(strings.ToLower(spender), "0x")
	data := "0xdd62ed3e" +
		fmt.Sprintf("%064s", cleanOwner) +
		fmt.Sprintf("%064s", cleanSpender)

	return c.ethCallUint256(rpcURL, tokenAddress, data)
}

// getTokenMetadata retrieves name() and symbol() for a token contract
func (c *AlchemyClient) getTokenMetadata(rpcURL, tokenAddress string) (string, string) {
	// name() selector: 0x06fdde03
	nameResult, err := c.ethCallString(rpcURL, tokenAddress, "0x06fdde03")
	if err != nil {
		nameResult = ""
	}
	// symbol() selector: 0x95d89b41
	symbolResult, err := c.ethCallString(rpcURL, tokenAddress, "0x95d89b41")
	if err != nil {
		symbolResult = ""
	}
	return nameResult, symbolResult
}

// ethCallUint256 makes an eth_call and parses the result as a uint256
func (c *AlchemyClient) ethCallUint256(rpcURL, to, data string) (*big.Int, error) {
	rpcRequest := alchemyRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "eth_call",
		Params: []interface{}{
			map[string]interface{}{"to": to, "data": data},
			"latest",
		},
	}

	jsonData, err := json.Marshal(rpcRequest)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", rpcURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rpcResp genericRPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, err
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("eth_call error: %s", rpcResp.Error.Message)
	}

	var hexResult string
	if err := json.Unmarshal(rpcResp.Result, &hexResult); err != nil {
		return nil, err
	}

	// Parse hex to big.Int
	cleanHex := strings.TrimPrefix(hexResult, "0x")
	if cleanHex == "" || cleanHex == "0" {
		return big.NewInt(0), nil
	}
	result := new(big.Int)
	result.SetString(cleanHex, 16)
	return result, nil
}

// ethCallString makes an eth_call and parses the ABI-encoded result as a string
func (c *AlchemyClient) ethCallString(rpcURL, to, data string) (string, error) {
	rpcRequest := alchemyRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "eth_call",
		Params: []interface{}{
			map[string]interface{}{"to": to, "data": data},
			"latest",
		},
	}

	jsonData, err := json.Marshal(rpcRequest)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", rpcURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var rpcResp genericRPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return "", err
	}
	if rpcResp.Error != nil {
		return "", fmt.Errorf("eth_call error: %s", rpcResp.Error.Message)
	}

	var hexResult string
	if err := json.Unmarshal(rpcResp.Result, &hexResult); err != nil {
		return "", err
	}

	// Decode ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
	cleanHex := strings.TrimPrefix(hexResult, "0x")
	if len(cleanHex) < 128 { // Need at least offset + length
		return "", nil
	}

	// Read string length at bytes 32-64
	lengthHex := cleanHex[64:128]
	length, err := strconv.ParseInt(strings.TrimLeft(lengthHex, "0"), 16, 64)
	if err != nil || length <= 0 || length > 256 {
		return "", nil
	}

	// Read string data starting at byte 64
	dataStart := 128
	dataEnd := dataStart + int(length)*2
	if dataEnd > len(cleanHex) {
		dataEnd = len(cleanHex)
	}
	strData := cleanHex[dataStart:dataEnd]

	// Convert hex to bytes to string
	var strBytes []byte
	for i := 0; i < len(strData)-1; i += 2 {
		b, err := strconv.ParseUint(strData[i:i+2], 16, 8)
		if err != nil {
			break
		}
		if b == 0 {
			break
		}
		strBytes = append(strBytes, byte(b))
	}

	return string(strBytes), nil
}
