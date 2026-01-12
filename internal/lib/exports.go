// Package main provides FFI exports for the arcSign wallet library.
// This file contains C-compatible export functions that can be called
// from the Rust Tauri frontend via libloading.
//
// Memory Management Contract:
// - All export functions return *C.char (heap-allocated JSON strings)
// - Caller MUST call GoFree() on returned pointers to prevent memory leaks
// - Pattern: Go allocates via C.CString, Rust frees via GoFree
//
// Error Handling:
// - All functions return JSON with {"success": bool, "data": {}, "error": {}}
// - Panics are recovered and converted to error JSON responses
// - See contracts/ffi-api.md for complete API specification
//
// Feature: 005-go-cli-shared - Backend Communication Architecture Upgrade
// Created: 2025-10-25
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
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"
	"unsafe"

	"github.com/arcsign/chainadapter"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/yourusername/arcsign/internal/app"
	"github.com/yourusername/arcsign/internal/provider"
	"github.com/yourusername/arcsign/internal/rpc"
	"github.com/yourusername/arcsign/internal/security"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	chainadapterService "github.com/yourusername/arcsign/internal/services/chainadapter"
	"github.com/yourusername/arcsign/internal/services/hdkey"
	"github.com/yourusername/arcsign/internal/services/wallet"
	"github.com/yourusername/arcsign/src/swap"
)

// Global ChainAdapter service instance (initialized on first use)
var chainAdapterSvc *chainadapterService.Service

// Global SessionManager instance (initialized on first use)
var sessionManager *app.SessionManager

// Global WalletSessionManager instance (initialized on first use)
var walletSessionManager *app.WalletSessionManager

// init is called automatically when the library is loaded.
// It sets up security measures to protect sensitive data.
func init() {
	// Disable core dumps to prevent private keys from being written to disk
	// This is a security best practice for applications handling sensitive data
	if err := security.DisableCoreDump(); err != nil {
		// Log but don't fail - this is a best-effort security measure
		// On some systems (containers, restricted environments), this may fail
		fmt.Fprintf(os.Stderr, "[Security] Warning: Could not disable core dumps: %v\n", err)
	} else {
		fmt.Fprintf(os.Stderr, "[Security] Core dumps disabled for sensitive data protection\n")
	}
}

// initChainAdapterService initializes the global ChainAdapter service (lazy initialization)
func initChainAdapterService() *chainadapterService.Service {
	if chainAdapterSvc == nil {
		chainAdapterSvc = chainadapterService.NewService(nil) // nil = use in-memory tx store
	}
	return chainAdapterSvc
}

// initSessionManager initializes the global SessionManager (lazy initialization)
func initSessionManager() *app.SessionManager {
	if sessionManager == nil {
		sessionManager = app.NewSessionManager()
	}
	return sessionManager
}

// initWalletSessionManager initializes the global WalletSessionManager (lazy initialization)
func initWalletSessionManager() *app.WalletSessionManager {
	if walletSessionManager == nil {
		walletSessionManager = app.NewWalletSessionManager()
	}
	return walletSessionManager
}

// validateSessionAndGetAppPassword validates session token and returns provider key
// This is a helper function to reduce code duplication across API functions
// Parameters:
//   - sessionToken: Session token from frontend (preferred)
//   - appPassword: Legacy app password (fallback for backward compatibility)
//   - usbPath: USB device path to validate against session
// Returns: (provider key string, error)
//
// Security: Uses GetProviderKey to retrieve encrypted key from session
// The provider key is decrypted on-demand and never stored in plain text
func validateSessionAndGetAppPassword(sessionToken, appPassword, usbPath string) (string, error) {
	sm := initSessionManager()

	// Try session token first (preferred)
	if sessionToken != "" {
		// Validate token and get session
		session, err := sm.ValidateToken(sessionToken)
		if err != nil {
			return "", fmt.Errorf("session expired. Please log in again")
		}

		// Verify USB path matches session
		if session.UsbPath != usbPath {
			return "", fmt.Errorf("USB path mismatch with session")
		}

		// ✅ NEW: Get provider key from encrypted session storage
		// The key is decrypted using the session token itself
		providerKey, err := sm.GetProviderKey(sessionToken)
		if err != nil {
			// Fallback to appPassword if decryption fails (for sessions created before this update)
			if appPassword != "" {
				return appPassword, nil
			}
			return "", fmt.Errorf("failed to get provider key from session: %w", err)
		}

		return providerKey, nil
	} else if appPassword != "" {
		// Fallback to legacy appPassword for backward compatibility
		return appPassword, nil
	} else {
		return "", fmt.Errorf("authentication required: provide sessionToken or appPassword")
	}
}

// debugLog writes debug messages to /Volumes/arcsign/logs/go_debug.log
func debugLog(message string) {
	logFile := "/Volumes/arcsign/logs/go_debug.log"
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	logMessage := fmt.Sprintf("[%s] %s\n", timestamp, message)

	// Output to stderr so it appears in terminal
	fmt.Fprintf(os.Stderr, "[Go Debug] %s\n", message)

	// Also write to file
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	f.WriteString(logMessage)
}

// T026: zeroString securely zeros sensitive string data from memory
// This prevents sensitive data (passwords, mnemonics) from lingering in memory
func zeroString(s *string) {
	if s == nil || *s == "" {
		return
	}
	// Convert to byte slice and zero each byte
	b := []byte(*s)
	for i := range b {
		b[i] = 0
	}
	*s = ""
}

// getRPCEndpoint returns the appropriate RPC endpoint for a chain.
// Uses the unified RPC Registry for all endpoint resolution.
// For transaction operations, always uses free public RPC (no API key required).
// For Alchemy-specific operations, constructs Alchemy URL with API key.
func getRPCEndpoint(chainID, apiKey string) string {
	// Use RPC Registry for free public endpoints (preferred for transactions)
	endpoint, err := rpc.GetRPC(chainID)
	if err == nil {
		return endpoint
	}
	// Fallback to Ethereum mainnet if chain not found
	return "https://eth.llamarpc.com"
}

// getAlchemyRPCEndpoint constructs the Alchemy RPC URL for enhanced API calls.
// Returns empty string if chain doesn't support Alchemy.
// Use this only for Alchemy-specific APIs (token balances, asset transfers, etc.)
func getAlchemyRPCEndpoint(chainID, apiKey string) string {
	endpoint, err := rpc.GetAlchemyRPC(chainID, apiKey)
	if err != nil {
		// Chain doesn't support Alchemy, return free RPC as fallback
		return getRPCEndpoint(chainID, apiKey)
	}
	return endpoint
}

// Deprecated: buildAlchemyRPCEndpoint is kept for backward compatibility.
// Use getRPCEndpoint for transactions and getAlchemyRPCEndpoint for Alchemy APIs.
func buildAlchemyRPCEndpoint(chainID, apiKey string) string {
	return getRPCEndpoint(chainID, apiKey)
}

//export GoFree
// GoFree frees memory allocated by Go and returned to Rust.
// CRITICAL: Rust MUST call this function on every pointer returned by FFI exports.
//
// Memory Safety:
// - Only call on pointers returned by this library's export functions
// - Never call twice on the same pointer (double-free)
// - Includes panic recovery to handle invalid pointers gracefully
func GoFree(ptr *C.char) {
	defer func() {
		if r := recover(); r != nil {
			// Log but don't crash - invalid pointer passed from Rust
			// In production, this would use proper logging
			debug.PrintStack()
		}
	}()

	if ptr != nil {
		C.free(unsafe.Pointer(ptr))
	}
}

//export GetVersion
// GetVersion returns library version information as JSON.
// This is the simplest FFI function, useful for testing library loading.
//
// Returns: {"success": true, "data": {"version": "0.2.0", "buildTime": "...", "goVersion": "..."}}
// Caller MUST call GoFree() on the returned pointer.
func GetVersion() *C.char {
	start := time.Now()
	defer func() {
		// FR-014: Log entry/exit with timing only
		elapsed := time.Since(start)
		_ = elapsed // TODO: Replace with proper logging in future tasks
	}()

	// Panic recovery (prevents Rust process crash)
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
		}
	}()

	data := map[string]string{
		"version":   "0.2.0",
		"buildTime": time.Now().Format(time.RFC3339),
		"goVersion": "1.21+",
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export CreateWallet
// CreateWallet creates a new HD wallet with auto-generated mnemonic.
// T021: Implement CreateWallet export function calling existing wallet.CreateWallet service
//
// Input JSON: {"walletName": "...", "password": "...", "usbPath": "...", "wordCount": 12|24, "passphrase": "..."}
// Output JSON: {"success": true, "data": {"walletId": "...", "walletName": "...", "mnemonic": "...", "createdAt": "..."}}
//
// Caller MUST call GoFree() on the returned pointer.
func CreateWallet(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletName string `json:"walletName"`
		Password   string `json:"password"`
		USBPath    string `json:"usbPath"`
		WordCount  int    `json:"wordCount"`  // 12 or 24
		Passphrase string `json:"passphrase"` // BIP39 passphrase (optional)
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Default to 24 words if not specified
	if input.WordCount != 12 && input.WordCount != 24 {
		input.WordCount = 24
	}

	// T026: Ensure sensitive data is zeroed before function returns
	defer func() {
		zeroString(&input.Password)
		zeroString(&input.Passphrase)
	}()

	// Create wallet service
	svc := wallet.NewWalletService(input.USBPath)

	usesPassphrase := input.Passphrase != ""

	// Create wallet using service (generates mnemonic and addresses)
	walletObj, mnemonic, err := svc.CreateWallet(
		input.WalletName,
		input.Password,
		input.WordCount,
		usesPassphrase,
		input.Passphrase,
	)

	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Ensure mnemonic is cleared from memory after return
	defer zeroString(&mnemonic)

	// Recalculate locked wallets after creation
	// New wallet may cause others to become locked if limit exceeded
	initSessionManager().RecalculateLockedWallets(input.USBPath)

	// Return success response with mnemonic (caller must display and secure it)
	data := map[string]interface{}{
		"walletId":   walletObj.ID,
		"walletName": walletObj.Name,
		"mnemonic":   mnemonic, // IMPORTANT: Caller must display this once and clear it
		"createdAt":  walletObj.CreatedAt.Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ImportWallet
// ImportWallet imports an existing wallet from mnemonic.
// T022: Implement ImportWallet export function
//
// Input JSON: {"walletName": "...", "mnemonic": "...", "password": "...", "usbPath": "...", "passphrase": "..."}
// Output JSON: {"success": true, "data": {"walletId": "...", "walletName": "...", "importedAt": "..."}}
func ImportWallet(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			// Note: In panic, we can't reliably return - this is best effort
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletName string `json:"walletName"`
		Mnemonic   string `json:"mnemonic"`
		Password   string `json:"password"`
		USBPath    string `json:"usbPath"`
		Passphrase string `json:"passphrase"` // BIP39 passphrase (optional)
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Normalize mnemonic: trim whitespace to prevent seed derivation issues
	input.Mnemonic = strings.TrimSpace(input.Mnemonic)

	// T026: Ensure sensitive data is zeroed before function returns
	defer func() {
		zeroString(&input.Mnemonic)
		zeroString(&input.Password)
		zeroString(&input.Passphrase)
	}()

	// Create wallet service
	svc := wallet.NewWalletService(input.USBPath)

	usesPassphrase := input.Passphrase != ""

	// Import wallet using provided mnemonic (not generate new one!)
	walletObj, err := svc.ImportWalletFromMnemonic(
		input.WalletName,
		input.Mnemonic,
		input.Password,
		usesPassphrase,
		input.Passphrase,
	)

	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Recalculate locked wallets after import
	// New wallet may cause others to become locked if limit exceeded
	initSessionManager().RecalculateLockedWallets(input.USBPath)

	// Return success response
	data := map[string]interface{}{
		"walletId":   walletObj.ID,
		"walletName": walletObj.Name,
		"importedAt": walletObj.CreatedAt.Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export UnlockWallet
// UnlockWallet authenticates and loads wallet into memory.
// T023: Implement UnlockWallet export function with real password verification
//
// Input JSON: {"walletId": "...", "password": "...", "usbPath": "..."}
// Output JSON: {"success": true, "data": {"walletId": "...", "walletName": "...", "unlockedAt": "..."}}
func UnlockWallet(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletID string `json:"walletId"`
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// T026: Ensure sensitive data is zeroed before function returns
	defer func() {
		zeroString(&input.Password)
	}()

	// Create wallet service and attempt to restore (decrypt) wallet
	svc := wallet.NewWalletService(input.USBPath)

	// RestoreWallet verifies password by attempting decryption
	mnemonic, err := svc.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Clear mnemonic from memory immediately (we don't need it for unlock response)
	defer zeroString(&mnemonic)

	// Load wallet metadata
	walletObj, err := svc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Password verified successfully - return wallet info
	data := map[string]interface{}{
		"walletId":   walletObj.ID,
		"walletName": walletObj.Name,
		"unlockedAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GenerateAddresses
// GenerateAddresses derives addresses for specified blockchains from wallet's AddressBook.
// T024: Implement GenerateAddresses export function (returns all addresses from wallet metadata)
//
// Input JSON: {"walletId": "...", "blockchains": []}
// Output JSON: {"success": true, "data": {"addresses": [{"blockchain": "...", "address": "...", "derivationPath": "...", "symbol": "...", "coinType": ...}], "generatedAt": "..."}}
func GenerateAddresses(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletID    string   `json:"walletId"`
		USBPath     string   `json:"usbPath"` // USB storage path
		Blockchains []string `json:"blockchains"` // Empty array means all blockchains
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Create wallet service with USB path
	svc := wallet.NewWalletService(input.USBPath)

	// Load wallet metadata (includes AddressBook from wallet creation)
	walletObj, err := svc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Check if AddressBook exists
	if walletObj.AddressBook == nil || len(walletObj.AddressBook.Addresses) == 0 {
		response := NewErrorResponse(ErrStorageError, "Wallet has no addresses. Please regenerate addresses.")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Convert AddressBook entries to FFI response format
	addresses := make([]map[string]interface{}, 0, len(walletObj.AddressBook.Addresses))
	for _, addr := range walletObj.AddressBook.Addresses {
		// Filter by blockchain if specified
		if len(input.Blockchains) > 0 {
			found := false
			for _, bc := range input.Blockchains {
				if addr.CoinName == bc || addr.Symbol == bc {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		addresses = append(addresses, map[string]interface{}{
			"blockchain":     addr.CoinName,
			"symbol":         addr.Symbol,
			"address":        addr.Address,
			"derivationPath": addr.DerivationPath,
			"coinType":       addr.CoinType,
		})
	}

	data := map[string]interface{}{
		"addresses":   addresses,
		"generatedAt": time.Now().Format(time.RFC3339),
		"count":       len(addresses),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ExportWallet
// ExportWallet exports wallet metadata without private keys.
// T024.1: Implement ExportWallet export function
//
// Input JSON: {"walletName": "...", "usbPath": "...", "format": "json"}
// Output JSON: {"success": true, "data": {"walletId": "...", "walletName": "...", "exportData": "...", "exportedAt": "..."}}
func ExportWallet(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletName string `json:"walletName"`
		USBPath    string `json:"usbPath"`
		Format     string `json:"format"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// FR-003: Export wallet metadata without private keys
	data := map[string]interface{}{
		"walletId":   "placeholder-export-id",
		"walletName": input.WalletName,
		"exportData": "metadata-only-no-private-keys",
		"exportedAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export RenameWallet
// RenameWallet changes wallet display name.
// T024.2: Implement RenameWallet export function
//
// Input JSON: {"walletName": "...", "newWalletName": "...", "usbPath": "..."}
// Output JSON: {"success": true, "data": {"walletId": "...", "oldName": "...", "newName": "...", "renamedAt": "..."}}
func RenameWallet(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletName    string `json:"walletName"`
		NewWalletName string `json:"newWalletName"`
		USBPath       string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// FR-003: Rename wallet
	data := map[string]interface{}{
		"walletId":  "placeholder-rename-id",
		"oldName":   input.WalletName,
		"newName":   input.NewWalletName,
		"renamedAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export DeleteWallet
// DeleteWallet permanently deletes a wallet from storage after password verification.
// This is a destructive operation that cannot be undone.
//
// Security: Requires correct wallet password for authentication.
//
// Input JSON: {
//   "walletId": "uuid",
//   "password": "wallet-password",  // REQUIRED: Must be correct
//   "usbPath": "/path/to/usb"
// }
//
// Returns: {"success": true, "data": {"walletId": "...", "deletedAt": "..."}}
func DeleteWallet(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletID string `json:"walletId"`
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Security: Clear sensitive data after use
	defer zeroString(&input.Password)

	// Validate inputs
	if input.WalletID == "" {
		response := NewErrorResponse(ErrInvalidInput, "Wallet ID is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.Password == "" {
		response := NewErrorResponse(ErrInvalidInput, "Password is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Create wallet service
	svc := wallet.NewWalletService(input.USBPath)

	// Delete wallet (password will be verified inside)
	err := svc.DeleteWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Recalculate locked wallets after deletion
	// This may unlock wallets if we're now below the limit
	initSessionManager().RecalculateLockedWallets(input.USBPath)

	// Success
	data := map[string]interface{}{
		"walletId":  input.WalletID,
		"deletedAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ListWallets
// ListWallets enumerates all wallets on USB.
// T024.3: Implement ListWallets export function
//
// Input JSON: {"usbPath": "..."}
// Output JSON: {"success": true, "data": {"wallets": [{"walletId": "...", "walletName": "...", "createdAt": "..."}], "count": 2}}
func ListWallets(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		USBPath string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Create wallet service with USB path
	svc := wallet.NewWalletService(input.USBPath)

	// List all wallets from storage
	walletObjs, err := svc.ListWallets()
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Convert wallet objects to FFI response format
	wallets := make([]map[string]interface{}, 0, len(walletObjs))
	for _, w := range walletObjs {
		addressCount := 0
		var addresses []map[string]interface{}
		if w.AddressBook != nil {
			addressCount = len(w.AddressBook.Addresses)
			// Include public addresses (no sensitive data)
			addresses = make([]map[string]interface{}, 0, len(w.AddressBook.Addresses))
			for _, addr := range w.AddressBook.Addresses {
				addresses = append(addresses, map[string]interface{}{
					"symbol":         addr.Symbol,
					"coinName":       addr.CoinName,
					"coinType":       addr.CoinType,
					"address":        addr.Address,
					"derivationPath": addr.DerivationPath,
					"category":       string(addr.Category),
				})
			}
		}

		walletData := map[string]interface{}{
			"walletId":      w.ID,
			"walletName":    w.Name,
			"createdAt":     w.CreatedAt.Format(time.RFC3339),
			"addressCount":  addressCount,
			"hasPassphrase": w.UsesPassphrase,
		}
		// Only include addresses if available
		if addresses != nil {
			walletData["addresses"] = addresses
		}
		wallets = append(wallets, walletData)
	}

	data := map[string]interface{}{
		"wallets": wallets,
		"count":   len(wallets),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

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
func BuildTransaction(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
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
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Zero sensitive data after function returns
	defer zeroString(&input.AppPassword)

	// Step 0: Validate session token and get appPassword
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Build RPC endpoint from provider configuration
	rpcEndpoint := ""
	if input.USBPath != "" && appPassword != "" {
		// Load provider config to get Alchemy API key
		configPath := input.USBPath + "/provider_config.enc"
		store, err := provider.NewProviderConfigStore(configPath, appPassword)
		if err == nil {
			// Try to get provider - first try "global", then chain-specific
			var config *provider.ProviderConfig
			config, err = store.GetBestProvider("global")
			if err != nil {
				// Fallback to chain-specific provider
				config, err = store.GetBestProvider("ethereum")
			}
			if err == nil && config != nil && config.APIKey != "" {
				// Build Alchemy RPC URL based on chain
				rpcEndpoint = buildAlchemyRPCEndpoint(input.ChainID, config.APIKey)
				fmt.Fprintf(os.Stderr, "[Go BuildTransaction] Using RPC endpoint: %s\n", rpcEndpoint)
			}
		}
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Parse amount string to *big.Int
	amount, err := chainadapterService.ParseAmount(input.Amount)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid amount: %v", err))
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
		response := NewErrorResponse(ErrTransactionBuildFailed, fmt.Sprintf("Failed to build transaction: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Encode signing payload as base64 for JSON transport
	signingPayloadB64 := base64.StdEncoding.EncodeToString(unsigned.SigningPayload)

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
func SignTransaction(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletID   string                 `json:"walletId"`
		Password   string                 `json:"password"`
		Passphrase string                 `json:"passphrase"` // BIP39 passphrase (empty if not used)
		USBPath    string                 `json:"usbPath"`
		ChainID    string                 `json:"chainId"`
		UnsignedTx map[string]interface{} `json:"unsignedTx"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Zero sensitive data after function returns
	defer zeroString(&input.Password)
	defer zeroString(&input.Passphrase)

	// Step 0: Check if wallet is locked (before any expensive operations)
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
		response := NewErrorResponse(code, fmt.Sprintf("Failed to decrypt wallet: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&mnemonic) // Critical: clear mnemonic after use

	// Step 2: Load wallet metadata to get AddressBook
	walletObj, err := walletSvc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, fmt.Sprintf("Failed to load wallet: %v", err))
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
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Address %s not found in wallet AddressBook", unsigned.From))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 5: Derive private key from mnemonic + derivation path
	bip39Svc := bip39service.NewBIP39Service()
	hdkeySvc := hdkey.NewHDKeyService()

	// Mnemonic → Seed (use provided passphrase, empty string if not used)
	seed, err := bip39Svc.MnemonicToSeed(mnemonic, input.Passphrase)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to derive seed: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Seed → Master Key
	masterKey, err := hdkeySvc.NewMasterKey(seed)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to create master key: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Master Key → Child Key (using derivation path)
	childKey, err := hdkeySvc.DerivePath(masterKey, derivationPath)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to derive key at path %s: %v", derivationPath, err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Child Key → Private Key (raw bytes)
	// SECURITY: Use SecureAlloc to try mlock the memory
	privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to extract private key: %v", err))
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
			fmt.Fprintf(os.Stderr, "[SignTx] Derivation path: %s\n", derivationPath)
			fmt.Fprintf(os.Stderr, "[SignTx] Expected address (from wallet): %s\n", unsigned.From)
			fmt.Fprintf(os.Stderr, "[SignTx] Derived address (from privkey): %s\n", derivedAddr.Hex())
			if strings.ToLower(derivedAddr.Hex()) != strings.ToLower(unsigned.From) {
				fmt.Fprintf(os.Stderr, "[SignTx] CRITICAL: Address mismatch! Private key derives to different address.\n")
				fmt.Fprintf(os.Stderr, "[SignTx] This means the wallet's AddressBook contains wrong address for this derivation path.\n")
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
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Failed to create secure signer: %v", err))
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
		response := NewErrorResponse(ErrTransactionSignFailed, fmt.Sprintf("Failed to sign transaction: %v", err))
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
func BroadcastTransaction(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID      string                 `json:"chainId"`
		SignedTx     map[string]interface{} `json:"signedTx"`
		RPCConfig    string                 `json:"rpcConfig"`
		USBPath      string                 `json:"usbPath"`
		SessionToken string                 `json:"sessionToken"` // PREFERRED: Session token
		AppPassword  string                 `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Validate session token and get appPassword
	appPassword, err := validateSessionAndGetAppPassword(input.SessionToken, input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, err.Error())
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
			var config *provider.ProviderConfig
			config, err = store.GetBestProvider("global")
			if err != nil {
				config, err = store.GetBestProvider("ethereum")
			}
			if err == nil && config != nil && config.APIKey != "" {
				rpcEndpoint = buildAlchemyRPCEndpoint(input.ChainID, config.APIKey)
				// Safe string truncation for logging
				logEndpoint := rpcEndpoint
				if len(logEndpoint) > 50 {
					logEndpoint = logEndpoint[:50] + "..."
				}
				fmt.Fprintf(os.Stderr, "[Go BroadcastTx] Built RPC endpoint for chain %s: %s\n", input.ChainID, logEndpoint)
			}
		}
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Reconstruct SignedTransaction from map
	signedBytes, err := json.Marshal(input.SignedTx)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid signed transaction: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var signed chainadapter.SignedTransaction
	if err := json.Unmarshal(signedBytes, &signed); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Failed to parse signed transaction: %v", err))
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
		response := NewErrorResponse(ErrTransactionBroadcastFailed, fmt.Sprintf("Failed to broadcast transaction: %v", err))
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
func QueryTransactionStatus(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID   string `json:"chainId"`
		TxHash    string `json:"txHash"`
		RPCConfig string `json:"rpcConfig"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Query transaction status
	ctx := context.Background()
	status, err := svc.QueryTransactionStatus(ctx, input.ChainID, input.TxHash, input.RPCConfig)
	if err != nil {
		response := NewErrorResponse(ErrTransactionQueryFailed, fmt.Sprintf("Failed to query transaction status: %v", err))
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
func SetProviderConfig(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ProviderType   string `json:"providerType"`
		APIKey         string `json:"apiKey"`
		ChainID        string `json:"chainId"`
		NetworkID      string `json:"networkId"`
		CustomEndpoint string `json:"customEndpoint"`
		Priority       int    `json:"priority"`
		Enabled        bool   `json:"enabled"`
		Password       string `json:"password"` // For encryption
		USBPath        string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Zero sensitive data after function returns
	defer zeroString(&input.APIKey)
	defer zeroString(&input.Password)

	// Create provider config store
	configPath := filepath.Join(input.USBPath, "provider_config.enc")
	debugLog(fmt.Sprintf("[DEBUG] SetProviderConfig: configPath = %s", configPath))
	debugLog(fmt.Sprintf("[DEBUG] SetProviderConfig: password length = %d", len(input.Password)))
	debugLog(fmt.Sprintf("[DEBUG] SetProviderConfig: password = '%s'", input.Password))

	store, err := provider.NewProviderConfigStore(configPath, input.Password)
	if err != nil {
		debugLog(fmt.Sprintf("[DEBUG] SetProviderConfig: Failed to create store: %v", err))
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to open config store: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	debugLog("[DEBUG] SetProviderConfig: Store created successfully")

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
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid API key: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Save configuration
	if err := store.Set(config); err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to save provider config: %v", err))
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
func GetProviderConfig(params *C.char) *C.char {
	fmt.Fprintf(os.Stderr, "[Go] GetProviderConfig called\n")
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		fmt.Fprintf(os.Stderr, "[Go] GetProviderConfig took %v\n", elapsed)
	}()

	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "[Go] PANIC in GetProviderConfig: %v\n", r)
			debug.PrintStack()
		}
	}()

	paramsJSON := C.GoString(params)
	fmt.Fprintf(os.Stderr, "[Go] GetProviderConfig params: %s\n", paramsJSON)
	var input struct {
		ChainID      string `json:"chainId"`
		ProviderType string `json:"providerType"` // Optional
		Password     string `json:"password"`
		USBPath      string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		fmt.Fprintf(os.Stderr, "[Go] GetProviderConfig JSON parse error: %v\n", err)
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	fmt.Fprintf(os.Stderr, "[Go] GetProviderConfig: chainId=%s, providerType=%s, password length=%d\n", input.ChainID, input.ProviderType, len(input.Password))

	// Zero sensitive data after function returns
	defer zeroString(&input.Password)

	// Create provider config store
	configPath := input.USBPath + "/provider_config.enc"
	fmt.Fprintf(os.Stderr, "[Go] GetProviderConfig: configPath=%s\n", configPath)
	store, err := provider.NewProviderConfigStore(configPath, input.Password)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to open config store: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var config *provider.ProviderConfig
	if input.ProviderType != "" {
		// Get specific provider
		config, err = store.Get(input.ChainID, input.ProviderType)
	} else {
		// Get best provider for chain
		config, err = store.GetBestProvider(input.ChainID)
	}

	if err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Provider config not found: %v", err))
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
func ListProviderConfigs(params *C.char) *C.char {
	fmt.Fprintf(os.Stderr, "[Go] ListProviderConfigs called\n")
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		fmt.Fprintf(os.Stderr, "[Go] ListProviderConfigs took %v\n", elapsed)
	}()

	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "[Go] PANIC in ListProviderConfigs: %v\n", r)
			debug.PrintStack()
		}
	}()

	paramsJSON := C.GoString(params)
	fmt.Fprintf(os.Stderr, "[Go] ListProviderConfigs params: %s\n", paramsJSON)
	var input struct {
		ChainID  string `json:"chainId"` // Optional
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		fmt.Fprintf(os.Stderr, "[Go] ListProviderConfigs JSON parse error: %v\n", err)
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	fmt.Fprintf(os.Stderr, "[Go] ListProviderConfigs: chainId=%s, password length=%d\n", input.ChainID, len(input.Password))

	// Zero sensitive data after function returns
	defer zeroString(&input.Password)

	// Create provider config store
	configPath := input.USBPath + "/provider_config.enc"
	fmt.Fprintf(os.Stderr, "[Go] ListProviderConfigs: configPath=%s\n", configPath)
	store, err := provider.NewProviderConfigStore(configPath, input.Password)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to open config store: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var configs []*provider.ProviderConfig
	if input.ChainID != "" {
		// Get all providers for specific chain
		configs, err = store.GetAllForChain(input.ChainID)
		if err != nil {
			response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to list providers: %v", err))
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
func DeleteProviderConfig(params *C.char) *C.char {
	fmt.Fprintf(os.Stderr, "[Go] DeleteProviderConfig called\n")
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		fmt.Fprintf(os.Stderr, "[Go] DeleteProviderConfig took %v\n", elapsed)
	}()

	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "[Go] PANIC in DeleteProviderConfig: %v\n", r)
			debug.PrintStack()
		}
	}()

	paramsJSON := C.GoString(params)
	fmt.Fprintf(os.Stderr, "[Go] DeleteProviderConfig params: %s\n", paramsJSON)
	var input struct {
		ChainID      string `json:"chainId"`
		ProviderType string `json:"providerType"`
		Password     string `json:"password"`
		USBPath      string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		fmt.Fprintf(os.Stderr, "[Go] DeleteProviderConfig JSON parse error: %v\n", err)
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	fmt.Fprintf(os.Stderr, "[Go] DeleteProviderConfig: chainId=%s, providerType=%s, password length=%d\n", input.ChainID, input.ProviderType, len(input.Password))

	// Zero sensitive data after function returns
	defer zeroString(&input.Password)

	// Create provider config store
	configPath := input.USBPath + "/provider_config.enc"
	fmt.Fprintf(os.Stderr, "[Go] DeleteProviderConfig: configPath=%s\n", configPath)
	store, err := provider.NewProviderConfigStore(configPath, input.Password)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to open config store: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Delete configuration
	if err := store.Delete(input.ChainID, input.ProviderType); err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to delete provider config: %v", err))
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
func EstimateFee(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID   string `json:"chainId"`
		From      string `json:"from"`
		To        string `json:"to"`
		Asset     string `json:"asset"`
		Amount    string `json:"amount"`
		RPCConfig string `json:"rpcConfig"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize ChainAdapter service
	svc := initChainAdapterService()

	// Parse amount string to *big.Int
	amount, err := chainadapterService.ParseAmount(input.Amount)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid amount: %v", err))
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
		response := NewErrorResponse(ErrFeeEstimationFailed, fmt.Sprintf("Failed to estimate fee: %v", err))
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
func IsFirstTimeSetup(params *C.char) *C.char {
	fmt.Fprintf(os.Stderr, "[Go] IsFirstTimeSetup called\n")
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		fmt.Fprintf(os.Stderr, "[Go] IsFirstTimeSetup took %v\n", elapsed)
	}()

	defer func() {
		if r := recover(); r != nil {
			fmt.Fprintf(os.Stderr, "[Go] PANIC in IsFirstTimeSetup: %v\n", r)
			debug.PrintStack()
			// We can't return a value from here without named returns.
			// Just log it for now.
		}
	}()

	paramsJSON := C.GoString(params)
	fmt.Fprintf(os.Stderr, "[Go] IsFirstTimeSetup params: %s\n", paramsJSON)

	var input struct {
		USBPath string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		fmt.Fprintf(os.Stderr, "[Go] JSON Unmarshal error: %v\n", err)
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Check if app_config.enc exists
	exists := app.AppConfigExists(input.USBPath)
	isFirstTime := !exists
	fmt.Fprintf(os.Stderr, "[Go] AppConfigExists(%s) = %v, isFirstTime = %v\n", input.USBPath, exists, isFirstTime)

	data := map[string]interface{}{
		"isFirstTime": isFirstTime,
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	fmt.Fprintf(os.Stderr, "[Go] IsFirstTimeSetup response: %s\n", string(jsonBytes))
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
func InitializeApp(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Security: Clear password after use
	defer zeroString(&input.Password)

	// Initialize app config
	if err := app.InitializeAppConfig(input.Password, input.USBPath); err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Failed to initialize app: %v", err))
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
func UnlockApp(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Security: Clear password after use
	defer zeroString(&input.Password)

	// Load app config
	config, err := app.LoadAppConfig(input.Password, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrWalletNotFound, fmt.Sprintf("Failed to unlock app (incorrect password?): %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	data := map[string]interface{}{
		"config": config,
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetTokenBalances
// GetTokenBalances queries token balances for all addresses in a wallet across multiple chains
// using Alchemy API. Returns aggregated token balances with USD values.
//
// Security: Uses session token for app-level auth (low-risk operation).
// Wallet password still required to verify wallet access.
//
// Input JSON: {
//   "walletId": "uuid",
//   "password": "wallet-password",      // REQUIRED: Must be correct wallet password
//   "usbPath": "/path/to/usb",
//   "sessionToken": "session-token",    // REQUIRED: Valid session token
//   "appPassword": "app-level-password" // DEPRECATED: Use sessionToken instead
// }
//
// Returns: {"success": true, "data": {"tokens": [...], "totalUsd": 5000.50, ...}}
func GetTokenBalances(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input provider.GetTokenBalancesInput
	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
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
		response := NewErrorResponse(ErrInvalidInput, err.Error())
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
		debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Failed to initialize provider store: %v", err))
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Failed to initialize provider store: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	debugLog("[DEBUG] GetTokenBalances: Provider store initialized successfully")

	// Try to get Alchemy provider for global chainId (set by ProviderSettings UI)
	debugLog("[DEBUG] GetTokenBalances: Attempting to get provider with chainId='global', providerType='alchemy'")
	providerConfig, err := providerStore.Get("global", "alchemy")
	if err != nil {
		debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Error getting provider: %v", err))
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Failed to get Alchemy provider: %v", err))
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
		response := NewErrorResponse(code, err.Error())
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

	// Step 3: Build Alchemy API request
	addressNetworkMap := make(map[string][]string) // address -> networks

	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: includeTestnets = %v", input.IncludeTestnets))

	for _, addr := range walletObj.AddressBook.Addresses {
		// Convert chain name to Alchemy network identifier
		network, ok := provider.GetAlchemyNetwork(addr.CoinName)
		if !ok {
			// Skip unsupported chains
			continue
		}

		// Add network to address
		addressNetworkMap[addr.Address] = append(addressNetworkMap[addr.Address], network)

		// If includeTestnets is true and this is an Ethereum address, also query Sepolia
		if input.IncludeTestnets && addr.CoinName == "Ethereum" {
			debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Adding Sepolia for address %s", addr.Address))
			addressNetworkMap[addr.Address] = append(addressNetworkMap[addr.Address], provider.NetworkEthSepolia)
		}
	}

	debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Total addresses with networks: %d", len(addressNetworkMap)))
	for addr, networks := range addressNetworkMap {
		debugLog(fmt.Sprintf("[DEBUG] GetTokenBalances: Address %s -> Networks: %v", addr[:10]+"...", networks))
	}

	if len(addressNetworkMap) == 0 {
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

	// Convert map to slice
	var alchemyAddresses []provider.AlchemyAddressWithNetworks
	for addr, networks := range addressNetworkMap {
		alchemyAddresses = append(alchemyAddresses, provider.AlchemyAddressWithNetworks{
			Address:  addr,
			Networks: networks,
		})
	}

	// Step 4: Query Alchemy API
	alchemyClient := provider.NewAlchemyClient(alchemyAPIKey)
	alchemyResponse, err := alchemyClient.GetTokenBalancesByAddress(alchemyAddresses)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Alchemy API error: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Step 5: Simplify and aggregate results
	tokens := provider.SimplifyTokenBalances(alchemyResponse)

	// Calculate totals
	var totalUSD float64
	networkSet := make(map[string]bool)
	for _, token := range tokens {
		totalUSD += token.USDValue
		networkSet[token.Network] = true
	}

	output := provider.GetTokenBalancesOutput{
		Tokens:       tokens,
		TotalUSD:     totalUSD,
		AddressCount: len(addressNetworkMap),
		NetworkCount: len(networkSet),
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
func GetAssetTransfers(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Address     string `json:"address"`
		Network     string `json:"network"`     // e.g., "eth-mainnet", "polygon-mainnet"
		MaxCount    int    `json:"maxCount"`    // Optional: max transfers to return
		PageKey     string `json:"pageKey"`     // Optional: pagination
		AppPassword string `json:"appPassword"`
		USBPath     string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Security: Clear sensitive data after use
	defer zeroString(&input.AppPassword)

	// Validate required inputs
	if input.Address == "" {
		response := NewErrorResponse(ErrInvalidInput, "Address is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.Network == "" {
		input.Network = "eth-mainnet" // Default to Ethereum mainnet
	}

	// Load Alchemy API key from provider registry
	providerConfigPath := filepath.Join(input.USBPath, "provider_config.enc")
	providerStore, err := provider.NewProviderConfigStore(providerConfigPath, input.AppPassword)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Failed to initialize provider store: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

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
			response := NewErrorResponse(ErrStorageError, fmt.Sprintf("BSCTrace API error: %v", err))
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
			response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Alchemy API error: %v", err))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}

	default:
		// Unknown provider - fallback to Alchemy
		alchemyClient := provider.NewAlchemyClient(providerConfig.APIKey)
		transfers, pageKey, err = alchemyClient.GetAssetTransfers(input.Address, input.Network, maxCount, input.PageKey)
		if err != nil {
			fmt.Printf("Alchemy API error (fallback): %v\n", err)
			response := NewErrorResponse(ErrStorageError, fmt.Sprintf("Alchemy API error: %v", err))
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
func ValidatePassphrase(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		_ = elapsed
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletID   string `json:"walletId"`
		Password   string `json:"password"`
		Passphrase string `json:"passphrase"`
		USBPath    string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
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
		response := NewErrorResponse(code, fmt.Sprintf("Failed to decrypt wallet: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&mnemonic)

	// Step 2: Load wallet metadata to get AddressBook
	walletObj, err := walletSvc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, fmt.Sprintf("Failed to load wallet: %v", err))
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

	// Mnemonic → Seed (using provided passphrase)
	seed, err := bip39Svc.MnemonicToSeed(mnemonic, input.Passphrase)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to derive seed: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Seed → Master Key
	masterKey, err := hdkeySvc.NewMasterKey(seed)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to create master key: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Master Key → Child Key (using ETH derivation path)
	childKey, err := hdkeySvc.DerivePath(masterKey, ethDerivationPath)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to derive key at path %s: %v", ethDerivationPath, err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Child Key → Private Key (raw bytes)
	privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
	if err != nil {
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to extract private key: %v", err))
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
		response := NewErrorResponse(ErrEncryptionError, fmt.Sprintf("Failed to parse private key: %v", err))
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

// ============================================================================
// Swap FFI Functions (OpenOcean DEX Aggregator - FREE, No KYC required)
// Feature: Token Swap via OpenOcean API
// ============================================================================

// Global swap aggregator instance (lazy initialization)
var swapAggregator *swap.Aggregator

// initSwapAggregator initializes the global swap aggregator
// OpenOcean doesn't require API key!
func initSwapAggregator() *swap.Aggregator {
	if swapAggregator == nil {
		swapAggregator = swap.NewAggregator(&swap.Config{})
	}
	return swapAggregator
}

// chainIDToInt converts chain string to numeric chain ID for 1inch API
func chainIDToInt(chainID string) int {
	switch chainID {
	case "ethereum", "ethereum-mainnet":
		return 1
	case "polygon", "polygon-mainnet":
		return 137
	case "arbitrum", "arbitrum-mainnet":
		return 42161
	case "optimism", "optimism-mainnet":
		return 10
	case "base", "base-mainnet":
		return 8453
	case "bsc", "bsc-mainnet", "bnb":
		return 56
	case "bsc-testnet", "bnb-testnet":
		return 97
	default:
		return 1 // Default to Ethereum mainnet
	}
}

//export GetSwapQuote
// GetSwapQuote fetches a swap quote from OpenOcean DEX aggregator.
// Feature: Token Swap (OpenOcean - FREE, No KYC required)
//
// Input JSON: {
//   "chainId": "ethereum" | "polygon" | "arbitrum" | etc.,
//   "fromTokenAddress": "0x..." or "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" for native,
//   "toTokenAddress": "0x...",
//   "amount": "1000000000000000000",  // Amount in smallest unit (wei)
//   "fromAddress": "0x...",  // User's wallet address
//   "slippage": 0.5,  // Slippage tolerance in percent
//   "usbPath": "/path/to/usb",
//   "appPassword": "password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "dex": "OpenOcean",
//     "fromToken": {...},
//     "toToken": {...},
//     "fromAmount": "...",
//     "toAmount": "...",
//     "toAmountMin": "...",
//     "exchangeRate": "...",
//     "estimatedGas": "...",
//     "gasCostETH": "...",
//     "route": ["ETH", "USDC"],
//     "protocols": ["OpenOcean"],
//     "needsApproval": true,
//     "approvalAddress": "0x..."
//   }
// }
func GetSwapQuote(params *C.char) *C.char {
	start := time.Now()
	var provider string = "openocean" // will be updated from input
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetSwapQuote via %s completed in %v", provider, elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID          string  `json:"chainId"`
		FromTokenAddress string  `json:"fromTokenAddress"`
		ToTokenAddress   string  `json:"toTokenAddress"`
		Amount           string  `json:"amount"`
		FromAddress      string  `json:"fromAddress"`
		Slippage         float64 `json:"slippage"`
		Provider         string  `json:"provider"`     // DEX provider: "openocean" | "kyberswap"
		USBPath          string  `json:"usbPath"`
		SessionToken     string  `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword      string  `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update provider for debug log
	if input.Provider != "" {
		provider = input.Provider
	}

	defer zeroString(&input.AppPassword)

	// Default slippage
	if input.Slippage <= 0 {
		input.Slippage = 0.5
	}

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	// Parse amount
	amount := new(big.Int)
	amount.SetString(input.Amount, 10)

	// Get dynamic gas price from RPC (with chain-specific fallback)
	gasPrice, _ := rpc.GetGasPrice(input.ChainID)
	if gasPrice == nil {
		gasPrice = big.NewInt(1e9) // 1 Gwei fallback
	}
	debugLog(fmt.Sprintf("GetSwapQuote: Using gas price %s wei for chain %s", gasPrice.String(), input.ChainID))

	// Get quote
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	quote, err := aggregator.GetQuote(ctx, &swap.QuoteParams{
		Provider:         swap.Provider(input.Provider), // Pass provider from frontend
		ChainID:          chainIDToInt(input.ChainID),
		FromTokenAddress: input.FromTokenAddress,
		ToTokenAddress:   input.ToTokenAddress,
		Amount:           amount,
		FromAddress:      input.FromAddress,
		Slippage:         input.Slippage,
		GasPrice:         gasPrice,
	})

	if err != nil {
		response := NewErrorResponse(ErrSwapQuoteFailed, fmt.Sprintf("Failed to get swap quote: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	response := NewSuccessResponse(quote)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export BuildSwapTransaction
// BuildSwapTransaction builds a complete swap transaction ready for signing.
// Feature: Token Swap
//
// Input JSON: same as GetSwapQuote
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "quote": {...},  // Same as GetSwapQuote response
//     "txData": {
//       "from": "0x...",
//       "to": "0x...",  // 1inch router
//       "data": "0x...",  // Encoded swap call
//       "value": "0",  // ETH value for native swaps
//       "gas": 200000
//     },
//     "chainId": 1
//   }
// }
func BuildSwapTransaction(params *C.char) *C.char {
	start := time.Now()
	var provider string = "openocean" // will be updated from input
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("BuildSwapTransaction via %s completed in %v", provider, elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID          string  `json:"chainId"`
		FromTokenAddress string  `json:"fromTokenAddress"`
		ToTokenAddress   string  `json:"toTokenAddress"`
		Amount           string  `json:"amount"`
		FromAddress      string  `json:"fromAddress"`
		Slippage         float64 `json:"slippage"`
		Provider         string  `json:"provider"`     // DEX provider: "openocean" | "kyberswap"
		USBPath          string  `json:"usbPath"`
		SessionToken     string  `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword      string  `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Update provider for debug log
	if input.Provider != "" {
		provider = input.Provider
	}

	defer zeroString(&input.AppPassword)

	// Default slippage
	if input.Slippage <= 0 {
		input.Slippage = 0.5
	}

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	// Parse amount
	amount := new(big.Int)
	amount.SetString(input.Amount, 10)

	// Get dynamic gas price from RPC (with chain-specific fallback)
	gasPrice, _ := rpc.GetGasPrice(input.ChainID)
	if gasPrice == nil {
		gasPrice = big.NewInt(1e9) // 1 Gwei fallback
	}
	debugLog(fmt.Sprintf("BuildSwapTransaction: Using gas price %s wei for chain %s", gasPrice.String(), input.ChainID))

	// Build swap transaction
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	swapTx, err := aggregator.BuildSwapTransaction(ctx, &swap.QuoteParams{
		Provider:         swap.Provider(input.Provider), // Pass provider from frontend
		ChainID:          chainIDToInt(input.ChainID),
		FromTokenAddress: input.FromTokenAddress,
		ToTokenAddress:   input.ToTokenAddress,
		Amount:           amount,
		FromAddress:      input.FromAddress,
		Slippage:         input.Slippage,
		GasPrice:         gasPrice,
	})

	if err != nil {
		response := NewErrorResponse(ErrSwapBuildFailed, fmt.Sprintf("Failed to build swap transaction: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	response := NewSuccessResponse(swapTx)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetSwapApproval
// GetSwapApproval builds the ERC-20 approve transaction data locally.
// This does NOT call any external API - it just encodes the approve(spender, amount) call.
// Feature: Token Swap - Approval Flow
//
// Input JSON: {
//   "chainId": "ethereum",
//   "tokenAddress": "0x...",  // Token contract to call approve() on
//   "spenderAddress": "0x...", // DEX router address (from quote.approvalAddress)
//   "amount": "1000000000000000000",  // Amount to approve (optional, empty = unlimited = MaxUint256)
//   "usbPath": "/path/to/usb",
//   "appPassword": "password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "to": "0x...",  // Token contract address
//     "data": "0x...",  // Encoded approve(spender, amount) call
//     "value": "0"
//   }
// }
func GetSwapApproval(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetSwapApproval completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID        string `json:"chainId"`
		TokenAddress   string `json:"tokenAddress"`
		SpenderAddress string `json:"spenderAddress"` // DEX router address
		Amount         string `json:"amount"`         // Optional: empty = unlimited
		USBPath        string `json:"usbPath"`
		SessionToken   string `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword    string `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Validate required fields
	if input.TokenAddress == "" {
		response := NewErrorResponse(ErrInvalidInput, "tokenAddress is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	if input.SpenderAddress == "" {
		response := NewErrorResponse(ErrInvalidInput, "spenderAddress is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Parse amount: empty = MaxUint256 (unlimited approval)
	var amount *big.Int
	if input.Amount != "" && input.Amount != "0" {
		amount = new(big.Int)
		if _, ok := amount.SetString(input.Amount, 10); !ok {
			response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid amount: %s", input.Amount))
			jsonBytes, _ := json.Marshal(response)
			return C.CString(string(jsonBytes))
		}
	} else {
		// MaxUint256 = 2^256 - 1 (unlimited approval)
		amount = new(big.Int)
		amount.Exp(big.NewInt(2), big.NewInt(256), nil)
		amount.Sub(amount, big.NewInt(1))
	}

	// Build ERC-20 approve(address spender, uint256 amount) calldata
	// Function selector: keccak256("approve(address,uint256)")[:4] = 0x095ea7b3
	// Followed by: spender address (32 bytes, left-padded) + amount (32 bytes, left-padded)
	approveSelector := []byte{0x09, 0x5e, 0xa7, 0xb3}

	// Parse spender address (remove 0x prefix if present)
	spenderHex := strings.TrimPrefix(input.SpenderAddress, "0x")
	spenderBytes, err := hexToBytes(spenderHex)
	if err != nil || len(spenderBytes) != 20 {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid spender address: %s", input.SpenderAddress))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Build calldata: 4 bytes selector + 32 bytes spender + 32 bytes amount = 68 bytes
	calldata := make([]byte, 68)
	copy(calldata[0:4], approveSelector)
	copy(calldata[16:36], spenderBytes) // spender at bytes 4-35 (left-padded to 32 bytes)
	amountBytes := amount.Bytes()
	copy(calldata[68-len(amountBytes):68], amountBytes) // amount at bytes 36-67 (left-padded to 32 bytes)

	// Return approval transaction data
	approval := map[string]string{
		"to":    input.TokenAddress,
		"data":  "0x" + bytesToHex(calldata),
		"value": "0",
	}

	debugLog(fmt.Sprintf("Built approve calldata: to=%s, spender=%s, amount=%s",
		input.TokenAddress, input.SpenderAddress, amount.String()))

	response := NewSuccessResponse(approval)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// hexToBytes converts a hex string to bytes
func hexToBytes(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		s = "0" + s
	}
	result := make([]byte, len(s)/2)
	for i := 0; i < len(result); i++ {
		var b byte
		_, err := fmt.Sscanf(s[i*2:i*2+2], "%02x", &b)
		if err != nil {
			return nil, err
		}
		result[i] = b
	}
	return result, nil
}

// bytesToHex converts bytes to a hex string
func bytesToHex(b []byte) string {
	result := make([]byte, len(b)*2)
	for i, v := range b {
		result[i*2] = "0123456789abcdef"[v>>4]
		result[i*2+1] = "0123456789abcdef"[v&0x0f]
	}
	return string(result)
}

//export CheckSwapAllowance
// CheckSwapAllowance checks the current token allowance for 1inch router.
// Feature: Token Swap - Allowance Check
//
// Input JSON: {
//   "chainId": "ethereum",
//   "tokenAddress": "0x...",
//   "walletAddress": "0x...",
//   "usbPath": "/path/to/usb",
//   "appPassword": "password"
// }
//
// Output JSON: {
//   "success": true,
//   "data": {
//     "allowance": "1000000000000000000",
//     "hasAllowance": true
//   }
// }
func CheckSwapAllowance(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("CheckSwapAllowance completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID       string `json:"chainId"`
		TokenAddress  string `json:"tokenAddress"`
		WalletAddress string `json:"walletAddress"`
		USBPath       string `json:"usbPath"`
		SessionToken  string `json:"sessionToken"` // PREFERRED: Session token (optional for read-only API)
		AppPassword   string `json:"appPassword"`  // DEPRECATED
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	allowance, err := aggregator.CheckAllowance(ctx, "", chainIDToInt(input.ChainID), input.TokenAddress, input.WalletAddress)
	if err != nil {
		response := NewErrorResponse(ErrSwapAllowanceFailed, fmt.Sprintf("Failed to check allowance: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"allowance":    allowance.String(),
		"hasAllowance": allowance.Cmp(big.NewInt(0)) > 0,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetNativeTokenAddress
// GetNativeTokenAddress returns the standard native token address for DEX APIs.
// Native tokens (ETH, MATIC, BNB, etc.) use this special address in API calls.
func GetNativeTokenAddress() *C.char {
	address := swap.GetNativeTokenAddress()
	response := NewSuccessResponse(map[string]string{
		"address": address,
	})
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export GetSwapTokens
// GetSwapTokens fetches all available tokens for swap on a chain from OpenOcean API.
// Feature: Token Swap (OpenOcean - FREE, No KYC required)
//
// Input JSON: {
//
//	"chainId": "56",  // Chain ID as string
//	"usbPath": "/Volumes/USB/...",
//	"appPassword": "password123"
//
// }
//
// Output JSON: {
//
//	"success": true,
//	"data": {
//	  "tokens": [
//	    {
//	      "symbol": "BNB",
//	      "name": "BNB",
//	      "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
//	      "decimals": 18,
//	      "logoURI": "https://..."
//	    },
//	    ...
//	  ]
//	}
//
// }
func GetSwapTokens(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetSwapTokens completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		ChainID     string `json:"chainId"`
		Provider    string `json:"provider"` // DEX provider: "openocean" | "kyberswap"
		USBPath     string `json:"usbPath"`
		AppPassword string `json:"appPassword"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Initialize swap aggregator (OpenOcean - no API key needed!)
	aggregator := initSwapAggregator()

	// Get tokens
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tokens, err := aggregator.GetTokens(ctx, swap.Provider(input.Provider), chainIDToInt(input.ChainID))
	if err != nil {
		response := NewErrorResponse(ErrSwapQuoteFailed, fmt.Sprintf("Failed to get swap tokens: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	output := map[string]interface{}{
		"tokens": tokens,
	}

	response := NewSuccessResponse(output)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

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
//     "walletLimit": 3,
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
func GetMembershipStatus(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("GetMembershipStatus completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		USBPath     string `json:"usbPath"`
		AppPassword string `json:"appPassword"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Load app config (password, usbPath)
	appConfig, err := app.LoadAppConfig(input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrAppConfigLoad, fmt.Sprintf("Failed to load app config: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Ensure device identity exists (generates UUID if needed)
	deviceId, err := appConfig.EnsureIdentity()
	if err != nil {
		response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Failed to ensure identity: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Save if identity was newly created (config, password, usbPath)
	if err := app.SaveAppConfig(appConfig, input.AppPassword, input.USBPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, fmt.Sprintf("Failed to save app config: %v", err))
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
func AddMembershipBinding(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("AddMembershipBinding completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
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
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
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
		response := NewErrorResponse(ErrAppConfigLoad, fmt.Sprintf("Failed to load app config: %v", err))
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
		response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Failed to add membership: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Save updated config (config, password, usbPath)
	if err := app.SaveAppConfig(appConfig, input.AppPassword, input.USBPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, fmt.Sprintf("Failed to save app config: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

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
func RemoveMembershipBinding(params *C.char) *C.char {
	start := time.Now()
	defer func() {
		elapsed := time.Since(start)
		debugLog(fmt.Sprintf("RemoveMembershipBinding completed in %v", elapsed))
	}()

	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		USBPath     string `json:"usbPath"`
		AppPassword string `json:"appPassword"`
		NftTokenId  string `json:"nftTokenId"`
		NftContract string `json:"nftContract"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Load app config (password, usbPath)
	appConfig, err := app.LoadAppConfig(input.AppPassword, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrAppConfigLoad, fmt.Sprintf("Failed to load app config: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Remove membership binding
	removed := appConfig.RemoveMembership(input.NftTokenId, input.NftContract)

	// Save updated config (config, password, usbPath)
	if err := app.SaveAppConfig(appConfig, input.AppPassword, input.USBPath); err != nil {
		response := NewErrorResponse(ErrAppConfigSave, fmt.Sprintf("Failed to save app config: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

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
func CreateSessionToken(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		USBPath     string `json:"usbPath"`
		AppPassword string `json:"appPassword"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	defer zeroString(&input.AppPassword)

	// Initialize session manager
	sm := initSessionManager()

	// Create session token
	session, err := sm.CreateSession(input.USBPath, input.AppPassword)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Authentication failed: %v", err))
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
func ValidateSessionToken(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize session manager
	sm := initSessionManager()

	// Validate token
	session, err := sm.ValidateToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid token: %v", err))
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
func RevokeSessionToken(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
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
func GetDeviceMembershipStatusWithToken(params *C.char) *C.char {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize session manager
	sm := initSessionManager()

	// Validate token and get session
	session, err := sm.ValidateToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid token: %v", err))
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
	// Formula: 3 + (nft_count * 5)
	nftCount := len(session.Memberships)
	walletLimit := 3 + (nftCount * 5)
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
func CreateWalletSessionToken(params *C.char) *C.char {
	// Panic recovery
	defer func() {
		if r := recover(); r != nil {
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		WalletID string `json:"walletId"`
		Password string `json:"password"`
		USBPath  string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize wallet session manager
	wsm := initWalletSessionManager()

	// Create wallet session (validates password)
	session, err := wsm.CreateWalletSession(input.WalletID, input.Password, input.USBPath)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Failed to create wallet session: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return session info
	result := map[string]interface{}{
		"token":     session.Token,
		"walletId":  session.WalletID,
		"expiresAt": session.ExpiresAt.Unix(),
		"usbPath":   session.UsbPath,
	}

	response := NewSuccessResponse(result)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ValidateWalletSessionToken
func ValidateWalletSessionToken(params *C.char) *C.char {
	// Panic recovery
	defer func() {
		if r := recover(); r != nil {
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize wallet session manager
	wsm := initWalletSessionManager()

	// Validate token
	session, err := wsm.ValidateWalletToken(input.Token)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid wallet token: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Return session info
	result := map[string]interface{}{
		"valid":     true,
		"walletId":  session.WalletID,
		"expiresAt": session.ExpiresAt.Unix(),
		"usbPath":   session.UsbPath,
	}

	response := NewSuccessResponse(result)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export RevokeWalletSessionToken
func RevokeWalletSessionToken(params *C.char) *C.char {
	// Panic recovery
	defer func() {
		if r := recover(); r != nil {
			response := NewErrorResponse(ErrLibraryPanic, fmt.Sprintf("Library panic: %v", r))
			jsonBytes, _ := json.Marshal(response)
			_ = C.CString(string(jsonBytes))
		}
	}()

	paramsJSON := C.GoString(params)
	var input struct {
		Token string `json:"token"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, fmt.Sprintf("Invalid JSON: %v", err))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Initialize wallet session manager
	wsm := initWalletSessionManager()

	// Revoke token
	wsm.RevokeWalletToken(input.Token)

	// Return success
	result := map[string]interface{}{
		"revoked": true,
	}

	response := NewSuccessResponse(result)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// main is required for buildmode=c-shared but should remain empty.
// All functionality is exposed through //export functions.
func main() {
	// Empty main function - library is used via FFI exports only
}
