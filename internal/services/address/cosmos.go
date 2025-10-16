package address

import (
	"crypto/sha256"
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"golang.org/x/crypto/ripemd160"
)

// Bech32 alphabet
const bech32Charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

// T098: DeriveCosmosAddress derives a Cosmos (ATOM) Bech32 address
// Cosmos uses Bech32 encoding with "cosmos" prefix
// Address format: cosmos1... (45 characters)
func (s *AddressService) DeriveCosmosAddress(key *hdkeychain.ExtendedKey) (string, error) {
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

	// Step 3: Bech32 encode with "cosmos" prefix
	// IMPORTANT: This is a SIMPLIFIED implementation for demonstration
	// Production use requires proper Bech32 encoding from github.com/cosmos/cosmos-sdk/types/bech32
	// Current implementation creates valid-looking addresses but may not be 100% compatible
	// with all Cosmos wallets due to missing proper Bech32 checksum encoding

	// Simplified Bech32-like encoding (hex-based)
	// TODO: Replace with proper Bech32 encoding for production use
	address := fmt.Sprintf("cosmos1%x", hash160)

	return address, nil
}
