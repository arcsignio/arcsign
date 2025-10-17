package lib

import (
	"errors"
	"fmt"
	"time"
)

// T101: Comprehensive error messages with suggestions for all error cases

// Address generation errors
var (
	ErrCoinNotSupported = errors.New("cryptocurrency not supported")
	ErrFormatterFailed  = errors.New("address formatter failed")
	ErrInvalidKey       = errors.New("invalid extended key")
	ErrInvalidPath      = errors.New("invalid derivation path")
)

// AddressGenerationError provides detailed error information with suggestions
type AddressGenerationError struct {
	CoinSymbol string
	CoinName   string
	Reason     string
	Suggestion string
}

func (e *AddressGenerationError) Error() string {
	return fmt.Sprintf("failed to generate %s (%s) address: %s. %s",
		e.CoinName, e.CoinSymbol, e.Reason, e.Suggestion)
}

// NewAddressGenerationError creates a detailed address generation error with suggestions
func NewAddressGenerationError(symbol, name, reason string) *AddressGenerationError {
	suggestion := getSuggestionForError(symbol, reason)
	return &AddressGenerationError{
		CoinSymbol: symbol,
		CoinName:   name,
		Reason:     reason,
		Suggestion: suggestion,
	}
}

// getSuggestionForError provides user-friendly suggestions based on error type
func getSuggestionForError(symbol, reason string) string {
	switch {
	case reason == "unsupported formatter":
		return fmt.Sprintf("The %s formatter is not yet implemented. You can derive %s addresses manually using the 'arcsign derive' command with the appropriate coin type.", symbol, symbol)

	case reason == "key derivation failed":
		return "Please check that your mnemonic and passphrase are correct. Try restoring your wallet if the problem persists."

	case reason == "invalid public key":
		return "The derived key appears to be invalid. This may indicate a problem with the seed or derivation path."

	default:
		return "Please check the audit log for more details. You can still derive this address manually."
	}
}

// WalletError provides detailed wallet-related errors
type WalletError struct {
	Operation  string
	WalletID   string
	Reason     string
	Suggestion string
}

func (e *WalletError) Error() string {
	return fmt.Sprintf("%s failed for wallet %s: %s. %s",
		e.Operation, e.WalletID, e.Reason, e.Suggestion)
}

// NewWalletError creates a detailed wallet error with suggestions
func NewWalletError(operation, walletID, reason string) *WalletError {
	return &WalletError{
		Operation:  operation,
		WalletID:   walletID,
		Reason:     reason,
		Suggestion: getWalletErrorSuggestion(operation, reason),
	}
}

func getWalletErrorSuggestion(operation, reason string) string {
	switch operation {
	case "ADDRESS_GENERATION":
		return "Wallet was created successfully, but some addresses could not be generated. Check the audit log for details. You can derive addresses manually using 'arcsign derive'."

	case "WALLET_LOAD":
		return "Ensure you're using the correct wallet ID and USB drive. Use 'arcsign list' to see available wallets."

	case "WALLET_CREATE":
		return "Ensure your USB drive has enough space (at least 10 MB) and is writable."

	default:
		return "Check the audit log for more details."
	}
}

// FormatErrorWithContext formats an error with additional context
func FormatErrorWithContext(err error, context string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", context, err)
}

// IsRecoverableError determines if an error is recoverable
func IsRecoverableError(err error) bool {
	if err == nil {
		return true
	}

	// Check for specific recoverable errors
	switch {
	case errors.Is(err, ErrCoinNotSupported):
		return true // Can continue with other coins
	case errors.Is(err, ErrFormatterFailed):
		return true // Can continue with other coins
	default:
		return false
	}
}

// ChainMetric tracks generation metrics for a single blockchain (v0.3.0+)
type ChainMetric struct {
	Symbol       string        `json:"symbol"`       // Chain symbol (e.g., "ARB", "KSM")
	Success      bool          `json:"success"`      // Whether address generation succeeded
	Duration     time.Duration `json:"duration"`     // Time taken to generate address
	Attempts     int           `json:"attempts"`     // Number of attempts (1 = first try, 2 = retry)
	ErrorMessage string        `json:"errorMessage"` // Error message if failed
}

// GenerationMetrics tracks overall multi-chain address generation metrics (v0.3.0+)
type GenerationMetrics struct {
	TotalChains     int                    `json:"totalChains"`     // Total number of chains attempted
	SuccessCount    int                    `json:"successCount"`    // Number of successful generations
	FailureCount    int                    `json:"failureCount"`    // Number of failed generations
	RetryCount      int                    `json:"retryCount"`      // Total number of retries across all chains
	TotalDuration   time.Duration          `json:"totalDuration"`   // Total time for all generations
	PerChainMetrics map[string]ChainMetric `json:"perChainMetrics"` // Detailed metrics per chain (keyed by symbol)
}

// SuccessRate calculates the percentage of successful address generations
func (g *GenerationMetrics) SuccessRate() float64 {
	if g.TotalChains == 0 {
		return 0.0
	}
	return float64(g.SuccessCount) / float64(g.TotalChains) * 100.0
}
