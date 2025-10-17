package hdkey

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
)

// HDKeyService handles BIP32 hierarchical deterministic key derivation
type HDKeyService struct {
	params *chaincfg.Params
}

// NewHDKeyService creates a new HD key service
// Uses Bitcoin mainnet parameters by default
func NewHDKeyService() *HDKeyService {
	return &HDKeyService{
		params: &chaincfg.MainNetParams,
	}
}

// NewMasterKey creates a master extended key from a BIP39 seed
// Seed must be between 16 and 64 bytes (128-512 bits)
func (s *HDKeyService) NewMasterKey(seed []byte) (*hdkeychain.ExtendedKey, error) {
	if len(seed) < 16 || len(seed) > 64 {
		return nil, fmt.Errorf("seed must be between 16 and 64 bytes, got %d", len(seed))
	}

	masterKey, err := hdkeychain.NewMaster(seed, s.params)
	if err != nil {
		return nil, fmt.Errorf("failed to create master key: %w", err)
	}

	return masterKey, nil
}

// DerivePath derives a child key following a BIP32 path
// Path format: m/44'/0'/0'/0/0
// Hardened derivation uses ' (e.g., 44')
// Returns the derived extended key
func (s *HDKeyService) DerivePath(key *hdkeychain.ExtendedKey, path string) (*hdkeychain.ExtendedKey, error) {
	// Remove "m/" prefix if present
	path = strings.TrimPrefix(path, "m/")
	if path == "" {
		return key, nil
	}

	// Split path into components
	components := strings.Split(path, "/")

	currentKey := key
	for i, component := range components {
		if component == "" {
			continue
		}

		// Check for hardened derivation (ends with ')
		hardened := false
		if strings.HasSuffix(component, "'") {
			hardened = true
			component = strings.TrimSuffix(component, "'")
		}

		// Parse index
		index, err := strconv.ParseUint(component, 10, 32)
		if err != nil {
			return nil, fmt.Errorf("invalid path component at position %d: %s", i, component)
		}

		// Apply hardened bit if needed
		var childIndex uint32
		if hardened {
			childIndex = hdkeychain.HardenedKeyStart + uint32(index)
		} else {
			childIndex = uint32(index)
		}

		// Derive child key
		childKey, err := currentKey.Derive(childIndex)
		if err != nil {
			return nil, fmt.Errorf("failed to derive child at index %d: %w", index, err)
		}

		currentKey = childKey
	}

	return currentKey, nil
}

// GetPublicKey extracts the compressed public key (33 bytes) from an extended key
func (s *HDKeyService) GetPublicKey(key *hdkeychain.ExtendedKey) ([]byte, error) {
	pubKey, err := key.ECPubKey()
	if err != nil {
		return nil, fmt.Errorf("failed to get public key: %w", err)
	}

	// Return compressed public key (33 bytes)
	return pubKey.SerializeCompressed(), nil
}

// GetPrivateKey extracts the private key (32 bytes) from an extended key
// WARNING: Private keys must be handled securely and cleared from memory after use
func (s *HDKeyService) GetPrivateKey(key *hdkeychain.ExtendedKey) ([]byte, error) {
	privKey, err := key.ECPrivKey()
	if err != nil {
		return nil, fmt.Errorf("failed to get private key: %w", err)
	}

	// Return private key bytes (32 bytes)
	return privKey.Serialize(), nil
}

// GetExtendedPublicKey returns the extended public key (xpub) as a string
// xpub can be used to derive public keys without exposing private keys
func (s *HDKeyService) GetExtendedPublicKey(key *hdkeychain.ExtendedKey) (string, error) {
	// Neuter the key (convert to public-only)
	pubKey, err := key.Neuter()
	if err != nil {
		return "", fmt.Errorf("failed to neuter key: %w", err)
	}

	return pubKey.String(), nil
}

// GetExtendedPrivateKey returns the extended private key (xprv) as a string
// WARNING: xprv contains private keys and must be handled securely
func (s *HDKeyService) GetExtendedPrivateKey(key *hdkeychain.ExtendedKey) (string, error) {
	return key.String(), nil
}
