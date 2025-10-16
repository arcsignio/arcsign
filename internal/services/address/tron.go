package address

import (
	"crypto/sha256"
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/mr-tron/base58"
)

// T040: DeriveTronAddress derives a TRON (TRX) address
// TRON uses Ethereum-like address generation with base58 encoding
// Addresses start with 'T' and are base58-encoded
func (s *AddressService) DeriveTronAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Convert to uncompressed format (65 bytes: 0x04 + X + Y)
	uncompressed := pubKey.SerializeUncompressed()

	// TRON address generation (similar to Ethereum):
	// 1. Keccak256 hash of uncompressed public key (without 0x04 prefix)
	hash := crypto.Keccak256(uncompressed[1:])

	// 2. Take last 20 bytes
	addressBytes := hash[len(hash)-20:]

	// 3. Add TRON prefix (0x41 for mainnet addresses starting with 'T')
	tronAddress := append([]byte{0x41}, addressBytes...)

	// 4. Double SHA256 for checksum
	checksum := doubleSHA256(tronAddress)

	// 5. Append first 4 bytes of checksum
	addressWithChecksum := append(tronAddress, checksum[:4]...)

	// 6. Base58 encode
	encoded := base58.Encode(addressWithChecksum)

	return encoded, nil
}

// doubleSHA256 performs double SHA256 hashing (used for TRON checksum)
func doubleSHA256(data []byte) []byte {
	first := sha256.Sum256(data)
	second := sha256.Sum256(first[:])
	return second[:]
}
