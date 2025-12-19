// Package oneinch provides a client for the 1inch DEX aggregator API
package oneinch

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

const (
	// BaseURL for 1inch API v6.0
	BaseURL = "https://api.1inch.dev/swap/v6.0"

	// TokenAPIBase for token search
	TokenAPIBase = "https://api.1inch.dev/token/v1.2"

	// DefaultTimeout for HTTP requests
	DefaultTimeout = 30 * time.Second

	// QuoteValidDuration is how long a quote is considered valid
	QuoteValidDuration = 30 * time.Second

	// Native token address (ETH, MATIC, etc.)
	NativeTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
)

// Supported chain IDs
var SupportedChains = map[int]string{
	1:     "Ethereum",
	137:   "Polygon",
	42161: "Arbitrum",
	10:    "Optimism",
	8453:  "Base",
	56:    "BNB Chain",
}

// 1inch Router addresses per chain
var RouterAddresses = map[int]string{
	1:     "0x111111125421ca6dc452d289314280a0f8842a65", // v6
	137:   "0x111111125421ca6dc452d289314280a0f8842a65",
	42161: "0x111111125421ca6dc452d289314280a0f8842a65",
	10:    "0x111111125421ca6dc452d289314280a0f8842a65",
	8453:  "0x111111125421ca6dc452d289314280a0f8842a65",
	56:    "0x111111125421ca6dc452d289314280a0f8842a65",
}

// Client is the 1inch API client
type Client struct {
	httpClient *http.Client
	apiKey     string
	baseURL    string
}

// NewClient creates a new 1inch API client
func NewClient(apiKey string) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
		apiKey:  apiKey,
		baseURL: BaseURL,
	}
}

// IsChainSupported checks if a chain is supported by 1inch
func IsChainSupported(chainID int) bool {
	_, ok := SupportedChains[chainID]
	return ok
}

// GetRouterAddress returns the 1inch router address for a chain
func GetRouterAddress(chainID int) string {
	return RouterAddresses[chainID]
}

// doRequest performs an HTTP request with API key header
func (c *Client) doRequest(ctx context.Context, method, urlStr string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add API key header
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
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
		var apiErr OneInchError
		if json.Unmarshal(body, &apiErr) == nil && apiErr.Error != "" {
			return nil, fmt.Errorf("1inch API error (%d): %s", resp.StatusCode, apiErr.String())
		}
		return nil, fmt.Errorf("1inch API error (%d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// GetQuote fetches a swap quote without transaction data
func (c *Client) GetQuote(ctx context.Context, req *QuoteRequest) (*QuoteResponse, error) {
	if !IsChainSupported(req.ChainID) {
		return nil, fmt.Errorf("unsupported chain: %d", req.ChainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%d/quote", c.baseURL, req.ChainID)
	params := url.Values{}
	params.Set("src", req.FromTokenAddress)
	params.Set("dst", req.ToTokenAddress)
	params.Set("amount", req.Amount.String())
	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp QuoteResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse quote response: %w", err)
	}

	return &resp, nil
}

// GetSwap fetches swap transaction data
func (c *Client) GetSwap(ctx context.Context, req *SwapRequest) (*SwapResponse, error) {
	if !IsChainSupported(req.ChainID) {
		return nil, fmt.Errorf("unsupported chain: %d", req.ChainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%d/swap", c.baseURL, req.ChainID)
	params := url.Values{}
	params.Set("src", req.FromTokenAddress)
	params.Set("dst", req.ToTokenAddress)
	params.Set("amount", req.Amount.String())
	params.Set("from", req.FromAddress)
	params.Set("slippage", fmt.Sprintf("%.2f", req.Slippage))

	if req.DisableEstimate {
		params.Set("disableEstimate", "true")
	}

	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp SwapResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse swap response: %w", err)
	}

	return &resp, nil
}

// GetApproveTransaction fetches the approve transaction data
func (c *Client) GetApproveTransaction(ctx context.Context, req *ApproveRequest) (*ApproveResponse, error) {
	if !IsChainSupported(req.ChainID) {
		return nil, fmt.Errorf("unsupported chain: %d", req.ChainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%d/approve/transaction", c.baseURL, req.ChainID)
	params := url.Values{}
	params.Set("tokenAddress", req.TokenAddress)

	if req.Amount != nil {
		params.Set("amount", req.Amount.String())
	}
	// If amount is nil, 1inch returns unlimited approval

	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp ApproveResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse approve response: %w", err)
	}

	return &resp, nil
}

// GetAllowance checks the current token allowance for 1inch router
func (c *Client) GetAllowance(ctx context.Context, req *AllowanceRequest) (*big.Int, error) {
	if !IsChainSupported(req.ChainID) {
		return nil, fmt.Errorf("unsupported chain: %d", req.ChainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%d/approve/allowance", c.baseURL, req.ChainID)
	params := url.Values{}
	params.Set("tokenAddress", req.TokenAddress)
	params.Set("walletAddress", req.WalletAddress)
	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr)
	if err != nil {
		return nil, err
	}

	var resp AllowanceResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse allowance response: %w", err)
	}

	allowance := new(big.Int)
	allowance.SetString(resp.Allowance, 10)
	return allowance, nil
}

// BuildSwapQuote creates a standardized SwapQuote from the raw API response
func (c *Client) BuildSwapQuote(ctx context.Context, req *SwapRequest, gasPrice *big.Int) (*SwapQuote, error) {
	// Get quote first
	quoteReq := &QuoteRequest{
		FromTokenAddress: req.FromTokenAddress,
		ToTokenAddress:   req.ToTokenAddress,
		Amount:           req.Amount,
		ChainID:          req.ChainID,
	}

	quoteResp, err := c.GetQuote(ctx, quoteReq)
	if err != nil {
		return nil, err
	}

	// Calculate exchange rate
	fromAmount := new(big.Float).SetInt(req.Amount)
	toAmount := new(big.Int)
	toAmount.SetString(quoteResp.ToTokenAmount, 10)
	toAmountFloat := new(big.Float).SetInt(toAmount)

	// Adjust for decimals
	fromDecimals := new(big.Float).SetFloat64(float64(quoteResp.FromToken.Decimals))
	toDecimals := new(big.Float).SetFloat64(float64(quoteResp.ToToken.Decimals))

	fromAmountHuman := new(big.Float).Quo(fromAmount, new(big.Float).SetInt(
		new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(quoteResp.FromToken.Decimals)), nil),
	))
	toAmountHuman := new(big.Float).Quo(toAmountFloat, new(big.Float).SetInt(
		new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(quoteResp.ToToken.Decimals)), nil),
	))

	_ = fromDecimals // silence unused warning
	_ = toDecimals

	exchangeRate := new(big.Float).Quo(toAmountHuman, fromAmountHuman)
	exchangeRateStr, _ := exchangeRate.Float64()

	// Calculate minimum output with slippage
	slippageFactor := 1.0 - (req.Slippage / 100.0)
	toAmountMinFloat := new(big.Float).Mul(toAmountFloat, big.NewFloat(slippageFactor))
	toAmountMin := new(big.Int)
	toAmountMinFloat.Int(toAmountMin)

	// Calculate gas cost in ETH
	gasCost := new(big.Int).Mul(gasPrice, big.NewInt(quoteResp.EstimatedGas))
	gasCostETH := new(big.Float).Quo(
		new(big.Float).SetInt(gasCost),
		big.NewFloat(1e18),
	)
	gasCostETHStr, _ := gasCostETH.Float64()

	// Extract route and protocols
	var route []string
	var protocols []string
	route = append(route, quoteResp.FromToken.Symbol)

	protocolSet := make(map[string]bool)
	for _, step := range quoteResp.Protocols {
		for _, part := range step {
			if !protocolSet[part.Name] {
				protocols = append(protocols, part.Name)
				protocolSet[part.Name] = true
			}
		}
	}
	route = append(route, quoteResp.ToToken.Symbol)

	// Check if approval is needed (for non-native tokens)
	needsApproval := req.FromTokenAddress != NativeTokenAddress
	if needsApproval {
		allowance, err := c.GetAllowance(ctx, &AllowanceRequest{
			TokenAddress:  req.FromTokenAddress,
			WalletAddress: req.FromAddress,
			ChainID:       req.ChainID,
		})
		if err == nil && allowance.Cmp(req.Amount) >= 0 {
			needsApproval = false
		}
	}

	return &SwapQuote{
		Dex:             "1inch",
		FromToken:       quoteResp.FromToken,
		ToToken:         quoteResp.ToToken,
		FromAmount:      req.Amount.String(),
		ToAmount:        quoteResp.ToTokenAmount,
		ToAmountMin:     toAmountMin.String(),
		ExchangeRate:    fmt.Sprintf("%.6f", exchangeRateStr),
		PriceImpact:     "0.00", // 1inch doesn't provide this directly
		EstimatedGas:    strconv.FormatInt(quoteResp.EstimatedGas, 10),
		GasCostETH:      fmt.Sprintf("%.6f", gasCostETHStr),
		Route:           route,
		Protocols:       protocols,
		ValidUntil:      time.Now().Add(QuoteValidDuration).Unix(),
		NeedsApproval:   needsApproval,
		ApprovalAddress: GetRouterAddress(req.ChainID),
	}, nil
}

// BuildSwapTransaction creates a complete SwapTransaction ready for signing
func (c *Client) BuildSwapTransaction(ctx context.Context, req *SwapRequest, gasPrice *big.Int) (*SwapTransaction, error) {
	// Get quote
	quote, err := c.BuildSwapQuote(ctx, req, gasPrice)
	if err != nil {
		return nil, err
	}

	// Get swap transaction data
	swapResp, err := c.GetSwap(ctx, req)
	if err != nil {
		return nil, err
	}

	return &SwapTransaction{
		Quote:   *quote,
		TxData:  swapResp.Tx,
		ChainID: req.ChainID,
	}, nil
}
