package address

import (
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"golang.org/x/crypto/sha3"
)

// T106: DeriveIconAddress derives an ICON (ICX) address from an extended key
//
// ICON uses a simple address derivation:
// 1. secp256k1 private key → uncompressed public key (64 bytes, without 0x04 prefix)
// 2. SHA3-256 hash of public key
// 3. Take last 20 bytes
// 4. Prepend "hx" prefix
//
// Key Differences from Ethereum:
// - ICON uses SHA3-256 (actual FIPS 202 standard)
// - Ethereum uses Keccak-256 (pre-standard version, different output)
// - ICON prefix: "hx" (users) / "cx" (contracts)
// - Ethereum prefix: "0x"
//
// BIP44 Coin Type Critical Discrepancy:
// - Registered coin type: 74 (per SLIP-0044)
// - Actual ecosystem usage: 4801368 (mainnet) / 1 (testnet)
// - This implementation uses the derivation path already selected by caller
// - Users should be aware of this discrepancy when comparing with ICON wallets
//
// Address format: hx + 40 hex characters (e.g., hx396031be52ec56955bd7bf15eacdfa1a1c1fe19e)
func (s *AddressService) DeriveIconAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get the ECDSA private key
	privKey, err := key.ECPrivKey()
	if err != nil {
		return "", fmt.Errorf("failed to get ECDSA private key: %w", err)
	}

	// Get uncompressed public key (65 bytes: 0x04 + X + Y)
	// We need to remove the 0x04 prefix for ICON
	pubKeyBytes := privKey.PubKey().SerializeUncompressed()
	if len(pubKeyBytes) != 65 {
		return "", fmt.Errorf("invalid public key length: expected 65, got %d", len(pubKeyBytes))
	}

	// Remove 0x04 prefix, keep only the 64-byte X+Y coordinates
	pubKeyWithoutPrefix := pubKeyBytes[1:]

	// SHA3-256 hash (FIPS 202 standard, NOT Keccak-256)
	hash := sha3.Sum256(pubKeyWithoutPrefix)

	// Take last 20 bytes
	addressBytes := hash[12:]

	// Prepend "hx" prefix and convert to hex
	address := "hx" + hex.EncodeToString(addressBytes)

	return address, nil
}
