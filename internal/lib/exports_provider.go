// Package main - Provider configuration FFI exports.
// Extracted from exports.go for maintainability.
// Contains: SetProviderConfig, GetProviderConfig, ListProviderConfigs, DeleteProviderConfig
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"path/filepath"
	"runtime/debug"
	"time"

	"github.com/arcsignio/arcsign/internal/provider"
)

//export SetProviderConfig
// SetProviderConfig saves a blockchain data provider configuration.
// Feature: Provider Registry System - API Key Management
//
// Input JSON: {
//   "providerType": "alchemy" | "infura" | "quicknode",
//   "apiKey": "your-api-key",
//   "chainId": "ethereum",
//   "networkId": "mainnet" | "sepolia",  // Optional
//   "customEndpoint": "https://...",      // Optional
//   "priority": 100,                      // Higher = preferred
//   "enabled": true,
//   "password": "wallet-password",        // For encryption
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "providerType": "alchemy",
//     "chainId": "ethereum",
//     "configured": true,
//     "configuredAt": "2025-11-27T10:00:00Z"
//   }
// }
func SetProviderConfig(params *C.char) (result *C.char) {
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
		ProviderType   string `json:"providerType"`
		APIKey         string `json:"apiKey"`
		ChainID        string `json:"chainId"`
		NetworkID      string `json:"networkId"`
		CustomEndpoint string `json:"customEndpoint"`
		Priority       int    `json:"priority"`
		Enabled        bool   `json:"enabled"`
		USBPath        string `json:"usbPath"`
		SessionToken   string `json:"sessionToken"` // PREFERRED: Session token
		AppPassword    string `json:"appPassword"`  // DEPRECATED: Backward compatibility
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
	defer zeroString(&input.APIKey)
	defer zeroString(&input.AppPassword)

	// Validate session and get provider key
	providerKey, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&providerKey)

	// Create provider config store
	configPath := filepath.Join(input.USBPath, "provider_config.enc")

	store, err := provider.NewProviderConfigStore(configPath, providerKey)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	// Create provider configuration
	config := &provider.ProviderConfig{
		ProviderType:   input.ProviderType,
		APIKey:         input.APIKey,
		ChainID:        input.ChainID,
		NetworkID:      input.NetworkID,
		CustomEndpoint: input.CustomEndpoint,
		Priority:       input.Priority,
		Enabled:        input.Enabled,
	}

	// Validate API key format
	if err := provider.ValidateAPIKey(config); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid API key format")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Save configuration
	if err := store.Set(config); err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return success response
	data := map[string]interface{}{
		"providerType": input.ProviderType,
		"chainId":      input.ChainID,
		"configured":   true,
		"configuredAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetProviderConfig
// GetProviderConfig retrieves a blockchain data provider configuration.
// Feature: Provider Registry System - API Key Management
//
// Input JSON: {
//   "chainId": "ethereum",
//   "providerType": "alchemy",  // Optional: if not specified, returns best provider
//   "password": "wallet-password",
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "providerType": "alchemy",
//     "chainId": "ethereum",
//     "networkId": "mainnet",
//     "priority": 100,
//     "enabled": true,
//     "hasApiKey": true,
//     "createdAt": "2025-11-27T09:00:00Z",
//     "updatedAt": "2025-11-27T10:00:00Z"
//   }
// }
func GetProviderConfig(params *C.char) (result *C.char) {
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
		ProviderType string `json:"providerType"` // Optional
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"` // PREFERRED: Session token
		AppPassword  string `json:"appPassword"`  // DEPRECATED: Backward compatibility
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

	// Validate session and get provider key
	providerKey, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&providerKey)

	// Create provider config store
	configPath := input.USBPath + "/provider_config.enc"
	store, err := provider.NewProviderConfigStore(configPath, providerKey)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	var config *provider.ProviderConfig
	if input.ProviderType != "" {
		// Get specific provider
		config, err = store.Get(input.ChainID, input.ProviderType)
	} else {
		// Get best provider for chain
		config, err = store.GetBestProvider(input.ChainID)
	}

	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return config without exposing API key
	data := map[string]interface{}{
		"providerType": config.ProviderType,
		"chainId":      config.ChainID,
		"networkId":    config.NetworkID,
		"priority":     config.Priority,
		"enabled":      config.Enabled,
		"hasApiKey":    config.APIKey != "",
		"createdAt":    config.CreatedAt.Format(time.RFC3339),
		"updatedAt":    config.UpdatedAt.Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ListProviderConfigs
// ListProviderConfigs retrieves all provider configurations for a chain.
// Feature: Provider Registry System - API Key Management
//
// Input JSON: {
//   "chainId": "ethereum",  // Optional: if not specified, lists all chains
//   "password": "wallet-password",
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "providers": [
//       {
//         "providerType": "alchemy",
//         "chainId": "ethereum",
//         "priority": 100,
//         "enabled": true
//       },
//       {...}
//     ],
//     "count": 2
//   }
// }
func ListProviderConfigs(params *C.char) (result *C.char) {
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
		ChainID      string `json:"chainId"` // Optional
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"` // PREFERRED: Session token
		AppPassword  string `json:"appPassword"`  // DEPRECATED: Backward compatibility
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

	// Validate session and get provider key
	providerKey, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&providerKey)

	// Create provider config store
	configPath := input.USBPath + "/provider_config.enc"
	store, err := provider.NewProviderConfigStore(configPath, providerKey)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	var configs []*provider.ProviderConfig
	if input.ChainID != "" {
		// Get all providers for specific chain
		configs, err = store.GetAllForChain(input.ChainID)
		if err != nil {
			response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}
	} else {
		// Get all providers across all chains
		chains := store.ListChains()
		configs = make([]*provider.ProviderConfig, 0)
		for _, chainID := range chains {
			chainConfigs, _ := store.GetAllForChain(chainID)
			configs = append(configs, chainConfigs...)
		}
	}

	// Convert to response format (without API keys)
	providers := make([]map[string]interface{}, 0, len(configs))
	for _, config := range configs {
		providers = append(providers, map[string]interface{}{
			"providerType": config.ProviderType,
			"chainId":      config.ChainID,
			"networkId":    config.NetworkID,
			"priority":     config.Priority,
			"enabled":      config.Enabled,
			"hasApiKey":    config.APIKey != "",
		})
	}

	data := map[string]interface{}{
		"providers": providers,
		"count":     len(providers),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export DeleteProviderConfig
// DeleteProviderConfig removes a provider configuration.
// Feature: Provider Registry System - API Key Management
//
// Input JSON: {
//   "chainId": "ethereum",
//   "providerType": "alchemy",
//   "password": "wallet-password",
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "deleted": true,
//     "deletedAt": "2025-11-27T10:05:00Z"
//   }
// }
func DeleteProviderConfig(params *C.char) (result *C.char) {
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
		ProviderType string `json:"providerType"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"` // PREFERRED: Session token
		AppPassword  string `json:"appPassword"`  // DEPRECATED: Backward compatibility
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

	// Validate session and get provider key
	providerKey, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&providerKey)

	// Create provider config store
	configPath := input.USBPath + "/provider_config.enc"
	store, err := provider.NewProviderConfigStore(configPath, providerKey)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	// Delete configuration
	if err := store.Delete(input.ChainID, input.ProviderType); err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return success response
	data := map[string]interface{}{
		"deleted":   true,
		"deletedAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}
