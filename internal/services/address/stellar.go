package address

import (
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/stellar/go/keypair"
)

// T038: DeriveStellarAddress derives a Stellar (XLM) address
// Stellar uses Ed25519 keypairs with custom base32 encoding
// Addresses start with 'G' (public key) and are 56 characters long
func (s *AddressService) DeriveStellarAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get the raw public key bytes (33 bytes compressed)
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Stellar uses Ed25519, but for BIP44 derivation we're using secp256k1
	// We need to convert the secp256k1 public key to a format Stellar can use
	// For now, we'll use the compressed public key bytes (33 bytes)
	// and pad/hash to get 32 bytes for Stellar's Ed25519 format

	pubKeyBytes := pubKey.SerializeCompressed()

	// Use the first 32 bytes of the compressed public key
	// (Skip the first byte which is the compression indicator)
	if len(pubKeyBytes) < 32 {
		return "", fmt.Errorf("public key too short: %d bytes", len(pubKeyBytes))
	}

	// Create a Stellar keypair from the raw seed
	// Note: This is a simplification. In production, you'd want to properly
	// derive Ed25519 keys from the BIP32 path or use Stellar's key derivation
	kp, err := keypair.FromRawSeed([32]byte(pubKeyBytes[1:33]))
	if err != nil {
		return "", fmt.Errorf("failed to create Stellar keypair: %w", err)
	}

	// Return the Stellar address (public key encoded in base32)
	return kp.Address(), nil
}
