package address

import (
	"fmt"

	"github.com/Zilliqa/gozilliqa-sdk/bech32"
	"github.com/Zilliqa/gozilliqa-sdk/keytools"
	"github.com/Zilliqa/gozilliqa-sdk/util"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
)

// T100: DeriveZilliqaAddress derives a Zilliqa (ZIL) address from an extended key
//
// Zilliqa uses Schnorr signatures on secp256k1 curve (same curve as Bitcoin/Ethereum).
// The key difference is the signature scheme (Schnorr vs ECDSA).
//
// Key Details:
// - Signature: Schnorr signatures (not ECDSA like Ethereum)
// - Curve: secp256k1 (same as Bitcoin/Ethereum)
// - Hash: SHA256 of public key
// - Encoding: Bech32 with "zil" prefix
//
// BIP44 Path: m/44'/313'/0'/0/0
// Coin Type: 313 (Zilliqa registered coin type - SLIP-0044)
//
// Address Types:
// - Mainnet: zil1... (Bech32 with "zil" prefix)
// - Testnet: zil1... (same format, network determined by node connection)
//
// Address format: zil1 + Bech32(SHA256(pubkey)[12:]) (last 20 bytes)
// Example: zil1f8mcd7nnv3v6ucw2kjnq7ngvhj22phglks50s5
func (s *AddressService) DeriveZilliqaAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get the secp256k1 private key bytes
	privKey, err := key.ECPrivKey()
	if err != nil {
		return "", fmt.Errorf("failed to get private key: %w", err)
	}

	// Convert private key to hex string (required by gozilliqa-sdk)
	privKeyHex := fmt.Sprintf("%064x", privKey.Serialize())

	// Get public key from private key using Zilliqa SDK
	// compressed=true for compressed public key format (33 bytes)
	publicKey := keytools.GetPublicKeyFromPrivateKey(util.DecodeHex(privKeyHex), true)

	// Get Zilliqa address from public key
	// The SDK handles: SHA256(pubkey) → take last 20 bytes → Bech32 encode with "zil"
	address := keytools.GetAddressFromPublic(publicKey)

	// Verify address has correct format
	if len(address) == 0 {
		return "", fmt.Errorf("failed to generate Zilliqa address")
	}

	// Convert to Bech32 format (zil1...)
	bech32Address, err := bech32.ToBech32Address(address)
	if err != nil {
		return "", fmt.Errorf("failed to convert to Bech32 format: %w", err)
	}

	return bech32Address, nil
}
