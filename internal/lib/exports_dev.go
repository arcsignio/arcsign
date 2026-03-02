//go:build dev

// Package main provides FFI exports for developer mode features.
// This file is only compiled when the "dev" build tag is set:
//   go build -tags dev -buildmode=c-shared
//
// In production builds (without -tags dev), these functions are excluded,
// ensuring developer mode signing cannot be used in release binaries.
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"runtime/debug"
	"strings"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/yourusername/arcsign/internal/app"
)

// Global DevSessionManager instance for Developer Mode auto-signing
// Only available in dev builds.
var devSessionManager *app.DevSessionManager

// initDevSessionManager initializes the global DevSessionManager (lazy initialization)
func initDevSessionManager() *app.DevSessionManager {
	if devSessionManager == nil {
		chainSvc := initChainAdapterService()
		devSessionManager = app.NewDevSessionManager(chainSvc)
	}
	return devSessionManager
}

//export CreateDevSession
// CreateDevSession creates a new developer session for auto-signing.
// The session stores pre-derived signing keys in memory for fast signing.
//
// Input JSON: {
//   "walletId": "wallet-uuid",
//   "password": "wallet-password",
//   "passphrase": "optional-bip39-passphrase",
//   "usbPath": "/Volumes/ArcSign",
//   "durationMinutes": 30,
//   "trustedNetworks": ["sepolia", "goerli", "bsc-testnet"]
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "sessionToken": "dev_xxx...",
//     "expiresAt": 1234567890000,
//     "trustedNetworks": ["sepolia", "goerli"],
//     "addresses": ["0x..."]
//   }
// }
func CreateDevSession(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		WalletID        string   `json:"walletId"`
		Password        string   `json:"password"`
		Passphrase      string   `json:"passphrase"`
		USBPath         string   `json:"usbPath"`
		DurationMinutes int      `json:"durationMinutes"`
		TrustedNetworks []string `json:"trustedNetworks"`
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

	// Zero sensitive data after function returns
	defer zeroString(&input.Password)
	defer zeroString(&input.Passphrase)

	// Create session
	dsm := initDevSessionManager()
	session, err := dsm.CreateSession(app.DevSessionConfig{
		WalletID:        input.WalletID,
		Password:        input.Password,
		Passphrase:      input.Passphrase,
		UsbPath:         input.USBPath,
		DurationMinutes: input.DurationMinutes,
		TrustedNetworks: input.TrustedNetworks,
	})
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Get addresses from session
	info, _ := dsm.GetSessionInfo(session.Token)
	addresses := info["addresses"]

	result := map[string]interface{}{
		"sessionToken":    session.Token,
		"expiresAt":       session.ExpiresAt.UnixMilli(),
		"trustedNetworks": session.TrustedNetworks,
		"addresses":       addresses,
	}

	response := NewSuccessResponse(result)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export DevSessionSign
// DevSessionSign signs a transaction using a developer session (no password needed).
// Only works for testnet transactions in trusted networks.
//
// Input JSON: {
//   "sessionToken": "dev_xxx...",
//   "chainId": 11155111,
//   "from": "0x...",
//   "to": "0x...",
//   "data": "0x...",
//   "value": "0",
//   "gas": "21000",
//   "gasPrice": "1000000000",
//   "maxFeePerGas": "1000000000",
//   "maxPriorityFeePerGas": "1000000000",
//   "nonce": 0
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "signedTx": "0x...",
//     "txHash": "0x...",
//     "signedBy": "0x..."
//   }
// }
func DevSessionSign(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		SessionToken         string `json:"sessionToken"`
		ChainID              int64  `json:"chainId"`
		From                 string `json:"from"`
		To                   string `json:"to"`
		Data                 string `json:"data"`
		Value                string `json:"value"`
		Gas                  string `json:"gas"`
		GasPrice             string `json:"gasPrice"`
		MaxFeePerGas         string `json:"maxFeePerGas"`
		MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
		Nonce                uint64 `json:"nonce"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Parse data
	data := []byte{}
	if input.Data != "" && input.Data != "0x" {
		dataStr := strings.TrimPrefix(input.Data, "0x")
		var err error
		data, err = hex.DecodeString(dataStr)
		if err != nil {
			response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}
	}

	// Parse value
	value := new(big.Int)
	if input.Value != "" && input.Value != "0" && input.Value != "0x0" {
		valueStr := strings.TrimPrefix(input.Value, "0x")
		if strings.HasPrefix(input.Value, "0x") {
			value.SetString(valueStr, 16)
		} else {
			value.SetString(input.Value, 10)
		}
	}

	// Parse gas
	gasLimit := uint64(21000) // Default
	if input.Gas != "" {
		gasStr := strings.TrimPrefix(input.Gas, "0x")
		if strings.HasPrefix(input.Gas, "0x") {
			gas := new(big.Int)
			gas.SetString(gasStr, 16)
			gasLimit = gas.Uint64()
		} else {
			gas := new(big.Int)
			gas.SetString(input.Gas, 10)
			gasLimit = gas.Uint64()
		}
	}

	// Parse gas prices
	var gasPrice, maxFeePerGas, maxPriorityFeePerGas *big.Int
	if input.GasPrice != "" {
		gasPrice = new(big.Int)
		gpStr := strings.TrimPrefix(input.GasPrice, "0x")
		if strings.HasPrefix(input.GasPrice, "0x") {
			gasPrice.SetString(gpStr, 16)
		} else {
			gasPrice.SetString(input.GasPrice, 10)
		}
	}
	if input.MaxFeePerGas != "" {
		maxFeePerGas = new(big.Int)
		mfStr := strings.TrimPrefix(input.MaxFeePerGas, "0x")
		if strings.HasPrefix(input.MaxFeePerGas, "0x") {
			maxFeePerGas.SetString(mfStr, 16)
		} else {
			maxFeePerGas.SetString(input.MaxFeePerGas, 10)
		}
	}
	if input.MaxPriorityFeePerGas != "" {
		maxPriorityFeePerGas = new(big.Int)
		mpStr := strings.TrimPrefix(input.MaxPriorityFeePerGas, "0x")
		if strings.HasPrefix(input.MaxPriorityFeePerGas, "0x") {
			maxPriorityFeePerGas.SetString(mpStr, 16)
		} else {
			maxPriorityFeePerGas.SetString(input.MaxPriorityFeePerGas, 10)
		}
	}

	// Sign using DevSessionManager
	dsm := initDevSessionManager()
	signed, err := dsm.SignTransaction(
		input.SessionToken,
		input.ChainID,
		input.From,
		input.To,
		data,
		value,
		gasLimit,
		gasPrice,
		maxFeePerGas,
		maxPriorityFeePerGas,
		input.Nonce,
	)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Encode result
	signedTxHex := fmt.Sprintf("0x%x", signed.SerializedTx)
	txHash := ethcrypto.Keccak256Hash(signed.SerializedTx)

	result := map[string]interface{}{
		"signedTx": signedTxHex,
		"txHash":   txHash.Hex(),
		"signedBy": input.From,
	}

	response := NewSuccessResponse(result)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetDevSession
// GetDevSession returns information about a developer session.
//
// Input JSON: {
//   "sessionToken": "dev_xxx..."
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "active": true,
//     "walletId": "...",
//     "expiresAt": 1234567890000,
//     "remainingMs": 60000,
//     "signCount": 5,
//     "trustedNetworks": ["sepolia"],
//     "addresses": ["0x..."]
//   }
// }
func GetDevSession(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		SessionToken string `json:"sessionToken"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	dsm := initDevSessionManager()
	info, err := dsm.GetSessionInfo(input.SessionToken)
	if err != nil {
		result := map[string]interface{}{
			"active":  false,
			"message": err.Error(),
		}
		response := NewSuccessResponse(result)
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	info["active"] = true
	response := NewSuccessResponse(info)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export EndDevSession
// EndDevSession terminates a developer session and clears all stored keys.
//
// Input JSON: {
//   "sessionToken": "dev_xxx..."
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "status": "ended"
//   }
// }
func EndDevSession(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		SessionToken string `json:"sessionToken"`
	}

	if err = json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	dsm := initDevSessionManager()
	err = dsm.EndSession(input.SessionToken)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	result := map[string]interface{}{
		"status": "ended",
	}
	response := NewSuccessResponse(result)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}
