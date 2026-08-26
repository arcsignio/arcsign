// Package main - ERC-7730 clear signing FFI exports.
//
// SECURITY: these exports affect DISPLAY only. None of them feed the blacklist,
// RequiresAcknowledge, or any signing gate. A fully compromised descriptor can
// at worst mislabel a transaction on screen — it can never disable a safety
// check. See internal/clearsign for the full rationale.
package main

/*
#include <stdlib.h>
*/
import "C"
import (
	"context"
	"encoding/json"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"

	"github.com/arcsignio/arcsign/internal/clearsign"
)

// arcSignChains are the chains ArcSign supports; updates fetch only these.
var arcSignChains = []int64{1, 56, 137, 42161, 10, 8453, 43114}

// descriptorStorePath is the per-USB encrypted descriptor snapshot.
func descriptorStorePath(usbPath string) string {
	return filepath.Join(usbPath, "descriptors.enc")
}

// descriptorRegistry resolves the active registry: the USB-stored snapshot when
// present and parseable, otherwise the embedded one.
//
// Never returns nil. A broken stored snapshot degrades silently to the built-in
// set rather than disabling clear signing — and if even that fails, an empty
// registry means every lookup misses and the frontend keeps its existing
// calldata decoding.
func descriptorRegistry(usbPath, sessionToken string) *clearsign.Registry {
	if usbPath != "" && sessionToken != "" {
		if store, err := clearsign.NewDescriptorStore(descriptorStorePath(usbPath), sessionToken); err == nil {
			defer store.Close()
			if raw, ok := store.Load(); ok {
				if r, err := clearsign.LoadSnapshot(raw); err == nil && r.Count() > 0 {
					return r
				}
			}
		}
	}
	r, err := clearsign.LoadEmbeddedSnapshot()
	if err != nil {
		return clearsign.NewRegistry("", nil)
	}
	return r
}

//export ResolveDescriptor
func ResolveDescriptor(params *C.char) (result *C.char) {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			result = C.CString(`{"success":false,"error":"INTERNAL_ERROR"}`)
		}
	}()

	var input struct {
		ChainID      int64          `json:"chainId"`
		To           string         `json:"to"`
		Selector     string         `json:"selector"`
		Decoded      map[string]any `json:"decoded"`
		USBPath      string         `json:"usbPath"`
		SessionToken string         `json:"sessionToken"`
		Tokens       []struct {
			Address  string `json:"address"`
			Symbol   string `json:"symbol"`
			Decimals int    `json:"decimals"`
		} `json:"tokens"`
	}
	if err := json.Unmarshal([]byte(C.GoString(params)), &input); err != nil {
		return C.CString(`{"success":false,"error":"INVALID_INPUT"}`)
	}

	known := make(map[string]clearsign.TokenInfo, len(input.Tokens))
	for _, t := range input.Tokens {
		known[strings.ToLower(t.Address)] = clearsign.TokenInfo{
			Symbol:   t.Symbol,
			Decimals: t.Decimals,
		}
	}
	lookup := func(addr string) (clearsign.TokenInfo, bool) {
		info, ok := known[strings.ToLower(addr)]
		return info, ok
	}

	reg := descriptorRegistry(input.USBPath, input.SessionToken)
	intent, ok := reg.Resolve(input.ChainID, input.To, input.Selector, input.Decoded, lookup)
	if !ok {
		// Not an error: no descriptor simply means the frontend keeps its
		// existing calldata decoding.
		out, _ := json.Marshal(map[string]any{"success": true, "data": nil})
		return C.CString(string(out))
	}
	out, _ := json.Marshal(map[string]any{"success": true, "data": intent})
	return C.CString(string(out))
}

//export UpdateDescriptors
func UpdateDescriptors(params *C.char) (result *C.char) {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			result = C.CString(`{"success":false,"error":"INTERNAL_ERROR"}`)
		}
	}()

	var input struct {
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
	}
	if err := json.Unmarshal([]byte(C.GoString(params)), &input); err != nil {
		return C.CString(`{"success":false,"error":"INVALID_INPUT"}`)
	}
	if err := ValidateUSBPath(input.USBPath); err != nil {
		return C.CString(`{"success":false,"error":"INVALID_INPUT"}`)
	}
	if input.SessionToken == "" {
		return C.CString(`{"success":false,"error":"INVALID_INPUT"}`)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	snap, err := clearsign.NewFetcher().FetchLatest(ctx, arcSignChains)
	if err != nil {
		out, _ := json.Marshal(map[string]any{"success": false, "error": "NETWORK_ERROR"})
		return C.CString(string(out))
	}
	raw, err := json.Marshal(snap)
	if err != nil {
		return C.CString(`{"success":false,"error":"INTERNAL_ERROR"}`)
	}

	store, err := clearsign.NewDescriptorStore(descriptorStorePath(input.USBPath), input.SessionToken)
	if err != nil {
		return C.CString(`{"success":false,"error":"STORAGE_ERROR"}`)
	}
	defer store.Close()
	if err := store.Save(raw); err != nil {
		return C.CString(`{"success":false,"error":"STORAGE_ERROR"}`)
	}

	out, _ := json.Marshal(map[string]any{
		"success": true,
		"data": map[string]any{
			"version": snap.Version,
			"count":   len(snap.Descriptors),
		},
	})
	return C.CString(string(out))
}

//export GetDescriptorStatus
func GetDescriptorStatus(params *C.char) (result *C.char) {
	defer func() {
		if r := recover(); r != nil {
			debug.PrintStack()
			result = C.CString(`{"success":false,"error":"INTERNAL_ERROR"}`)
		}
	}()

	var input struct {
		USBPath      string `json:"usbPath"`
		SessionToken string `json:"sessionToken"`
	}
	if err := json.Unmarshal([]byte(C.GoString(params)), &input); err != nil {
		return C.CString(`{"success":false,"error":"INVALID_INPUT"}`)
	}

	reg := descriptorRegistry(input.USBPath, input.SessionToken)
	out, _ := json.Marshal(map[string]any{
		"success": true,
		"data": map[string]any{
			"version": reg.Version(),
			"count":   reg.Count(),
		},
	})
	return C.CString(string(out))
}
