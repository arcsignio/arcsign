// Package main - Message Signing FFI exports.
// Extracted from exports.go for maintainability.
// Contains: SignMessage, SignTypedData; helpers: eip191Hash, hashTypedDataV4
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"runtime/debug"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/security/signgate"
)

//export SignMessage
// SignMessage signs a message using EIP-191 personal_sign standard.
// Feature: WalletConnect Phase 2 - personal_sign support
//
// EIP-191 format: keccak256("\x19Ethereum Signed Message:\n" + len(message) + message)
//
// Input JSON: {
//   "walletId": "uuid-xxx",
//   "password": "user-password",
//   "passphrase": "bip39-passphrase",  // Optional BIP39 passphrase
//   "usbPath": "/path/to/usb",
//   "address": "0x...",  // Signing address
//   "message": "0x..." | "plain text"  // Message to sign (hex or plain text)
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "signature": "0x...",  // 65-byte signature (r + s + v)
//     "messageHash": "0x...",  // EIP-191 hash of message
//     "signedBy": "0x..."  // Address that signed
//   }
// }
func SignMessage(params *C.char) (result *C.char) {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			result = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		WalletID         string `json:"walletId"`
		Password         string `json:"password"`
		Passphrase       string `json:"passphrase"`
		USBPath          string `json:"usbPath"`
		Address          string `json:"address"`
		Message          string `json:"message"`
		AcknowledgedRisk bool   `json:"acknowledgedRisk"`
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

	// Rate limiting: prevent brute-force on message signing
	if !walletRateLimiter.AllowAttempt(input.WalletID) {
		remaining := walletRateLimiter.GetRemainingAttempts(input.WalletID)
		response := NewErrorResponse(ErrRateLimitExceeded,
			fmt.Sprintf("Too many signing attempts. Please wait before trying again. (%d attempts remaining)", remaining))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Build the EIP-191 hash (message decode + prefix + keccak) up front so the
	// gate's hashFn can return it; identical to the former plaintext path.
	msgHashBytes, err := eip191Hash(input.Message)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	messageHash := common.BytesToHash(msgHashBytes)

	// Sign through deriveAndSign — the single key-derivation entry point that
	// runs signgate.Authorize FIRST, so this path passes the mandatory gate.
	signature, err := deriveAndSign(context.Background(),
		signParams{
			WalletID:   input.WalletID,
			Password:   input.Password,
			Passphrase: input.Passphrase,
			USBPath:    input.USBPath,
			Address:    input.Address,
		},
		signgate.SignRequest{
			Kind:             signgate.KindMessage,
			Message:          msgDecodedBytes(input.Message),
			AcknowledgedRisk: input.AcknowledgedRisk,
		},
		func() (common.Hash, error) { return messageHash, nil },
	)
	if err != nil {
		code := mapSignError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return result
	output := map[string]interface{}{
		"signature":   fmt.Sprintf("0x%x", signature),
		"messageHash": messageHash.Hex(),
		"signedBy":    input.Address,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// SignTypedData signs EIP-712 typed data.
// This is used for eth_signTypedData_v4 in WalletConnect.
//
// Input JSON:
//
//	{
//	  "walletId": "...",
//	  "password": "...",
//	  "passphrase": "...",
//	  "usbPath": "...",
//	  "address": "0x...",
//	  "typedData": "{...}" // EIP-712 JSON string
//	}
//
// Output JSON:
//
//	{
//	  "success": true,
//	  "data": {
//	    "signature": "0x...",
//	    "signedBy": "0x..."
//	  }
//	}
//
//export SignTypedData
func SignTypedData(params *C.char) (result *C.char) {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			result = C.CString(string(jsonBytes))
		}
	}()

	// Parse input
	var input struct {
		WalletID         string `json:"walletId"`
		Password         string `json:"password"`
		Passphrase       string `json:"passphrase"`
		USBPath          string `json:"usbPath"`
		Address          string `json:"address"`
		TypedData        string `json:"typedData"`
		AcknowledgedRisk bool   `json:"acknowledgedRisk"`
	}

	paramsStr, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if err := json.Unmarshal([]byte(paramsStr), &input); err != nil {
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

	defer zeroString(&input.Password)
	defer zeroString(&input.Passphrase)

	// Rate limiting: prevent brute-force on typed data signing
	if !walletRateLimiter.AllowAttempt(input.WalletID) {
		remaining := walletRateLimiter.GetRemainingAttempts(input.WalletID)
		response := NewErrorResponse(ErrRateLimitExceeded,
			fmt.Sprintf("Too many signing attempts. Please wait before trying again. (%d attempts remaining)", remaining))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Parse typed data
	var typedData apitypes.TypedData
	if err := json.Unmarshal([]byte(input.TypedData), &typedData); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Sign through deriveAndSign — the single key-derivation entry point that
	// runs signgate.Authorize FIRST, so this path passes the mandatory gate.
	// hashTypedDataV4 runs AFTER authorization, inside the gated helper.
	signature, err := deriveAndSign(context.Background(),
		signParams{
			WalletID:   input.WalletID,
			Password:   input.Password,
			Passphrase: input.Passphrase,
			USBPath:    input.USBPath,
			Address:    input.Address,
		},
		signgate.SignRequest{
			Kind:             signgate.KindTypedData,
			TypedData:        &typedData,
			AcknowledgedRisk: input.AcknowledgedRisk,
		},
		func() (common.Hash, error) { return hashTypedDataV4(typedData) },
	)
	if err != nil {
		code := mapSignError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return result
	output := map[string]interface{}{
		"signature": fmt.Sprintf("0x%x", signature),
		"signedBy":  input.Address,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// eip191Hash builds the EIP-191 personal_sign hash for a message.
// The message is hex-decoded when 0x-prefixed, otherwise treated as UTF-8 text,
// then prefixed with "\x19Ethereum Signed Message:\n<len>" and keccak256'd.
// Kept as a pure (non-cgo, no-wallet) helper so the signing path is testable.
func eip191Hash(message string) ([]byte, error) {
	var messageBytes []byte
	if strings.HasPrefix(message, "0x") || strings.HasPrefix(message, "0X") {
		hexStr := strings.TrimPrefix(strings.TrimPrefix(message, "0x"), "0X")
		decoded, err := hexToBytes(hexStr)
		if err != nil {
			return nil, err
		}
		messageBytes = decoded
	} else {
		messageBytes = []byte(message)
	}

	return security.EIP191Hash(messageBytes), nil
}

// hashTypedDataV4 computes the EIP-712 signing hash for typed data using
// go-ethereum's apitypes. Signing is done separately via SecureSigner so the
// private key never leaves XOR-split storage in plaintext form.
func hashTypedDataV4(typedData apitypes.TypedData) (common.Hash, error) {
	// Hash the typed data
	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return common.Hash{}, fmt.Errorf("failed to hash domain: %w", err)
	}

	typedDataHash, err := typedData.HashStruct(typedData.PrimaryType, typedData.Message)
	if err != nil {
		return common.Hash{}, fmt.Errorf("failed to hash message: %w", err)
	}

	// Create the final hash: keccak256("\x19\x01" || domainSeparator || typedDataHash)
	rawData := []byte(fmt.Sprintf("\x19\x01%s%s", string(domainSeparator), string(typedDataHash)))
	return ethcrypto.Keccak256Hash(rawData), nil
}

// msgDecodedBytes returns the raw message bytes (hex-decoded if 0x-prefixed)
// for the signgate scan — mirrors eip191Hash's decode step.
func msgDecodedBytes(message string) []byte {
	if strings.HasPrefix(message, "0x") || strings.HasPrefix(message, "0X") {
		if b, err := hexToBytes(strings.TrimPrefix(strings.TrimPrefix(message, "0x"), "0X")); err == nil {
			return b
		}
	}
	return []byte(message)
}

// mapSignError maps signgate.ErrBlocked to the blacklist error code; all other
// errors delegate to MapWalletError so wrong-password / wallet-not-found / etc.
// surface their specific codes (consistent with SignTransaction).
func mapSignError(err error) ErrorCode {
	if errors.Is(err, signgate.ErrBlocked) {
		return ErrBlacklisted
	}
	return MapWalletError(err)
}
