// Package openocean provides a client for the OpenOcean DEX aggregator API
// OpenOcean is a FREE API that requires no API key or KYC verification
package openocean

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// BaseURL for OpenOcean API v4
	BaseURL = "https://open-api.openocean.finance/v4"

	// DefaultTimeout for HTTP requests
	DefaultTimeout = 30 * time.Second

	// QuoteValidDuration is how long a quote is considered valid
	QuoteValidDuration = 30 * time.Second

	// Native token address (ETH, BNB, MATIC, etc.)
	NativeTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
)

// Supported chains mapping chainID to OpenOcean chain name
var SupportedChains = map[int]string{
	1:     "eth",
	56:    "bsc",
	137:   "polygon",
	42161: "arbitrum",
	10:    "optimism",
	8453:  "base",
	43114: "avax",
	250:   "fantom",
}

// ChainNames for display
var ChainNames = map[int]string{
	1:     "Ethereum",
	56:    "BNB Chain",
	137:   "Polygon",
	42161: "Arbitrum",
	10:    "Optimism",
	8453:  "Base",
	43114: "Avalanche",
	250:   "Fantom",
}

// Client is the OpenOcean API client
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new OpenOcean API client (no API key required!)
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
		baseURL: BaseURL,
	}
}

// IsChainSupported checks if a chain is supported by OpenOcean
func IsChainSupported(chainID int) bool {
	_, ok := SupportedChains[chainID]
	return ok
}

// GetChainName returns the OpenOcean chain name for a chainID
func GetChainName(chainID int) string {
	return SupportedChains[chainID]
}

// doRequest performs an HTTP request
func (c *Client) doRequest(ctx context.Context, method, urlStr string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check for API errors
	if resp.StatusCode != http.StatusOK {
		var apiErr APIError
		if json.Unmarshal(body, &apiErr) == nil && apiErr.Error != "" {
			return nil, fmt.Errorf("OpenOcean API error (%d): %s", resp.StatusCode, apiErr.Error)
		}
		return nil, fmt.Errorf("OpenOcean API error (%d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// GetQuote fetches a swap quote
func (c *Client) GetQuote(ctx context.Context, req *QuoteRequest) (*QuoteResponse, error) {
	chainName, ok := SupportedChains[req.ChainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %d", req.ChainID)
	}

	// Build URL
	// Note: OpenOcean v4 API uses:
	// - amountDecimals (not amount) for the input amount in smallest unit
	// - gasPrice in gwei (not wei)
	urlStr := fmt.Sprintf("%s/%s/quote", c.baseURL, chainName)
	params := url.Values{}
	params.Set("inTokenAddress", req.FromTokenAddress)
	params.Set("outTokenAddress", req.ToTokenAddress)
	params.Set("amountDecimals", req.Amount.String()) // Use amountDecimals instead of amount
	// Convert gasPrice from wei to gwei (divide by 1e9)
	gasPriceGwei := new(big.Int).Div(req.GasPrice, big.NewInt(1e9))
	params.Set("gasPrice", gasPriceGwei.String())
	params.Set("slippage", fmt.Sprintf("%.2f", req.Slippage))
	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp APIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse quote response: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("OpenOcean quote error: %s", resp.Error)
	}

	return resp.Data, nil
}

// GetSwap fetches swap transaction data
func (c *Client) GetSwap(ctx context.Context, req *SwapRequest) (*SwapResponse, error) {
	chainName, ok := SupportedChains[req.ChainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %d", req.ChainID)
	}

	// Build URL
	// Note: OpenOcean v4 API uses:
	// - amountDecimals (not amount) for the input amount in smallest unit
	// - gasPrice in gwei (not wei)
	urlStr := fmt.Sprintf("%s/%s/swap", c.baseURL, chainName)
	params := url.Values{}
	params.Set("inTokenAddress", req.FromTokenAddress)
	params.Set("outTokenAddress", req.ToTokenAddress)
	params.Set("amountDecimals", req.Amount.String()) // Use amountDecimals instead of amount
	// Convert gasPrice from wei to gwei (divide by 1e9)
	gasPriceGwei := new(big.Int).Div(req.GasPrice, big.NewInt(1e9))
	params.Set("gasPrice", gasPriceGwei.String())
	params.Set("slippage", fmt.Sprintf("%.2f", req.Slippage))
	params.Set("account", req.FromAddress)

	if req.DisableEstimate {
		params.Set("disableEstimate", "true")
	}

	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp SwapAPIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse swap response: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("OpenOcean swap error: %s", resp.Error)
	}

	return resp.Data, nil
}

// GetTokenList fetches all available tokens for a chain
func (c *Client) GetTokenList(ctx context.Context, chainID int) ([]TokenInfo, error) {
	chainName, ok := SupportedChains[chainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %d", chainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%s/tokenList", c.baseURL, chainName)

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp TokenListResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse token list response: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("OpenOcean token list error: %s", resp.Error)
	}

	return resp.Data, nil
}

// BuildSwapQuote creates a standardized SwapQuote from the raw API response
func (c *Client) BuildSwapQuote(ctx context.Context, req *SwapRequest) (*SwapQuote, error) {
	// Get quote first
	quoteReq := &QuoteRequest{
		FromTokenAddress: req.FromTokenAddress,
		ToTokenAddress:   req.ToTokenAddress,
		Amount:           req.Amount,
		GasPrice:         req.GasPrice,
		Slippage:         req.Slippage,
		ChainID:          req.ChainID,
	}

	quoteResp, err := c.GetQuote(ctx, quoteReq)
	if err != nil {
		return nil, err
	}

	// Calculate exchange rate
	fromAmount := new(big.Float).SetInt(req.Amount)
	toAmount := new(big.Int)
	toAmount.SetString(quoteResp.OutAmount, 10)
	toAmountFloat := new(big.Float).SetInt(toAmount)

	// Adjust for decimals
	fromAmountHuman := new(big.Float).Quo(fromAmount, new(big.Float).SetInt(
		new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(quoteResp.InToken.Decimals)), nil),
	))
	toAmountHuman := new(big.Float).Quo(toAmountFloat, new(big.Float).SetInt(
		new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(quoteResp.OutToken.Decimals)), nil),
	))

	exchangeRate := new(big.Float).Quo(toAmountHuman, fromAmountHuman)
	exchangeRateStr, _ := exchangeRate.Float64()

	// Calculate minimum output with slippage
	slippageFactor := 1.0 - (req.Slippage / 100.0)
	toAmountMinFloat := new(big.Float).Mul(toAmountFloat, big.NewFloat(slippageFactor))
	toAmountMin := new(big.Int)
	toAmountMinFloat.Int(toAmountMin)

	// Calculate gas cost in native token
	estimatedGas, _ := strconv.ParseInt(quoteResp.EstimatedGas, 10, 64)
	gasCost := new(big.Int).Mul(req.GasPrice, big.NewInt(estimatedGas))
	gasCostETH := new(big.Float).Quo(
		new(big.Float).SetInt(gasCost),
		big.NewFloat(1e18),
	)
	gasCostETHStr, _ := gasCostETH.Float64()

	// Extract route
	route := []string{quoteResp.InToken.Symbol}
	route = append(route, quoteResp.OutToken.Symbol)

	// Check if approval is needed (for non-native tokens)
	needsApproval := req.FromTokenAddress != NativeTokenAddress

	// Handle price impact - OpenOcean returns format like "-0.17%"
	// We need to strip the % sign for frontend consistency
	priceImpact := quoteResp.PriceImpact
	if priceImpact == "" || priceImpact == "0" {
		priceImpact = "N/A"
	} else {
		// Remove % suffix if present (e.g., "-0.17%" -> "-0.17")
		priceImpact = strings.TrimSuffix(priceImpact, "%")
	}

	return &SwapQuote{
		Dex: "OpenOcean",
		FromToken: TokenInfo{
			Symbol:   quoteResp.InToken.Symbol,
			Name:     quoteResp.InToken.Name,
			Address:  quoteResp.InToken.Address,
			Decimals: quoteResp.InToken.Decimals,
			LogoURI:  quoteResp.InToken.Icon,
		},
		ToToken: TokenInfo{
			Symbol:   quoteResp.OutToken.Symbol,
			Name:     quoteResp.OutToken.Name,
			Address:  quoteResp.OutToken.Address,
			Decimals: quoteResp.OutToken.Decimals,
			LogoURI:  quoteResp.OutToken.Icon,
		},
		FromAmount:      req.Amount.String(),
		ToAmount:        quoteResp.OutAmount,
		ToAmountMin:     toAmountMin.String(),
		ExchangeRate:    fmt.Sprintf("%.6f", exchangeRateStr),
		PriceImpact:     priceImpact,
		EstimatedGas:    quoteResp.EstimatedGas,
		GasCostETH:      fmt.Sprintf("%.6f", gasCostETHStr),
		Route:           route,
		Protocols:       []string{"OpenOcean"},
		ValidUntil:      time.Now().Add(QuoteValidDuration).Unix(),
		NeedsApproval:   needsApproval,
		ApprovalAddress: quoteResp.To, // Router address
	}, nil
}

// BuildSwapTransaction creates a complete SwapTransaction ready for signing
func (c *Client) BuildSwapTransaction(ctx context.Context, req *SwapRequest) (*SwapTransaction, error) {
	// Get quote
	quote, err := c.BuildSwapQuote(ctx, req)
	if err != nil {
		return nil, err
	}

	// Get swap transaction data
	swapResp, err := c.GetSwap(ctx, req)
	if err != nil {
		return nil, err
	}

	return &SwapTransaction{
		Quote: *quote,
		TxData: TxData{
			From:     swapResp.From,
			To:       swapResp.To,
			Data:     swapResp.Data,
			Value:    swapResp.Value,
			Gas:      swapResp.EstimatedGas,
			GasPrice: swapResp.GasPrice,
		},
		ChainID: req.ChainID,
	}, nil
}

// GetApproveTransaction gets the approval transaction for a token
func (c *Client) GetApproveTransaction(ctx context.Context, chainID int, tokenAddress string, amount *big.Int) (*ApproveResponse, error) {
	chainName, ok := SupportedChains[chainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %d", chainID)
	}

	// Build URL - OpenOcean uses /approve endpoint
	urlStr := fmt.Sprintf("%s/%s/approve", c.baseURL, chainName)
	params := url.Values{}
	params.Set("tokenAddress", tokenAddress)
	if amount != nil {
		params.Set("amount", amount.String())
	}
	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp ApproveAPIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse approve response: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("OpenOcean approve error: %s", resp.Error)
	}

	return resp.Data, nil
}

// GetAllowance checks the current token allowance for OpenOcean router
func (c *Client) GetAllowance(ctx context.Context, chainID int, tokenAddress, walletAddress string) (*big.Int, error) {
	chainName, ok := SupportedChains[chainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %d", chainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%s/allowance", c.baseURL, chainName)
	params := url.Values{}
	params.Set("tokenAddress", tokenAddress)
	params.Set("account", walletAddress)
	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp AllowanceAPIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse allowance response: %w", err)
	}

	if resp.Code != 200 {
		return nil, fmt.Errorf("OpenOcean allowance error: %s", resp.Error)
	}

	allowance := new(big.Int)
	allowance.SetString(resp.Data.Allowance, 10)
	return allowance, nil
}
