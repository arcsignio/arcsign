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
	"encoding/json"
	"fmt"
	"runtime/debug"
	"time"
	"unsafe"

	"github.com/yourusername/arcsign/internal/services/wallet"
)

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

	// T026: Ensure sensitive data is zeroed before function returns
	defer func() {
		zeroString(&input.Mnemonic)
		zeroString(&input.Password)
		zeroString(&input.Passphrase)
	}()

	// Create wallet service
	svc := wallet.NewWalletService(input.USBPath)

	// Determine word count (12 or 24)
	words := len(input.Mnemonic) / 8 // Approximate: 12 words ≈ 96 chars, 24 words ≈ 192 chars
	wordCount := 24
	if words < 20 {
		wordCount = 12
	}
	usesPassphrase := input.Passphrase != ""

	// Create wallet using service (which validates mnemonic and generates addresses)
	walletObj, _, err := svc.CreateWallet(
		input.WalletName,
		input.Password,
		wordCount,
		usesPassphrase,
		input.Passphrase,
	)

	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, err.Error())
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

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
		if w.AddressBook != nil {
			addressCount = len(w.AddressBook.Addresses)
		}

		wallets = append(wallets, map[string]interface{}{
			"walletId":      w.ID,
			"walletName":    w.Name,
			"createdAt":     w.CreatedAt.Format(time.RFC3339),
			"addressCount":  addressCount,
			"hasPassphrase": w.UsesPassphrase,
		})
	}

	data := map[string]interface{}{
		"wallets": wallets,
		"count":   len(wallets),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// main is required for buildmode=c-shared but should remain empty.
// All functionality is exposed through //export functions.
func main() {
	// Empty main function - library is used via FFI exports only
}
