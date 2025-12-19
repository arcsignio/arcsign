// Package oneinch provides a client for the 1inch DEX aggregator API
package oneinch

import "math/big"

// TokenInfo represents token information from 1inch API
type TokenInfo struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	Decimals int    `json:"decimals"`
	LogoURI  string `json:"logoURI,omitempty"`
}

// QuoteRequest parameters for getting a swap quote
type QuoteRequest struct {
	FromTokenAddress string   // Source token contract address
	ToTokenAddress   string   // Destination token contract address
	Amount           *big.Int // Amount of source token (in smallest unit)
	ChainID          int      // Chain ID (1=Ethereum, 137=Polygon, etc.)
}

// QuoteResponse from 1inch /quote endpoint
type QuoteResponse struct {
	FromToken       TokenInfo `json:"fromToken"`
	ToToken         TokenInfo `json:"toToken"`
	FromTokenAmount string    `json:"fromTokenAmount"` // Amount in smallest unit
	ToTokenAmount   string    `json:"toTokenAmount"`   // Amount in smallest unit
	EstimatedGas    int64     `json:"estimatedGas"`
	Protocols       [][]struct {
		Name             string  `json:"name"`
		Part             float64 `json:"part"`
		FromTokenAddress string  `json:"fromTokenAddress"`
		ToTokenAddress   string  `json:"toTokenAddress"`
	} `json:"protocols"`
}

// SwapRequest parameters for building a swap transaction
type SwapRequest struct {
	FromTokenAddress string   // Source token contract address
	ToTokenAddress   string   // Destination token contract address
	Amount           *big.Int // Amount of source token (in smallest unit)
	FromAddress      string   // User's wallet address
	Slippage         float64  // Slippage tolerance in percent (e.g., 0.5 for 0.5%)
	ChainID          int      // Chain ID
	DisableEstimate  bool     // Skip balance/allowance checks
}

// SwapResponse from 1inch /swap endpoint
type SwapResponse struct {
	FromToken       TokenInfo `json:"fromToken"`
	ToToken         TokenInfo `json:"toToken"`
	FromTokenAmount string    `json:"fromTokenAmount"`
	ToTokenAmount   string    `json:"toTokenAmount"`
	Tx              TxData    `json:"tx"`
}

// TxData represents the transaction to execute
type TxData struct {
	From     string `json:"from"`
	To       string `json:"to"`       // 1inch router contract
	Data     string `json:"data"`     // Encoded swap call
	Value    string `json:"value"`    // ETH value (for native token swaps)
	Gas      int64  `json:"gas"`      // Gas limit
	GasPrice string `json:"gasPrice"` // Legacy gas price (optional)
}

// ApproveRequest parameters for getting approve transaction
type ApproveRequest struct {
	TokenAddress string   // Token contract to approve
	Amount       *big.Int // Amount to approve (nil = unlimited)
	ChainID      int      // Chain ID
}

// ApproveResponse from 1inch /approve/transaction endpoint
type ApproveResponse struct {
	Data     string `json:"data"`     // Encoded approve call
	GasPrice string `json:"gasPrice"` // Suggested gas price
	To       string `json:"to"`       // Token contract address
	Value    string `json:"value"`    // Always "0"
}

// AllowanceRequest parameters for checking allowance
type AllowanceRequest struct {
	TokenAddress string // Token contract address
	WalletAddress string // User's wallet address
	ChainID      int    // Chain ID
}

// AllowanceResponse from 1inch /approve/allowance endpoint
type AllowanceResponse struct {
	Allowance string `json:"allowance"` // Current allowance amount
}

// SwapQuote is the standardized quote format returned to frontend
type SwapQuote struct {
	Dex             string    `json:"dex"`             // "1inch"
	FromToken       TokenInfo `json:"fromToken"`
	ToToken         TokenInfo `json:"toToken"`
	FromAmount      string    `json:"fromAmount"`      // Input amount (wei)
	ToAmount        string    `json:"toAmount"`        // Expected output (wei)
	ToAmountMin     string    `json:"toAmountMin"`     // Minimum output with slippage
	ExchangeRate    string    `json:"exchangeRate"`    // 1 FROM = ? TO
	PriceImpact     string    `json:"priceImpact"`     // Price impact percentage
	EstimatedGas    string    `json:"estimatedGas"`    // Gas units
	GasCostETH      string    `json:"gasCostETH"`      // Gas cost in ETH
	Route           []string  `json:"route"`           // Token path
	Protocols       []string  `json:"protocols"`       // DEXes used
	ValidUntil      int64     `json:"validUntil"`      // Quote expiry timestamp
	NeedsApproval   bool      `json:"needsApproval"`   // Whether approve tx is needed
	ApprovalAddress string    `json:"approvalAddress"` // Spender address for approval
}

// SwapTransaction is the complete transaction data for execution
type SwapTransaction struct {
	Quote    SwapQuote `json:"quote"`
	TxData   TxData    `json:"txData"`
	ChainID  int       `json:"chainId"`
}

// Error codes
const (
	ErrInsufficientLiquidity = "INSUFFICIENT_LIQUIDITY"
	ErrInsufficientBalance   = "INSUFFICIENT_BALANCE"
	ErrInvalidToken          = "INVALID_TOKEN"
	ErrRateLimited           = "RATE_LIMITED"
	ErrNetworkError          = "NETWORK_ERROR"
)

// OneInchError represents an error from the 1inch API
type OneInchError struct {
	StatusCode int    `json:"statusCode"`
	Error      string `json:"error"`
	Description string `json:"description"`
	Message    string `json:"message"`
}

func (e *OneInchError) String() string {
	if e.Description != "" {
		return e.Description
	}
	if e.Message != "" {
		return e.Message
	}
	return e.Error
}
