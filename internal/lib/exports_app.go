// Package main - App lifecycle and asset data FFI exports.
// Extracted from exports.go for maintainability.
// Contains: IsFirstTimeSetup, InitializeApp, UnlockApp, GetTokenBalances,
//           loadNodeRealAPIKey, GetNFTs, GetTokenApprovals
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"runtime/debug"
	"time"

	"github.com/arcsignio/arcsign/internal/app"
	"github.com/arcsignio/arcsign/internal/models"
	"github.com/arcsignio/arcsign/internal/provider"
	"github.com/arcsignio/arcsign/internal/services/wallet"
)

//export IsFirstTimeSetup
// IsFirstTimeSetup checks if app_config.enc exists at the USB path.
// Feature: App-level authentication
//
// Input JSON: {
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "isFirstTime": true  // true if app_config.enc doesn't exist
//   }
// }
func IsFirstTimeSetup(params *C.char) (result *C.char) {
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
		USBPath string `json:"usbPath"`
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

	// Check if app_config.enc exists
	exists := app.AppConfigExists(input.USBPath)
	isFirstTime := !exists

	data := map[string]interface{}{
		"isFirstTime": isFirstTime,
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export InitializeApp
// InitializeApp creates a new encrypted app_config.enc file for first-time setup.
// Feature: App-level authentication
//
// Input JSON: {
//   "password": "user-master-password",
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "message": "App initialized successfully"
//   }
// }
func InitializeApp(params *C.char) (result *C.char) {
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
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
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

	// Security: Clear password after use
	defer zeroString(&input.Password)

	// Initialize app config
	if err := app.InitializeAppConfig(input.Password, input.USBPath); err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	data := map[string]interface{}{
		"message": "App initialized successfully",
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export UnlockApp
// UnlockApp decrypts and loads app_config.enc using the provided password.
// Feature: App-level authentication
//
// Input JSON: {
//   "password": "user-master-password",
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "config": {
//       "version": "1.0.0",
//       "wallets": [{"id": "...", "name": "...", "createdAt": "..."}],
//       "providers": [{"providerType": "alchemy", "apiKey": "...", "priority": 100, "enabled": true}],
//       "settings": {"theme": "light", "language": "en"}
//     }
//   }
// }
func UnlockApp(params *C.char) (result *C.char) {
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
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
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

	// Security: Clear password after use
	defer zeroString(&input.Password)

	// Rate limiting: prevent brute-force on app password
	// Uses USB path as identifier (one rate limit per device)
	if !appRateLimiter.AllowAttempt(input.USBPath) {
		remaining := appRateLimiter.GetRemainingAttempts(input.USBPath)
		response := NewErrorResponse(ErrRateLimitExceeded,
			fmt.Sprintf("Too many failed attempts. Please wait before trying again. (%d attempts remaining)", remaining))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Load app config
	config, err := app.LoadAppConfig(input.Password, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidPassword, GetUserFriendlyMessage(ErrInvalidPassword))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Success: reset rate limiter for this device
	appRateLimiter.ResetWallet(input.USBPath)

	data := map[string]interface{}{
		"config": config,
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// bucketAddressesByProvider routes each wallet address to its provider, keyed
// by provider type, in the batch shape the WalletDataProvider interface expects.
// includeSepolia adds the Ethereum Sepolia testnet network to Ethereum addresses
// on Alchemy (token-balance-only behavior); pass false for NFTs/transfers.
func bucketAddressesByProvider(addresses []models.DerivedAddress, includeSepolia bool) map[string][]provider.AddressWithNetworks {
	// provider -> address -> networks
	byProvider := make(map[string]map[string][]string)
	for _, addr := range addresses {
		network, ok := provider.GetInternalNetwork(addr.CoinName)
		if !ok {
			continue
		}
		providerType := provider.GetProviderForNetwork(network)
		if byProvider[providerType] == nil {
			byProvider[providerType] = make(map[string][]string)
		}
		byProvider[providerType][addr.Address] = append(byProvider[providerType][addr.Address], network)
		if includeSepolia && providerType == provider.ProviderAlchemy && addr.CoinName == "Ethereum" {
			byProvider[providerType][addr.Address] = append(byProvider[providerType][addr.Address], provider.NetworkEthSepolia)
		}
	}

	out := make(map[string][]provider.AddressWithNetworks, len(byProvider))
	for providerType, addrMap := range byProvider {
		for addr, networks := range addrMap {
			out[providerType] = append(out[providerType], provider.AddressWithNetworks{Address: addr, Networks: networks})
		}
	}
	return out
}

// countBucketedAddresses returns the total number of (address) entries across
// all provider buckets.
func countBucketedAddresses(buckets map[string][]provider.AddressWithNetworks) int {
	n := 0
	for _, addrs := range buckets {
		n += len(addrs)
	}
	return n
}


//export GetTokenBalances
func GetTokenBalances(params *C.char) (result *C.char) {
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
	var input provider.GetTokenBalancesInput
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

	// Security: Clear sensitive data after use
	defer zeroString(&input.Password)
	defer zeroString(&input.AppPassword)

	// Step 0: Validate session token (app-level authentication)
	// This is a low-risk operation, so we use session token instead of appPassword
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Step 1: Load Alchemy API key from provider registry
	// Note: Using provider registry system instead of app config for now
	// Construct full path to provider_config.enc in USB root directory
	providerConfigPath := filepath.Join(input.USBPath, "provider_config.enc")
	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: providerConfigPath = %s", providerConfigPath))
	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Using session token auth: %v", input.SessionToken != ""))

	providerStore, err := provider.NewProviderConfigStore(providerConfigPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer providerStore.Close()

	// API keys are resolved per-provider inside the WalletDataProvider registry
	// (Alchemy/NodeReal need a key, Glacier is anonymous). No key check here.

	// Step 2: Verify wallet password before loading addresses
	// Security: Must authenticate user before exposing wallet data
	walletService := wallet.NewWalletService(input.USBPath)

	// First, verify the password by attempting to restore the wallet
	// This ensures only authorized users can view asset balances
	_, err = walletService.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		// Password verification failed
		code := MapWalletError(err)
		response := NewErrorResponse(code, "Invalid password or wallet access denied")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Password verified successfully, now load wallet metadata
	walletObj, err := walletService.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if walletObj.AddressBook == nil || len(walletObj.AddressBook.Addresses) == 0 {
		emptyOutput := provider.GetTokenBalancesOutput{
			Tokens:       []provider.SimplifiedTokenBalance{},
			TotalUSD:     0,
			AddressCount: 0,
			NetworkCount: 0,
		}
		response := NewSuccessResponse(emptyOutput)
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 3: Separate addresses by provider (Alchemy vs NodeReal vs Glacier)
	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: includeTestnets = %v", input.IncludeTestnets))

	// Step 3: Bucket each address by its provider. The Sepolia testnet special
	// case is token-only and stays here in the bucketing stage.
	buckets := bucketAddressesByProvider(walletObj.AddressBook.Addresses, input.IncludeTestnets)
	totalAddressCount := countBucketedAddresses(buckets)
	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: bucketed %d addresses across %d providers", totalAddressCount, len(buckets)))

	if totalAddressCount == 0 {
		emptyOutput := provider.GetTokenBalancesOutput{
			Tokens:       []provider.SimplifiedTokenBalance{},
			TotalUSD:     0,
			AddressCount: 0,
			NetworkCount: 0,
		}
		response := NewSuccessResponse(emptyOutput)
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 4: Dispatch polymorphically — one call per provider bucket.
	var allTokens []provider.SimplifiedTokenBalance
	var unavailable []provider.ProviderUnavailable
	for providerType, addrs := range buckets {
		wdp, err := provider.GetWalletDataProvider(providerType, providerStore)
		if err != nil || wdp == nil {
			// nil = provider unavailable (almost always a missing API key) —
			// record it so the UI can prompt the user instead of showing blank.
			unavailable = append(unavailable, provider.ProviderUnavailable{Provider: providerType, Reason: "missing_key"})
			continue
		}
		tokens, err := wdp.GetTokenBalances(addrs)
		if err != nil {
			fmt.Printf("%s GetTokenBalances error: %v\n", providerType, err)
			unavailable = append(unavailable, provider.ProviderUnavailable{Provider: providerType, Reason: "query_failed"})
		}
		// A provider running without its key still returns basic balances; report
		// a soft "degraded" hint so the UI can offer to unlock full data, rather
		// than implying the chain is broken.
		if d, ok := wdp.(provider.DegradedProvider); ok && d.IsDegraded() {
			unavailable = append(unavailable, provider.ProviderUnavailable{Provider: providerType, Reason: "degraded"})
		}
		allTokens = append(allTokens, tokens...)
	}

	// Step 4.5: Fill in USD prices for tokens whose provider didn't return one
	// (BSC/NodeReal, native BNB, etc) using DefiLlama (free, no key).
	provider.EnrichPricesWithDefiLlama(allTokens)

	// Step 5: Aggregate results
	var totalUSD float64
	networkSet := make(map[string]bool)
	for _, token := range allTokens {
		totalUSD += token.USDValue
		networkSet[token.Network] = true
	}

	output := provider.GetTokenBalancesOutput{
		Tokens:               allTokens,
		TotalUSD:             totalUSD,
		AddressCount:         totalAddressCount,
		NetworkCount:         len(networkSet),
		UnavailableProviders: unavailable,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetNFTs
// GetNFTs queries NFT holdings for a wallet across multiple chains using Alchemy API.
// Feature: NFT Gallery - Display owned NFTs
//
// Input JSON: {
//   "walletId": "wallet-id",
//   "password": "wallet-password",
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",
//   "appPassword": "app-level-password"
// }
//
// Returns: {"success": true, "data": {"nfts": [...], "totalCount": 5, ...}}
func GetNFTs(params *C.char) (result *C.char) {
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
	var input provider.GetNFTsInput
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

	// Security: Clear sensitive data after use
	defer zeroString(&input.Password)
	defer zeroString(&input.AppPassword)

	// Validate session token (app-level authentication)
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Load Alchemy API key from provider registry
	providerConfigPath := filepath.Join(input.USBPath, "provider_config.enc")
	providerStore, err := provider.NewProviderConfigStore(providerConfigPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer providerStore.Close()

	// API keys are resolved per-provider inside the WalletDataProvider registry.

	// Verify wallet password before loading addresses
	walletService := wallet.NewWalletService(input.USBPath)
	_, err = walletService.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, "Invalid password or wallet access denied")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	walletObj, err := walletService.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if walletObj.AddressBook == nil || len(walletObj.AddressBook.Addresses) == 0 {
		emptyOutput := provider.GetNFTsOutput{
			NFTs:         []provider.SimplifiedNFT{},
			TotalCount:   0,
			AddressCount: 0,
			NetworkCount: 0,
		}
		response := NewSuccessResponse(emptyOutput)
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Bucket addresses by provider (NFTs have no Sepolia special case).
	buckets := bucketAddressesByProvider(walletObj.AddressBook.Addresses, false)
	totalAddressCount := countBucketedAddresses(buckets)
	if totalAddressCount == 0 {
		emptyOutput := provider.GetNFTsOutput{
			NFTs:         []provider.SimplifiedNFT{},
			TotalCount:   0,
			AddressCount: 0,
			NetworkCount: 0,
		}
		response := NewSuccessResponse(emptyOutput)
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Dispatch polymorphically — one call per provider bucket.
	var allNFTs []provider.SimplifiedNFT
	var unavailable []provider.ProviderUnavailable
	for providerType, addrs := range buckets {
		wdp, err := provider.GetWalletDataProvider(providerType, providerStore)
		if err != nil || wdp == nil {
			// nil = provider unavailable (almost always a missing API key) —
			// record it so the UI can prompt the user instead of showing blank.
			unavailable = append(unavailable, provider.ProviderUnavailable{Provider: providerType, Reason: "missing_key"})
			continue
		}
		nfts, err := wdp.GetNFTs(addrs)
		if err != nil {
			fmt.Printf("%s GetNFTs error: %v\n", providerType, err)
			unavailable = append(unavailable, provider.ProviderUnavailable{Provider: providerType, Reason: "query_failed"})
		}
		// A keyless provider that still returns basic data reports "degraded";
		// for NFTs there is no degraded path, but keep the shape consistent.
		if d, ok := wdp.(provider.DegradedProvider); ok && d.IsDegraded() {
			unavailable = append(unavailable, provider.ProviderUnavailable{Provider: providerType, Reason: "degraded"})
		}
		allNFTs = append(allNFTs, nfts...)
	}

	// Aggregate results
	networkSet := make(map[string]bool)
	for _, nft := range allNFTs {
		networkSet[nft.Network] = true
	}

	output := provider.GetNFTsOutput{
		NFTs:                 allNFTs,
		TotalCount:           len(allNFTs),
		AddressCount:         totalAddressCount,
		NetworkCount:         len(networkSet),
		UnavailableProviders: unavailable,
	}

	nftResponse := NewSuccessResponse(output)
	nftJsonBytes, _ := json.Marshal(nftResponse)
	return C.CString(string(nftJsonBytes))
}

//export GetTokenApprovals
// GetTokenApprovals queries all active ERC-20 token approvals for a wallet's EVM addresses.
// Uses eth_getLogs (Approval events) + eth_call (allowance) to find active approvals.
// Feature: Token Approvals Management (v1.3 Dashboard)
//
// Input JSON: {
//   "walletId": "wallet-uuid",
//   "password": "wallet-password",
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",
//   "appPassword": "app-password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "approvals": [{ tokenAddress, tokenName, tokenSymbol, spender, allowance, isUnlimited, network, networkLabel, ownerAddress }],
//     "totalCount": 5
//   }
// }
func GetTokenApprovals(params *C.char) (result *C.char) {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetTokenApprovals completed in %v", elapsed))
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
	var input provider.GetTokenApprovalsInput
	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate USB path
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.Password)
	defer zeroString(&input.AppPassword)

	// Validate session token
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Load Alchemy API key
	providerConfigPath := filepath.Join(input.USBPath, "provider_config.enc")
	providerStore, err := provider.NewProviderConfigStore(providerConfigPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer providerStore.Close()

	// Resolve the Alchemy key the same tolerant way the assets path does
	// (LoadProviderAPIKey checks the configured key aliases under "global" and
	// returns "" rather than a hard error when nothing is configured). Token
	// approvals require an Alchemy key — there is no key-free fallback for the
	// eth_getLogs Approval-event scan — so a missing key is a clear, actionable
	// message, not a scary STORAGE_ERROR.
	alchemyAPIKey := provider.LoadProviderAPIKey(providerStore, provider.ProviderAlchemy)
	if alchemyAPIKey == "" {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy API key not configured. Add it in Provider settings to scan token approvals.")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Verify wallet password
	walletService := wallet.NewWalletService(input.USBPath)
	_, err = walletService.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, "Invalid password or wallet access denied")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	walletObj, err := walletService.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if walletObj.AddressBook == nil || len(walletObj.AddressBook.Addresses) == 0 {
		emptyOutput := provider.GetTokenApprovalsOutput{
			Approvals:  []provider.ApprovalEntry{},
			TotalCount: 0,
		}
		response := NewSuccessResponse(emptyOutput)
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Build address-network map (only EVM mainnet addresses)
	addressNetworkMap := make(map[string][]string)
	for _, addr := range walletObj.AddressBook.Addresses {
		network, ok := provider.GetAlchemyNetwork(addr.CoinName)
		if !ok {
			continue
		}
		addressNetworkMap[addr.Address] = append(addressNetworkMap[addr.Address], network)
	}

	if len(addressNetworkMap) == 0 {
		emptyOutput := provider.GetTokenApprovalsOutput{
			Approvals:  []provider.ApprovalEntry{},
			TotalCount: 0,
		}
		response := NewSuccessResponse(emptyOutput)
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Query approval events for each address on each network
	alchemyClient := provider.NewAlchemyClient(alchemyAPIKey)
	var allApprovals []provider.ApprovalEntry

	for address, networks := range addressNetworkMap {
		for _, network := range networks {
			approvals, err := alchemyClient.GetApprovalEvents(address, network)
			if err != nil {
				debugLog(fmt.Sprintf("GetApprovalEvents error for %s on %s: %v", address, network, err))
				continue // skip failed queries, don't fail the whole request
			}
			allApprovals = append(allApprovals, approvals...)
		}
	}

	if allApprovals == nil {
		allApprovals = []provider.ApprovalEntry{}
	}

	output := provider.GetTokenApprovalsOutput{
		Approvals:  allApprovals,
		TotalCount: len(allApprovals),
	}

	approvalResponse := NewSuccessResponse(output)
	approvalJsonBytes, _ := json.Marshal(approvalResponse)
	return C.CString(string(approvalJsonBytes))
}
