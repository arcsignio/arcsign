package address

import (
	"crypto/sha256"
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"golang.org/x/crypto/ripemd160"
)

// Ripple base58 alphabet (different from Bitcoin's)
const rippleAlphabet = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz"

// T036: DeriveRippleAddress derives a Ripple (XRP) address
// XRP uses custom Base58Check with different alphabet
// Addresses start with 'r' and are base58-encoded (Ripple alphabet)
func (s *AddressService) DeriveRippleAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Use compressed public key
	pubKeyBytes := pubKey.SerializeCompressed()

	// Step 1: SHA256 hash
	sha := sha256.Sum256(pubKeyBytes)

	// Step 2: RIPEMD160 hash
	ripemd := ripemd160.New()
	ripemd.Write(sha[:])
	hash160 := ripemd.Sum(nil)

	// Step 3: Add version byte (0x00 for mainnet, produces 'r' prefix)
	versioned := append([]byte{0x00}, hash160...)

	// Step 4: Double SHA256 for checksum
	checksum := doubleSHA256Ripple(versioned)

	// Step 5: Append first 4 bytes of checksum
	addressBytes := append(versioned, checksum[:4]...)

	// Step 6: Base58 encode with Ripple alphabet
	address := encodeBase58Ripple(addressBytes)

	return address, nil
}

// doubleSHA256Ripple performs double SHA256 hashing
func doubleSHA256Ripple(data []byte) []byte {
	first := sha256.Sum256(data)
	second := sha256.Sum256(first[:])
	return second[:]
}

// encodeBase58Ripple encodes data using Ripple's base58 alphabet
func encodeBase58Ripple(data []byte) string {
	// Convert to big integer
	var num uint64 = 0
	for _, b := range data {
		num = num*256 + uint64(b)
	}

	// If data is all zeros, return 'r' (first char of Ripple alphabet)
	if num == 0 {
		return string(rippleAlphabet[0])
	}

	// Convert to base58
	result := ""
	for num > 0 {
		remainder := num % 58
		result = string(rippleAlphabet[remainder]) + result
		num = num / 58
	}

	// Add leading 'r' for each leading zero byte
	for _, b := range data {
		if b == 0 {
			result = string(rippleAlphabet[0]) + result
		} else {
			break
		}
	}

	return result
}
