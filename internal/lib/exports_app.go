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

	"github.com/Jason-chen-taiwan/arcSignv2/internal/app"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/provider"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/wallet"
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

// loadNodeRealAPIKey attempts to load the NodeReal API key from the provider config store.
// Returns empty string if not configured.
func loadNodeRealAPIKey(providerStore *provider.ProviderConfigStore) string {
	configKeys := provider.GetProviderConfigKeys(provider.ProviderNodeReal)
	for _, key := range configKeys {
		config, err := providerStore.Get("global", key)
		if err == nil && config != nil && config.Enabled && config.APIKey != "" {
			return config.APIKey
		}
	}
	return ""
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

	// Try to get Alchemy provider for global chainId (set by ProviderSettings UI)
	debugLog("[DEBUG] GetTokenBalances: Attempting to get provider with chainId='global', providerType='alchemy'")
	providerConfig, err := providerStore.Get("global", "alchemy")
	if err != nil {
		debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Error getting provider: %v", err))
		response := NewErrorResponse(ErrStorageError, "Provider configuration not found")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if providerConfig == nil {
		debugLog("[DEBUG] GetTokenBalances: providerConfig is nil")
		response := NewErrorResponse(ErrInvalidInput, "Alchemy provider not configured")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if providerConfig.APIKey == "" {
		debugLog("[DEBUG] GetTokenBalances: providerConfig.APIKey is empty")
		response := NewErrorResponse(ErrInvalidInput, "Alchemy API key is missing")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Provider config retrieved successfully, APIKey length = %d", len(providerConfig.APIKey)))

	if !providerConfig.Enabled {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy provider is disabled")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	alchemyAPIKey := providerConfig.APIKey

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

	// Step 3: Separate addresses by provider (Alchemy vs NodeReal)
	alchemyAddrMap := make(map[string][]string) // address -> networks (for Alchemy)
	bscAddresses := make(map[string]bool)        // BSC addresses (for NodeReal)

	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: includeTestnets = %v", input.IncludeTestnets))

	for _, addr := range walletObj.AddressBook.Addresses {
		network, ok := provider.GetInternalNetwork(addr.CoinName)
		if !ok {
			continue
		}

		providerType := provider.GetProviderForNetwork(network)
		switch providerType {
		case provider.ProviderAlchemy:
			alchemyAddrMap[addr.Address] = append(alchemyAddrMap[addr.Address], network)
			// If includeTestnets is true and this is an Ethereum address, also query Sepolia
			if input.IncludeTestnets && addr.CoinName == "Ethereum" {
				debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Adding Sepolia for address %s", addr.Address))
				alchemyAddrMap[addr.Address] = append(alchemyAddrMap[addr.Address], provider.NetworkEthSepolia)
			}
		case provider.ProviderNodeReal:
			bscAddresses[addr.Address] = true
		}
	}

	totalAddressCount := len(alchemyAddrMap) + len(bscAddresses)
	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Alchemy addresses: %d, BSC addresses: %d", len(alchemyAddrMap), len(bscAddresses)))

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

	var allTokens []provider.SimplifiedTokenBalance

	// Step 4a: Query Alchemy for non-BSC chains
	if len(alchemyAddrMap) > 0 {
		var alchemyAddresses []provider.AlchemyAddressWithNetworks
		for addr, networks := range alchemyAddrMap {
			alchemyAddresses = append(alchemyAddresses, provider.AlchemyAddressWithNetworks{
				Address:  addr,
				Networks: networks,
			})
		}

		alchemyClient := provider.NewAlchemyClient(alchemyAPIKey)
		alchemyResponse, err := alchemyClient.GetTokenBalancesByAddress(alchemyAddresses)
		if err != nil {
			fmt.Printf("Alchemy GetTokenBalances error: %v\n", err)
		} else {
			alchemyTokens := provider.SimplifyTokenBalances(alchemyResponse)
			allTokens = append(allTokens, alchemyTokens...)
		}
	}

	// Step 4b: Query NodeReal for BSC addresses
	if len(bscAddresses) > 0 {
		nodeRealKey := loadNodeRealAPIKey(providerStore)
		if nodeRealKey != "" {
			bscClient := provider.NewBSCTraceClient(nodeRealKey)
			for addr := range bscAddresses {
				bscTokens, err := bscClient.GetTokenHoldingsBSC(addr)
				if err != nil {
					fmt.Printf("NodeReal GetTokenHoldings error for %s: %v\n", addr[:10], err)
					continue
				}
				allTokens = append(allTokens, bscTokens...)
			}
		} else {
			debugLog("[DEBUG] GetTokenBalances: No NodeReal API key configured, skipping BSC")
		}
	}

	// Step 5: Aggregate results
	var totalUSD float64
	networkSet := make(map[string]bool)
	for _, token := range allTokens {
		totalUSD += token.USDValue
		networkSet[token.Network] = true
	}

	output := provider.GetTokenBalancesOutput{
		Tokens:       allTokens,
		TotalUSD:     totalUSD,
		AddressCount: totalAddressCount,
		NetworkCount: len(networkSet),
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

	providerConfig, err := providerStore.Get("global", "alchemy")
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Provider configuration not found")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if providerConfig == nil || providerConfig.APIKey == "" {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy provider not configured")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if !providerConfig.Enabled {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy provider is disabled")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	alchemyAPIKey := providerConfig.APIKey

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

	// Separate addresses by provider (Alchemy vs NodeReal)
	alchemyAddrMap := make(map[string][]string)
	bscAddresses := make(map[string]bool)
	for _, addr := range walletObj.AddressBook.Addresses {
		network, ok := provider.GetInternalNetwork(addr.CoinName)
		if !ok {
			continue
		}
		providerType := provider.GetProviderForNetwork(network)
		switch providerType {
		case provider.ProviderAlchemy:
			alchemyAddrMap[addr.Address] = append(alchemyAddrMap[addr.Address], network)
		case provider.ProviderNodeReal:
			bscAddresses[addr.Address] = true
		}
	}

	totalAddressCount := len(alchemyAddrMap) + len(bscAddresses)
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

	var allNFTs []provider.SimplifiedNFT

	// Query Alchemy for non-BSC chains
	if len(alchemyAddrMap) > 0 {
		var alchemyAddresses []provider.AlchemyAddressWithNetworks
		for addr, networks := range alchemyAddrMap {
			alchemyAddresses = append(alchemyAddresses, provider.AlchemyAddressWithNetworks{
				Address:  addr,
				Networks: networks,
			})
		}

		alchemyClient := provider.NewAlchemyClient(alchemyAPIKey)
		alchemyResponse, err := alchemyClient.GetNFTsByAddress(alchemyAddresses)
		if err != nil {
			fmt.Printf("Alchemy GetNFTs error: %v\n", err)
		} else {
			alchemyNFTs := provider.SimplifyNFTs(alchemyResponse)
			allNFTs = append(allNFTs, alchemyNFTs...)
		}
	}

	// Query NodeReal for BSC addresses
	if len(bscAddresses) > 0 {
		nodeRealKey := loadNodeRealAPIKey(providerStore)
		if nodeRealKey != "" {
			bscClient := provider.NewBSCTraceClient(nodeRealKey)
			for addr := range bscAddresses {
				bscNFTs, err := bscClient.GetNFTHoldingsBSC(addr)
				if err != nil {
					fmt.Printf("NodeReal GetNFTHoldings error for %s: %v\n", addr[:10], err)
					continue
				}
				allNFTs = append(allNFTs, bscNFTs...)
			}
		} else {
			debugLog("[DEBUG] GetNFTs: No NodeReal API key configured, skipping BSC")
		}
	}

	// Aggregate results
	networkSet := make(map[string]bool)
	for _, nft := range allNFTs {
		networkSet[nft.Network] = true
	}

	output := provider.GetNFTsOutput{
		NFTs:         allNFTs,
		TotalCount:   len(allNFTs),
		AddressCount: totalAddressCount,
		NetworkCount: len(networkSet),
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

	providerConfig, err := providerStore.Get("global", "alchemy")
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Provider configuration not found")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if providerConfig == nil || providerConfig.APIKey == "" {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy provider not configured")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if !providerConfig.Enabled {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy provider is disabled")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	alchemyAPIKey := providerConfig.APIKey

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
