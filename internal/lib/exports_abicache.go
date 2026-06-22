// Package main provides ABI-cache FFI exports for the arcSign wallet library.
// GetCachedAbi / SetCachedAbi / ClearAbiCache let Rust/frontend read, write, and
// clear the encrypted on-USB ABI cache (AbiCacheStore, abi_cache.enc).
// Reuses the same session validation + app-password loading as the other exports.
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"

	"github.com/arcsignio/arcsign/internal/provider"
)

// GetCachedAbi looks up a verified ABI for (chainId, address) in the on-USB cache.
// Read path of the signing flow — must NEVER block. A store-open error is treated
// as a cache miss ({"entry": null}), not an error response.
//
//export GetCachedAbi
func GetCachedAbi(params *C.char) (result *C.char) {
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
		ChainID      int    `json:"chainId"`
		Address      string `json:"address"`
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
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Graceful: a store-open error is a cache miss, never a block on signing.
	store, err := provider.NewAbiCacheStore(input.USBPath+"/abi_cache.enc", appPassword)
	if err != nil {
		response := NewSuccessResponse(map[string]interface{}{"entry": nil})
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	entry := store.Get(input.ChainID, input.Address)
	response := NewSuccessResponse(map[string]interface{}{"entry": entry})
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// SetCachedAbi persists a verified ABI for (chainId, address) into the on-USB cache.
//
//export SetCachedAbi
func SetCachedAbi(params *C.char) (result *C.char) {
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
		ChainID      int             `json:"chainId"`
		Address      string          `json:"address"`
		ABI          json.RawMessage `json:"abi"`
		MatchLevel   string          `json:"matchLevel"`
		Source       string          `json:"source"`
		FetchedAt    int64           `json:"fetchedAt"`
		USBPath      string          `json:"usbPath"`
		SessionToken string          `json:"sessionToken"`
		AppPassword  string          `json:"appPassword"`
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

	store, err := provider.NewAbiCacheStore(input.USBPath+"/abi_cache.enc", appPassword)
	if err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	e := &provider.AbiCacheEntry{
		ABI:        input.ABI,
		MatchLevel: input.MatchLevel,
		Source:     input.Source,
		Address:    input.Address,
		ChainID:    input.ChainID,
		FetchedAt:  input.FetchedAt,
	}
	if err := store.Set(e); err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	response := NewSuccessResponse(map[string]interface{}{"ok": true})
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}

// ClearAbiCache wipes the entire on-USB ABI cache. A store-open error means there
// is nothing to clear, so it reports success.
//
//export ClearAbiCache
func ClearAbiCache(params *C.char) (result *C.char) {
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
		response := NewErrorResponse(ErrInvalidInput, GetUserFriendlyMessage(ErrInvalidInput))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer zeroString(&appPassword)

	// Graceful: store-open error means nothing to clear.
	store, err := provider.NewAbiCacheStore(input.USBPath+"/abi_cache.enc", appPassword)
	if err != nil {
		response := NewSuccessResponse(map[string]interface{}{"ok": true})
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}
	defer store.Close()

	if err := store.Clear(); err != nil {
		response := NewErrorResponse(ErrStorageError, GetUserFriendlyMessage(ErrStorageError))
		jsonBytes, _ := json.Marshal(response)
		return C.CString(string(jsonBytes))
	}

	response := NewSuccessResponse(map[string]interface{}{"ok": true})
	jsonBytes, _ := json.Marshal(response)
	return C.CString(string(jsonBytes))
}
