// Package alchemy implements BlockchainProvider for Alchemy service
package alchemy

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/yourusername/arcsign/internal/provider"
)

// AlchemyProvider implements BlockchainProvider for Alchemy API
type AlchemyProvider struct {
	apiKey     string
	httpClient *http.Client
	baseURL    string
	chainID    string
	networkID  string
}

// Alchemy network endpoint mapping
var alchemyNetworks = map[string]string{
	"ethereum-mainnet":  "https://eth-mainnet.g.alchemy.com/v2",
	"ethereum-sepolia":  "https://eth-sepolia.g.alchemy.com/v2",
	"ethereum-goerli":   "https://eth-goerli.g.alchemy.com/v2",
	"polygon-mainnet":   "https://polygon-mainnet.g.alchemy.com/v2",
	"polygon-mumbai":    "https://polygon-mumbai.g.alchemy.com/v2",
	"arbitrum-mainnet":  "https://arb-mainnet.g.alchemy.com/v2",
	"arbitrum-sepolia":  "https://arb-sepolia.g.alchemy.com/v2",
	"optimism-mainnet":  "https://opt-mainnet.g.alchemy.com/v2",
	"optimism-sepolia":  "https://opt-sepolia.g.alchemy.com/v2",
	"base-mainnet":      "https://base-mainnet.g.alchemy.com/v2",
	"base-sepolia":      "https://base-sepolia.g.alchemy.com/v2",
}

// NewAlchemyProvider creates a new Alchemy provider instance
func NewAlchemyProvider(config *provider.ProviderConfig) (provider.BlockchainProvider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("alchemy API key is required")
	}

	// Determine base URL
	var baseURL string
	if config.CustomEndpoint != "" {
		baseURL = config.CustomEndpoint
	} else {
		// Construct network key
		networkKey := config.ChainID
		if config.NetworkID != "" {
			networkKey = config.ChainID + "-" + config.NetworkID
		}

		var ok bool
		baseURL, ok = alchemyNetworks[networkKey]
		if !ok {
			return nil, fmt.Errorf("unsupported alchemy network: %s", networkKey)
		}
	}

	return &AlchemyProvider{
		apiKey:  config.APIKey,
		baseURL: baseURL,
		chainID: config.ChainID,
		networkID: config.NetworkID,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// ProviderName returns "alchemy"
func (a *AlchemyProvider) ProviderName() string {
	return "alchemy"
}

// SupportedChains returns chains supported by Alchemy
func (a *AlchemyProvider) SupportedChains() []string {
	return []string{"ethereum", "polygon", "arbitrum", "optimism", "base"}
}

// --- JSON-RPC Helper Methods ---

// rpcCall performs a JSON-RPC call to Alchemy
func (a *AlchemyProvider) rpcCall(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	// Build request URL
	url := fmt.Sprintf("%s/%s", a.baseURL, a.apiKey)

	// Build JSON-RPC request
	reqBody := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	}

	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(reqJSON)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Execute request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, provider.NewProviderError("RPC_ERROR", fmt.Sprintf("RPC call failed: %v", err), "alchemy", true, err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return nil, provider.NewProviderError("HTTP_ERROR", fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body)), "alchemy", resp.StatusCode >= 500, nil)
	}

	// Parse JSON-RPC response
	var rpcResp struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      int             `json:"id"`
		Result  json.RawMessage `json:"result,omitempty"`
		Error   *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Check for JSON-RPC error
	if rpcResp.Error != nil {
		retryable := rpcResp.Error.Code >= -32000 && rpcResp.Error.Code < -32099 // Server errors are retryable
		return nil, provider.NewProviderError("RPC_ERROR", rpcResp.Error.Message, "alchemy", retryable, nil)
	}

	return rpcResp.Result, nil
}

// --- Account & Balance Operations ---

// GetBalance retrieves native token balance
func (a *AlchemyProvider) GetBalance(ctx context.Context, chainID, address string) (*big.Int, error) {
	if chainID != a.chainID {
		return nil, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_getBalance", []interface{}{address, "latest"})
	if err != nil {
		return nil, err
	}

	var balanceHex string
	if err := json.Unmarshal(result, &balanceHex); err != nil {
		return nil, fmt.Errorf("failed to parse balance: %w", err)
	}

	balance := new(big.Int)
	balance.SetString(balanceHex[2:], 16) // Remove 0x prefix
	return balance, nil
}

// GetTokenBalance retrieves ERC-20 token balance
func (a *AlchemyProvider) GetTokenBalance(ctx context.Context, chainID, address, tokenContract string) (*big.Int, error) {
	if chainID != a.chainID {
		return nil, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	// ERC-20 balanceOf function signature: 0x70a08231
	// Encode parameter: address (padded to 32 bytes)
	data := fmt.Sprintf("0x70a08231%064s", address[2:]) // Remove 0x and pad

	params := []interface{}{
		map[string]string{
			"to":   tokenContract,
			"data": data,
		},
		"latest",
	}

	result, err := a.rpcCall(ctx, "eth_call", params)
	if err != nil {
		return nil, err
	}

	var balanceHex string
	if err := json.Unmarshal(result, &balanceHex); err != nil {
		return nil, fmt.Errorf("failed to parse token balance: %w", err)
	}

	balance := new(big.Int)
	balance.SetString(balanceHex[2:], 16) // Remove 0x prefix
	return balance, nil
}

// GetTransactionCount retrieves account nonce
func (a *AlchemyProvider) GetTransactionCount(ctx context.Context, chainID, address string) (uint64, error) {
	if chainID != a.chainID {
		return 0, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_getTransactionCount", []interface{}{address, "latest"})
	if err != nil {
		return 0, err
	}

	var nonceHex string
	if err := json.Unmarshal(result, &nonceHex); err != nil {
		return 0, fmt.Errorf("failed to parse nonce: %w", err)
	}

	nonce := new(big.Int)
	nonce.SetString(nonceHex[2:], 16)
	return nonce.Uint64(), nil
}

// --- Fee Estimation ---

// EstimateGas estimates gas for a transaction
func (a *AlchemyProvider) EstimateGas(ctx context.Context, chainID, from, to string, value *big.Int, data []byte) (uint64, error) {
	if chainID != a.chainID {
		return 0, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	params := map[string]interface{}{
		"from": from,
		"to":   to,
	}

	if value != nil && value.Sign() > 0 {
		params["value"] = fmt.Sprintf("0x%x", value)
	}

	if len(data) > 0 {
		params["data"] = fmt.Sprintf("0x%x", data)
	}

	result, err := a.rpcCall(ctx, "eth_estimateGas", []interface{}{params})
	if err != nil {
		return 0, err
	}

	var gasHex string
	if err := json.Unmarshal(result, &gasHex); err != nil {
		return 0, fmt.Errorf("failed to parse gas estimate: %w", err)
	}

	gas := new(big.Int)
	gas.SetString(gasHex[2:], 16)
	return gas.Uint64(), nil
}

// GetBaseFee retrieves current base fee (EIP-1559)
func (a *AlchemyProvider) GetBaseFee(ctx context.Context, chainID string) (*big.Int, error) {
	if chainID != a.chainID {
		return nil, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_getBlockByNumber", []interface{}{"latest", false})
	if err != nil {
		return nil, err
	}

	var block struct {
		BaseFeePerGas string `json:"baseFeePerGas"`
	}

	if err := json.Unmarshal(result, &block); err != nil {
		return nil, fmt.Errorf("failed to parse block: %w", err)
	}

	if block.BaseFeePerGas == "" {
		return nil, fmt.Errorf("baseFeePerGas not available (pre-EIP1559 chain)")
	}

	baseFee := new(big.Int)
	baseFee.SetString(block.BaseFeePerGas[2:], 16)
	return baseFee, nil
}

// GetFeeHistory retrieves fee history for priority fee estimation
func (a *AlchemyProvider) GetFeeHistory(ctx context.Context, chainID string, blockCount int) (*big.Int, error) {
	if chainID != a.chainID {
		return nil, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_feeHistory", []interface{}{
		fmt.Sprintf("0x%x", blockCount),
		"latest",
		[]int{50}, // 50th percentile
	})
	if err != nil {
		return nil, err
	}

	var feeHistory struct {
		Reward [][]string `json:"reward"`
	}

	if err := json.Unmarshal(result, &feeHistory); err != nil {
		return nil, fmt.Errorf("failed to parse fee history: %w", err)
	}

	if len(feeHistory.Reward) == 0 || len(feeHistory.Reward[0]) == 0 {
		return big.NewInt(2e9), nil // Default 2 Gwei
	}

	// Calculate average from recent blocks
	total := new(big.Int)
	count := 0
	for _, rewards := range feeHistory.Reward {
		if len(rewards) > 0 {
			reward := new(big.Int)
			reward.SetString(rewards[0][2:], 16) // Remove 0x
			total.Add(total, reward)
			count++
		}
	}

	if count == 0 {
		return big.NewInt(2e9), nil
	}

	avg := new(big.Int).Div(total, big.NewInt(int64(count)))
	return avg, nil
}

// EstimateBitcoinFee is not supported by Alchemy (EVM-only)
func (a *AlchemyProvider) EstimateBitcoinFee(ctx context.Context, chainID string, targetBlocks int) (int64, error) {
	return 0, fmt.Errorf("bitcoin fee estimation not supported by Alchemy")
}

// --- Transaction Operations ---

// SendRawTransaction broadcasts a signed transaction
func (a *AlchemyProvider) SendRawTransaction(ctx context.Context, chainID, rawTx string) (string, error) {
	if chainID != a.chainID {
		return "", fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_sendRawTransaction", []interface{}{rawTx})
	if err != nil {
		return "", err
	}

	var txHash string
	if err := json.Unmarshal(result, &txHash); err != nil {
		return "", fmt.Errorf("failed to parse tx hash: %w", err)
	}

	return txHash, nil
}

// GetTransactionByHash retrieves transaction details
func (a *AlchemyProvider) GetTransactionByHash(ctx context.Context, chainID, txHash string) (*provider.TransactionInfo, error) {
	if chainID != a.chainID {
		return nil, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_getTransactionByHash", []interface{}{txHash})
	if err != nil {
		return nil, err
	}

	// Check if transaction exists
	if string(result) == "null" {
		return nil, fmt.Errorf("transaction not found")
	}

	var tx struct {
		Hash        string `json:"hash"`
		From        string `json:"from"`
		To          string `json:"to"`
		Value       string `json:"value"`
		BlockNumber string `json:"blockNumber"`
		BlockHash   string `json:"blockHash"`
		Nonce       string `json:"nonce"`
		GasPrice    string `json:"gasPrice"`
		Gas         string `json:"gas"`
		Input       string `json:"input"`
	}

	if err := json.Unmarshal(result, &tx); err != nil {
		return nil, fmt.Errorf("failed to parse transaction: %w", err)
	}

	// Parse values
	value := new(big.Int)
	if tx.Value != "" {
		value.SetString(tx.Value[2:], 16)
	}

	var blockNumber *uint64
	if tx.BlockNumber != "" && tx.BlockNumber != "null" {
		bn := new(big.Int)
		bn.SetString(tx.BlockNumber[2:], 16)
		bnUint := bn.Uint64()
		blockNumber = &bnUint
	}

	var blockHash *string
	if tx.BlockHash != "" && tx.BlockHash != "null" {
		blockHash = &tx.BlockHash
	}

	var nonce *uint64
	if tx.Nonce != "" {
		n := new(big.Int)
		n.SetString(tx.Nonce[2:], 16)
		nUint := n.Uint64()
		nonce = &nUint
	}

	var gasPrice *big.Int
	if tx.GasPrice != "" {
		gasPrice = new(big.Int)
		gasPrice.SetString(tx.GasPrice[2:], 16)
	}

	var gasLimit *uint64
	if tx.Gas != "" {
		g := new(big.Int)
		g.SetString(tx.Gas[2:], 16)
		gUint := g.Uint64()
		gasLimit = &gUint
	}

	status := "pending"
	if blockNumber != nil {
		status = "confirmed"
	}

	return &provider.TransactionInfo{
		Hash:        tx.Hash,
		From:        tx.From,
		To:          tx.To,
		Value:       value,
		BlockNumber: blockNumber,
		BlockHash:   blockHash,
		Status:      status,
		Nonce:       nonce,
		GasPrice:    gasPrice,
		GasLimit:    gasLimit,
		Data:        []byte(tx.Input),
	}, nil
}

// GetTransactionReceipt retrieves transaction receipt
func (a *AlchemyProvider) GetTransactionReceipt(ctx context.Context, chainID, txHash string) (*provider.TransactionReceipt, error) {
	if chainID != a.chainID {
		return nil, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_getTransactionReceipt", []interface{}{txHash})
	if err != nil {
		return nil, err
	}

	// Check if receipt exists
	if string(result) == "null" {
		return nil, nil // Receipt not available yet (transaction pending)
	}

	var receipt provider.TransactionReceipt
	if err := json.Unmarshal(result, &receipt); err != nil {
		return nil, fmt.Errorf("failed to parse receipt: %w", err)
	}

	return &receipt, nil
}

// --- Block & Network Info ---

// GetBlockNumber retrieves latest block number
func (a *AlchemyProvider) GetBlockNumber(ctx context.Context, chainID string) (uint64, error) {
	if chainID != a.chainID {
		return 0, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_blockNumber", []interface{}{})
	if err != nil {
		return 0, err
	}

	var blockHex string
	if err := json.Unmarshal(result, &blockHex); err != nil {
		return 0, fmt.Errorf("failed to parse block number: %w", err)
	}

	blockNum := new(big.Int)
	blockNum.SetString(blockHex[2:], 16)
	return blockNum.Uint64(), nil
}

// GetBlock retrieves block details
func (a *AlchemyProvider) GetBlock(ctx context.Context, chainID, blockIdentifier string) (*provider.BlockInfo, error) {
	if chainID != a.chainID {
		return nil, fmt.Errorf("chain mismatch: provider for %s, requested %s", a.chainID, chainID)
	}

	result, err := a.rpcCall(ctx, "eth_getBlockByNumber", []interface{}{blockIdentifier, false})
	if err != nil {
		return nil, err
	}

	var block struct {
		Number       string   `json:"number"`
		Hash         string   `json:"hash"`
		ParentHash   string   `json:"parentHash"`
		Timestamp    string   `json:"timestamp"`
		Transactions []string `json:"transactions"`
	}

	if err := json.Unmarshal(result, &block); err != nil {
		return nil, fmt.Errorf("failed to parse block: %w", err)
	}

	blockNum := new(big.Int)
	blockNum.SetString(block.Number[2:], 16)

	timestamp := new(big.Int)
	timestamp.SetString(block.Timestamp[2:], 16)

	return &provider.BlockInfo{
		Number:       blockNum.Uint64(),
		Hash:         block.Hash,
		ParentHash:   block.ParentHash,
		Timestamp:    timestamp.Uint64(),
		Transactions: block.Transactions,
	}, nil
}

// --- UTXO Operations (Not Supported) ---

// ListUnspent is not supported by Alchemy (EVM-only)
func (a *AlchemyProvider) ListUnspent(ctx context.Context, chainID, address string) ([]*provider.UTXO, error) {
	return nil, fmt.Errorf("UTXO operations not supported by Alchemy (EVM chains only)")
}

// GetRawTransaction is not supported by Alchemy (EVM-only)
func (a *AlchemyProvider) GetRawTransaction(ctx context.Context, chainID, txHash string, verbose bool) (*provider.BitcoinTransaction, error) {
	return nil, fmt.Errorf("Bitcoin operations not supported by Alchemy (EVM chains only)")
}

// --- Health & Diagnostics ---

// HealthCheck verifies Alchemy connectivity
func (a *AlchemyProvider) HealthCheck(ctx context.Context) error {
	// Simple health check: get latest block number
	_, err := a.GetBlockNumber(ctx, a.chainID)
	if err != nil {
		return fmt.Errorf("alchemy health check failed: %w", err)
	}
	return nil
}

// Close releases resources
func (a *AlchemyProvider) Close() error {
	// HTTP client doesn't need explicit cleanup
	return nil
}
