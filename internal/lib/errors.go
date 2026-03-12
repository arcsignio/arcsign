// Package main provides FFI error code mappings and helper functions
// for converting Go errors to structured JSON responses.
//
// Error codes are designed to match across the FFI boundary:
// - Go exports return these codes in JSON {"error": {"code": "...", "message": "..."}}
// - Rust parses and maps to corresponding error enums
//
// Feature: 005-go-cli-shared
// Created: 2025-10-25
package main

import "strings"

// ErrorCode represents machine-readable error identifiers for FFI responses
type ErrorCode string

const (
	// Input validation errors (400-style)
	ErrInvalidInput     ErrorCode = "INVALID_INPUT"      // Malformed input parameters
	ErrInvalidMnemonic  ErrorCode = "INVALID_MNEMONIC"   // BIP39 validation failed
	ErrInvalidPassword  ErrorCode = "INVALID_PASSWORD"   // Authentication failed
	ErrInvalidBlockchain ErrorCode = "INVALID_BLOCKCHAIN" // Unknown blockchain identifier

	// Resource errors (404/409-style)
	ErrWalletNotFound       ErrorCode = "WALLET_NOT_FOUND"        // Wallet does not exist
	ErrWalletAlreadyExists  ErrorCode = "WALLET_ALREADY_EXISTS"   // Wallet name collision
	ErrWalletLocked         ErrorCode = "WALLET_LOCKED"           // Wallet is locked due to limit exceeded

	// System errors (500-style)
	ErrStorageError     ErrorCode = "STORAGE_ERROR"     // USB I/O failure
	ErrEncryptionError  ErrorCode = "ENCRYPTION_ERROR"  // Cryptographic operation failed
	ErrLibraryPanic     ErrorCode = "LIBRARY_PANIC"     // Unrecoverable Go panic

	// ChainAdapter transaction errors
	ErrTransactionBuildFailed     ErrorCode = "TRANSACTION_BUILD_FAILED"     // Transaction construction failed
	ErrTransactionSignFailed      ErrorCode = "TRANSACTION_SIGN_FAILED"      // Transaction signing failed
	ErrTransactionBroadcastFailed ErrorCode = "TRANSACTION_BROADCAST_FAILED" // Transaction broadcast failed
	ErrTransactionQueryFailed     ErrorCode = "TRANSACTION_QUERY_FAILED"     // Transaction status query failed
	ErrFeeEstimationFailed        ErrorCode = "FEE_ESTIMATION_FAILED"        // Fee estimation failed

	// Swap/DEX aggregator errors
	ErrSwapQuoteFailed    ErrorCode = "SWAP_QUOTE_FAILED"    // Failed to get swap quote from DEX
	ErrSwapBuildFailed    ErrorCode = "SWAP_BUILD_FAILED"    // Failed to build swap transaction
	ErrSwapApprovalFailed ErrorCode = "SWAP_APPROVAL_FAILED" // Failed to get token approval
	ErrSwapAllowanceFailed ErrorCode = "SWAP_ALLOWANCE_FAILED" // Failed to check token allowance
	ErrChainNotSupported  ErrorCode = "CHAIN_NOT_SUPPORTED"  // Chain not supported for swap

	// App config errors
	ErrAppConfigLoad ErrorCode = "APP_CONFIG_LOAD_FAILED" // Failed to load app_config.enc
	ErrAppConfigSave ErrorCode = "APP_CONFIG_SAVE_FAILED" // Failed to save app_config.enc

	// Membership errors
	ErrMembershipInvalid  ErrorCode = "MEMBERSHIP_INVALID"   // Membership validation failed
	ErrMembershipNotFound ErrorCode = "MEMBERSHIP_NOT_FOUND" // Membership binding not found

	// Backup errors
	ErrBackupInvalid   ErrorCode = "BACKUP_INVALID"   // .arcsign file format or version error
	ErrBackupCorrupted ErrorCode = "BACKUP_CORRUPTED" // Decryption succeeded but data is malformed

	// Bundle errors (batch export/import)
	ErrBundleInvalid   ErrorCode = "BUNDLE_INVALID"   // .arcsign-bundle format or version error
	ErrBundleCorrupted ErrorCode = "BUNDLE_CORRUPTED" // Outer decryption succeeded but inner data malformed
)

// FFIError represents a structured error response for FFI functions
// T050: Enhanced with context field for detailed error information
type FFIError struct {
	Code    ErrorCode              `json:"code"`
	Message string                 `json:"message"`
	Context map[string]interface{} `json:"context,omitempty"` // T051: Additional error context
}

// FFIResponse is the standard response envelope for all FFI functions
type FFIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *FFIError   `json:"error,omitempty"`
}

// NewErrorResponse creates a standard error response with the given code and message
func NewErrorResponse(code ErrorCode, message string) FFIResponse {
	return FFIResponse{
		Success: false,
		Error: &FFIError{
			Code:    code,
			Message: message,
		},
	}
}

// T051: NewErrorResponseWithContext creates an error response with additional context
func NewErrorResponseWithContext(code ErrorCode, message string, context map[string]interface{}) FFIResponse {
	return FFIResponse{
		Success: false,
		Error: &FFIError{
			Code:    code,
			Message: message,
			Context: context,
		},
	}
}

// NewSuccessResponse creates a standard success response with the given data
func NewSuccessResponse(data interface{}) FFIResponse {
	return FFIResponse{
		Success: true,
		Data:    data,
	}
}

// T052: GetUserFriendlyMessage returns a user-friendly error message for each error code
func GetUserFriendlyMessage(code ErrorCode) string {
	switch code {
	case ErrInvalidInput:
		return "Invalid input provided. Please check your data and try again."
	case ErrInvalidMnemonic:
		return "Invalid recovery phrase. Please ensure you've entered all words correctly (12 or 24 words)."
	case ErrInvalidPassword:
		return "Incorrect password. Please try again."
	case ErrInvalidBlockchain:
		return "Unsupported blockchain. Please select a supported cryptocurrency."
	case ErrWalletNotFound:
		return "Wallet not found. Please ensure the USB drive is connected and contains your wallet."
	case ErrWalletAlreadyExists:
		return "A wallet with this recovery phrase already exists on the USB drive."
	case ErrWalletLocked:
		return "This wallet is locked because you have exceeded your wallet limit. Please upgrade your membership or remove some wallets to unlock."
	case ErrStorageError:
		return "Storage device not accessible. Please ensure your USB drive is properly connected."
	case ErrEncryptionError:
		return "Encryption operation failed. Your data is secure, but the operation could not complete."
	case ErrLibraryPanic:
		return "An unexpected error occurred. Please restart the application."
	case ErrTransactionBuildFailed:
		return "Failed to build transaction. Please check your inputs and try again."
	case ErrTransactionSignFailed:
		return "Failed to sign transaction. Please try again."
	case ErrTransactionBroadcastFailed:
		return "Failed to broadcast transaction. Please check your network connection."
	case ErrTransactionQueryFailed:
		return "Failed to query transaction status. Please try again later."
	case ErrFeeEstimationFailed:
		return "Failed to estimate network fee. Please try again."
	case ErrSwapQuoteFailed:
		return "Failed to get swap quote. Please try again."
	case ErrSwapBuildFailed:
		return "Failed to build swap transaction. Please try again."
	case ErrSwapApprovalFailed:
		return "Failed to get token approval. Please try again."
	case ErrSwapAllowanceFailed:
		return "Failed to check token allowance. Please try again."
	case ErrChainNotSupported:
		return "This blockchain is not supported for this operation."
	case ErrAppConfigLoad:
		return "Failed to load application configuration. Please ensure your USB drive is connected."
	case ErrAppConfigSave:
		return "Failed to save application configuration. Please ensure your USB drive is connected."
	case ErrMembershipInvalid:
		return "Membership validation failed. Please check your membership status."
	case ErrMembershipNotFound:
		return "Membership binding not found."
	case ErrBackupInvalid:
		return "Invalid backup file. Please select a valid .arcsign file."
	case ErrBackupCorrupted:
		return "The backup file appears to be corrupted."
	case ErrBundleInvalid:
		return "Invalid bundle file. Please select a valid .arcsign-bundle file."
	case ErrBundleCorrupted:
		return "The bundle file appears to be corrupted."
	default:
		return "An error occurred. Please try again."
	}
}

// T049: MapWalletError converts internal wallet service errors to FFI error codes
// Enhanced mapping with comprehensive error pattern recognition
func MapWalletError(err error) ErrorCode {
	if err == nil {
		return ""
	}

	errMsg := strings.ToLower(err.Error())

	// Priority-ordered pattern matching (most specific first)
	switch {
	// Mnemonic validation errors
	case strings.Contains(errMsg, "invalid mnemonic"),
		strings.Contains(errMsg, "bip39"),
		strings.Contains(errMsg, "word count"),
		strings.Contains(errMsg, "invalid phrase"):
		return ErrInvalidMnemonic

	// Password/authentication errors
	case strings.Contains(errMsg, "wrong password"),
		strings.Contains(errMsg, "incorrect password"),
		strings.Contains(errMsg, "authentication failed"),
		strings.Contains(errMsg, "invalid password"),
		strings.Contains(errMsg, "password mismatch"):
		return ErrInvalidPassword

	// Wallet existence errors
	case strings.Contains(errMsg, "wallet not found"),
		strings.Contains(errMsg, "does not exist"),
		strings.Contains(errMsg, "no such wallet"):
		return ErrWalletNotFound

	case strings.Contains(errMsg, "already exists"),
		strings.Contains(errMsg, "duplicate wallet"),
		strings.Contains(errMsg, "wallet exists"):
		return ErrWalletAlreadyExists

	// Storage/USB errors
	case strings.Contains(errMsg, "usb"),
		strings.Contains(errMsg, "storage"),
		strings.Contains(errMsg, "device not found"),
		strings.Contains(errMsg, "no such file"),
		strings.Contains(errMsg, "permission denied"),
		strings.Contains(errMsg, "i/o error"),
		strings.Contains(errMsg, "read error"),
		strings.Contains(errMsg, "write error"):
		return ErrStorageError

	// Encryption/decryption errors
	case strings.Contains(errMsg, "encryption"),
		strings.Contains(errMsg, "decryption"),
		strings.Contains(errMsg, "cipher"),
		strings.Contains(errMsg, "argon2"),
		strings.Contains(errMsg, "gcm"):
		return ErrEncryptionError

	// Blockchain validation errors
	case strings.Contains(errMsg, "invalid blockchain"),
		strings.Contains(errMsg, "unsupported chain"),
		strings.Contains(errMsg, "unknown coin"):
		return ErrInvalidBlockchain

	// Backup errors
	case strings.Contains(errMsg, "invalid backup"),
		strings.Contains(errMsg, "unsupported backup"),
		strings.Contains(errMsg, "backup format"):
		return ErrBackupInvalid

	case strings.Contains(errMsg, "corrupted backup"):
		return ErrBackupCorrupted

	// Bundle errors
	case strings.Contains(errMsg, "invalid bundle"),
		strings.Contains(errMsg, "unsupported bundle"),
		strings.Contains(errMsg, "bundle format"):
		return ErrBundleInvalid

	case strings.Contains(errMsg, "corrupted bundle"):
		return ErrBundleCorrupted

	// Invalid input (catch-all for validation errors)
	case strings.Contains(errMsg, "invalid"),
		strings.Contains(errMsg, "malformed"),
		strings.Contains(errMsg, "parse error"):
		return ErrInvalidInput

	// Default to invalid input for unknown errors
	default:
		return ErrInvalidInput
	}
}

// T049: MapWalletErrorWithContext converts errors and extracts context information
func MapWalletErrorWithContext(err error) (ErrorCode, map[string]interface{}) {
	if err == nil {
		return "", nil
	}

	code := MapWalletError(err)
	context := make(map[string]interface{})

	// T051: Extract additional context based on error type
	errMsg := err.Error()

	switch code {
	case ErrInvalidMnemonic:
		// Try to extract word count if available
		if strings.Contains(errMsg, "expected") {
			context["hint"] = "Recovery phrase must be 12 or 24 words"
		}

	case ErrInvalidPassword:
		context["hint"] = "Passwords are case-sensitive"

	case ErrStorageError:
		context["hint"] = "Check USB connection and try again"
		if strings.Contains(errMsg, "permission") {
			context["cause"] = "insufficient_permissions"
		}

	case ErrWalletAlreadyExists:
		context["hint"] = "Use import to access existing wallet"

	case ErrEncryptionError:
		context["hint"] = "Your wallet data is still secure"
	}

	return code, context
}
