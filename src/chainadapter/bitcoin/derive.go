// Package bitcoin - Address derivation utilities
package bitcoin

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
)

// validateBIP44Path validates that a derivation path follows BIP44 standard.
//
// BIP44 format: m/44'/cointype'/account'/change/index
// - Bitcoin mainnet: cointype = 0
// - Bitcoin testnet: cointype = 1
//
// Parameters:
// - path: Derivation path (e.g., "m/44'/0'/0'/0/0")
// - expectedCoinType: Expected coin type (0 for Bitcoin mainnet)
//
// Returns:
// - Error if path is invalid or coin type doesn't match
func validateBIP44Path(path string, expectedCoinType int) error {
	// BIP44 pattern: m/44'/cointype'/account'/change/index
	// All components except 'm' are integers, hardened components have '
	pattern := `^m/44'/(\d+)'/(\d+)'/([01])/(\d+)$`
	re := regexp.MustCompile(pattern)
	matches := re.FindStringSubmatch(path)

	if matches == nil {
		return fmt.Errorf("path must follow BIP44 format: m/44'/cointype'/account'/change/index")
	}

	// Extract and validate coin type
	coinType, err := strconv.Atoi(matches[1])
	if err != nil {
		return fmt.Errorf("invalid coin type: %s", matches[1])
	}

	if coinType != expectedCoinType {
		return fmt.Errorf("coin type mismatch: expected %d, got %d", expectedCoinType, coinType)
	}

	// Validate account (can be any positive integer)
	account, err := strconv.Atoi(matches[2])
	if err != nil || account < 0 {
		return fmt.Errorf("invalid account: %s", matches[2])
	}

	// Change is already validated by regex (must be 0 or 1)

	// Validate index (can be any positive integer)
	index, err := strconv.Atoi(matches[4])
	if err != nil || index < 0 {
		return fmt.Errorf("invalid index: %s", matches[4])
	}

	return nil
}

// pubKeyToP2WPKHAddress converts a compressed public key to a P2WPKH (Native SegWit) address.
//
// P2WPKH addresses start with:
// - bc1q... for mainnet
// - tb1q... for testnet
// - bcrt1q... for regtest
//
// Parameters:
// - pubKeyBytes: Compressed public key (33 bytes, starting with 0x02 or 0x03)
// - network: Network identifier ("mainnet", "testnet3", "regtest")
//
// Returns:
// - P2WPKH address string
// - Error if public key is invalid or encoding fails
func pubKeyToP2WPKHAddress(pubKeyBytes []byte, network string) (string, error) {
	// Step 1: Validate public key format
	if len(pubKeyBytes) != 33 {
		return "", fmt.Errorf("invalid public key length: expected 33 bytes, got %d", len(pubKeyBytes))
	}

	if pubKeyBytes[0] != 0x02 && pubKeyBytes[0] != 0x03 {
		return "", fmt.Errorf("invalid public key format: must start with 0x02 or 0x03 (compressed)")
	}

	// Step 2: Parse public key
	pubKey, err := btcec.ParsePubKey(pubKeyBytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse public key: %w", err)
	}

	// Step 3: Select network parameters
	var chainParams *chaincfg.Params
	switch network {
	case "mainnet":
		chainParams = &chaincfg.MainNetParams
	case "testnet3":
		chainParams = &chaincfg.TestNet3Params
	case "regtest":
		chainParams = &chaincfg.RegressionNetParams
	default:
		return "", fmt.Errorf("unsupported network: %s", network)
	}

	// Step 4: Create witness pubkey hash address (P2WPKH)
	// P2WPKH is a Pay-to-Witness-PubKey-Hash address
	witnessProg := btcutil.Hash160(pubKey.SerializeCompressed())
	address, err := btcutil.NewAddressWitnessPubKeyHash(witnessProg, chainParams)
	if err != nil {
		return "", fmt.Errorf("failed to create P2WPKH address: %w", err)
	}

	return address.EncodeAddress(), nil
}

// parseBIP44Path parses a BIP44 derivation path into its components.
//
// Returns: (coinType, account, change, index, error)
func parseBIP44Path(path string) (int, int, int, int, error) {
	// Remove "m/" prefix
	path = strings.TrimPrefix(path, "m/")

	// Split by '/'
	parts := strings.Split(path, "/")
	if len(parts) != 5 {
		return 0, 0, 0, 0, fmt.Errorf("invalid path length")
	}

	// Verify first component is "44'"
	if parts[0] != "44'" {
		return 0, 0, 0, 0, fmt.Errorf("path must start with m/44'")
	}

	// Parse coin type (remove ')
	coinTypeStr := strings.TrimSuffix(parts[1], "'")
	coinType, err := strconv.Atoi(coinTypeStr)
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("invalid coin type: %s", parts[1])
	}

	// Parse account (remove ')
	accountStr := strings.TrimSuffix(parts[2], "'")
	account, err := strconv.Atoi(accountStr)
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("invalid account: %s", parts[2])
	}

	// Parse change (no hardening)
	change, err := strconv.Atoi(parts[3])
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("invalid change: %s", parts[3])
	}

	// Parse index (no hardening)
	index, err := strconv.Atoi(parts[4])
	if err != nil {
		return 0, 0, 0, 0, fmt.Errorf("invalid index: %s", parts[4])
	}

	return coinType, account, change, index, nil
}
