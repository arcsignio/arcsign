// Package main provides wallet management FFI exports for the arcSign wallet library.
// This file contains wallet CRUD operations: create, import, unlock, generate addresses,
// export/import backups, rename, delete, and list wallets.
//
// Extracted from exports.go for better code organization.
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"runtime/debug"
	"strings"
	"time"

	"github.com/Jason-chen-taiwan/arcSignv2/internal/security"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/backup"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/wallet"
)

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
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		WalletName string `json:"walletName"`
		Password   string `json:"password"`
		USBPath    string `json:"usbPath"`
		WordCount  int    `json:"wordCount"`  // 12 or 24
		Passphrase string `json:"passphrase"` // BIP39 passphrase (optional)
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
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
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
	defer security.SecureZero(jsonBytes) // Zero mnemonic from serialized JSON
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
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			// Note: In panic, we can't reliably return - this is best effort
			_ = ptr
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		WalletName string `json:"walletName"`
		Mnemonic   string `json:"mnemonic"`
		Password   string `json:"password"`
		USBPath    string `json:"usbPath"`
		Passphrase string `json:"passphrase"` // BIP39 passphrase (optional)
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

	// Normalize mnemonic: trim whitespace to prevent seed derivation issues
	input.Mnemonic = strings.TrimSpace(input.Mnemonic)

	// T026: Ensure sensitive data is zeroed before function returns
	defer func() {
		zeroString(&paramsJSON) // Zero raw JSON containing mnemonic
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
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
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
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
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

	// T026: Ensure sensitive data is zeroed before function returns
	defer func() {
		zeroString(&input.Password)
	}()

	// Rate limiting: prevent brute-force on wallet password
	if !walletRateLimiter.AllowAttempt(input.WalletID) {
		remaining := walletRateLimiter.GetRemainingAttempts(input.WalletID)
		response := NewErrorResponse(ErrRateLimitExceeded,
			fmt.Sprintf("Too many failed attempts. Please wait before trying again. (%d attempts remaining)", remaining))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Create wallet service and attempt to restore (decrypt) wallet
	svc := wallet.NewWalletService(input.USBPath)

	// RestoreWallet verifies password by attempting decryption
	mnemonic, err := svc.RestoreWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Clear mnemonic from memory immediately (we don't need it for unlock response)
	defer zeroString(&mnemonic)

	// Load wallet metadata
	walletObj, err := svc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Password verified successfully - reset rate limiter
	walletRateLimiter.ResetWallet(input.WalletID)

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
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
		}
	}()

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		WalletID    string   `json:"walletId"`
		USBPath     string   `json:"usbPath"` // USB storage path
		Blockchains []string `json:"blockchains"` // Empty array means all blockchains
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

	// Create wallet service with USB path
	svc := wallet.NewWalletService(input.USBPath)

	// Load wallet metadata (includes AddressBook from wallet creation)
	walletObj, err := svc.LoadWallet(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
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
// ExportWallet exports a wallet as an encrypted .arcsign backup file.
// The mnemonic.enc inside is already AES-256-GCM encrypted — no additional encryption needed.
// No password required for export.
//
// Input JSON: {"walletId": "...", "usbPath": "..."}
// Output JSON: {"success": true, "data": {"walletName": "...", "backupData": "<base64>", "exportedAt": "..."}}
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

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		WalletID string `json:"walletId"`
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

	if input.WalletID == "" {
		response := NewErrorResponse(ErrInvalidInput, "Wallet ID is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Export wallet as .arcsign backup
	svc := backup.NewBackupService(input.USBPath)
	backupData, walletName, err := svc.ExportBackup(input.WalletID)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	data := map[string]interface{}{
		"walletName": walletName,
		"backupData": base64.StdEncoding.EncodeToString(backupData),
		"exportedAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ImportBackupWallet
// ImportBackupWallet restores a wallet from an encrypted .arcsign backup file.
// Password is required to verify ownership (decrypt mnemonic).
//
// Input JSON: {"backupData": "<base64>", "password": "...", "usbPath": "...", "walletName": "..."}
// Output JSON: {"success": true, "data": {"walletId": "...", "walletName": "...", "importedAt": "..."}}
func ImportBackupWallet(params *C.char) *C.char {
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

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var input struct {
		BackupData string `json:"backupData"` // base64 encoded .arcsign file content
		Password   string `json:"password"`
		USBPath    string `json:"usbPath"`
		WalletName string `json:"walletName"` // optional override
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&input.Password)

	// Validate USB path
	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.BackupData == "" {
		response := NewErrorResponse(ErrInvalidInput, "Backup data is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.Password == "" {
		response := NewErrorResponse(ErrInvalidInput, "Password is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Decode base64 backup data
	backupBytes, err := base64.StdEncoding.DecodeString(input.BackupData)
	if err != nil {
		response := NewErrorResponse(ErrBackupCorrupted, "Invalid backup data encoding")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	// Import backup
	svc := backup.NewBackupService(input.USBPath)
	w, err := svc.ImportBackup(backupBytes, input.Password, input.WalletName)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	data := map[string]interface{}{
		"walletId":   w.ID,
		"walletName": w.Name,
		"importedAt": time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ExportAllWallets
// ExportAllWallets packages all wallets into an encrypted .arcsign-bundle file.
// Password is used as the outer encryption key (Argon2id + AES-256-GCM).
//
// Input JSON: {"password": "...", "usbPath": "..."}
// Output JSON: {"success": true, "data": {"bundleData": "<base64>", "walletCount": N, "exportedAt": "..."}}
func ExportAllWallets(params *C.char) *C.char {
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
	defer zeroString(&input.Password)

	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.Password == "" {
		response := NewErrorResponse(ErrInvalidInput, "Password is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	svc := backup.NewBackupService(input.USBPath)
	encryptedBundle, walletCount, err := svc.ExportAllBackups(input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	data := map[string]interface{}{
		"bundleData":  base64.StdEncoding.EncodeToString(encryptedBundle),
		"walletCount": walletCount,
		"exportedAt":  time.Now().Format(time.RFC3339),
	}

	response := NewSuccessResponse(data)
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

//export ImportAllWallets
// ImportAllWallets restores all wallets from an encrypted .arcsign-bundle file.
// Password decrypts the outer layer; individual wallet passwords are not needed.
//
// Input JSON: {"bundleData": "<base64>", "password": "...", "usbPath": "..."}
// Output JSON: {"success": true, "data": {"wallets": [...], "importedCount": N, "importedAt": "..."}}
func ImportAllWallets(params *C.char) *C.char {
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

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	var input struct {
		BundleData string `json:"bundleData"` // base64 encoded encrypted bundle
		Password   string `json:"password"`
		USBPath    string `json:"usbPath"`
	}

	if err := json.Unmarshal([]byte(paramsJSON), &input); err != nil {
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&input.Password)

	if err := ValidateUSBPath(input.USBPath); err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Invalid storage path")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.BundleData == "" {
		response := NewErrorResponse(ErrInvalidInput, "Bundle data is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	if input.Password == "" {
		response := NewErrorResponse(ErrInvalidInput, "Password is required")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	bundleBytes, err := base64.StdEncoding.DecodeString(input.BundleData)
	if err != nil {
		response := NewErrorResponse(ErrBundleCorrupted, "Invalid bundle data encoding")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	svc := backup.NewBackupService(input.USBPath)
	wallets, err := svc.ImportAllBackups(bundleBytes, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	walletList := make([]map[string]string, len(wallets))
	for i, w := range wallets {
		walletList[i] = map[string]string{
			"walletId":   w.ID,
			"walletName": w.Name,
		}
	}

	data := map[string]interface{}{
		"wallets":       walletList,
		"importedCount": len(wallets),
		"importedAt":    time.Now().Format(time.RFC3339),
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

	paramsJSON, err := safeGoString(params)
	if err != nil {
		response := NewErrorResponse(ErrInvalidInput, "Input size exceeds limit")
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	var input struct {
		WalletName    string `json:"walletName"`
		NewWalletName string `json:"newWalletName"`
		USBPath       string `json:"usbPath"`
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
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			ptr := C.CString(string(jsonBytes))
			_ = ptr
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
	err = svc.DeleteWallet(input.WalletID, input.Password)
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
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

	// Create wallet service with USB path
	svc := wallet.NewWalletService(input.USBPath)

	// List all wallets from storage
	walletObjs, err := svc.ListWallets()
	if err != nil {
		code := MapWalletError(err)
		response := NewErrorResponse(code, GetUserFriendlyMessage(code))
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
