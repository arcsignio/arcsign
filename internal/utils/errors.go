package utils

import "errors"

// Storage errors
var (
	// ErrUSBNotFound is returned when no USB device is detected
	ErrUSBNotFound = errors.New("no USB device found - please insert a USB drive")

	// ErrUSBFull is returned when USB device doesn't have enough space
	ErrUSBFull = errors.New("USB device is full - insufficient space for wallet data")
)

// Wallet errors
var (
	// ErrWalletNotFound is returned when a wallet ID doesn't exist
	ErrWalletNotFound = errors.New("wallet not found")

	// ErrInvalidPassword is returned when password validation fails
	ErrInvalidPassword = errors.New("invalid password - must be 12+ characters with 3+ complexity types")

	// ErrDecryptionFailed is returned when mnemonic decryption fails (wrong password or corrupted data)
	ErrDecryptionFailed = errors.New("decryption failed - wrong password or corrupted wallet data")
)

// BIP39 errors
var (
	// ErrInvalidMnemonic is returned when BIP39 mnemonic validation fails
	ErrInvalidMnemonic = errors.New("invalid mnemonic phrase - checksum verification failed")
)

// Rate limiting errors
var (
	// ErrRateLimitExceeded is returned when too many failed authentication attempts occur
	ErrRateLimitExceeded = errors.New("rate limit exceeded - too many failed attempts, please wait")
)
