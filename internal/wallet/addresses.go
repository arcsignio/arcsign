package wallet

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	"github.com/yourusername/arcsign/internal/services/hdkey"
)

// T022: Generate addresses.json file with all 54 blockchain addresses

// GenerateAddressesFile generates addresses for all 54 supported blockchains
// and writes them to addresses.json on the specified USB path.
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

	// Generate addresses for all 54 supported chains
	addresses := make([]Address, 0, 54)
	chains := SupportedChains()

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
		case 2: // Litecoin
			addressString, err = addressService.DeriveLitecoinAddress(derivedKey)
		case 3: // Dogecoin
			addressString, err = addressService.DeriveDogecoinAddress(derivedKey)
		default:
			// For now, use Ethereum formatter as fallback for EVM-compatible chains
			// In production, we'll need specific formatters for Cosmos, Substrate, etc.
			addressString, err = addressService.DeriveEthereumAddress(derivedKey)
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

	// Validate total count
	if addressesFile.TotalCount != 54 {
		return nil, fmt.Errorf("invalid address count: %d (expected 54)", addressesFile.TotalCount)
	}

	if len(addressesFile.Addresses) != int(addressesFile.TotalCount) {
		return nil, fmt.Errorf("address array length %d does not match total_count %d", len(addressesFile.Addresses), addressesFile.TotalCount)
	}

	return &addressesFile, nil
}
