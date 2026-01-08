/**
 * BSCTrace API client for BSC transaction history
 * Provider: NodeReal MegaNode (https://nodereal.io/meganode)
 *
 * BSCTrace is the official replacement for deprecated BscScan API
 * Uses JSON-RPC 2.0 format with nr_getAssetTransfers method
 *
 * Free Tier: 100M CU/month, 300 req/sec
 * nr_getAssetTransfers: 250 CU/request = ~400K queries/month
 *
 * Docs: https://docs.nodereal.io/reference/nr_getassettransfers
 *
 * Network ID Conversion:
 * Uses adapter.NodeRealAdapter for converting between Internal and NodeReal formats.
 * All API responses are normalized to Internal Network IDs before returning.
 */

package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/yourusername/arcsign/internal/provider/adapter"
)

// Constants are now defined in adapter/nodereal.go
// Re-export for backward compatibility
const (
	BSCTraceBaseURL   = adapter.NodeRealBaseURL
	BSCTracePublicKey = adapter.NodeRealPublicKey
)

// BSCTraceClient handles communication with NodeReal BSCTrace API
type BSCTraceClient struct {
	httpClient *http.Client
	endpoint   string
}

// ================================================================================
// NODEREAL/BSCTRACE NETWORK ADAPTER (Delegated to adapter package)
// ================================================================================

// nodeRealAdapter is a cached reference to the NodeReal adapter
var nodeRealAdapter = adapter.Get("nodereal")

// ToNodeRealNetwork converts Internal Network ID to NodeReal's format
// Delegates to adapter.NodeRealAdapter.ToProviderNetwork()
func ToNodeRealNetwork(internalNetwork string) string {
	if nodeRealAdapter != nil {
		return nodeRealAdapter.ToProviderNetwork(internalNetwork)
	}
	return internalNetwork
}

// FromNodeRealNetwork converts NodeReal's format back to Internal Network ID
// Delegates to adapter.NodeRealAdapter.FromProviderNetwork()
func FromNodeRealNetwork(nodeRealNetwork string) string {
	if nodeRealAdapter != nil {
		return nodeRealAdapter.FromProviderNetwork(nodeRealNetwork)
	}
	return nodeRealNetwork
}

// GetNodeRealRPCEndpoint returns the RPC endpoint for a given Internal Network ID
// Delegates to adapter.NodeRealAdapter.GetRPCEndpoint()
func GetNodeRealRPCEndpoint(internalNetwork string, apiKey string) string {
	if nodeRealAdapter != nil {
		return nodeRealAdapter.GetRPCEndpoint(internalNetwork, apiKey)
	}
	return ""
}

// GetNodeRealSupportedNetworks returns all networks supported by NodeReal/BSCTrace
// Delegates to adapter.NodeRealAdapter.SupportedNetworks()
func GetNodeRealSupportedNetworks() []string {
	if nodeRealAdapter != nil {
		return nodeRealAdapter.SupportedNetworks()
	}
	return []string{}
}

// IsNodeRealNetwork checks if a network is supported by NodeReal/BSCTrace
// Delegates to adapter.NodeRealAdapter.IsSupported()
func IsNodeRealNetwork(network string) bool {
	if nodeRealAdapter != nil {
		normalized := NormalizeToInternalNetwork(network)
		return nodeRealAdapter.IsSupported(normalized)
	}
	return false
}

// NewBSCTraceClient creates a new BSCTrace API client
func NewBSCTraceClient(apiKey string) *BSCTraceClient {
	key := apiKey
	if key == "" {
		key = BSCTracePublicKey
	}
	return &BSCTraceClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		endpoint: fmt.Sprintf("%s/%s", BSCTraceBaseURL, key),
	}
}

// JSON-RPC request/response structures
type jsonRPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// nr_getAssetTransfers request parameters
type assetTransfersParams struct {
	Category          []string `json:"category"`
	FromAddress       string   `json:"fromAddress,omitempty"`
	ToAddress         string   `json:"toAddress,omitempty"`
	FromBlock         string   `json:"fromBlock,omitempty"`
	ToBlock           string   `json:"toBlock,omitempty"`
	ContractAddresses []string `json:"contractAddresses,omitempty"`
	Order             string   `json:"order,omitempty"`
	MaxCount          string   `json:"maxCount,omitempty"`
	PageKey           string   `json:"pageKey,omitempty"`
	ExcludeZeroValue  bool     `json:"excludeZeroValue"`
}

// nr_getAssetTransfers response
type assetTransfersResult struct {
	Transfers []bscTraceTransfer `json:"transfers"`
	PageKey   string             `json:"pageKey,omitempty"`
}

// Single transfer from BSCTrace
type bscTraceTransfer struct {
	BlockNum        string               `json:"blockNum"`
	Hash            string               `json:"hash"`
	From            string               `json:"from"`
	To              string               `json:"to"`
	Value           string               `json:"value"`
	Asset           string               `json:"asset"`
	Category        string               `json:"category"` // "external", "20", "721", "1155"
	UniqueID        string               `json:"uniqueId,omitempty"`
	RawContract     bscTraceRawContract  `json:"rawContract"`
	TokenID         string               `json:"tokenId,omitempty"`
	ERC721TokenID   string               `json:"erc721TokenId,omitempty"`
	ERC1155Metadata []bscTraceERC1155    `json:"erc1155Metadata,omitempty"`
	Metadata        *bscTraceMetadata    `json:"metadata,omitempty"`
}

type bscTraceRawContract struct {
	Value    string `json:"value"`
	Address  string `json:"address,omitempty"`
	Decimals string `json:"decimals,omitempty"`
}

type bscTraceERC1155 struct {
	TokenID string `json:"tokenId"`
	Value   string `json:"value"`
}

type bscTraceMetadata struct {
	BlockTimestamp string `json:"blockTimestamp"`
}

// GetAssetTransfersBSC fetches transaction history using BSCTrace nr_getAssetTransfers
func (c *BSCTraceClient) GetAssetTransfersBSC(address string, maxCount int, pageKey string) ([]AssetTransfer, string, error) {
	var allTransfers []AssetTransfer

	// Query incoming transfers (to address)
	// Note: Don't specify FromBlock/ToBlock - let API use defaults to avoid
	// "from must be less than to" error with 0x0 and latest
	inParams := assetTransfersParams{
		Category:         []string{"external", "internal", "20", "721", "1155"},
		ToAddress:        address,
		Order:            "desc",
		MaxCount:         fmt.Sprintf("0x%x", maxCount),
		ExcludeZeroValue: true,
	}
	if pageKey != "" {
		inParams.PageKey = pageKey
	}

	inResult, err := c.callAssetTransfers(inParams)
	if err != nil {
		fmt.Printf("BSCTrace: Failed to get incoming transfers: %v\n", err)
	} else {
		for _, t := range inResult.Transfers {
			allTransfers = append(allTransfers, c.convertToAssetTransfer(t))
		}
	}

	// Query outgoing transfers (from address)
	outParams := assetTransfersParams{
		Category:         []string{"external", "internal", "20", "721", "1155"},
		FromAddress:      address,
		Order:            "desc",
		MaxCount:         fmt.Sprintf("0x%x", maxCount),
		ExcludeZeroValue: true,
	}

	outResult, err := c.callAssetTransfers(outParams)
	if err != nil {
		fmt.Printf("BSCTrace: Failed to get outgoing transfers: %v\n", err)
	} else {
		for _, t := range outResult.Transfers {
			allTransfers = append(allTransfers, c.convertToAssetTransfer(t))
		}
	}

	// Deduplicate and sort
	allTransfers = deduplicateTransfers(allTransfers)
	SortTransfersByBlock(allTransfers)

	// Limit results
	if len(allTransfers) > maxCount {
		allTransfers = allTransfers[:maxCount]
	}

	// Get next page key from incoming result
	nextPageKey := ""
	if inResult != nil && inResult.PageKey != "" {
		nextPageKey = inResult.PageKey
	}

	return allTransfers, nextPageKey, nil
}

// callAssetTransfers makes the JSON-RPC call to nr_getAssetTransfers
func (c *BSCTraceClient) callAssetTransfers(params assetTransfersParams) (*assetTransfersResult, error) {
	// Build JSON-RPC request
	rpcReq := jsonRPCRequest{
		JSONRPC: "2.0",
		Method:  "nr_getAssetTransfers",
		Params:  []interface{}{params},
		ID:      1,
	}

	jsonData, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request
	req, err := http.NewRequest("POST", c.endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse JSON-RPC response
	var rpcResp jsonRPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Check for RPC error
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("BSCTrace RPC error (%d): %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	// Parse result
	var result assetTransfersResult
	if err := json.Unmarshal(rpcResp.Result, &result); err != nil {
		return nil, fmt.Errorf("failed to parse transfers result: %w", err)
	}

	return &result, nil
}

// convertToAssetTransfer converts BSCTrace transfer to Alchemy-compatible format
func (c *BSCTraceClient) convertToAssetTransfer(t bscTraceTransfer) AssetTransfer {
	// Convert category from BSCTrace format to Alchemy format
	category := t.Category
	switch category {
	case "20":
		category = "erc20"
	case "721":
		category = "erc721"
	case "1155":
		category = "erc1155"
	}

	// Parse value
	value := parseValueToFloat(t.Value, t.RawContract.Decimals)

	// Get asset symbol
	asset := t.Asset
	if asset == "" {
		asset = "BNB"
	}

	// Generate unique ID if not provided
	uniqueID := t.UniqueID
	if uniqueID == "" {
		uniqueID = fmt.Sprintf("%s-%s-%s", t.Hash, category, t.RawContract.Address)
	}

	// Get timestamp
	var metadata *TransferMetadataBlock
	if t.Metadata != nil && t.Metadata.BlockTimestamp != "" {
		metadata = &TransferMetadataBlock{
			BlockTimestamp: t.Metadata.BlockTimestamp,
		}
	}

	// Handle contract address
	var contractAddr *string
	if t.RawContract.Address != "" {
		contractAddr = &t.RawContract.Address
	}

	// Handle ERC721 token ID
	var erc721TokenID *string
	if t.ERC721TokenID != "" {
		erc721TokenID = &t.ERC721TokenID
	} else if t.TokenID != "" {
		erc721TokenID = &t.TokenID
	}

	// Handle ERC1155 metadata
	var erc1155Metadata []ERC1155MetadataItem
	for _, m := range t.ERC1155Metadata {
		erc1155Metadata = append(erc1155Metadata, ERC1155MetadataItem{
			TokenID: m.TokenID,
			Value:   m.Value,
		})
	}

	return AssetTransfer{
		BlockNum:        t.BlockNum,
		UniqueID:        uniqueID,
		Hash:            t.Hash,
		From:            t.From,
		To:              t.To,
		Value:           value,
		Asset:           asset,
		Category:        category,
		ERC721TokenID:   erc721TokenID,
		ERC1155Metadata: erc1155Metadata,
		RawContract: RawContractInfo{
			Value:   t.RawContract.Value,
			Address: contractAddr,
			Decimal: t.RawContract.Decimals,
		},
		Metadata: metadata,
	}
}

// parseValueToFloat converts hex or decimal value string to float
func parseValueToFloat(valueStr, decimalsStr string) float64 {
	if valueStr == "" || valueStr == "0x0" || valueStr == "0" {
		return 0
	}

	// Parse decimals (default 18 for BNB)
	decimals := 18
	if decimalsStr != "" {
		if d, err := strconv.Atoi(decimalsStr); err == nil {
			decimals = d
		}
	}

	// Parse value (can be hex or decimal)
	var valueFloat float64
	valueStr = strings.TrimPrefix(strings.TrimPrefix(valueStr, "0x"), "0X")

	// Try hex first
	if valInt, err := strconv.ParseUint(valueStr, 16, 64); err == nil {
		valueFloat = float64(valInt)
	} else if valFloat64, err := strconv.ParseFloat(valueStr, 64); err == nil {
		// Fallback to decimal
		valueFloat = valFloat64
	}

	// Divide by 10^decimals
	divisor := 1.0
	for i := 0; i < decimals; i++ {
		divisor *= 10
	}

	return valueFloat / divisor
}
