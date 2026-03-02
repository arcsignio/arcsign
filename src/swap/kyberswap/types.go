// Package kyberswap provides a client for KyberSwap DEX aggregator API
// KyberSwap is FREE and does not require an API key
package kyberswap

import "math/big"

// Native token address (ETH, BNB, MATIC, etc.)
const NativeTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

// Supported chains mapping chainID to KyberSwap chain name
var SupportedChains = map[int]string{
	1:     "ethereum",
	56:    "bsc",
	137:   "polygon",
	42161: "arbitrum",
	10:    "optimism",
	8453:  "base",
	43114: "avalanche",
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

// RouteRequest for getting swap routes
type RouteRequest struct {
	TokenIn   string   // Input token address
	TokenOut  string   // Output token address
	AmountIn  *big.Int // Amount in smallest unit
	ChainID   int      // Chain ID
}

// RouteSummary from KyberSwap API
type RouteSummary struct {
	TokenIn      string `json:"tokenIn"`
	TokenOut     string `json:"tokenOut"`
	AmountIn     string `json:"amountIn"`
	AmountInUsd  string `json:"amountInUsd"`
	AmountOut    string `json:"amountOut"`
	AmountOutUsd string `json:"amountOutUsd"`
	Gas          string `json:"gas"`
	GasUsd       string `json:"gasUsd"`
	GasPriceGwei string `json:"gasPriceGwei"`
}

// RouteResponse from /routes endpoint
type RouteResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		RouteSummary RouteSummary `json:"routeSummary"`
		RouterAddress string     `json:"routerAddress"`
	} `json:"data"`
}

// BuildRequest for building swap transaction
type BuildRequest struct {
	RouteSummary      RouteSummary `json:"routeSummary"`
	Sender            string       `json:"sender"`
	Recipient         string       `json:"recipient"`
	SlippageTolerance int          `json:"slippageTolerance"` // In basis points (50 = 0.5%)
}

// BuildResponse from /route/build endpoint
type BuildResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		RouterAddress string `json:"routerAddress"`
		AmountIn      string `json:"amountIn"`
		AmountOut     string `json:"amountOut"`
		Gas           string `json:"gas"`
		Data          string `json:"data"`
	} `json:"data"`
}

// TokenInfo represents a token with its metadata
type TokenInfo struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	Decimals int    `json:"decimals"`
	LogoURI  string `json:"logoURI"`
}

// SwapQuote represents a standardized swap quote
type SwapQuote struct {
	Dex             string    `json:"dex"`
	FromToken       TokenInfo `json:"fromToken"`
	ToToken         TokenInfo `json:"toToken"`
	FromAmount      string    `json:"fromAmount"`
	ToAmount        string    `json:"toAmount"`
	ToAmountMin     string    `json:"toAmountMin"`
	ExchangeRate    string    `json:"exchangeRate"`
	PriceImpact     string    `json:"priceImpact"`
	EstimatedGas    string    `json:"estimatedGas"`
	GasCostETH      string    `json:"gasCostETH"`
	Route           []string  `json:"route"`
	Protocols       []string  `json:"protocols"`
	ValidUntil      int64     `json:"validUntil"`
	NeedsApproval   bool      `json:"needsApproval"`
	ApprovalAddress string    `json:"approvalAddress"`
}

// TxData represents transaction data for signing
type TxData struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Data     string `json:"data"`
	Value    string `json:"value"`
	Gas      string `json:"gas"`
	GasPrice string `json:"gasPrice"`
}

// SwapTransaction is the complete transaction ready for signing
type SwapTransaction struct {
	Quote        SwapQuote    `json:"quote"`
	TxData       TxData       `json:"txData"`
	ChainID      int          `json:"chainId"`
	RouteSummary RouteSummary `json:"routeSummary"`
}
