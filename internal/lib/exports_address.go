// Package main - Address book, transaction labels, asset transfers, and passphrase validation FFI exports.
// Extracted from exports.go for maintainability.
// Contains: ListContacts, AddContact, UpdateContact, DeleteContact,
//           SetTransactionLabel, GetTransactionLabels, DeleteTransactionLabel,
//           GetAssetTransfers, ValidatePassphrase
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
	"strings"
	"time"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/contacts"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/provider"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/bip39service"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/hdkey"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/wallet"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/txlabels"
)

// ========================================================================
// Address Book (Contacts) Operations
// ========================================================================

//export ListContacts
// ListContacts returns all saved contacts from encrypted storage.
// Feature: Address Book (v1.3)
//
// Input JSON: {
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",
//   "appPassword": "app-password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": { "contacts": [...] }
// }
func ListContacts(params *C.char) (result *C.char) {
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
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
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
		response := NewErrorResponse(ErrInvalidPassword, "Authentication failed")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	contactsPath := filepath.Join(input.USBPath, "contacts.enc")
	store, err := contacts.NewContactStore(contactsPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Failed to load contacts")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	contactList := store.List()
	output := map[string]interface{}{
		"contacts": contactList,
	}
	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export AddContact
// AddContact creates a new contact in encrypted storage.
// Feature: Address Book (v1.3)
//
// Input JSON: {
//   "name": "Alice",
//   "address": "0x...",
//   "symbol": "ETH",
//   "coinName": "Ethereum",
//   "notes": "optional",
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",
//   "appPassword": "app-password"
// }
func AddContact(params *C.char) (result *C.char) {
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
		Name         string `json:"name"`
		Address      string `json:"address"`
		Symbol       string `json:"symbol"`
		CoinName     string `json:"coinName"`
		Notes        string `json:"notes"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
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
		response := NewErrorResponse(ErrInvalidPassword, "Authentication failed")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	contactsPath := filepath.Join(input.USBPath, "contacts.enc")
	store, err := contacts.NewContactStore(contactsPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Failed to load contacts")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	contact, err := store.Add(input.Name, input.Address, input.Symbol, input.CoinName, input.Notes)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"contact": contact,
	}
	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export UpdateContact
// UpdateContact modifies an existing contact in encrypted storage.
// Feature: Address Book (v1.3)
//
// Input JSON: {
//   "contactId": "uuid",
//   "name": "Alice",
//   "address": "0x...",
//   "symbol": "ETH",
//   "coinName": "Ethereum",
//   "notes": "optional",
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",
//   "appPassword": "app-password"
// }
func UpdateContact(params *C.char) (result *C.char) {
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
		ContactID    string `json:"contactId"`
		Name         string `json:"name"`
		Address      string `json:"address"`
		Symbol       string `json:"symbol"`
		CoinName     string `json:"coinName"`
		Notes        string `json:"notes"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
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
		response := NewErrorResponse(ErrInvalidPassword, "Authentication failed")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	contactsPath := filepath.Join(input.USBPath, "contacts.enc")
	store, err := contacts.NewContactStore(contactsPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Failed to load contacts")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	contact, err := store.Update(input.ContactID, input.Name, input.Address, input.Symbol, input.CoinName, input.Notes)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"contact": contact,
	}
	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export DeleteContact
// DeleteContact removes a contact from encrypted storage.
// Feature: Address Book (v1.3)
//
// Input JSON: {
//   "contactId": "uuid",
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",
//   "appPassword": "app-password"
// }
func DeleteContact(params *C.char) (result *C.char) {
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
		ContactID    string `json:"contactId"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
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
		response := NewErrorResponse(ErrInvalidPassword, "Authentication failed")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	contactsPath := filepath.Join(input.USBPath, "contacts.enc")
	store, err := contacts.NewContactStore(contactsPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Failed to load contacts")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	if err := store.Delete(input.ContactID); err != nil {
		response := NewErrorResponse(ErrInvalidInput, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"deleted":   true,
		"deletedAt": time.Now().Format(time.RFC3339),
	}
	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// ========================================================================
// Transaction Labels Operations
// ========================================================================

//export SetTransactionLabel
// SetTransactionLabel adds or updates a transaction label (upsert).
// Feature: Transaction Labels (v1.3)
func SetTransactionLabel(params *C.char) (result *C.char) {
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
		Network      string `json:"network"`
		TxHash       string `json:"txHash"`
		Name         string `json:"name"`
		Category     string `json:"category"`
		Notes        string `json:"notes"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
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
		response := NewErrorResponse(ErrInvalidPassword, "Authentication failed")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	labelsPath := filepath.Join(input.USBPath, "tx_labels.enc")
	store, err := txlabels.NewTxLabelStore(labelsPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Failed to load transaction labels")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	label, err := store.Set(input.Network, input.TxHash, input.Name, input.Category, input.Notes)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"label":   label,
		"network": input.Network,
		"txHash":  input.TxHash,
	}
	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetTransactionLabels
// GetTransactionLabels returns transaction labels, optionally filtered by network.
// Feature: Transaction Labels (v1.3)
func GetTransactionLabels(params *C.char) (result *C.char) {
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
		Network      string `json:"network"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
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
		response := NewErrorResponse(ErrInvalidPassword, "Authentication failed")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	labelsPath := filepath.Join(input.USBPath, "tx_labels.enc")
	store, err := txlabels.NewTxLabelStore(labelsPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Failed to load transaction labels")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	var entries []txlabels.LabelEntry
	if input.Network != "" {
		entries = store.ListByNetwork(input.Network)
	} else {
		entries = store.ListAll()
	}

	output := map[string]interface{}{
		"labels": entries,
	}
	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export DeleteTransactionLabel
// DeleteTransactionLabel removes a transaction label.
// Feature: Transaction Labels (v1.3)
func DeleteTransactionLabel(params *C.char) (result *C.char) {
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
		Network      string `json:"network"`
		TxHash       string `json:"txHash"`
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
		AppPassword  string `json:"appPassword"`
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
		response := NewErrorResponse(ErrInvalidPassword, "Authentication failed")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	labelsPath := filepath.Join(input.USBPath, "tx_labels.enc")
	store, err := txlabels.NewTxLabelStore(labelsPath, appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, "Failed to load transaction labels")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	if err := store.Delete(input.Network, input.TxHash); err != nil {
		response := NewErrorResponse(ErrInvalidInput, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"deleted":   true,
		"deletedAt": time.Now().Format(time.RFC3339),
	}
	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetAssetTransfers
// GetAssetTransfers queries transaction history for an address using Alchemy API.
// Feature: Transaction History - Asset Transfers API Integration
//
// Input JSON: {
//   "address": "0x...",           // The wallet address to query
//   "network": "eth-mainnet",     // Network identifier (eth-mainnet, polygon-mainnet, etc.)
//   "maxCount": 50,               // Optional: maximum number of transfers to return
//   "pageKey": "",                // Optional: pagination key for next page
//   "appPassword": "app-password",
//   "usbPath": "/path/to/usb"
// }
//
// Returns: {"success": true, "data": {"transfers": [...], "pageKey": "..."}}
func GetAssetTransfers(params *C.char) (result *C.char) {
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
		Address      string `json:"address"`
		Network      string `json:"network"`      // e.g., "eth-mainnet", "polygon-mainnet"
		MaxCount     int    `json:"maxCount"`     // Optional: max transfers to return
		PageKey      string `json:"pageKey"`      // Optional: pagination
		SessionToken string `json:"sessionToken"` // PREFERRED: Session token for auth
		AppPassword  string `json:"appPassword"`  // DEPRECATED: Direct password
		USBPath      string `json:"usbPath"`
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

	// Security: Clear sensitive data after use
	defer zeroString(&input.AppPassword)
	defer zeroString(&input.SessionToken)

	// Validate required inputs
	if input.Address == "" {
		response := NewErrorResponse(ErrInvalidInput, "Address is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.Network == "" {
		input.Network = "eth-mainnet" // Default to Ethereum mainnet
	}

	// Get app password from session token or use direct password (deprecated)
	appPassword, authErr := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if authErr != nil {
		response := NewErrorResponse(ErrInvalidPassword, GetUserFriendlyMessage(ErrInvalidPassword))
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
	if err != nil || providerConfig == nil || providerConfig.APIKey == "" {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy API key not configured")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if !providerConfig.Enabled {
		response := NewErrorResponse(ErrInvalidInput, "Alchemy provider is disabled")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Default max count
	maxCount := input.MaxCount
	if maxCount <= 0 {
		maxCount = 50
	}

	var transfers []provider.AssetTransfer
	var pageKey string

	// Determine which provider to use based on network (centralized in chains.go)
	providerType := provider.GetProviderForNetwork(input.Network)

	switch providerType {
	case provider.ProviderNodeReal:
		// BSC network: Use BSCTrace (NodeReal) provider
		// Check all possible config keys for nodereal
		nodeRealAPIKey := ""
		configKeys := provider.GetProviderConfigKeys(provider.ProviderNodeReal)
		for _, key := range configKeys {
			config, configErr := providerStore.Get("global", key)
			if configErr == nil && config != nil && config.Enabled && config.APIKey != "" {
				nodeRealAPIKey = config.APIKey
				break
			}
		}

		if nodeRealAPIKey == "" {
			// No BSCTrace API key configured - return informative message
			response := NewErrorResponse(ErrInvalidInput,
				"BSC transaction history requires NodeReal API key. "+
					"Get a free key at https://dashboard.nodereal.io and configure it in provider settings.")
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}

		// Use BSCTrace for BSC network
		bscTraceClient := provider.NewBSCTraceClient(nodeRealAPIKey)
		transfers, pageKey, err = bscTraceClient.GetAssetTransfersBSC(input.Address, maxCount, input.PageKey)
		if err != nil {
			fmt.Printf("BSCTrace API error: %v\n", err)
			response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}

	case provider.ProviderAlchemy:
		// Alchemy networks: ETH, Polygon, Arbitrum, Optimism, Base
		// Categories are automatically determined based on network (chains.go)
		alchemyClient := provider.NewAlchemyClient(providerConfig.APIKey)
		transfers, pageKey, err = alchemyClient.GetAssetTransfers(input.Address, input.Network, maxCount, input.PageKey)
		if err != nil {
			fmt.Printf("Alchemy API error: %v\n", err)
			response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}

	default:
		// Unknown provider - fallback to Alchemy
		alchemyClient := provider.NewAlchemyClient(providerConfig.APIKey)
		transfers, pageKey, err = alchemyClient.GetAssetTransfers(input.Address, input.Network, maxCount, input.PageKey)
		if err != nil {
			fmt.Printf("Alchemy API error (fallback): %v\n", err)
			response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}
	}

	output := map[string]interface{}{
		"transfers": transfers,
		"pageKey":   pageKey,
		"address":   input.Address,
		"network":   input.Network,
		"count":     len(transfers),
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ValidatePassphrase
// ValidatePassphrase validates a BIP39 passphrase by deriving an Ethereum address
// and comparing it with the stored address in the wallet's AddressBook.
// Feature: Passphrase validation for wallets with BIP39 passphrase
//
// This is used during wallet unlock flow:
// 1. User enters wallet password (validated via unlock_wallet)
// 2. If wallet has_passphrase=true, user is prompted for passphrase
// 3. This function validates the passphrase by comparing derived address
//
// Input JSON: {
//   "walletId": "uuid-xxx",
//   "password": "user-password",
//   "passphrase": "bip39-passphrase",
//   "usbPath": "/path/to/usb"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "valid": true,
//     "derivedAddress": "0x...",
//     "expectedAddress": "0x..."
//   }
// }
func ValidatePassphrase(params *C.char) (result *C.char) {
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

	if walletObj.AddressBook == nil {
		response := NewErrorResponse(ErrStorageError, "Wallet has no AddressBook")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 3: Find the Ethereum address in AddressBook (coin_type 60)
	// This is the address we'll compare against
	var expectedAddress string
	var ethDerivationPath string
	for _, addr := range walletObj.AddressBook.Addresses {
		// Ethereum addresses have CoinType 60 (SLIP-44)
		if addr.CoinType == 60 {
			expectedAddress = addr.Address
			ethDerivationPath = addr.DerivationPath
			break
		}
	}

	if expectedAddress == "" {
		response := NewErrorResponse(ErrInvalidInput, "No Ethereum address found in wallet")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 4: Derive Ethereum address using (mnemonic + passphrase)
	bip39Svc := bip39service.NewBIP39Service()
	hdkeySvc := hdkey.NewHDKeyService()

	// Mnemonic -> Seed (using provided passphrase)
	seed, err := bip39Svc.MnemonicToSeed(mnemonic, input.Passphrase)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Seed -> Master Key
	masterKey, err := hdkeySvc.NewMasterKey(seed)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Master Key -> Child Key (using ETH derivation path)
	childKey, err := hdkeySvc.DerivePath(masterKey, ethDerivationPath)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Child Key -> Private Key (raw bytes)
	privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer func() {
		for i := range privateKeyBytes {
			privateKeyBytes[i] = 0
		}
	}()

	// Convert private key to hex and derive Ethereum address
	privateKeyHex := fmt.Sprintf("%x", privateKeyBytes)
	defer zeroString(&privateKeyHex)

	ethPrivKey, err := ethcrypto.HexToECDSA(privateKeyHex)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, GetUserFriendlyMessage(ErrEncryptionError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	derivedAddress := ethcrypto.PubkeyToAddress(ethPrivKey.PublicKey).Hex()

	// Step 5: Compare derived address with expected address
	isValid := strings.EqualFold(derivedAddress, expectedAddress)

	output := map[string]interface{}{
		"valid":           isValid,
		"derivedAddress":  derivedAddress,
		"expectedAddress": expectedAddress,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}
