package address

import (
	"crypto/sha256"
	"fmt"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/crypto"
	"golang.org/x/crypto/ripemd160"
)

// AddressService handles cryptocurrency address derivation
type AddressService struct {
	btcParams *chaincfg.Params
}

// NewAddressService creates a new address service
func NewAddressService() *AddressService {
	return &AddressService{
		btcParams: &chaincfg.MainNetParams,
	}
}

// DeriveBitcoinAddress derives a Bitcoin P2PKH address from an extended key
// Returns a base58-encoded Bitcoin address (e.g., 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa)
func (s *AddressService) DeriveBitcoinAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Create Bitcoin address (P2PKH - Pay to Public Key Hash)
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), s.btcParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Bitcoin address: %w", err)
	}

	// Return the P2PKH address string
	return address.EncodeAddress(), nil
}

// DeriveEthereumAddress derives an Ethereum address from an extended key
// Returns a hex-encoded Ethereum address (e.g., 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb)
func (s *AddressService) DeriveEthereumAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Convert to uncompressed format (65 bytes: 0x04 + X + Y)
	uncompressed := pubKey.SerializeUncompressed()

	// Ethereum address = last 20 bytes of Keccak256(uncompressed public key without 0x04 prefix)
	// Skip the first byte (0x04) and hash the remaining 64 bytes
	hash := crypto.Keccak256(uncompressed[1:])

	// Take last 20 bytes and add 0x prefix
	address := fmt.Sprintf("0x%x", hash[len(hash)-20:])

	return address, nil
}

// GetPublicKeyHash returns the RIPEMD160(SHA256(pubkey)) hash
// Used for Bitcoin address derivation
func (s *AddressService) GetPublicKeyHash(publicKey []byte) []byte {
	// SHA256
	sha := sha256.Sum256(publicKey)

	// RIPEMD160
	ripemd := ripemd160.New()
	ripemd.Write(sha[:])
	return ripemd.Sum(nil)
}

// FormatAddressWithLabel returns a formatted address string with label
func (s *AddressService) FormatAddressWithLabel(coinType string, address string, path string) string {
	return fmt.Sprintf("[%s] %s\n  Derivation Path: %s", coinType, address, path)
}
