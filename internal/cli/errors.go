package cli

// Error code constants as defined in FR-042 of the specification.
//
// These codes MUST match the enumerated set in the spec:
// INVALID_PASSWORD, USB_NOT_FOUND, WALLET_EXISTS, INVALID_MNEMONIC,
// CRYPTO_ERROR, IO_ERROR, TIMEOUT, INVALID_SCHEMA, INVALID_CHECKSUM
//
// All CLI errors in dashboard mode must use one of these codes
// to enable consistent error handling in the Tauri backend.

const (
	// ErrInvalidPassword indicates the provided password is incorrect
	// or does not meet requirements (min 12 chars, complexity rules)
	ErrInvalidPassword = "INVALID_PASSWORD"

	// ErrUSBNotFound indicates no USB drive was detected at the expected path
	// or the specified USB_PATH environment variable is invalid
	ErrUSBNotFound = "USB_NOT_FOUND"

	// ErrWalletExists indicates a wallet with the same ID or name
	// already exists on the USB drive (duplicate wallet)
	ErrWalletExists = "WALLET_EXISTS"

	// ErrInvalidMnemonic indicates the provided BIP39 mnemonic phrase
	// is invalid (wrong word count, invalid words, or checksum failure)
	ErrInvalidMnemonic = "INVALID_MNEMONIC"

	// ErrCryptoError indicates a cryptographic operation failed
	// (encryption, decryption, key derivation, signature generation)
	ErrCryptoError = "CRYPTO_ERROR"

	// ErrIOError indicates a file system operation failed
	// (read, write, delete, permission denied)
	ErrIOError = "IO_ERROR"

	// ErrTimeout indicates a CLI operation exceeded the 30-second timeout
	// imposed by the Tauri CLI wrapper
	ErrTimeout = "TIMEOUT"

	// ErrInvalidSchema indicates a JSON file has an incompatible schema_version
	// (e.g., addresses.json with schema_version != "1.0")
	ErrInvalidSchema = "INVALID_SCHEMA"

	// ErrInvalidChecksum indicates a SHA-256 checksum verification failed
	// (addresses.json checksum mismatch suggests data corruption)
	ErrInvalidChecksum = "INVALID_CHECKSUM"
)

// NewCliError creates a new CliError with the specified code and message.
//
// This is a convenience function for constructing CliError instances
// throughout the codebase.
//
// Parameters:
//   - code: Error code constant from this package (e.g., ErrInvalidPassword)
//   - message: Human-readable error message for display
//
// Returns:
//   - *CliError: Error instance ready for inclusion in CliResponse
func NewCliError(code, message string) *CliError {
	return &CliError{
		Code:    code,
		Message: message,
	}
}
