// Package main provides transaction-related FFI exports for the arcSign wallet library.
// This file contains BuildTransaction, SignTransaction, BroadcastTransaction,
// QueryTransactionStatus, and EstimateFee — extracted from exports.go.
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"runtime/debug"
	"strings"
	"time"

	"github.com/arcsignio/arcsign/internal/provider"
	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/security/simulation"
	"github.com/arcsignio/arcsign/internal/services/bip39service"
	chainadapterService "github.com/arcsignio/arcsign/internal/services/chainadapter"
	"github.com/arcsignio/arcsign/internal/services/hdkey"
	"github.com/arcsignio/arcsign/internal/services/wallet"
	"github.com/arcsignio/arcsign/src/chainadapter"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

//export BuildTransaction
// BuildTransaction constructs an unsigned transaction ready for signing.
// Feature: 006-chain-adapter - ChainAdapter Transaction FFI
// Security: Uses session token for app-level auth (low-risk operation).
//
// Input JSON: {
//   "chainId": "bitcoin" | "ethereum" | "ethereum-sepolia",
//   "from": "address",
//   "to": "address",
//   "asset": "BTC" | "ETH",
//   "amount": "1000000",  // string representation of big.Int
//   "feeSpeed": "slow" | "normal" | "fast",
//   "memo": "optional",
//   "tokenAddress": "optional ERC-20 contract address",
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",    // REQUIRED: Valid session token
//   "appPassword": "app-password"       // DEPRECATED: Use sessionToken instead
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "id": "unique-tx-id",
//     "chainId": "bitcoin",
//     "from": "address",
//     "to": "address",
//     "amount": "1000000",
//     "fee": "5000",
//     "signingPayload": "base64-encoded-bytes",
//     "humanReadable": "JSON representation for audit"
//   }
// }
func BuildTransaction(params *C.char) (result *C.char) {
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
		ChainID      string `json:"chainId"`
		From         string `json:"from"`
		To           string `json:"to"`
		Asset        string `json:"asset"`
		Amount       string `json:"amount"`       // string representation of big.Int
		FeeSpeed     string `json:"feeSpeed"`     // "slow", "normal", "fast"
		Memo         string `json:"memo"`         // optional
		TokenAddress string `json:"tokenAddress"` // optional: ERC-20 token contract address
		USBPath      string `json:"usbPath"`      // USB path for provider config
		SessionToken string `json:"sessionToken"` // PREFERRED: Session token for app auth
		AppPassword  string `json:"appPassword"`  // DEPRECATED: App password for decryption
		IsPro        bool   `json:"isPro"`        // Pro membership status (for security features)
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
	defer zeroString(&input.AppPassword)

	// Rate limiting: prevent transaction build spam
	if !txRateLimiter.AllowAttempt(input.USBPath) {
		response := NewErrorResponse(ErrRateLimitExceeded,
			"Too many transaction requests. Please wait before trying again.")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 0: Validate session token and get appPassword
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Build RPC endpoint from provider configuration
	rpcEndpoint := ""
	alchemyAPIKey := "" // Captured for transaction simulation
	if input.USBPath != "" && appPassword != "" {
		// Load provider config to get Alchemy API key
		configPath := input.USBPath + "/provider_config.enc"
		store, err := provider.NewProviderConfigStore(configPath, appPassword)
		if err == nil {
			defer store.Close()
			// Try to get provider - first try "global", then chain-specific
			var config *provider.ProviderConfig
			config, err = store.GetBestProvider("global")
			if err != nil {
				// Fallback to chain-specific provider
				config, err = store.GetBestProvider("ethereum")
			}
			if err == nil && config != nil && config.APIKey != "" {
				alchemyAPIKey = config.APIKey
				// Build Alchemy RPC URL based on chain
				rpcEndpoint = buildAlchemyRPCEndpoint(input.ChainID, config.APIKey)
			}
		}
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Parse amount string to *big.Int
	amount, err := chainadapterService.ParseAmount(input.Amount)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Convert feeSpeed string to enum
	var feeSpeed chainadapter.FeeSpeed
	switch input.FeeSpeed {
	case "slow":
		feeSpeed = chainadapter.FeeSpeedSlow
	case "normal":
		feeSpeed = chainadapter.FeeSpeedNormal
	case "fast":
		feeSpeed = chainadapter.FeeSpeedFast
	default:
		feeSpeed = chainadapter.FeeSpeedNormal // default
	}

	// Create transaction request
	req := &chainadapter.TransactionRequest{
		From:     input.From,
		To:       input.To,
		Asset:    input.Asset,
		Amount:   amount,
		FeeSpeed: feeSpeed,
		Memo:     input.Memo,
	}

	// Add ERC-20 token address to ChainSpecific if provided
	if input.TokenAddress != "" {
		req.ChainSpecific = map[string]interface{}{
			"token_address": input.TokenAddress,
		}
	}

	// Build unsigned transaction
	ctx := context.Background()
	unsigned, err := svc.BuildTransaction(ctx, input.ChainID, req, rpcEndpoint)
	if err != nil {
		response := NewErrorResponse(ErrTransactionBuildFailed, GetUserFriendlyMessage(ErrTransactionBuildFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Encode signing payload as base64 for JSON transport
	signingPayloadB64 := base64.StdEncoding.EncodeToString(unsigned.SigningPayload)

	// Perform security check (blacklist + simulation) via TxGuard
	guard := initTxGuard()
	txValue := "0x0"
	txData := ""
	if unsigned.ChainSpecific != nil {
		if v, ok := unsigned.ChainSpecific["tx_value"]; ok {
			if vs, ok := v.(string); ok {
				txValue = vs
			}
		}
		if d, ok := unsigned.ChainSpecific["data"]; ok {
			if ds, ok := d.(string); ok {
				txData = ds
			}
		}
	}
	securityReport := guard.Check(ctx, input.IsPro, input.To, input.ChainID, alchemyAPIKey, simulation.TxParams{
		From:  input.From,
		To:    input.To,
		Value: txValue,
		Data:  txData,
	})

	// Marshal response
	data := map[string]interface{}{
		"id":              unsigned.ID,
		"chainId":         unsigned.ChainID,
		"from":            unsigned.From,
		"to":              unsigned.To,
		"amount":          unsigned.Amount.String(),
		"fee":             unsigned.Fee.String(),
		"signingPayload":  signingPayloadB64,
		"humanReadable":   unsigned.HumanReadable,
		"buildTimestamp":  time.Now().Format(time.RFC3339),
		"chainSpecific":   unsigned.ChainSpecific, // Critical for transaction reconstruction during signing
		"security":        securityReport,          // Security report (Pro: full check, Free: proRequired=true)
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export SignTransaction
// SignTransaction signs an unsigned transaction using wallet password.
// Feature: 006-chain-adapter - ChainAdapter Transaction FFI
//
// Security Design:
// - Private key is derived on-demand from mnemonic using password
// - Private key exists only during signing (~50-100ms)
// - All sensitive data (password, mnemonic, privateKey) cleared after use
//
// Input JSON: {
//   "walletId": "uuid-xxx",
//   "password": "user-password",
//   "passphrase": "bip39-passphrase",  // Optional BIP39 passphrase (empty string if not used)
//   "usbPath": "/path/to/usb",
//   "chainId": "bitcoin" | "ethereum",
//   "unsignedTx": {...}  // UnsignedTransaction from BuildTransaction (includes "from" address)
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "txHash": "0x...",
//     "signature": "base64-encoded-signature",
//     "serializedTx": "base64-encoded-serialized-tx",
//     "signedBy": "address"
//   }
// }
func SignTransaction(params *C.char) (result *C.char) {
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
		WalletID     string                 `json:"walletId"`
		Password     string                 `json:"password"`     // Wallet password (for signing)
		Passphrase   string                 `json:"passphrase"`   // BIP39 passphrase (empty if not used)
		USBPath      string                 `json:"usbPath"`
		ChainID      string                 `json:"chainId"`
		UnsignedTx   map[string]interface{} `json:"unsignedTx"`
		SessionToken string                 `json:"sessionToken"` // PREFERRED: Session token for session validation
		AppPassword  string                 `json:"appPassword"`  // DEPRECATED: Backward compatibility
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
	defer zeroString(&input.AppPassword)

	// Rate limiting: prevent brute-force on wallet signing
	if !walletRateLimiter.AllowAttempt(input.WalletID) {
		remaining := walletRateLimiter.GetRemainingAttempts(input.WalletID)
		response := NewErrorResponse(ErrRateLimitExceeded,
			fmt.Sprintf("Too many signing attempts. Please wait before trying again. (%d attempts remaining)", remaining))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 0a: Validate session token (optional - for provider config access if needed)
	// SignTransaction mainly uses wallet password, but session validation is useful
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil && input.SessionToken != "" {
		// Only fail if sessionToken was explicitly provided but is invalid
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Step 0b: Check if wallet is locked (before any expensive operations)
	// Locked wallets cannot sign transactions - this enforces the wallet limit
	sm := initSessionManager()
	if session := sm.GetSessionByUSBPath(input.USBPath); session != nil {
		if session.IsWalletLocked(input.WalletID) {
			response := NewErrorResponse(ErrWalletLocked, "Wallet is locked due to exceeding the wallet limit. Please upgrade your membership or remove newer wallets to unlock this wallet.")
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}
	}
	// Note: If no session exists, we proceed with the transaction
	// This allows signing when the user hasn't logged in yet (fallback mode)
	// The wallet limit is still enforced at the UI level in this case

	// Step 1: Decrypt wallet to get mnemonic
	walletSvc := wallet.NewWalletService(input.USBPath)
	mnemonic, err := walletSvc.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&mnemonic) // Critical: clear mnemonic after use

	// Step 2: Load wallet metadata to get AddressBook
	walletObj, err := walletSvc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 3: Manually reconstruct UnsignedTransaction from map
	// Note: *big.Int fields can't be directly unmarshalled from JSON strings
	unsigned := chainadapter.UnsignedTransaction{}

	// Extract string fields
	if id, ok := input.UnsignedTx["id"].(string); ok {
		unsigned.ID = id
	}
	if chainID, ok := input.UnsignedTx["chainId"].(string); ok {
		unsigned.ChainID = chainID
	}
	if from, ok := input.UnsignedTx["from"].(string); ok {
		unsigned.From = from
	}
	if to, ok := input.UnsignedTx["to"].(string); ok {
		unsigned.To = to
	}
	if humanReadable, ok := input.UnsignedTx["humanReadable"].(string); ok {
		unsigned.HumanReadable = humanReadable
	}

	// Parse Amount (string -> *big.Int)
	if amountStr, ok := input.UnsignedTx["amount"].(string); ok {
		amount := new(big.Int)
		if _, success := amount.SetString(amountStr, 10); success {
			unsigned.Amount = amount
		}
	}

	// Parse Fee (string -> *big.Int)
	if feeStr, ok := input.UnsignedTx["fee"].(string); ok {
		fee := new(big.Int)
		if _, success := fee.SetString(feeStr, 10); success {
			unsigned.Fee = fee
		}
	}

	// Decode base64 signing payload
	if payloadStr, ok := input.UnsignedTx["signingPayload"].(string); ok {
		decoded, err := base64.StdEncoding.DecodeString(payloadStr)
		if err == nil {
			unsigned.SigningPayload = decoded
		}
	}

	// Parse ChainSpecific (critical for transaction reconstruction)
	if chainSpecific, ok := input.UnsignedTx["chainSpecific"].(map[string]interface{}); ok {
		unsigned.ChainSpecific = chainSpecific
	}

	// Step 4: Find derivation path from AddressBook using "from" address
	if walletObj.AddressBook == nil {
		response := NewErrorResponse(ErrStorageError, "Wallet has no AddressBook")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var derivationPath string
	found := false
	for _, addr := range walletObj.AddressBook.Addresses {
		if addr.Address == unsigned.From {
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

	// Step 5: Derive private key from mnemonic + derivation path
	bip39Svc := bip39service.NewBIP39Service()
	hdkeySvc := hdkey.NewHDKeyService()

	// Mnemonic → Seed (use provided passphrase, empty string if not used)
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
	// SECURITY: Use SecureAlloc to try mlock the memory
	privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	// Note: privateKeyBytes will be zeroed by SecureSigner constructor

	// Debug: Verify derived address matches expected address (only in dev mode)
	// This verification is done BEFORE creating SecureSigner because SecureSigner zeros the key
	if strings.HasPrefix(input.ChainID, "ethereum") || strings.HasPrefix(input.ChainID, "bsc") ||
		strings.HasPrefix(input.ChainID, "polygon") || strings.HasPrefix(input.ChainID, "arbitrum") ||
		strings.HasPrefix(input.ChainID, "optimism") || strings.HasPrefix(input.ChainID, "base") {
		// Temporarily derive address for verification (will be zeroed with privateKeyBytes)
		ethPrivKey, ethErr := ethcrypto.ToECDSA(privateKeyBytes)
		if ethErr == nil {
			derivedAddr := ethcrypto.PubkeyToAddress(ethPrivKey.PublicKey)
			if !strings.EqualFold(derivedAddr.Hex(), unsigned.From) {
				// Address mismatch - return error instead of logging sensitive data
				response := NewErrorResponse(ErrEncryptionError, "Key derivation address mismatch")
				jsonBytes, _ := json.Marshal(response)
				return C.CString(string(jsonBytes))
			}
		}
	}

	// Step 6: Create SecureSigner with XOR-split key storage
	// SECURITY IMPROVEMENT: Private key is split into 3 XOR shares immediately
	// The original privateKeyBytes is zeroed by NewSecureSigner
	// Key is only reconstructed momentarily during signing (~1-5ms exposure vs ~50-100ms before)
	secureSigner, err := security.NewSecureSigner(privateKeyBytes, unsigned.From, input.ChainID)
	if err != nil {
		// If signer creation fails, manually zero the key
		security.SecureZero(privateKeyBytes)
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer secureSigner.Zeroize() // Clear XOR shares from memory

	// Step 7: Sign transaction using ChainAdapter with SecureSigner
	// The SecureSigner implements chainadapter.Signer interface
	// Key is only reconstructed during actual signing (~1-5ms exposure)
	chainAdapterSvc := initChainAdapterService()
	ctx := context.Background()
	signed, err := chainAdapterSvc.SignTransaction(ctx, input.ChainID, &unsigned, secureSigner, "")
	if err != nil {
		response := NewErrorResponse(ErrTransactionSignFailed, GetUserFriendlyMessage(ErrTransactionSignFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 8: Encode signature and serialized tx as base64 for JSON transport
	signatureB64 := base64.StdEncoding.EncodeToString(signed.Signature)
	serializedTxB64 := base64.StdEncoding.EncodeToString(signed.SerializedTx)

	// Step 9: Return signed transaction (no sensitive data)
	data := map[string]interface{}{
		"txHash":        signed.TxHash,
		"signature":     signatureB64,
		"serializedTx":  serializedTxB64,
		"signedBy":      unsigned.From,
		"signTimestamp": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export BroadcastTransaction
// BroadcastTransaction submits a signed transaction to the blockchain network.
// Feature: 006-chain-adapter - ChainAdapter Transaction FFI
//
// Input JSON: {
//   "chainId": "bitcoin" | "ethereum",
//   "signedTx": {...},  // SignedTransaction from SignTransaction
//   "rpcConfig": "optional-rpc-endpoint"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "txHash": "0x...",
//     "chainId": "bitcoin",
//     "submittedAt": "2025-11-04T15:30:00Z",
//     "status": "pending",
//     "statusUrl": "https://blockexplorer.com/tx/..."
//   }
// }
func BroadcastTransaction(params *C.char) (result *C.char) {
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
		ChainID      string                 `json:"chainId"`
		SignedTx     map[string]interface{} `json:"signedTx"`
		RPCConfig    string                 `json:"rpcConfig"`
		USBPath      string                 `json:"usbPath"`
		SessionToken string                 `json:"sessionToken"` // PREFERRED: Session token
		AppPassword  string                 `json:"appPassword"`  // DEPRECATED
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

	// Rate limiting: prevent broadcast spam
	if !txRateLimiter.AllowAttempt(input.USBPath) {
		response := NewErrorResponse(ErrRateLimitExceeded,
			"Too many broadcast requests. Please wait before trying again.")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate session token and get appPassword
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Build RPC endpoint from provider configuration (same as BuildTransaction)
	rpcEndpoint := input.RPCConfig
	if rpcEndpoint == "" && input.USBPath != "" && appPassword != "" {
		configPath := input.USBPath + "/provider_config.enc"
		store, err := provider.NewProviderConfigStore(configPath, appPassword)
		if err == nil {
			defer store.Close()
			var config *provider.ProviderConfig
			config, err = store.GetBestProvider("global")
			if err != nil {
				config, err = store.GetBestProvider("ethereum")
			}
			if err == nil && config != nil && config.APIKey != "" {
				rpcEndpoint = buildAlchemyRPCEndpoint(input.ChainID, config.APIKey)
			}
		}
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Reconstruct SignedTransaction from map
	signedBytes, err := json.Marshal(input.SignedTx)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var signed chainadapter.SignedTransaction
	if err := json.Unmarshal(signedBytes, &signed); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Decode base64 fields if they were encoded
	if len(signed.Signature) == 0 {
		if sigStr, ok := input.SignedTx["signature"].(string); ok {
			decoded, err := base64.StdEncoding.DecodeString(sigStr)
			if err == nil {
				signed.Signature = decoded
			}
		}
	}
	if len(signed.SerializedTx) == 0 {
		if txStr, ok := input.SignedTx["serializedTx"].(string); ok {
			decoded, err := base64.StdEncoding.DecodeString(txStr)
			if err == nil {
				signed.SerializedTx = decoded
			}
		}
	}

	// Broadcast transaction
	ctx := context.Background()
	receipt, err := svc.BroadcastTransaction(ctx, input.ChainID, &signed, rpcEndpoint)
	if err != nil {
		response := NewErrorResponse(ErrTransactionBroadcastFailed, GetUserFriendlyMessage(ErrTransactionBroadcastFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Marshal response
	data := map[string]interface{}{
		"txHash":      receipt.TxHash,
		"chainId":     input.ChainID,
		"submittedAt": receipt.SubmittedAt.Format(time.RFC3339),
		"status":      "pending",
		"statusUrl":   receipt.StatusURL,
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export QueryTransactionStatus
// QueryTransactionStatus retrieves the current status of a transaction.
// Feature: 006-chain-adapter - ChainAdapter Transaction FFI
//
// Input JSON: {
//   "chainId": "bitcoin" | "ethereum",
//   "txHash": "0x..." | "bitcoin-tx-hash",
//   "rpcConfig": "optional-rpc-endpoint"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "txHash": "0x...",
//     "status": "pending" | "confirmed" | "finalized" | "failed",
//     "confirmations": 3,
//     "blockNumber": 12345,
//     "blockHash": "0x...",
//     "updatedAt": "2025-11-04T15:35:00Z"
//   }
// }
func QueryTransactionStatus(params *C.char) (result *C.char) {
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
		ChainID      string `json:"chainId"`
		TxHash       string `json:"txHash"`
		RPCConfig    string `json:"rpcConfig"`
		USBPath      string `json:"usbPath"`      // USB path for provider config
		SessionToken string `json:"sessionToken"` // PREFERRED: Session token
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

	// Validate session token and get appPassword (optional for this read-only operation)
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil && input.SessionToken != "" {
		// Only fail if sessionToken was explicitly provided but is invalid
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Build RPC endpoint from provider config if not provided
	rpcConfig := input.RPCConfig
	if rpcConfig == "" && input.USBPath != "" && appPassword != "" {
		configPath := input.USBPath + "/provider_config.enc"
		store, err := provider.NewProviderConfigStore(configPath, appPassword)
		if err == nil {
			defer store.Close()
			var config *provider.ProviderConfig
			config, err = store.GetBestProvider("global")
			if err != nil {
				config, err = store.GetBestProvider("ethereum")
			}
			if err == nil && config != nil && config.APIKey != "" {
				rpcConfig = buildAlchemyRPCEndpoint(input.ChainID, config.APIKey)
			}
		}
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Query transaction status
	ctx := context.Background()
	status, err := svc.QueryTransactionStatus(ctx, input.ChainID, input.TxHash, rpcConfig)
	if err != nil {
		response := NewErrorResponse(ErrTransactionQueryFailed, GetUserFriendlyMessage(ErrTransactionQueryFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Convert status to string
	var statusStr string
	switch status.Status {
	case chainadapter.TxStatusPending:
		statusStr = "pending"
	case chainadapter.TxStatusConfirmed:
		statusStr = "confirmed"
	case chainadapter.TxStatusFinalized:
		statusStr = "finalized"
	case chainadapter.TxStatusFailed:
		statusStr = "failed"
	default:
		statusStr = "unknown"
	}

	// Marshal response
	data := map[string]interface{}{
		"txHash":        status.TxHash,
		"status":        statusStr,
		"confirmations": status.Confirmations,
		"blockNumber":   status.BlockNumber,
		"blockHash":     status.BlockHash,
		"updatedAt":     status.UpdatedAt.Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export EstimateFee
// EstimateFee calculates fee estimates with confidence bounds.
// Feature: 006-chain-adapter - ChainAdapter Transaction FFI
//
// Input JSON: {
//   "chainId": "bitcoin" | "ethereum",
//   "from": "address",
//   "to": "address",
//   "asset": "BTC" | "ETH",
//   "amount": "1000000",
//   "rpcConfig": "optional-rpc-endpoint"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "chainId": "bitcoin",
//     "minFee": "1000",
//     "recommendedFee": "5000",
//     "maxFee": "10000",
//     "confidence": 85,
//     "estimatedBlocks": 6,
//     "timestamp": "2025-11-04T15:40:00Z"
//   }
// }
func EstimateFee(params *C.char) (result *C.char) {
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
		ChainID   string `json:"chainId"`
		From      string `json:"from"`
		To        string `json:"to"`
		Asset     string `json:"asset"`
		Amount    string `json:"amount"`
		RPCConfig string `json:"rpcConfig"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Parse amount string to *big.Int
	amount, err := chainadapterService.ParseAmount(input.Amount)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Create transaction request for fee estimation
	req := &chainadapter.TransactionRequest{
		From:   input.From,
		To:     input.To,
		Asset:  input.Asset,
		Amount: amount,
	}

	// Estimate fee
	ctx := context.Background()
	estimate, err := svc.EstimateFee(ctx, input.ChainID, req, input.RPCConfig)
	if err != nil {
		response := NewErrorResponse(ErrFeeEstimationFailed, GetUserFriendlyMessage(ErrFeeEstimationFailed))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Marshal response
	data := map[string]interface{}{
		"chainId":         input.ChainID,
		"minFee":          estimate.MinFee.String(),
		"recommendedFee":  estimate.Recommended.String(),
		"maxFee":          estimate.MaxFee.String(),
		"confidence":      estimate.Confidence,
		"estimatedBlocks": estimate.EstimatedBlocks,
		"timestamp":       estimate.Timestamp.Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export CheckTransactionSecurity
// CheckTransactionSecurity runs the txguard risk engine (blacklist + simulation)
// for a transaction WITHOUT building or signing it. Used by the WalletConnect and
// mint-page signing paths to surface a SecurityReport before the user signs.
// Reuses the same lazy global guard and provider-key loading as BuildTransaction.
// Pro-gated inside guard.Check (Free → proRequired); never blocks signing.
func CheckTransactionSecurity(params *C.char) (result *C.char) {
	defer func() {
		if r := recover(); r != nil {
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
		ChainID      string `json:"chainId"`
		From         string `json:"from"`
		To           string `json:"to"`
		Value        string `json:"value"`
		Data         string `json:"data"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
		IsPro        bool   `json:"isPro"`
	}
	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&input.AppPassword)

	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Load Alchemy key for simulation (same pattern as BuildTransaction).
	// Missing key is fine — guard.Check degrades gracefully (blacklist still runs).
	alchemyAPIKey := ""
	if input.USBPath != "" && appPassword != "" {
		configPath := input.USBPath + "/provider_config.enc"
		store, err := provider.NewProviderConfigStore(configPath, appPassword)
		if err == nil {
			defer store.Close()
			config, e := store.GetBestProvider("global")
			if e != nil {
				config, e = store.GetBestProvider("ethereum")
			}
			if e == nil && config != nil {
				alchemyAPIKey = config.APIKey
			}
		}
	}

	guard := initTxGuard()
	report := guard.Check(context.Background(), input.IsPro, input.To, input.ChainID, alchemyAPIKey, simulation.TxParams{
		From:  input.From,
		To:    input.To,
		Value: input.Value,
		Data:  input.Data,
	})

	response := NewSuccessResponse(report)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}
