// Package ethereum - Address derivation utilities
package ethereum

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// validateBIP44Path validates that a derivation path follows BIP44 standard.
//
// BIP44 format: m/44'/cointype'/account'/change/index
// - Ethereum: cointype = 60
//
// Parameters:
// - path: Derivation path (e.g., "m/44'/60'/0'/0/0")
// - expectedCoinType: Expected coin type (60 for Ethereum)
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

// pubKeyToChecksummedAddress converts a public key to an EIP-55 checksummed Ethereum address.
//
// Ethereum addresses are derived by:
// 1. Taking Keccak256 hash of the uncompressed public key (excluding 0x04 prefix)
// 2. Taking the last 20 bytes of the hash
// 3. Applying EIP-55 checksum encoding (mixed case)
//
// Parameters:
// - pubKeyBytes: Public key bytes (33 bytes compressed or 65 bytes uncompressed)
//
// Returns:
// - Checksummed Ethereum address (0x... with mixed case)
// - Error if public key is invalid
func pubKeyToChecksummedAddress(pubKeyBytes []byte) (string, error) {
	// Step 1: Parse public key
	var pubKey *btcec.PublicKey
	var err error

	switch len(pubKeyBytes) {
	case 33:
		// Compressed public key (starts with 0x02 or 0x03)
		pubKey, err = btcec.ParsePubKey(pubKeyBytes)
		if err != nil {
			return "", fmt.Errorf("failed to parse compressed public key: %w", err)
		}
	case 65:
		// Uncompressed public key (starts with 0x04)
		if pubKeyBytes[0] != 0x04 {
			return "", fmt.Errorf("invalid uncompressed public key: must start with 0x04")
		}
		pubKey, err = btcec.ParsePubKey(pubKeyBytes)
		if err != nil {
			return "", fmt.Errorf("failed to parse uncompressed public key: %w", err)
		}
	default:
		return "", fmt.Errorf("invalid public key length: expected 33 or 65 bytes, got %d", len(pubKeyBytes))
	}

	// Step 2: Get uncompressed public key (65 bytes: 0x04 + X + Y)
	uncompressed := pubKey.SerializeUncompressed()
	if len(uncompressed) != 65 {
		return "", fmt.Errorf("invalid uncompressed public key length: %d", len(uncompressed))
	}

	// Step 3: Take Keccak256 hash of the public key (excluding the 0x04 prefix)
	// Keccak256(X || Y) where X and Y are 32 bytes each
	hash := crypto.Keccak256(uncompressed[1:])

	// Step 4: Take last 20 bytes as the Ethereum address
	address := common.BytesToAddress(hash[12:])

	// Step 5: Apply EIP-55 checksum encoding
	checksummed := address.Hex() // Returns checksummed address with 0x prefix

	return checksummed, nil
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
