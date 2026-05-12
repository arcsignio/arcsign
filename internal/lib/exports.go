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
	"encoding/json"
	"fmt"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"
	"unsafe"

	"github.com/arcsignio/arcsign/internal/app"
	"github.com/arcsignio/arcsign/internal/rpc"
	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/security/blacklist"
	"github.com/arcsignio/arcsign/internal/security/simulation"
	"github.com/arcsignio/arcsign/internal/security/txguard"
	chainadapterService "github.com/arcsignio/arcsign/internal/services/chainadapter"
	"github.com/arcsignio/arcsign/internal/services/ratelimit"
)

// Global ChainAdapter service instance (initialized on first use)
var chainAdapterSvc *chainadapterService.Service

// Global SessionManager instance (initialized on first use)
var sessionManager *app.SessionManager

// Global WalletSessionManager instance (initialized on first use)
var walletSessionManager *app.WalletSessionManager

// Global app-level rate limiter for UnlockApp password attempts
// 5 attempts per 2 minutes — more generous than wallet-level (3/min)
// because app unlock is a higher-friction operation
var appRateLimiter = ratelimit.NewRateLimiter(5, 2*time.Minute)

// Wallet-level rate limiter for password/signing operations
// 3 attempts per 1 minute — strict limit for: UnlockWallet, SignTransaction, SignMessage, SignTypedData
var walletRateLimiter = ratelimit.NewRateLimiter(3, 1*time.Minute)

// Transaction-level rate limiter for build/broadcast operations
// 10 attempts per 1 minute — moderate limit to prevent spam
var txRateLimiter = ratelimit.NewRateLimiter(10, 1*time.Minute)

// Global TxGuard for transaction security checks (blacklist + simulation)
var txGuardInstance *txguard.Guard

// initTxGuard initializes the global TxGuard instance (lazy init).
func initTxGuard() *txguard.Guard {
	if txGuardInstance != nil {
		return txGuardInstance
	}
	blMgr := blacklist.NewManager(nil) // uses default HTTP fetcher
	sim := simulation.NewSimulator()
	txGuardInstance = txguard.NewGuard(blMgr, sim)
	// Start background blacklist update (best-effort)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		_ = blMgr.Update(ctx)
	}()
	return txGuardInstance
}

// init is called automatically when the library is loaded.
// It sets up security measures to protect sensitive data.
func init() {
	// Disable core dumps to prevent private keys from being written to disk
	// This is a security best practice for applications handling sensitive data
	// Best-effort: may fail on some systems (containers, restricted environments)
	_ = security.DisableCoreDump()
}

// MaxFFIPayloadSize is the maximum allowed size for FFI input parameters.
// Prevents memory exhaustion from oversized JSON payloads.
const MaxFFIPayloadSize = 1 << 20 // 1MB

// safeGoString converts a C string to Go string with size validation.
// Returns an error if the input is nil or exceeds MaxFFIPayloadSize.
func safeGoString(params *C.char) (string, error) {
	if params == nil {
		return "", fmt.Errorf("null input")
	}
	s := C.GoString(params)
	if len(s) > MaxFFIPayloadSize {
		return "", fmt.Errorf("input exceeds size limit")
	}
	return s, nil
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

		// Get provider key from encrypted session storage
		providerKey, err := sm.GetProviderKey(sessionToken)
		if err != nil {
			// Fallback to appPassword if decryption fails (for sessions created before this update)
			if appPassword != "" {
				return appPassword, nil
			}
			return "", fmt.Errorf("failed to get provider key from session")
		}

		return providerKey, nil
	} else if appPassword != "" {
		// Fallback to legacy appPassword for backward compatibility
		return appPassword, nil
	} else {
		return "", fmt.Errorf("authentication required: provide sessionToken or appPassword")
	}
}

// debugLog is a no-op in production. Debug logging to disk/stderr is disabled
// to prevent sensitive data leakage (API keys, paths, session details).
func debugLog(_ string) {}

// T026: zeroString securely zeros sensitive string data from memory
// This prevents sensitive data (passwords, mnemonics) from lingering in memory.
// Uses unsafe.StringData (Go 1.20+) to access the actual backing array
// instead of []byte(*s) which creates a COPY and leaves the original intact.
func zeroString(s *string) {
	if s == nil || *s == "" {
		return
	}
	b := unsafe.Slice(unsafe.StringData(*s), len(*s))
	security.SecureZero(b)
	*s = ""
}

// ValidateUSBPath validates that a USB path is safe and within allowed mount points.
// This prevents path traversal attacks at the FFI boundary.
// Internal Go code (e.g., tests using t.TempDir()) is NOT validated here.
func ValidateUSBPath(usbPath string) error {
	if usbPath == "" {
		return fmt.Errorf("usbPath is required")
	}
	if !filepath.IsAbs(usbPath) {
		return fmt.Errorf("usbPath must be an absolute path")
	}
	cleanPath := filepath.Clean(usbPath)
	if strings.Contains(cleanPath, "..") {
		return fmt.Errorf("invalid path")
	}
	// Windows drive letter (D:\, E:\, etc.)
	if len(cleanPath) >= 3 && cleanPath[1] == ':' &&
		(cleanPath[2] == '/' || cleanPath[2] == '\\') {
		return nil
	}
	// Unix USB mount points
	for _, prefix := range []string{"/Volumes/", "/media/", "/mnt/", "/run/media/"} {
		if strings.HasPrefix(cleanPath, prefix) {
			return nil
		}
	}
	return fmt.Errorf("invalid storage path")
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
func GetVersion() (result *C.char) {
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
			response := NewErrorResponse(ErrLibraryPanic, GetUserFriendlyMessage(ErrLibraryPanic))
			jsonBytes, _ := json.Marshal(response)
			result = C.CString(string(jsonBytes))
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

// Wallet management functions (CreateWallet, ImportWallet, UnlockWallet, GenerateAddresses,
// ExportWallet, ImportBackupWallet, ExportAllWallets, ImportAllWallets, RenameWallet,
// DeleteWallet, ListWallets) have been moved to exports_wallet.go

// Transaction operation functions (BuildTransaction, SignTransaction, BroadcastTransaction,
// QueryTransactionStatus, EstimateFee) have been moved to exports_transaction.go

// Provider configuration functions (SetProviderConfig, GetProviderConfig, ListProviderConfigs,
// DeleteProviderConfig) have been moved to exports_provider.go

// App lifecycle and asset data functions (IsFirstTimeSetup, InitializeApp, UnlockApp,
// GetTokenBalances, loadNodeRealAPIKey, GetNFTs, GetTokenApprovals)
// have been moved to exports_app.go

// Address book, transaction labels, asset transfers, and passphrase validation functions
// have been moved to exports_address.go

// Swap FFI functions (GetSwapQuote, BuildSwapTransaction, GetSwapApproval,
// CheckSwapAllowance, GetNativeTokenAddress, GetSwapTokens)
// have been moved to exports_swap.go

// Membership and session management functions (GetMembershipStatus, AddMembershipBinding,
// RemoveMembershipBinding, SyncMembershipBindingWithToken, RemoveMembershipBindingWithToken,
// CreateSessionToken, ValidateSessionToken, RevokeSessionToken,
// GetDeviceMembershipStatusWithToken, CreateWalletSessionToken, ValidateWalletSessionToken,
// RevokeWalletSessionToken) have been moved to exports_membership.go

// Message signing functions (SignMessage, SignTypedData, signTypedDataV4)
// have been moved to exports_signing.go

// main is required for buildmode=c-shared but should remain empty.
// All functionality is exposed through //export functions.
func main() {
	// Empty main function - library is used via FFI exports only
}

