package wallet

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	"github.com/yourusername/arcsign/internal/services/hdkey"
)

// T022: Generate addresses.json file for supported blockchains

// GenerateAddressesFile generates addresses for all supported blockchains
// and writes them to addresses.json on the specified USB path.
// Currently generates 22 addresses (1 BTC + 21 EVM chains).
//
// Parameters:
//   - usbPath: Root path to USB device (e.g., "/Volumes/NO NAME")
//   - walletID: Unique wallet identifier (UUID)
//   - mnemonic: BIP39 mnemonic phrase (12 or 24 words)
//   - passphrase: Optional BIP39 passphrase (empty string if not used)
//
// Returns:
//   - Absolute path to generated addresses.json file
//   - Error if generation or file write fails
func GenerateAddressesFile(usbPath, walletID, mnemonic, passphrase string) (string, error) {
	// Initialize services
	bip39Service := bip39service.NewBIP39Service()
	hdkeyService := hdkey.NewHDKeyService()
	addressService := address.NewAddressService()

	// Normalize mnemonic: trim whitespace to prevent seed derivation issues
	mnemonic = strings.TrimSpace(mnemonic)

	// Generate BIP39 seed from mnemonic + passphrase
	seed, err := bip39Service.MnemonicToSeed(mnemonic, passphrase)
	if err != nil {
		return "", fmt.Errorf("failed to generate seed: %w", err)
	}

	// Create master key from seed
	masterKey, err := hdkeyService.NewMasterKey(seed)
	if err != nil {
		return "", fmt.Errorf("failed to create master key: %w", err)
	}

	// Generate addresses for all supported chains
	chains := SupportedChains()
	addresses := make([]Address, 0, len(chains))

	for _, chain := range chains {
		// Derive key at BIP44 path for this chain
		derivationPath := FormatDerivationPath(chain.CoinType, 0, 0, 0)
		
		derivedKey, err := hdkeyService.DerivePath(masterKey, derivationPath)
		if err != nil {
			return "", fmt.Errorf("failed to derive key for %s at path %s: %w", chain.Symbol, derivationPath, err)
		}

		// Generate address based on coin type
		var addressString string
		switch chain.CoinType {
		case 0: // Bitcoin
			addressString, err = addressService.DeriveBitcoinAddress(derivedKey)
		case 60: // Ethereum and EVM-compatible chains
			addressString, err = addressService.DeriveEthereumAddress(derivedKey)
		default:
			return "", fmt.Errorf("unsupported coin type: %d for chain %s", chain.CoinType, chain.Symbol)
		}

		if err != nil {
			return "", fmt.Errorf("failed to generate address for %s: %w", chain.Symbol, err)
		}

		// Create Address struct
		addr := NewAddress(
			chain.Name,
			chain.Symbol,
			addressString,
			chain.CoinType,
			chain.Category,
		)

		addresses = append(addresses, addr)
	}

	// Create AddressesFile with computed checksum
	addressesFile := NewAddressesFile(walletID, addresses)

	// Create directory structure
	walletDir := filepath.Join(usbPath, "wallets", walletID)
	if err := os.MkdirAll(walletDir, 0700); err != nil {
		return "", fmt.Errorf("failed to create wallet directory: %w", err)
	}

	// Write addresses.json file
	filePath := filepath.Join(walletDir, "addresses.json")
	data, err := json.MarshalIndent(addressesFile, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to serialize addresses file: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0600); err != nil {
		return "", fmt.Errorf("failed to write addresses file: %w", err)
	}

	return filePath, nil
}

// ReadAddressesFile reads and validates an addresses.json file from USB
// Returns the parsed AddressesFile or error if file is invalid/corrupted
func ReadAddressesFile(filePath string) (*AddressesFile, error) {
	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read addresses file: %w", err)
	}

	// Parse JSON
	var addressesFile AddressesFile
	if err := json.Unmarshal(data, &addressesFile); err != nil {
		return nil, fmt.Errorf("failed to parse addresses file: %w", err)
	}

	// Validate schema version
	if addressesFile.SchemaVersion != "1.0" {
		return nil, fmt.Errorf("unsupported schema version: %s (expected 1.0)", addressesFile.SchemaVersion)
	}

	// Validate checksum
	if err := ValidateAddressesFileChecksum(&addressesFile); err != nil {
		return nil, fmt.Errorf("checksum validation failed: %w", err)
	}

	// Validate total count matches array length
	if len(addressesFile.Addresses) != int(addressesFile.TotalCount) {
		return nil, fmt.Errorf("address array length %d does not match total_count %d", len(addressesFile.Addresses), addressesFile.TotalCount)
	}

	// Validate minimum address count (at least 1)
	if addressesFile.TotalCount < 1 {
		return nil, fmt.Errorf("invalid address count: %d (expected at least 1)", addressesFile.TotalCount)
	}

	return &addressesFile, nil
}
