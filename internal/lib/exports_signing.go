// Package main - Message Signing FFI exports.
// Extracted from exports.go for maintainability.
// Contains: SignMessage, SignTypedData, signTypedDataV4 (helper)
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"runtime/debug"
	"strings"
	"time"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/security"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/bip39service"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/hdkey"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/wallet"
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
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

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
		WalletID   string `json:"walletId"`
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
		USBPath    string `json:"usbPath"`
		Address    string `json:"address"`
		Message    string `json:"message"`
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

	// Step 1: Decrypt wallet to get mnemonic
	walletSvc := wallet.NewWalletService(input.USBPath)
	mnemonic, err := walletSvc.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&mnemonic)

	// Step 2: Load wallet metadata to get AddressBook
	walletObj, err := walletSvc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 3: Find the address in AddressBook to get derivation path
	if walletObj.AddressBook == nil {
		response := NewErrorResponse(ErrStorageError, "Wallet has no AddressBook")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var derivationPath string
	found := false
	for _, addr := range walletObj.AddressBook.Addresses {
		if strings.EqualFold(addr.Address, input.Address) {
			derivationPath = addr.DerivationPath
			found = true
			break
		}
	}

	if !found {
		response := NewErrorResponse(ErrInvalidInput, "Address not found in wallet")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 4: Derive private key for the specific address
	bip39Svc := bip39service.NewBIP39Service()
	hdkeySvc := hdkey.NewHDKeyService()

	// Mnemonic → Seed
	seed, err := bip39Svc.MnemonicToSeed(mnemonic, input.Passphrase)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Seed → Master Key
	masterKey, err := hdkeySvc.NewMasterKey(seed)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Master Key → Child Key (using derivation path)
	childKey, err := hdkeySvc.DerivePath(masterKey, derivationPath)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Child Key → Private Key (raw bytes)
	privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer security.SecureZero(privateKeyBytes)

	// Convert to ECDSA private key
	privateKey, err := ethcrypto.ToECDSA(privateKeyBytes)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 5: Prepare message bytes
	var messageBytes []byte
	if strings.HasPrefix(input.Message, "0x") || strings.HasPrefix(input.Message, "0X") {
		// Hex-encoded message - strip the 0x prefix before decoding
		hexStr := strings.TrimPrefix(strings.TrimPrefix(input.Message, "0x"), "0X")
		messageBytes, err = hexToBytes(hexStr)
		if err != nil {
			response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}
	} else {
		// Plain text message
		messageBytes = []byte(input.Message)
	}

	// Step 6: Create EIP-191 hash
	// Format: "\x19Ethereum Signed Message:\n" + len(message) + message
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(messageBytes))
	prefixedMessage := append([]byte(prefix), messageBytes...)
	messageHash := ethcrypto.Keccak256Hash(prefixedMessage)

	// Step 7: Sign the hash
	signature, err := ethcrypto.Sign(messageHash.Bytes(), privateKey)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Adjust v value for Ethereum compatibility (add 27)
	// go-ethereum returns v as 0 or 1, but Ethereum expects 27 or 28
	if signature[64] < 27 {
		signature[64] += 27
	}

	// Step 8: Return result
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
		WalletID   string `json:"walletId"`
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
		USBPath    string `json:"usbPath"`
		Address    string `json:"address"`
		TypedData  string `json:"typedData"`
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

	// Step 1: Decrypt wallet to get mnemonic
	walletSvc := wallet.NewWalletService(input.USBPath)
	mnemonic, err := walletSvc.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&mnemonic)

	// Step 2: Load wallet metadata to find derivation path
	walletObj, err := walletSvc.LoadWallet(input.WalletID)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 3: Find derivation path for the address
	var derivationPath string
	for _, addr := range walletObj.AddressBook.Addresses {
		if strings.EqualFold(addr.Address, input.Address) {
			derivationPath = addr.DerivationPath
			break
		}
	}
	if derivationPath == "" {
		response := NewErrorResponse(ErrTransactionSignFailed, "Address not found in wallet")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 4: Derive private key
	bip39Svc := bip39service.NewBIP39Service()
	hdkeySvc := hdkey.NewHDKeyService()

	seed, err := bip39Svc.MnemonicToSeed(mnemonic, input.Passphrase)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer security.SecureZero(seed)

	masterKey, err := hdkeySvc.NewMasterKey(seed)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	childKey, err := hdkeySvc.DerivePath(masterKey, derivationPath)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer security.SecureZero(privateKeyBytes)

	privateKey, err := ethcrypto.ToECDSA(privateKeyBytes)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 5: Sign EIP-712 typed data using go-ethereum's signer
	signature, err := signTypedDataV4(privateKey, typedData)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 6: Return result
	output := map[string]interface{}{
		"signature": fmt.Sprintf("0x%x", signature),
		"signedBy":  input.Address,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// signTypedDataV4 signs EIP-712 typed data using go-ethereum's apitypes
func signTypedDataV4(privateKey *ecdsa.PrivateKey, typedData apitypes.TypedData) ([]byte, error) {
	// Hash the typed data
	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return nil, fmt.Errorf("failed to hash domain: %w", err)
	}

	typedDataHash, err := typedData.HashStruct(typedData.PrimaryType, typedData.Message)
	if err != nil {
		return nil, fmt.Errorf("failed to hash message: %w", err)
	}

	// Create the final hash: keccak256("\x19\x01" || domainSeparator || typedDataHash)
	rawData := []byte(fmt.Sprintf("\x19\x01%s%s", string(domainSeparator), string(typedDataHash)))
	hash := ethcrypto.Keccak256Hash(rawData)

	// Sign the hash
	signature, err := ethcrypto.Sign(hash.Bytes(), privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign: %w", err)
	}

	// Adjust v value for Ethereum (add 27)
	if signature[64] < 27 {
		signature[64] += 27
	}

	return signature, nil
}
