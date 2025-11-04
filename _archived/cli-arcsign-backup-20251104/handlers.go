package main

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/yourusername/arcsign/internal/cli"
	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	"github.com/yourusername/arcsign/internal/services/hdkey"
)

// T020c: handleDeriveAddressNonInteractive derives a single address from mnemonic + path
// This is used by the dashboard for duplicate wallet detection WITHOUT creating wallet files.
//
// Environment variables:
//   - MNEMONIC: BIP39 mnemonic phrase (12 or 24 words)
//   - DERIVATION_PATH: BIP44 derivation path (e.g., m/44'/0'/0'/0/0)
//   - BIP39_PASSPHRASE: Optional BIP39 passphrase (default: empty)
//
// Output:
//   - JSON response with derived address, path, and blockchain info
//   - No wallet files are created (memory-only derivation)
func handleDeriveAddressNonInteractive() {
	startTime := time.Now()
	requestID := generateRequestID()

	// Read environment variables
	mnemonic := os.Getenv("MNEMONIC")
	derivationPath := os.Getenv("DERIVATION_PATH")
	bip39Passphrase := os.Getenv("BIP39_PASSPHRASE")

	// Log inputs (excluding sensitive data)
	cli.WriteLog(fmt.Sprintf("[%s] derive_address: path=%s, has_passphrase=%v", requestID, derivationPath, bip39Passphrase != ""))

	// Validate required parameters
	if mnemonic == "" {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidSchema, "MNEMONIC environment variable is required"),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	if derivationPath == "" {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidSchema, "DERIVATION_PATH environment variable is required"),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	// Validate mnemonic format
	words := strings.Fields(strings.TrimSpace(mnemonic))
	if len(words) != 12 && len(words) != 24 {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidMnemonic, fmt.Sprintf("Invalid mnemonic length: %d words (must be 12 or 24)", len(words))),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	// Validate derivation path format (m/44'/coin_type'/account'/change/address_index)
	validPath := regexp.MustCompile(`^m/44'/\d+'/\d+'/\d+/\d+$`)
	if !validPath.MatchString(derivationPath) {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidSchema, fmt.Sprintf("Invalid derivation path format: %s (expected m/44'/coin_type'/account'/change/index)", derivationPath)),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	// Parse coin type from path to determine blockchain
	coinType, err := parseCoinTypeFromPath(derivationPath)
	if err != nil {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrCryptoError, fmt.Sprintf("Failed to parse coin type: %v", err)),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	// Validate BIP39 mnemonic (checksum verification)
	bip39Service := bip39service.NewBIP39Service()
	if err := bip39Service.ValidateMnemonic(mnemonic); err != nil {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidMnemonic, fmt.Sprintf("Invalid BIP39 mnemonic: %v", err)),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	cli.WriteLog(fmt.Sprintf("[%s] Mnemonic validated, generating seed...", requestID))

	// Generate BIP39 seed from mnemonic + passphrase
	seed, err := bip39Service.MnemonicToSeed(mnemonic, bip39Passphrase)
	if err != nil {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrCryptoError, fmt.Sprintf("Failed to generate seed: %v", err)),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	cli.WriteLog(fmt.Sprintf("[%s] Seed generated, deriving master key...", requestID))

	// Create master key from seed
	hdkeyService := hdkey.NewHDKeyService()
	masterKey, err := hdkeyService.NewMasterKey(seed)
	if err != nil {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrCryptoError, fmt.Sprintf("Failed to create master key: %v", err)),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	cli.WriteLog(fmt.Sprintf("[%s] Master key created, deriving at path %s...", requestID, derivationPath))

	// Derive key at specified path
	derivedKey, err := hdkeyService.DerivePath(masterKey, derivationPath)
	if err != nil {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrCryptoError, fmt.Sprintf("Failed to derive key at path %s: %v", derivationPath, err)),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	cli.WriteLog(fmt.Sprintf("[%s] Key derived, generating address...", requestID))

	// Generate address based on coin type
	addressService := address.NewAddressService()
	var derivedAddress string
	var blockchain string
	var symbol string

	switch coinType {
	case 0: // Bitcoin
		blockchain = "Bitcoin"
		symbol = "BTC"
		derivedAddress, err = addressService.DeriveBitcoinAddress(derivedKey)
	case 60: // Ethereum
		blockchain = "Ethereum"
		symbol = "ETH"
		derivedAddress, err = addressService.DeriveEthereumAddress(derivedKey)
	case 2: // Litecoin
		blockchain = "Litecoin"
		symbol = "LTC"
		derivedAddress, err = addressService.DeriveLitecoinAddress(derivedKey)
	case 3: // Dogecoin
		blockchain = "Dogecoin"
		symbol = "DOGE"
		derivedAddress, err = addressService.DeriveDogecoinAddress(derivedKey)
	// Add more coin types as needed
	default:
		// For unsupported coin types, try Ethereum formatter as fallback
		blockchain = fmt.Sprintf("Unknown (coin_type=%d)", coinType)
		symbol = "UNKNOWN"
		derivedAddress, err = addressService.DeriveEthereumAddress(derivedKey)
		if err != nil {
			response := cli.CliResponse{
				Success:    false,
				Error:      cli.NewCliError(cli.ErrCryptoError, fmt.Sprintf("Unsupported coin type: %d", coinType)),
				RequestID:  requestID,
				CliVersion: Version,
				DurationMs: time.Since(startTime).Milliseconds(),
			}
			cli.WriteJSON(response)
			os.Exit(1)
		}
	}

	if err != nil {
		response := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrCryptoError, fmt.Sprintf("Failed to generate address: %v", err)),
			RequestID:  requestID,
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(response)
		os.Exit(1)
	}

	duration := time.Since(startTime)
	cli.WriteLog(fmt.Sprintf("[%s] Address generated successfully: %s (%s)", requestID, derivedAddress, blockchain))

	// Build success response
	response := cli.CliResponse{
		Success: true,
		Data: map[string]interface{}{
			"address":    derivedAddress,
			"blockchain": blockchain,
			"symbol":     symbol,
			"coin_type":  coinType,
			"path":       derivationPath,
		},
		RequestID:  requestID,
		CliVersion: Version,
		DurationMs: duration.Milliseconds(),
	}

	cli.WriteJSON(response)
}

// parseCoinTypeFromPath extracts the coin_type from a BIP44 path
// Example: m/44'/0'/0'/0/0 -> 0 (Bitcoin)
// Example: m/44'/60'/0'/0/0 -> 60 (Ethereum)
func parseCoinTypeFromPath(path string) (uint32, error) {
	// Match: m/44'/coin_type'/...
	re := regexp.MustCompile(`^m/44'/(\d+)'`)
	matches := re.FindStringSubmatch(path)
	if len(matches) < 2 {
		return 0, fmt.Errorf("invalid path format")
	}

	coinType, err := strconv.ParseUint(matches[1], 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid coin_type: %w", err)
	}

	return uint32(coinType), nil
}
