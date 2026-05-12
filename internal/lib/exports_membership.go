// Package main - Membership and Session Management FFI exports.
// Extracted from exports.go for maintainability.
// Contains: GetMembershipStatus, AddMembershipBinding, RemoveMembershipBinding,
//           SyncMembershipBindingWithToken, RemoveMembershipBindingWithToken,
//           CreateSessionToken, ValidateSessionToken, RevokeSessionToken,
//           GetDeviceMembershipStatusWithToken,
//           CreateWalletSessionToken, ValidateWalletSessionToken, RevokeWalletSessionToken
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime/debug"
	"time"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/arcsignio/arcsign/internal/app"
	"github.com/arcsignio/arcsign/internal/constants"
)

// ============================================================================
// Membership FFI Functions
// Feature: NFT-based membership with USB device binding
// ============================================================================

//export GetMembershipStatus
// GetMembershipStatus returns the USB device identity and membership status.
// This also ensures the deviceId is generated if it doesn't exist.
//
// Input JSON: {
//   "usbPath": "/path/to/usb",
//   "appPassword": "password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "deviceId": "uuid-string",
//     "deviceIdHash": "0x...",  // keccak256(deviceId) for contract binding
//     "walletLimit": 1,
//     "walletCount": 1,
//     "canCreateWallet": true,
//     "memberships": [{
//       "nftTokenId": "1",
//       "nftContract": "0x...",
//       "chainId": "bnb",
//       "boundAddress": "0x...",
//       "isValid": true
//     }]
//   }
// }
func GetMembershipStatus(params *C.char) (result *C.char) {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetMembershipStatus completed in %v", elapsed))
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
		USBPath     string `json:"usbPath"`
		AppPassword string `json:"appPassword"`
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

	// Load app config (password, usbPath)
	appConfig, err := app.LoadAppConfig(input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrAppConfigLoad, GetUserFriendlyMessage(ErrAppConfigLoad))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Ensure device identity exists (generates UUID if needed)
	deviceId, err := appConfig.EnsureIdentity()
	if err != nil {
		response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Save if identity was newly created (config, password, usbPath)
	if err := app.SaveAppConfig(appConfig, input.AppPassword, input.USBPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, GetUserFriendlyMessage(ErrAppConfigSave))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Calculate deviceIdHash for contract binding (keccak256)
	deviceIdHash := ethcrypto.Keccak256Hash([]byte(deviceId))

	// Build membership list for response
	memberships := make([]map[string]interface{}, 0)
	for _, m := range appConfig.GetMemberships() {
		memberships = append(memberships, map[string]interface{}{
			"nftTokenId":   m.NftTokenId,
			"nftContract":  m.NftContract,
			"chainId":      m.ChainId,
			"boundAddress": m.BoundAddress,
			"boundAt":      m.BoundAt.Unix(),
			"isValid":      m.IsValid,
			"lastVerified": m.LastVerified.Unix(),
		})
	}

	// Count wallets from filesystem (more reliable than appConfig.Wallets)
	// Wallet directories are stored directly in USB root as UUID folders with wallet.json
	walletCount := 0
	if entries, err := os.ReadDir(input.USBPath); err == nil {
		for _, entry := range entries {
			// Skip non-directories and hidden directories
			if !entry.IsDir() || len(entry.Name()) == 0 || entry.Name()[0] == '.' {
				continue
			}
			// Check if it's a wallet directory (has wallet.json)
			walletJsonPath := filepath.Join(input.USBPath, entry.Name(), "wallet.json")
			if _, err := os.Stat(walletJsonPath); err == nil {
				walletCount++
			}
		}
	}

	// Calculate wallet limit and canCreate based on actual count
	walletLimit := appConfig.GetWalletLimit()
	canCreateWallet := walletCount < walletLimit

	output := map[string]interface{}{
		"deviceId":        deviceId,
		"deviceIdHash":    "0x" + deviceIdHash.Hex()[2:], // Ensure 0x prefix
		"walletLimit":     walletLimit,
		"walletCount":     walletCount,
		"canCreateWallet": canCreateWallet,
		"memberships":     memberships,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export AddMembershipBinding
// AddMembershipBinding adds a new NFT membership binding to this USB device.
// Call this after the user has bound their deviceId on the NFT contract.
//
// Input JSON: {
//   "usbPath": "/path/to/usb",
//   "appPassword": "password",
//   "nftTokenId": "1",
//   "nftContract": "0x...",
//   "chainId": "bnb",
//   "boundAddress": "0x...",
//   "signature": "0x..."
// }
func AddMembershipBinding(params *C.char) (result *C.char) {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("AddMembershipBinding completed in %v", elapsed))
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
		USBPath      string `json:"usbPath"`
		AppPassword  string `json:"appPassword"`
		NftTokenId   string `json:"nftTokenId"`
		NftContract  string `json:"nftContract"`
		ChainId      string `json:"chainId"`
		BoundAddress string `json:"boundAddress"`
		Signature    string `json:"signature"`
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
	if input.NftTokenId == "" || input.NftContract == "" || input.BoundAddress == "" {
		response := NewErrorResponse(ErrInvalidInput, "Missing required fields")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Load app config (password, usbPath)
	appConfig, err := app.LoadAppConfig(input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrAppConfigLoad, GetUserFriendlyMessage(ErrAppConfigLoad))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Add membership binding
	binding := app.MembershipBinding{
		NftTokenId:   input.NftTokenId,
		NftContract:  input.NftContract,
		ChainId:      input.ChainId,
		BoundAddress: input.BoundAddress,
		BoundAt:      time.Now(),
		Signature:    input.Signature,
		IsValid:      true, // Will be verified on-chain later
	}

	if err := appConfig.AddMembership(binding); err != nil {
		response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Save updated config (config, password, usbPath)
	if err := app.SaveAppConfig(appConfig, input.AppPassword, input.USBPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, GetUserFriendlyMessage(ErrAppConfigSave))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update session memberships and recalculate locked wallets
	// This ensures the session reflects the new membership immediately
	sm := initSessionManager()
	sm.UpdateMembershipsAndRecalculate(input.USBPath, appConfig.GetMemberships())

	output := map[string]interface{}{
		"success":     true,
		"walletLimit": appConfig.GetWalletLimit(),
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export RemoveMembershipBinding
// RemoveMembershipBinding removes an NFT membership binding from this USB device.
//
// Input JSON: {
//   "usbPath": "/path/to/usb",
//   "appPassword": "password",
//   "nftTokenId": "1",
//   "nftContract": "0x..."
// }
func RemoveMembershipBinding(params *C.char) (result *C.char) {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("RemoveMembershipBinding completed in %v", elapsed))
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
		USBPath     string `json:"usbPath"`
		AppPassword string `json:"appPassword"`
		NftTokenId  string `json:"nftTokenId"`
		NftContract string `json:"nftContract"`
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

	// Load app config (password, usbPath)
	appConfig, err := app.LoadAppConfig(input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrAppConfigLoad, GetUserFriendlyMessage(ErrAppConfigLoad))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Remove membership binding
	removed := appConfig.RemoveMembership(input.NftTokenId, input.NftContract)

	// Save updated config (config, password, usbPath)
	if err := app.SaveAppConfig(appConfig, input.AppPassword, input.USBPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, GetUserFriendlyMessage(ErrAppConfigSave))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update session memberships and recalculate locked wallets
	// This ensures the session reflects the removed membership immediately
	sm := initSessionManager()
	sm.UpdateMembershipsAndRecalculate(input.USBPath, appConfig.GetMemberships())

	output := map[string]interface{}{
		"removed":     removed,
		"walletLimit": appConfig.GetWalletLimit(),
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// ============================================================
// Session-based Membership Sync FFI Exports
// ============================================================

//export SyncMembershipBindingWithToken
// SyncMembershipBindingWithToken adds a membership binding using session token instead of password.
// This allows frontend to sync on-chain bindings to USB without re-entering password.
//
// Input JSON: {
//   "token": "session-token",
//   "nftTokenId": "1",
//   "nftContract": "0x...",
//   "chainId": "bnb",
//   "boundAddress": "0x..."
// }
func SyncMembershipBindingWithToken(params *C.char) (result *C.char) {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("SyncMembershipBindingWithToken completed in %v", elapsed))
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
		Token        string `json:"token"`
		NftTokenId   string `json:"nftTokenId"`
		NftContract  string `json:"nftContract"`
		ChainId      string `json:"chainId"`
		BoundAddress string `json:"boundAddress"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate required fields
	if input.Token == "" {
		response := NewErrorResponse(ErrInvalidInput, "Token is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if input.NftTokenId == "" || input.NftContract == "" || input.BoundAddress == "" {
		response := NewErrorResponse(ErrInvalidInput, "Missing required fields")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Get session manager and validate token
	sm := initSessionManager()
	session, err := sm.ValidateToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidPassword, GetUserFriendlyMessage(ErrInvalidPassword))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Get decrypted password from session
	appPassword, err := sm.GetProviderKey(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidPassword, GetUserFriendlyMessage(ErrInvalidPassword))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Load app config using decrypted password
	appConfig, err := app.LoadAppConfig(appPassword, session.UsbPath)
	if err != nil {
		response := NewErrorResponse(ErrAppConfigLoad, GetUserFriendlyMessage(ErrAppConfigLoad))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Add membership binding
	binding := app.MembershipBinding{
		NftTokenId:   input.NftTokenId,
		NftContract:  input.NftContract,
		ChainId:      input.ChainId,
		BoundAddress: input.BoundAddress,
		BoundAt:      time.Now(),
		Signature:    "", // No signature for synced bindings
		IsValid:      true,
	}

	if err := appConfig.AddMembership(binding); err != nil {
		response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Save updated config
	if err := app.SaveAppConfig(appConfig, appPassword, session.UsbPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, GetUserFriendlyMessage(ErrAppConfigSave))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update session memberships and recalculate locked wallets
	sm.UpdateMembershipsAndRecalculate(session.UsbPath, appConfig.GetMemberships())

	output := map[string]interface{}{
		"success":     true,
		"walletLimit": appConfig.GetWalletLimit(),
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export RemoveMembershipBindingWithToken
// RemoveMembershipBindingWithToken removes a membership binding using session token.
//
// Input JSON: {
//   "token": "session-token",
//   "nftTokenId": "1",
//   "nftContract": "0x..."
// }
func RemoveMembershipBindingWithToken(params *C.char) (result *C.char) {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("RemoveMembershipBindingWithToken completed in %v", elapsed))
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
		Token       string `json:"token"`
		NftTokenId  string `json:"nftTokenId"`
		NftContract string `json:"nftContract"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate required fields
	if input.Token == "" {
		response := NewErrorResponse(ErrInvalidInput, "Token is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if input.NftTokenId == "" || input.NftContract == "" {
		response := NewErrorResponse(ErrInvalidInput, "Missing required fields")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Get session manager and validate token
	sm := initSessionManager()
	session, err := sm.ValidateToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidPassword, GetUserFriendlyMessage(ErrInvalidPassword))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Get decrypted password from session
	appPassword, err := sm.GetProviderKey(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidPassword, GetUserFriendlyMessage(ErrInvalidPassword))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Load app config using decrypted password
	appConfig, err := app.LoadAppConfig(appPassword, session.UsbPath)
	if err != nil {
		response := NewErrorResponse(ErrAppConfigLoad, GetUserFriendlyMessage(ErrAppConfigLoad))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Remove membership binding
	removed := appConfig.RemoveMembership(input.NftTokenId, input.NftContract)

	// Save updated config
	if err := app.SaveAppConfig(appConfig, appPassword, session.UsbPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, GetUserFriendlyMessage(ErrAppConfigSave))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update session memberships and recalculate locked wallets
	sm.UpdateMembershipsAndRecalculate(session.UsbPath, appConfig.GetMemberships())

	output := map[string]interface{}{
		"removed":     removed,
		"walletLimit": appConfig.GetWalletLimit(),
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// ============================================================
// Session Management FFI Exports
// ============================================================

//export CreateSessionToken
func CreateSessionToken(params *C.char) (result *C.char) {
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
		USBPath     string `json:"usbPath"`
		AppPassword string `json:"appPassword"`
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

	// Initialize session manager
	sm := initSessionManager()

	// Create session token
	session, err := sm.CreateSession(input.USBPath, input.AppPassword)
	if err != nil {
		response := NewErrorResponse(ErrInvalidPassword, GetUserFriendlyMessage(ErrInvalidPassword))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"token":     session.Token,
		"expiresAt": session.ExpiresAt.Unix(),
		"usbPath":   session.UsbPath,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ValidateSessionToken
func ValidateSessionToken(params *C.char) (result *C.char) {
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
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize session manager
	sm := initSessionManager()

	// Validate token
	session, err := sm.ValidateToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"valid":     true,
		"usbPath":   session.UsbPath,
		"expiresAt": session.ExpiresAt.Unix(),
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export RevokeSessionToken
func RevokeSessionToken(params *C.char) (result *C.char) {
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
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize session manager
	sm := initSessionManager()

	// Revoke token
	sm.RevokeToken(input.Token)

	output := map[string]interface{}{
		"revoked": true,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetDeviceMembershipStatusWithToken
func GetDeviceMembershipStatusWithToken(params *C.char) (result *C.char) {
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
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize session manager
	sm := initSessionManager()

	// Validate token and get session
	session, err := sm.ValidateToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Security: Read from session cache - NO PASSWORD needed
	// DeviceId, DeviceIdHash, and Memberships were cached at login time
	deviceId := session.DeviceId
	deviceIdHash := session.DeviceIdHash

	// Build membership list from cached data
	memberships := make([]map[string]interface{}, 0)
	for _, m := range session.Memberships {
		memberships = append(memberships, map[string]interface{}{
			"nftTokenId":   m.NftTokenId,
			"nftContract":  m.NftContract,
			"chainId":      m.ChainId,
			"boundAddress": m.BoundAddress,
			"boundAt":      m.BoundAt.Unix(),
			"isValid":      m.IsValid,
			"lastVerified": m.LastVerified.Unix(),
		})
	}

	// Count wallets from filesystem (no password needed)
	// Wallet directories are stored directly in USB root as UUID folders with wallet.json
	walletCount := 0
	if entries, err := os.ReadDir(session.UsbPath); err == nil {
		for _, entry := range entries {
			// Skip non-directories and hidden directories
			if !entry.IsDir() || len(entry.Name()) == 0 || entry.Name()[0] == '.' {
				continue
			}
			// Check if it's a wallet directory (has wallet.json)
			walletJsonPath := filepath.Join(session.UsbPath, entry.Name(), "wallet.json")
			if _, err := os.Stat(walletJsonPath); err == nil {
				walletCount++
			}
		}
	}

	// Calculate wallet limit based on memberships
	nftCount := len(session.Memberships)
	walletLimit := constants.WalletLimit(nftCount)
	canCreateWallet := walletCount < walletLimit

	// Get locked wallet IDs from session (calculated at login)
	lockedWalletIds := session.LockedWalletIds
	if lockedWalletIds == nil {
		lockedWalletIds = []string{}
	}

	output := map[string]interface{}{
		"deviceId":        deviceId,
		"deviceIdHash":    deviceIdHash,
		"walletLimit":     walletLimit,
		"walletCount":     walletCount,
		"canCreateWallet": canCreateWallet,
		"memberships":     memberships,
		"lockedWalletIds": lockedWalletIds,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export CreateWalletSessionToken
func CreateWalletSessionToken(params *C.char) (result *C.char) {
	// Panic recovery
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
		WalletID string `json:"walletId"`
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

	// Initialize wallet session manager
	wsm := initWalletSessionManager()

	// Create wallet session (validates password)
	session, err := wsm.CreateWalletSession(input.WalletID, input.Password, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return session info
	output := map[string]interface{}{
		"token":     session.Token,
		"walletId":  session.WalletID,
		"expiresAt": session.ExpiresAt.Unix(),
		"usbPath":   session.UsbPath,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ValidateWalletSessionToken
func ValidateWalletSessionToken(params *C.char) (result *C.char) {
	// Panic recovery
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
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize wallet session manager
	wsm := initWalletSessionManager()

	// Validate token
	session, err := wsm.ValidateWalletToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return session info
	output := map[string]interface{}{
		"valid":     true,
		"walletId":  session.WalletID,
		"expiresAt": session.ExpiresAt.Unix(),
		"usbPath":   session.UsbPath,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export RevokeWalletSessionToken
func RevokeWalletSessionToken(params *C.char) (result *C.char) {
	// Panic recovery
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
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize wallet session manager
	wsm := initWalletSessionManager()

	// Revoke token
	wsm.RevokeWalletToken(input.Token)

	// Return success
	output := map[string]interface{}{
		"revoked": true,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}
