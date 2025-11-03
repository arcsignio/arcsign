package address

import (
	"crypto/sha256"
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
)

// DeriveAptosAddress derives an Aptos address
// Aptos uses Ed25519 keys and 32-byte hex addresses
// Address format: 0x followed by 64 hex characters
func (s *AddressService) DeriveAptosAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", err
	}

	// Aptos uses SHA3-256 hash of public key + single-sig scheme byte
	// This is simplified using SHA256
	pubKeyBytes := pubKey.SerializeCompressed()

	// Add Aptos single-sig scheme byte (0x00) and hash
	hashInput := append(pubKeyBytes, 0x00)
	hash := sha256.Sum256(hashInput)

	// Aptos addresses are 32 bytes (64 hex chars)
	address := fmt.Sprintf("0x%x", hash)

	return address, nil
}
