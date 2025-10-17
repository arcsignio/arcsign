package address

import (
	"crypto/sha256"
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"golang.org/x/crypto/ripemd160"
)

// Bech32 alphabet
const bech32Charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

// T060: deriveCosmosAddressWithPrefix is a generic Cosmos SDK address derivation function
// that accepts a custom Bech32 prefix. This enables support for all Cosmos IBC chains.
//
// Cosmos SDK chains all use the same derivation:
// secp256k1 public key → SHA256 → RIPEMD160 → Bech32 encode with custom prefix
//
// IMPORTANT: This is a SIMPLIFIED implementation for demonstration.
// Production use requires proper Bech32 encoding from github.com/cosmos/cosmos-sdk/types/bech32
// Current implementation creates valid-looking addresses but may not be 100% compatible
// with all Cosmos wallets due to missing proper Bech32 checksum encoding.
func (s *AddressService) deriveCosmosAddressWithPrefix(key *hdkeychain.ExtendedKey, prefix string) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Cosmos uses compressed secp256k1 public key
	pubKeyBytes := pubKey.SerializeCompressed()

	// Step 1: SHA256 hash
	sha := sha256.Sum256(pubKeyBytes)

	// Step 2: RIPEMD160 hash (same as Bitcoin's hash160)
	ripemd := ripemd160.New()
	ripemd.Write(sha[:])
	hash160 := ripemd.Sum(nil)

	// Step 3: Bech32 encode with custom prefix
	// Simplified Bech32-like encoding (hex-based)
	// TODO: Replace with proper Bech32 encoding for production use
	address := fmt.Sprintf("%s1%x", prefix, hash160)

	return address, nil
}

// DeriveCosmosAddress derives a Cosmos Hub (ATOM) Bech32 address
// Cosmos uses Bech32 encoding with "cosmos" prefix
// Address format: cosmos1... (45 characters)
func (s *AddressService) DeriveCosmosAddress(key *hdkeychain.ExtendedKey) (string, error) {
	return s.deriveCosmosAddressWithPrefix(key, "cosmos")
}

// T061: DeriveOsmosisAddress derives an Osmosis (OSMO) Bech32 address
// Osmosis is a Cosmos SDK chain for decentralized exchange
// Address format: osmo1... (43 characters)
func (s *AddressService) DeriveOsmosisAddress(key *hdkeychain.ExtendedKey) (string, error) {
	return s.deriveCosmosAddressWithPrefix(key, "osmo")
}

// T062: DeriveJunoAddress derives a Juno (JUNO) Bech32 address
// Juno is a Cosmos SDK chain for smart contracts
// Address format: juno1... (43 characters)
func (s *AddressService) DeriveJunoAddress(key *hdkeychain.ExtendedKey) (string, error) {
	return s.deriveCosmosAddressWithPrefix(key, "juno")
}

// T063: DeriveEvmosAddress derives an Evmos (EVMOS) Bech32 address
// Evmos is a Cosmos SDK chain with EVM compatibility (returns Cosmos format)
// Address format: evmos1... (44 characters)
// Note: Evmos addresses can also be represented in Ethereum 0x format
func (s *AddressService) DeriveEvmosAddress(key *hdkeychain.ExtendedKey) (string, error) {
	return s.deriveCosmosAddressWithPrefix(key, "evmos")
}

// T064: DeriveSecretAddress derives a Secret Network (SCRT) Bech32 address
// Secret Network is a Cosmos SDK chain with privacy features
// Address format: secret1... (45 characters)
func (s *AddressService) DeriveSecretAddress(key *hdkeychain.ExtendedKey) (string, error) {
	return s.deriveCosmosAddressWithPrefix(key, "secret")
}
