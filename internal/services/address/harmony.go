package address

import (
	"crypto/ecdsa"
	"fmt"

	"github.com/btcsuite/btcd/btcutil/bech32"
	"github.com/ethereum/go-ethereum/crypto"
)

// DeriveHarmonyAddress derives a Harmony ONE address from a private key
//
// Harmony uses identical Ethereum key derivation (secp256k1 + Keccak256)
// but encodes the final address using Bech32 with "one" prefix instead of 0x hex
//
// Derivation flow:
// 1. secp256k1 private key → public key
// 2. Keccak256 hash of public key → last 20 bytes (Ethereum format address)
// 3. Convert to Bech32 with "one" prefix
//
// Example:
//   Ethereum: 0x0B585F8DaEfBC68a311FbD4cB20d9174aD174016
//   Harmony:  one1pd9...
//
// BIP44 path: m/44'/1023'/0'/0/0 (coin type 1023, NOT 60)
// Note: MetaMask uses coin type 60, producing different addresses
func (s *AddressService) DeriveHarmonyAddress(privateKey *ecdsa.PrivateKey) (string, error) {
	// 1. Get Ethereum-format address (20 bytes)
	ethAddress := crypto.PubkeyToAddress(privateKey.PublicKey)
	addressBytes := ethAddress.Bytes()

	// 2. Convert to 5-bit groups for Bech32 encoding
	converted, err := bech32.ConvertBits(addressBytes, 8, 5, true)
	if err != nil {
		return "", fmt.Errorf("failed to convert address bits for Bech32: %w", err)
	}

	// 3. Encode as Bech32 with "one" prefix
	address, err := bech32.Encode("one", converted)
	if err != nil {
		return "", fmt.Errorf("failed to encode Harmony address: %w", err)
	}

	return address, nil
}
