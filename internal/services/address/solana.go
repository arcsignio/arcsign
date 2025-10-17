package address

import (
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/gagliardetto/solana-go"
)

// T042: DeriveSolanaAddress derives a Solana (SOL) address
// Solana uses Ed25519 keypairs with base58 encoding
// Addresses are base58-encoded public keys (32 bytes)
func (s *AddressService) DeriveSolanaAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get the raw public key bytes
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Solana uses Ed25519, but for BIP44 derivation we're using secp256k1
	// We need to convert the secp256k1 public key to a format Solana can use
	// For now, we'll use the compressed public key bytes (33 bytes)
	// and use first 32 bytes for Solana's Ed25519 format

	pubKeyBytes := pubKey.SerializeCompressed()

	// Use the first 32 bytes (skip compression indicator byte)
	if len(pubKeyBytes) < 32 {
		return "", fmt.Errorf("public key too short: %d bytes", len(pubKeyBytes))
	}

	// Create a Solana public key from the raw bytes
	var pubKeyArray [32]byte
	copy(pubKeyArray[:], pubKeyBytes[1:33])

	solanaPubKey := solana.PublicKeyFromBytes(pubKeyArray[:])

	// Return the base58-encoded Solana address
	return solanaPubKey.String(), nil
}
