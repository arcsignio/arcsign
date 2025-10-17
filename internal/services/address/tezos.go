package address

import (
	"fmt"

	"blockwatch.cc/tzgo/tezos"
	"github.com/anyproto/go-slip10"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
)

// T094: DeriveTezosAddress derives a Tezos (XTZ) address from an extended key
//
// Tezos uses Ed25519 keys which require SLIP-10 derivation (not BIP32).
// SLIP-10 adapts BIP32 for Ed25519 by using only hardened derivations.
//
// Key Differences from BIP32:
// - Ed25519 signature scheme (not secp256k1)
// - SLIP-10 specification (hardened derivations only)
// - Blake2b hashing (not SHA256+RIPEMD160)
// - Base58Check encoding with tz1 prefix for Ed25519 addresses
//
// BIP44 Path: m/44'/1729'/0'/0/0 (all hardened for Ed25519)
// Coin Type: 1729 (Tezos registered coin type - the Ramanujan number!)
//
// Address Types:
// - tz1: Ed25519 (this implementation)
// - tz2: secp256k1
// - tz3: secp256r1
//
// Address format: tz1 + Base58Check(Blake2b-160(pubkey))
// Example: tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb
func (s *AddressService) DeriveTezosAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get the private key bytes from BIP32 extended key
	// We use this as seed for SLIP-10 to derive Ed25519 keys
	privKeyBytes, err := key.ECPrivKey()
	if err != nil {
		return "", fmt.Errorf("failed to get private key: %w", err)
	}

	// Use the private key as seed for SLIP-10 derivation
	seed := privKeyBytes.Serialize()

	// Derive Ed25519 key using path: m/0' (hardened only)
	// Note: We use a simplified path since we're already at the coin level
	// The full BIP44 path derivation happens before this function is called
	node, err := slip10.DeriveForPath("m/0'", seed)
	if err != nil {
		return "", fmt.Errorf("failed to derive Ed25519 key: %w", err)
	}

	// Get the Ed25519 public key (32 bytes)
	publicKey, _ := node.Keypair()

	// Create Tezos key from Ed25519 public key bytes
	// The tzgo library will handle Blake2b hashing and Base58Check encoding
	tzKey := tezos.NewKey(tezos.KeyTypeEd25519, publicKey)

	// Generate tz1 address from the key
	address := tzKey.Address()

	// Return the address as a string
	return address.String(), nil
}
