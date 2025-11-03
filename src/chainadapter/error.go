// Package chainadapter - Error classification and handling
package chainadapter

import (
	"fmt"
	"time"
)

// ChainError represents a classified error from ChainAdapter operations.
// All errors returned by ChainAdapter methods MUST be wrapped in ChainError.
type ChainError struct {
	Code           string               // Error code (e.g., "ERR_INSUFFICIENT_FUNDS", "ERR_RPC_TIMEOUT")
	Message        string               // Human-readable message
	Classification ErrorClassification // Retry classification
	RetryAfter     *time.Duration      // For retryable errors, suggested retry delay
	Cause          error                // Original error (wrapped)
}

func (e *ChainError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *ChainError) Unwrap() error {
	return e.Cause
}

// ErrorClassification categorizes errors for retry logic
type ErrorClassification int

const (
	// Retryable errors are temporary and safe to retry (e.g., network timeout, RPC unavailable)
	Retryable ErrorClassification = iota

	// NonRetryable errors are permanent and will not succeed on retry (e.g., invalid format, insufficient funds)
	NonRetryable

	// UserIntervention errors require user action (e.g., fee too low, hardware wallet timeout)
	UserIntervention
)

func (ec ErrorClassification) String() string {
	switch ec {
	case Retryable:
		return "Retryable"
	case NonRetryable:
		return "NonRetryable"
	case UserIntervention:
		return "UserIntervention"
	default:
		return "Unknown"
	}
}

// Common error codes
const (
	// Retryable error codes
	ErrCodeRPCTimeout        = "ERR_RPC_TIMEOUT"
	ErrCodeRPCUnavailable    = "ERR_RPC_UNAVAILABLE"
	ErrCodeNetworkCongestion = "ERR_NETWORK_CONGESTION"
	ErrCodeNonceTooLow       = "ERR_NONCE_TOO_LOW"

	// NonRetryable error codes
	ErrCodeInvalidAddress     = "ERR_INVALID_ADDRESS"
	ErrCodeInvalidAmount      = "ERR_INVALID_AMOUNT"
	ErrCodeUnsupportedAsset   = "ERR_UNSUPPORTED_ASSET"
	ErrCodeInsufficientFunds  = "ERR_INSUFFICIENT_FUNDS"
	ErrCodeInvalidTransaction = "ERR_INVALID_TRANSACTION"
	ErrCodeInvalidSignature   = "ERR_INVALID_SIGNATURE"
	ErrCodeAddressMismatch    = "ERR_ADDRESS_MISMATCH"
	ErrCodeInvalidPath        = "ERR_INVALID_DERIVATION_PATH"
	ErrCodeTxNotFound         = "ERR_TX_NOT_FOUND"

	// UserIntervention error codes
	ErrCodeFeeTooLow           = "ERR_FEE_TOO_LOW"
	ErrCodeHardwareTimeout     = "ERR_HARDWARE_TIMEOUT"
	ErrCodeUserRejected        = "ERR_USER_REJECTED"
	ErrCodeRBFRequired         = "ERR_RBF_REQUIRED"
	ErrCodeMultiSigPending     = "ERR_MULTISIG_PENDING"
)

// NewChainError creates a new ChainError with the given parameters
func NewChainError(code, message string, classification ErrorClassification, cause error) *ChainError {
	return &ChainError{
		Code:           code,
		Message:        message,
		Classification: classification,
		Cause:          cause,
	}
}

// NewRetryableError creates a retryable error with optional retry delay
func NewRetryableError(code, message string, retryAfter *time.Duration, cause error) *ChainError {
	return &ChainError{
		Code:           code,
		Message:        message,
		Classification: Retryable,
		RetryAfter:     retryAfter,
		Cause:          cause,
	}
}

// NewNonRetryableError creates a non-retryable error
func NewNonRetryableError(code, message string, cause error) *ChainError {
	return &ChainError{
		Code:           code,
		Message:        message,
		Classification: NonRetryable,
		Cause:          cause,
	}
}

// NewUserInterventionError creates a user intervention error
func NewUserInterventionError(code, message string, cause error) *ChainError {
	return &ChainError{
		Code:           code,
		Message:        message,
		Classification: UserIntervention,
		Cause:          cause,
	}
}

// IsRetryable checks if an error is retryable
func IsRetryable(err error) bool {
	if chainErr, ok := err.(*ChainError); ok {
		return chainErr.Classification == Retryable
	}
	return false
}

// IsNonRetryable checks if an error is non-retryable
func IsNonRetryable(err error) bool {
	if chainErr, ok := err.(*ChainError); ok {
		return chainErr.Classification == NonRetryable
	}
	return false
}

// IsUserIntervention checks if an error requires user intervention
func IsUserIntervention(err error) bool {
	if chainErr, ok := err.(*ChainError); ok {
		return chainErr.Classification == UserIntervention
	}
	return false
}
