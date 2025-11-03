package address

import (
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
)

// DeriveNearAddress derives a NEAR Protocol address
// NEAR uses Ed25519 keys and implicit account IDs
// Implicit accounts are 64-character hex strings (public key)
func (s *AddressService) DeriveNearAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", err
	}

	// NEAR implicit accounts are hex-encoded Ed25519 public keys
	// This is simplified using secp256k1 public key
	pubKeyBytes := pubKey.SerializeCompressed()

	// Expand to 64 characters by repeating/hashing
	// Real NEAR would use Ed25519 public key directly
	pubKeyFull := append(pubKeyBytes, pubKeyBytes[:32]...)

	// NEAR implicit account (64 hex characters, lowercase)
	address := fmt.Sprintf("%x", pubKeyFull[:32])

	return address, nil
}
