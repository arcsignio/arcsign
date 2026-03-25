// Package main - Swap (DEX aggregator) FFI exports.
// Extracted from exports.go for maintainability.
// Contains: GetSwapQuote, BuildSwapTransaction, GetSwapApproval,
//           CheckSwapAllowance, GetNativeTokenAddress, GetSwapTokens
// Helpers:  initSwapAggregator, chainIDToInt, hexToBytes, bytesToHex
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"runtime/debug"
	"strings"
	"time"

	"github.com/Jason-chen-taiwan/arcSignv2/internal/rpc"
	"github.com/Jason-chen-taiwan/arcSignv2/src/swap"
)

// ============================================================================
// Swap FFI Functions (OpenOcean DEX Aggregator - FREE, No KYC required)
// Feature: Token Swap via OpenOcean API
// ============================================================================

// Global swap aggregator instance (lazy initialization)
var swapAggregator *swap.Aggregator

// initSwapAggregator initializes the global swap aggregator
// OpenOcean doesn't require API key!
func initSwapAggregator() *swap.Aggregator {
	if swapAggregator == nil {
		swapAggregator = swap.NewAggregator(&swap.Config{})
	}
	return swapAggregator
}

// chainIDToInt converts chain string to numeric chain ID for 1inch API
func chainIDToInt(chainID string) int {
	switch chainID {
	case "ethereum", "ethereum-mainnet":
		return 1
	case "polygon", "polygon-mainnet":
		return 137
	case "arbitrum", "arbitrum-mainnet":
		return 42161
	case "optimism", "optimism-mainnet":
		return 10
	case "base", "base-mainnet":
		return 8453
	case "bsc", "bsc-mainnet", "bnb":
		return 56
	case "bsc-testnet", "bnb-testnet":
		return 97
	default:
		return 1 // Default to Ethereum mainnet
	}
}

//export GetSwapQuote
// GetSwapQuote fetches a swap quote from OpenOcean DEX aggregator.
// Feature: Token Swap (OpenOcean - FREE, No KYC required)
//
// Input JSON: {
//   "chainId": "ethereum" | "polygon" | "arbitrum" | etc.,
//   "fromTokenAddress": "0x..." or "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" for native,
//   "toTokenAddress": "0x...",
//   "amount": "1000000000000000000",  // Amount in smallest unit (wei)
//   "fromAddress": "0x...",  // User's wallet address
//   "slippage": 0.5,  // Slippage tolerance in percent
//   "usbPath": "/path/to/usb",
//   "appPassword": "password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "dex": "OpenOcean",
//     "fromToken": {...},
//     "toToken": {...},
//     "fromAmount": "...",
//     "toAmount": "...",
//     "toAmountMin": "...",
//     "exchangeRate": "...",
//     "estimatedGas": "...",
//     "gasCostETH": "...",
//     "route": ["ETH", "USDC"],
//     "protocols": ["OpenOcean"],
//     "needsApproval": true,
//     "approvalAddress": "0x..."
//   }
// }
func GetSwapQuote(params *C.char) *C.char {
	start := time.Now()
	var provider string = "openocean" // will be updated from input
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetSwapQuote via %s completed in %v", provider, elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		ChainID          string  `json:"chainId"`
		FromTokenAddress string  `json:"fromTokenAddress"`
		ToTokenAddress   string  `json:"toTokenAddress"`
		Amount           string  `json:"amount"`
		FromAddress      string  `json:"fromAddress"`
		Slippage         float64 `json:"slippage"`
		Provider         string  `json:"provider"`     // DEX provider: "openocean" | "kyberswap"
		USBPath          string  `json:"usbPath"`
		SessionToken     string  `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword      string  `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate USB path to prevent path traversal
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update provider for debug log
	if input.Provider != "" {
		provider = input.Provider
	}

	defer zeroString(&input.AppPassword)

	// Default slippage
	if input.Slippage <= 0 {
		input.Slippage = 0.5
	}

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	// Parse amount
	amount := new(big.Int)
	amount.SetString(input.Amount, 10)

	// Get dynamic gas price from RPC (with chain-specific fallback)
	gasPrice, _ := rpc.GetGasPrice(input.ChainID)
	if gasPrice == nil {
		gasPrice = big.NewInt(1e9) // 1 Gwei fallback
	}
	debugLog(fmt.Sprintf("GetSwapQuote: Using gas price %s wei for chain %s", gasPrice.String(), input.ChainID))

	// Get quote
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	quote, err := aggregator.GetQuote(ctx, &swap.QuoteParams{
		Provider:         swap.Provider(input.Provider), // Pass provider from frontend
		ChainID:          chainIDToInt(input.ChainID),
		FromTokenAddress: input.FromTokenAddress,
		ToTokenAddress:   input.ToTokenAddress,
		Amount:           amount,
		FromAddress:      input.FromAddress,
		Slippage:         input.Slippage,
		GasPrice:         gasPrice,
	})

	if err != nil {
		response := NewErrorResponse(ErrSwapQuoteFailed, GetUserFriendlyMessage(ErrSwapQuoteFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	response := NewSuccessResponse(quote)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export BuildSwapTransaction
// BuildSwapTransaction builds a complete swap transaction ready for signing.
// Feature: Token Swap
//
// Input JSON: same as GetSwapQuote
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "quote": {...},  // Same as GetSwapQuote response
//     "txData": {
//       "from": "0x...",
//       "to": "0x...",  // 1inch router
//       "data": "0x...",  // Encoded swap call
//       "value": "0",  // ETH value for native swaps
//       "gas": 200000
//     },
//     "chainId": 1
//   }
// }
func BuildSwapTransaction(params *C.char) *C.char {
	start := time.Now()
	var provider string = "openocean" // will be updated from input
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("BuildSwapTransaction via %s completed in %v", provider, elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		ChainID          string  `json:"chainId"`
		FromTokenAddress string  `json:"fromTokenAddress"`
		ToTokenAddress   string  `json:"toTokenAddress"`
		Amount           string  `json:"amount"`
		FromAddress      string  `json:"fromAddress"`
		Slippage         float64 `json:"slippage"`
		Provider         string  `json:"provider"`     // DEX provider: "openocean" | "kyberswap"
		USBPath          string  `json:"usbPath"`
		SessionToken     string  `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword      string  `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate USB path to prevent path traversal
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update provider for debug log
	if input.Provider != "" {
		provider = input.Provider
	}

	defer zeroString(&input.AppPassword)

	// Default slippage
	if input.Slippage <= 0 {
		input.Slippage = 0.5
	}

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	// Parse amount
	amount := new(big.Int)
	amount.SetString(input.Amount, 10)

	// Get dynamic gas price from RPC (with chain-specific fallback)
	gasPrice, _ := rpc.GetGasPrice(input.ChainID)
	if gasPrice == nil {
		gasPrice = big.NewInt(1e9) // 1 Gwei fallback
	}
	debugLog(fmt.Sprintf("BuildSwapTransaction: Using gas price %s wei for chain %s", gasPrice.String(), input.ChainID))

	// Build swap transaction
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	swapTx, err := aggregator.BuildSwapTransaction(ctx, &swap.QuoteParams{
		Provider:         swap.Provider(input.Provider), // Pass provider from frontend
		ChainID:          chainIDToInt(input.ChainID),
		FromTokenAddress: input.FromTokenAddress,
		ToTokenAddress:   input.ToTokenAddress,
		Amount:           amount,
		FromAddress:      input.FromAddress,
		Slippage:         input.Slippage,
		GasPrice:         gasPrice,
	})

	if err != nil {
		response := NewErrorResponse(ErrSwapBuildFailed, GetUserFriendlyMessage(ErrSwapBuildFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	response := NewSuccessResponse(swapTx)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetSwapApproval
// GetSwapApproval builds the ERC-20 approve transaction data locally.
// This does NOT call any external API - it just encodes the approve(spender, amount) call.
// Feature: Token Swap - Approval Flow
//
// Input JSON: {
//   "chainId": "ethereum",
//   "tokenAddress": "0x...",  // Token contract to call approve() on
//   "spenderAddress": "0x...", // DEX router address (from quote.approvalAddress)
//   "amount": "1000000000000000000",  // Amount to approve (optional, empty = unlimited = MaxUint256)
//   "usbPath": "/path/to/usb",
//   "appPassword": "password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "to": "0x...",  // Token contract address
//     "data": "0x...",  // Encoded approve(spender, amount) call
//     "value": "0"
//   }
// }
func GetSwapApproval(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetSwapApproval completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		ChainID        string `json:"chainId"`
		TokenAddress   string `json:"tokenAddress"`
		SpenderAddress string `json:"spenderAddress"` // DEX router address
		Amount         string `json:"amount"`         // Optional: empty = unlimited
		USBPath        string `json:"usbPath"`
		SessionToken   string `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword    string `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate USB path to prevent path traversal
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Validate required fields
	if input.TokenAddress == "" {
		response := NewErrorResponse(ErrInvalidInput, "tokenAddress is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if input.SpenderAddress == "" {
		response := NewErrorResponse(ErrInvalidInput, "spenderAddress is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Parse amount: empty = MaxUint256 (unlimited approval), "0" = revoke
	var amount *big.Int
	if input.Amount == "" {
		// Empty = MaxUint256 (unlimited approval)
		amount = new(big.Int)
		amount.Exp(big.NewInt(2), big.NewInt(256), nil)
		amount.Sub(amount, big.NewInt(1))
	} else {
		// Parse literal amount (including "0" for revoke)
		amount = new(big.Int)
		if _, ok := amount.SetString(input.Amount, 10); !ok {
			response := NewErrorResponse(ErrInvalidInput, "Invalid amount")
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}
	}

	// Build ERC-20 approve(address spender, uint256 amount) calldata
	// Function selector: keccak256("approve(address,uint256)")[:4] = 0x095ea7b3
	// Followed by: spender address (32 bytes, left-padded) + amount (32 bytes, left-padded)
	approveSelector := []byte{0x09, 0x5e, 0xa7, 0xb3}

	// Parse spender address (remove 0x prefix if present)
	spenderHex := strings.TrimPrefix(input.SpenderAddress, "0x")
	spenderBytes, err := hexToBytes(spenderHex)
	if err != nil || len(spenderBytes) != 20 {
		response := NewErrorResponse(ErrInvalidInput, "Invalid spender address")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Build calldata: 4 bytes selector + 32 bytes spender + 32 bytes amount = 68 bytes
	calldata := make([]byte, 68)
	copy(calldata[0:4], approveSelector)
	copy(calldata[16:36], spenderBytes) // spender at bytes 4-35 (left-padded to 32 bytes)
	amountBytes := amount.Bytes()
	copy(calldata[68-len(amountBytes):68], amountBytes) // amount at bytes 36-67 (left-padded to 32 bytes)

	// Return approval transaction data
	approval := map[string]string{
		"to":    input.TokenAddress,
		"data":  "0x" + bytesToHex(calldata),
		"value": "0",
	}

	debugLog(fmt.Sprintf("Built approve calldata: to=%s, spender=%s, amount=%s",
		input.TokenAddress, input.SpenderAddress, amount.String()))

	response := NewSuccessResponse(approval)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// hexToBytes converts a hex string to bytes
func hexToBytes(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		s = "0" + s
	}
	result := make([]byte, len(s)/2)
	for i := 0; i < len(result); i++ {
		var b byte
		_, err := fmt.Sscanf(s[i*2:i*2+2], "%02x", &b)
		if err != nil {
			return nil, err
		}
		result[i] = b
	}
	return result, nil
}

// bytesToHex converts bytes to a hex string
func bytesToHex(b []byte) string {
	result := make([]byte, len(b)*2)
	for i, v := range b {
		result[i*2] = "0123456789abcdef"[v>>4]
		result[i*2+1] = "0123456789abcdef"[v&0x0f]
	}
	return string(result)
}

//export CheckSwapAllowance
// CheckSwapAllowance checks the current token allowance for 1inch router.
// Feature: Token Swap - Allowance Check
//
// Input JSON: {
//   "chainId": "ethereum",
//   "tokenAddress": "0x...",
//   "walletAddress": "0x...",
//   "usbPath": "/path/to/usb",
//   "appPassword": "password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "allowance": "1000000000000000000",
//     "hasAllowance": true
//   }
// }
func CheckSwapAllowance(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("CheckSwapAllowance completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		ChainID       string `json:"chainId"`
		TokenAddress  string `json:"tokenAddress"`
		WalletAddress string `json:"walletAddress"`
		Provider      string `json:"provider"` // DEX provider: "openocean" | "kyberswap"
		USBPath       string `json:"usbPath"`
		SessionToken  string `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword   string `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate USB path to prevent path traversal
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	allowance, err := aggregator.CheckAllowance(ctx, swap.Provider(input.Provider), chainIDToInt(input.ChainID), input.TokenAddress, input.WalletAddress)
	if err != nil {
		response := NewErrorResponse(ErrSwapAllowanceFailed, GetUserFriendlyMessage(ErrSwapAllowanceFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"allowance":    allowance.String(),
		"hasAllowance": allowance.Cmp(big.NewInt(0)) > 0,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetNativeTokenAddress
// GetNativeTokenAddress returns the standard native token address for DEX APIs.
// Native tokens (ETH, MATIC, BNB, etc.) use this special address in API calls.
func GetNativeTokenAddress() *C.char {
	address := swap.GetNativeTokenAddress()
	response := NewSuccessResponse(map[string]string{
		"address": address,
	})
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetSwapTokens
// GetSwapTokens fetches all available tokens for swap on a chain from OpenOcean API.
// Feature: Token Swap (OpenOcean - FREE, No KYC required)
//
// Input JSON: {
//
//	"chainId": "56",  // Chain ID as string
//	"usbPath": "/Volumes/USB/...",
//	"appPassword": "password123"
//
// }
//
// Output JSON: {
//
//	"success": true,
//	"data": {
//	  "tokens": [
//	    {
//	      "symbol": "BNB",
//	      "name": "BNB",
//	      "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
//	      "decimals": 18,
//	      "logoURI": "https://..."
//	    },
//	    ...
//	  ]
//	}
//
// }
func GetSwapTokens(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetSwapTokens completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		ChainID      string `json:"chainId"`
		Provider     string `json:"provider"`     // DEX provider: "openocean" | "kyberswap"
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword  string `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate USB path to prevent path traversal
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	// Get tokens
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tokens, err := aggregator.GetTokens(ctx, swap.Provider(input.Provider), chainIDToInt(input.ChainID))
	if err != nil {
		response := NewErrorResponse(ErrSwapQuoteFailed, GetUserFriendlyMessage(ErrSwapQuoteFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"tokens": tokens,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}
