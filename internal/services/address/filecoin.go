package address

import (
	"fmt"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"golang.org/x/crypto/blake2b"
)

// DeriveFilecoinAddress derives a Filecoin address
// Filecoin uses secp256k1 keys and custom address format
// Address format: f1... for secp256k1 addresses
func (s *AddressService) DeriveFilecoinAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", err
	}

	// Filecoin uses Blake2b-160 for secp256k1 addresses
	pubKeyBytes := pubKey.SerializeCompressed()

	// Hash with Blake2b
	hash := blake2b.Sum256(pubKeyBytes)

	// Take first 20 bytes (160 bits)
	addressHash := hash[:20]

	// Filecoin secp256k1 addresses start with "f1"
	// This is a simplified Base32 representation
	address := fmt.Sprintf("f1%x", addressHash)

	return address, nil
}
