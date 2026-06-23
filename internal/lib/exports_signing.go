// Package main - Message Signing FFI exports.
// Extracted from exports.go for maintainability.
// Contains: SignMessage, SignTypedData; helpers: eip191Hash, hashTypedDataV4
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"runtime/debug"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/services/bip39service"
	"github.com/arcsignio/arcsign/internal/services/hdkey"
	"github.com/arcsignio/arcsign/internal/services/wallet"
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
	// Step 4b: Create SecureSigner with XOR-split key storage.
	// SECURITY: privateKeyBytes is split into 3 XOR shares and zeroed here;
	// the key is only reconstructed momentarily inside SignHash (~1-5ms).
	// This matches SignTransaction so all signing paths share one protection.
	// chainID is "ethereum": EIP-191 signatures are a raw secp256k1 sig over a
	// hash and are identical across the EVM family.
	secureSigner, err := security.NewSecureSigner(privateKeyBytes, input.Address, "ethereum")
	if err != nil {
		security.SecureZero(privateKeyBytes)
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer secureSigner.Zeroize()

	// Step 5+6: Build the EIP-191 hash (message decode + prefix + keccak).
	messageHashBytes, err := eip191Hash(input.Message)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	messageHash := common.BytesToHash(messageHashBytes)

	// Step 7: Sign the hash via SecureSigner (XOR-split, key reconstructed
	// only during the crypto op). Byte-identical to the former plaintext path.
	signature, err := secureSigner.SignHash(messageHashBytes, input.Address)
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
	// Create SecureSigner with XOR-split key storage (zeroes privateKeyBytes).
	// SECURITY: the key is only reconstructed momentarily inside SignHash,
	// matching SignTransaction / SignMessage. chainID is "ethereum" because an
	// EIP-712 signature is a raw secp256k1 sig over a hash, identical across EVM.
	secureSigner, err := security.NewSecureSigner(privateKeyBytes, input.Address, "ethereum")
	if err != nil {
		security.SecureZero(privateKeyBytes)
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer secureSigner.Zeroize()

	// Step 5: Hash EIP-712 typed data, then sign via SecureSigner.
	hash, err := hashTypedDataV4(typedData)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	signature, err := secureSigner.SignHash(hash.Bytes(), input.Address)
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Adjust v value for Ethereum compatibility (go-ethereum returns 0/1).
	if signature[64] < 27 {
		signature[64] += 27
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
