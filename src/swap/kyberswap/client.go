// Package kyberswap provides a client for the KyberSwap DEX aggregator API
// KyberSwap is a FREE API that requires no API key
package kyberswap

import (
	"bytes"
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
	// BaseURL for KyberSwap Aggregator API
	BaseURL = "https://aggregator-api.kyberswap.com"

	// userAgent mimics a browser so Cloudflare's bot management doesn't 403 the API.
	userAgent = "Mozilla/5.0 (compatible; ArcSign/1.5.1; +https://arcsign.io)"

	// DefaultTimeout for HTTP requests
	DefaultTimeout = 30 * time.Second

	// QuoteValidDuration is how long a quote is considered valid
	QuoteValidDuration = 30 * time.Second

	// DefaultSlippage in basis points (50 = 0.5%)
	DefaultSlippage = 50
)

// Client is the KyberSwap API client
type Client struct {
	httpClient *http.Client
	baseURL    string
}

// NewClient creates a new KyberSwap API client (no API key required!)
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
		baseURL: BaseURL,
	}
}

// IsChainSupported checks if a chain is supported by KyberSwap
func IsChainSupported(chainID int) bool {
	_, ok := SupportedChains[chainID]
	return ok
}

// GetChainName returns the KyberSwap chain name for a chainID
func GetChainName(chainID int) string {
	return SupportedChains[chainID]
}

// doRequest performs an HTTP request
func (c *Client) doRequest(ctx context.Context, method, urlStr string, body []byte) ([]byte, error) {
	var req *http.Request
	var err error

	if body != nil {
		req, err = http.NewRequestWithContext(ctx, method, urlStr, bytes.NewReader(body))
	} else {
		req, err = http.NewRequestWithContext(ctx, method, urlStr, nil)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("KyberSwap API error (%d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// GetRoutes fetches swap routes from KyberSwap
func (c *Client) GetRoutes(ctx context.Context, req *RouteRequest) (*RouteResponse, error) {
	chainName, ok := SupportedChains[req.ChainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %d", req.ChainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%s/api/v1/routes", c.baseURL, chainName)
	params := url.Values{}
	params.Set("tokenIn", req.TokenIn)
	params.Set("tokenOut", req.TokenOut)
	params.Set("amountIn", req.AmountIn.String())
	urlStr += "?" + params.Encode()

	body, err := c.doRequest(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, err
	}

	var resp RouteResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse routes response: %w", err)
	}

	if resp.Code != 0 {
		return nil, fmt.Errorf("KyberSwap routes error: %s", resp.Message)
	}

	return &resp, nil
}

// BuildTransaction builds a swap transaction from routes
func (c *Client) BuildTransaction(ctx context.Context, chainID int, routeSummary RouteSummary, sender, recipient string, slippage int) (*BuildResponse, error) {
	chainName, ok := SupportedChains[chainID]
	if !ok {
		return nil, fmt.Errorf("unsupported chain: %d", chainID)
	}

	// Build URL
	urlStr := fmt.Sprintf("%s/%s/api/v1/route/build", c.baseURL, chainName)

	// Build request body
	buildReq := BuildRequest{
		RouteSummary:      routeSummary,
		Sender:            sender,
		Recipient:         recipient,
		SlippageTolerance: slippage,
	}

	reqBody, err := json.Marshal(buildReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal build request: %w", err)
	}

	body, err := c.doRequest(ctx, http.MethodPost, urlStr, reqBody)
	if err != nil {
		return nil, err
	}

	var resp BuildResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse build response: %w", err)
	}

	if resp.Code != 0 {
		return nil, fmt.Errorf("KyberSwap build error: %s", resp.Message)
	}

	return &resp, nil
}

// BuildSwapQuote creates a standardized SwapQuote
func (c *Client) BuildSwapQuote(ctx context.Context, chainID int, fromToken, toToken string, amount *big.Int, fromAddress string, slippage float64) (*SwapQuote, error) {
	// Get routes
	routeReq := &RouteRequest{
		TokenIn:  fromToken,
		TokenOut: toToken,
		AmountIn: amount,
		ChainID:  chainID,
	}

	routeResp, err := c.GetRoutes(ctx, routeReq)
	if err != nil {
		return nil, err
	}

	summary := routeResp.Data.RouteSummary

	// Calculate exchange rate
	fromAmount := new(big.Float).SetInt(amount)
	toAmount := new(big.Int)
	toAmount.SetString(summary.AmountOut, 10)
	toAmountFloat := new(big.Float).SetInt(toAmount)

	// Assume 18 decimals for now (will be corrected by frontend)
	exchangeRate := new(big.Float).Quo(toAmountFloat, fromAmount)
	exchangeRateStr, _ := exchangeRate.Float64()

	// Calculate minimum output with slippage
	slippageFactor := 1.0 - (slippage / 100.0)
	toAmountMinFloat := new(big.Float).Mul(toAmountFloat, big.NewFloat(slippageFactor))
	toAmountMin := new(big.Int)
	toAmountMinFloat.Int(toAmountMin)

	// Calculate gas cost in native token
	estimatedGas, _ := strconv.ParseInt(summary.Gas, 10, 64)
	gasPrice := big.NewInt(3000000000) // 3 Gwei default
	gasCost := new(big.Int).Mul(gasPrice, big.NewInt(estimatedGas))
	gasCostETH := new(big.Float).Quo(
		new(big.Float).SetInt(gasCost),
		big.NewFloat(1e18),
	)
	gasCostETHStr, _ := gasCostETH.Float64()

	// Build route
	route := []string{getTokenSymbol(chainID, fromToken), getTokenSymbol(chainID, toToken)}

	// Check if approval is needed (for non-native tokens)
	needsApproval := fromToken != NativeTokenAddress

	// Calculate price impact from USD values returned by KyberSwap API
	// Price impact = (amountOutUsd - amountInUsd) / amountInUsd * 100
	// Negative means user receives less value (typical for swaps)
	// Note: KyberSwap often returns "0" for amountOutUsd when it can't determine
	// the USD price, so we must check both values are positive.
	priceImpact := "N/A"
	if summary.AmountInUsd != "" && summary.AmountOutUsd != "" {
		inUsd, _, errIn := big.ParseFloat(summary.AmountInUsd, 10, 64, big.ToNearestEven)
		outUsd, _, errOut := big.ParseFloat(summary.AmountOutUsd, 10, 64, big.ToNearestEven)
		if errIn == nil && errOut == nil && inUsd.Sign() > 0 && outUsd.Sign() > 0 {
			diff := new(big.Float).Sub(outUsd, inUsd)
			impact := new(big.Float).Quo(diff, inUsd)
			impact.Mul(impact, big.NewFloat(100))
			impactF, _ := impact.Float64()
			priceImpact = fmt.Sprintf("%.2f", impactF)
		}
	}

	return &SwapQuote{
		Dex: "KyberSwap",
		FromToken: TokenInfo{
			Symbol:  getTokenSymbol(chainID, fromToken),
			Address: fromToken,
		},
		ToToken: TokenInfo{
			Symbol:  getTokenSymbol(chainID, toToken),
			Address: toToken,
		},
		FromAmount:      amount.String(),
		ToAmount:        summary.AmountOut,
		ToAmountMin:     toAmountMin.String(),
		ExchangeRate:    fmt.Sprintf("%.6f", exchangeRateStr),
		PriceImpact:     priceImpact,
		EstimatedGas:    summary.Gas,
		GasCostETH:      fmt.Sprintf("%.6f", gasCostETHStr),
		Route:           route,
		Protocols:       []string{"KyberSwap"},
		ValidUntil:      time.Now().Add(QuoteValidDuration).Unix(),
		NeedsApproval:   needsApproval,
		ApprovalAddress: routeResp.Data.RouterAddress,
	}, nil
}

// BuildSwapTransaction creates a complete SwapTransaction ready for signing
func (c *Client) BuildSwapTransaction(ctx context.Context, chainID int, fromToken, toToken string, amount *big.Int, fromAddress string, slippage float64) (*SwapTransaction, error) {
	// Get routes first
	routeReq := &RouteRequest{
		TokenIn:  fromToken,
		TokenOut: toToken,
		AmountIn: amount,
		ChainID:  chainID,
	}

	routeResp, err := c.GetRoutes(ctx, routeReq)
	if err != nil {
		return nil, err
	}

	summary := routeResp.Data.RouteSummary

	// Build quote
	quote, err := c.BuildSwapQuote(ctx, chainID, fromToken, toToken, amount, fromAddress, slippage)
	if err != nil {
		return nil, err
	}

	// Build transaction
	slippageBps := int(slippage * 100) // Convert to basis points
	if slippageBps <= 0 {
		slippageBps = DefaultSlippage
	}

	buildResp, err := c.BuildTransaction(ctx, chainID, summary, fromAddress, fromAddress, slippageBps)
	if err != nil {
		return nil, err
	}

	// Determine value (native token amount)
	value := "0"
	if fromToken == NativeTokenAddress {
		value = amount.String()
	}

	return &SwapTransaction{
		Quote: *quote,
		TxData: TxData{
			From:     fromAddress,
			To:       buildResp.Data.RouterAddress,
			Data:     buildResp.Data.Data,
			Value:    value,
			Gas:      buildResp.Data.Gas,
			GasPrice: "3000000000", // 3 Gwei default
		},
		ChainID:      chainID,
		RouteSummary: summary,
	}, nil
}

// getTokenSymbol returns token symbol based on address
func getTokenSymbol(chainID int, address string) string {
	if address == NativeTokenAddress {
		switch chainID {
		case 56:
			return "BNB"
		case 137:
			return "MATIC"
		default:
			return "ETH"
		}
	}
	// Return shortened address for unknown tokens
	if len(address) > 10 {
		return address[:6] + "..." + address[len(address)-4:]
	}
	return address
}

// GetRouterAddress returns the KyberSwap router address for a chain
func GetRouterAddress(chainID int) string {
	// KyberSwap uses the same router address across chains
	return "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5"
}

// GetTokenList fetches available tokens from KyberSwap Settings API
func (c *Client) GetTokenList(ctx context.Context, chainID int) ([]TokenInfo, error) {
	if !IsChainSupported(chainID) {
		return nil, fmt.Errorf("unsupported chain: %d", chainID)
	}

	// KyberSwap Settings API for token list
	urlStr := fmt.Sprintf("https://ks-setting.kyberswap.com/api/v1/tokens?page=1&pageSize=100&isWhitelisted=true&chainIds=%d", chainID)

	body, err := c.doRequest(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch KyberSwap token list: %w", err)
	}

	var resp TokenListAPIResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse token list response: %w", err)
	}

	if resp.Code != 0 {
		return nil, fmt.Errorf("KyberSwap token list error: %s", resp.Message)
	}

	// Convert to standard TokenInfo
	tokens := make([]TokenInfo, len(resp.Data.Tokens))
	for i, t := range resp.Data.Tokens {
		tokens[i] = TokenInfo{
			Symbol:   t.Symbol,
			Name:     t.Name,
			Address:  t.Address,
			Decimals: t.Decimals,
			LogoURI:  t.LogoURI,
		}
	}

	return tokens, nil
}

// CheckAllowance queries the on-chain ERC20 allowance for the KyberSwap router
// Uses a public RPC to call the standard ERC20 allowance(owner, spender) function
func (c *Client) CheckAllowance(ctx context.Context, chainID int, tokenAddress, walletAddress string) (*big.Int, error) {
	if !IsChainSupported(chainID) {
		return nil, fmt.Errorf("unsupported chain: %d", chainID)
	}

	// Native tokens don't need allowance
	if tokenAddress == NativeTokenAddress {
		maxUint256 := new(big.Int)
		maxUint256.SetString("115792089237316195423570985008687907853269984665640564039457584007913129639935", 10)
		return maxUint256, nil
	}

	rpcURL, ok := PublicRPCs[chainID]
	if !ok {
		return nil, fmt.Errorf("no public RPC available for chain %d", chainID)
	}

	spender := GetRouterAddress(chainID)

	// Build ERC20 allowance(address owner, address spender) calldata
	// Function selector: 0xdd62ed3e
	ownerPadded := fmt.Sprintf("%064s", walletAddress[2:])   // remove 0x, pad to 32 bytes
	spenderPadded := fmt.Sprintf("%064s", spender[2:])       // remove 0x, pad to 32 bytes
	calldata := "0xdd62ed3e" + ownerPadded + spenderPadded

	// Build JSON-RPC request
	rpcReq := JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params: []interface{}{
			EthCallParam{To: tokenAddress, Data: calldata},
			"latest",
		},
		ID: 1,
	}

	reqBody, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal RPC request: %w", err)
	}

	respBody, err := c.doRequest(ctx, http.MethodPost, rpcURL, reqBody)
	if err != nil {
		return nil, fmt.Errorf("eth_call failed: %w", err)
	}

	var rpcResp JSONRPCResponse
	if err := json.Unmarshal(respBody, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to parse RPC response: %w", err)
	}

	// Parse hex result to big.Int
	allowance := new(big.Int)
	if rpcResp.Result == "" || rpcResp.Result == "0x" {
		return big.NewInt(0), nil
	}
	// Remove 0x prefix
	hexStr := rpcResp.Result
	if len(hexStr) > 2 && hexStr[:2] == "0x" {
		hexStr = hexStr[2:]
	}
	allowance.SetString(hexStr, 16)

	return allowance, nil
}
