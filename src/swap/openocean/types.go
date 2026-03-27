// Package openocean provides types for OpenOcean DEX aggregator API
package openocean

import (
	"encoding/json"
	"fmt"
	"math/big"
)

// FlexString is a type that can unmarshal from both string and number JSON values
type FlexString string

// UnmarshalJSON implements json.Unmarshaler for FlexString
func (f *FlexString) UnmarshalJSON(data []byte) error {
	// Try to unmarshal as string first
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*f = FlexString(s)
		return nil
	}

	// Try to unmarshal as number
	var n json.Number
	if err := json.Unmarshal(data, &n); err == nil {
		*f = FlexString(n.String())
		return nil
	}

	// Try to unmarshal as float64 (fallback)
	var num float64
	if err := json.Unmarshal(data, &num); err == nil {
		*f = FlexString(fmt.Sprintf("%.0f", num))
		return nil
	}

	return fmt.Errorf("cannot unmarshal %s into FlexString", string(data))
}

// String returns the string value
func (f FlexString) String() string {
	return string(f)
}

// APIError represents an error from the OpenOcean API
type APIError struct {
	Code  int    `json:"code"`
	Error string `json:"error"`
}

// APIResponse is the standard API response wrapper
type APIResponse struct {
	Code  int            `json:"code"`
	Error string         `json:"error,omitempty"`
	Data  *QuoteResponse `json:"data"`
}

// SwapAPIResponse is the response wrapper for swap endpoint
type SwapAPIResponse struct {
	Code  int           `json:"code"`
	Error string        `json:"error,omitempty"`
	Data  *SwapResponse `json:"data"`
}

// TokenListResponse is the response for token list endpoint
type TokenListResponse struct {
	Code  int         `json:"code"`
	Error string      `json:"error,omitempty"`
	Data  []TokenInfo `json:"data"`
}

// ApproveAPIResponse is the response for approve endpoint
type ApproveAPIResponse struct {
	Code  int              `json:"code"`
	Error string           `json:"error,omitempty"`
	Data  *ApproveResponse `json:"data"`
}

// AllowanceAPIResponse is the response for allowance endpoint
type AllowanceAPIResponse struct {
	Code  int                `json:"code"`
	Error string             `json:"error,omitempty"`
	Data  *AllowanceResponse `json:"data"`
}

// QuoteRequest for getting a quote
type QuoteRequest struct {
	FromTokenAddress string   // inTokenAddress
	ToTokenAddress   string   // outTokenAddress
	Amount           *big.Int // amount in smallest unit
	GasPrice         *big.Int // gas price in wei
	Slippage         float64  // slippage percentage (e.g., 1 for 1%)
	ChainID          int      // chain ID
}

// SwapRequest for building a swap transaction
type SwapRequest struct {
	FromTokenAddress string   // inTokenAddress
	ToTokenAddress   string   // outTokenAddress
	Amount           *big.Int // amount in smallest unit
	GasPrice         *big.Int // gas price in wei
	Slippage         float64  // slippage percentage
	FromAddress      string   // account address
	ChainID          int      // chain ID
	DisableEstimate  bool     // disable gas estimation
	ReferrerAddress  string   // referrer address for fee collection
	ReferrerFee      float64  // referrer fee percentage (e.g., 0.1 for 0.1%)
}

// QuoteToken represents a token in the quote response
type QuoteToken struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	Decimals int    `json:"decimals"`
	Icon     string `json:"icon"`
}

// QuoteResponse is the response from the quote endpoint
type QuoteResponse struct {
	InToken      QuoteToken `json:"inToken"`
	OutToken     QuoteToken `json:"outToken"`
	InAmount     string     `json:"inAmount"`
	OutAmount    string     `json:"outAmount"`
	EstimatedGas string     `json:"estimatedGas"`
	PriceImpact  string     `json:"price_impact"` // OpenOcean uses snake_case
	To           string     `json:"to"`           // Router address (exchange field in response)
	Exchange     string     `json:"exchange"`     // Router address
}

// SwapResponse is the response from the swap endpoint
// Note: estimatedGas can be returned as either string or number by the API
type SwapResponse struct {
	From         string     `json:"from"`
	To           string     `json:"to"`
	Data         string     `json:"data"`
	Value        string     `json:"value"`
	GasPrice     FlexString `json:"gasPrice"`
	EstimatedGas FlexString `json:"estimatedGas"`
}

// TokenInfo represents a token with its metadata
type TokenInfo struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	Decimals int    `json:"decimals"`
	LogoURI  string `json:"icon"`
}

// ApproveResponse is the response for getting approval transaction
type ApproveResponse struct {
	To    string `json:"to"`
	Value string `json:"value"`
	Data  string `json:"data"`
}

// AllowanceResponse is the response for checking allowance
type AllowanceResponse struct {
	Allowance string `json:"allowance"`
}

// SwapQuote is the standardized quote structure (same as 1inch for compatibility)
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
	Quote   SwapQuote `json:"quote"`
	TxData  TxData    `json:"txData"`
	ChainID int       `json:"chainId"`
}
