// Package chainadapter - KeySource implementations
package chainadapter

import (
	"crypto/ecdsa"
	"fmt"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/tyler-smith/go-bip32"
	"github.com/tyler-smith/go-bip39"
)

// MnemonicKeySource implements KeySource using a BIP39 mnemonic phrase.
//
// Security:
// - Private keys are derived on-demand and NOT stored
// - Mnemonic is stored in memory (caller responsible for secure handling)
// - Uses BIP32 hierarchical deterministic key derivation
type MnemonicKeySource struct {
	mnemonic string
	password string // Optional BIP39 passphrase (empty string if none)
}

// NewMnemonicKeySource creates a KeySource from a BIP39 mnemonic.
//
// Parameters:
// - mnemonic: BIP39 mnemonic phrase (12, 15, 18, 21, or 24 words)
// - password: Optional BIP39 passphrase (use "" for no passphrase)
//
// Returns error if mnemonic is invalid.
func NewMnemonicKeySource(mnemonic string, password string) (*MnemonicKeySource, error) {
	// Validate mnemonic
	if !bip39.IsMnemonicValid(mnemonic) {
		return nil, NewNonRetryableError(
			ErrCodeInvalidPath,
			"invalid BIP39 mnemonic",
			nil,
		)
	}

	return &MnemonicKeySource{
		mnemonic: mnemonic,
		password: password,
	}, nil
}

// Type returns the key source type
func (m *MnemonicKeySource) Type() KeySourceType {
	return KeySourceMnemonic
}

// GetPublicKey derives the public key for the given BIP44 path.
//
// Path format: m/44'/cointype'/account'/change/index
//
// Examples:
// - Bitcoin: m/44'/0'/0'/0/0
// - Ethereum: m/44'/60'/0'/0/0
//
// Returns compressed public key bytes (33 bytes for secp256k1)
func (m *MnemonicKeySource) GetPublicKey(path string) ([]byte, error) {
	// Convert mnemonic to seed
	seed := bip39.NewSeed(m.mnemonic, m.password)

	// Create master key
	masterKey, err := bip32.NewMasterKey(seed)
	if err != nil {
		return nil, NewNonRetryableError(
			ErrCodeInvalidPath,
			"failed to create master key from seed",
			err,
		)
	}

	// Parse and derive path
	derivedKey, err := derivePath(masterKey, path)
	if err != nil {
		return nil, err
	}

	// Return compressed public key
	return derivedKey.PublicKey().Key, nil
}

// GetPrivateKey derives the private key for signing (used internally by signers).
// WARNING: This method exposes private key material and should only be used by trusted signers.
func (m *MnemonicKeySource) GetPrivateKey(path string) ([]byte, error) {
	seed := bip39.NewSeed(m.mnemonic, m.password)
	masterKey, err := bip32.NewMasterKey(seed)
	if err != nil {
		return nil, NewNonRetryableError(
			ErrCodeInvalidPath,
			"failed to create master key from seed",
			err,
		)
	}

	derivedKey, err := derivePath(masterKey, path)
	if err != nil {
		return nil, err
	}

	return derivedKey.Key, nil
}

// GetEthereumPrivateKey derives an Ethereum-compatible private key.
// Returns *ecdsa.PrivateKey for use with go-ethereum's crypto functions.
func (m *MnemonicKeySource) GetEthereumPrivateKey(path string) (*ecdsa.PrivateKey, error) {
	privateKeyBytes, err := m.GetPrivateKey(path)
	if err != nil {
		return nil, err
	}

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		return nil, NewNonRetryableError(
			ErrCodeInvalidPath,
			"failed to convert private key to ECDSA",
			err,
		)
	}

	return privateKey, nil
}

// GetBitcoinPrivateKey derives a Bitcoin-compatible private key.
// Returns *btcec.PrivateKey for use with btcd's signing functions.
func (m *MnemonicKeySource) GetBitcoinPrivateKey(path string) (*btcec.PrivateKey, error) {
	privateKeyBytes, err := m.GetPrivateKey(path)
	if err != nil {
		return nil, err
	}

	privateKey, publicKey := btcec.PrivKeyFromBytes(privateKeyBytes)
	_ = publicKey // Suppress unused warning

	return privateKey, nil
}

// XPubKeySource implements KeySource using an extended public key (xpub/ypub/zpub).
//
// Limitations:
// - Can only derive public keys (watch-only wallet)
// - Cannot sign transactions (requires external signer)
type XPubKeySource struct {
	xpub string
	key  *bip32.Key
}

// NewXPubKeySource creates a KeySource from an extended public key.
//
// Parameters:
// - xpub: Extended public key (xpub.../ypub.../zpub...)
//
// Returns error if xpub is invalid.
func NewXPubKeySource(xpub string) (*XPubKeySource, error) {
	// Deserialize xpub
	key, err := bip32.B58Deserialize(xpub)
	if err != nil {
		return nil, NewNonRetryableError(
			ErrCodeInvalidPath,
			"invalid extended public key",
			err,
		)
	}

	// Verify it's a public key by checking if private key bytes are all zero
	// In BIP32, public keys have their private key field set to zero
	if !key.IsPrivate {
		// This is a public key, good
	} else {
		return nil, NewNonRetryableError(
			ErrCodeInvalidPath,
			"expected public key, got private key",
			nil,
		)
	}

	return &XPubKeySource{
		xpub: xpub,
		key:  key,
	}, nil
}

// Type returns the key source type
func (x *XPubKeySource) Type() KeySourceType {
	return KeySourceXPub
}

// GetPublicKey derives the public key for the given derivation path.
//
// Note: XPub can only derive non-hardened paths (no apostrophes).
// Path must be relative to the xpub level (e.g., "0/0" not "m/44'/0'/0'/0/0")
func (x *XPubKeySource) GetPublicKey(path string) ([]byte, error) {
	// XPub derivation only supports non-hardened paths
	// Path should be relative (e.g., "0/0" for first external address)
	derivedKey, err := derivePathFromKey(x.key, path)
	if err != nil {
		return nil, err
	}

	return derivedKey.PublicKey().Key, nil
}

// HardwareWalletKeySource implements KeySource for hardware wallets (Ledger/Trezor).
//
// Status: Stub implementation for future hardware wallet support.
type HardwareWalletKeySource struct {
	deviceType string // "ledger" or "trezor"
	devicePath string // USB device path
}

// NewHardwareWalletKeySource creates a KeySource for a hardware wallet.
//
// Status: Not yet implemented - returns error
func NewHardwareWalletKeySource(deviceType string, devicePath string) (*HardwareWalletKeySource, error) {
	return nil, NewNonRetryableError(
		"ERR_NOT_SUPPORTED",
		"hardware wallet support not yet implemented",
		nil,
	)
}

// Type returns the key source type
func (h *HardwareWalletKeySource) Type() KeySourceType {
	return KeySourceHardwareWallet
}

// GetPublicKey would derive public key from hardware wallet.
// Status: Not yet implemented
func (h *HardwareWalletKeySource) GetPublicKey(path string) ([]byte, error) {
	return nil, NewNonRetryableError(
		"ERR_NOT_SUPPORTED",
		"hardware wallet support not yet implemented",
		nil,
	)
}

// derivePath derives a BIP32 key from a master key given a BIP44 path.
//
// Path format: m/44'/cointype'/account'/change/index
// - m: master key (implicit)
// - 44': purpose (BIP44)
// - cointype': 0 for Bitcoin, 60 for Ethereum
// - account': account index (usually 0)
// - change: 0 for external, 1 for internal (change addresses)
// - index: address index (0, 1, 2, ...)
//
// Apostrophe (') indicates hardened derivation.
func derivePath(masterKey *bip32.Key, path string) (*bip32.Key, error) {
	// Parse path (e.g., "m/44'/0'/0'/0/0")
	indices, err := parsePath(path)
	if err != nil {
		return nil, err
	}

	// Derive each level
	key := masterKey
	for i, index := range indices {
		derivedKey, err := key.NewChildKey(index)
		if err != nil {
			return nil, NewNonRetryableError(
				ErrCodeInvalidPath,
				fmt.Sprintf("failed to derive child key at level %d", i),
				err,
			)
		}
		key = derivedKey
	}

	return key, nil
}

// derivePathFromKey derives from an existing key (for XPub derivation)
func derivePathFromKey(key *bip32.Key, path string) (*bip32.Key, error) {
	// For XPub, path should be non-hardened relative path (e.g., "0/0")
	indices, err := parsePath(path)
	if err != nil {
		return nil, err
	}

	// Check for hardened indices (not supported with xpub)
	for _, index := range indices {
		if index >= bip32.FirstHardenedChild {
			return nil, NewNonRetryableError(
				ErrCodeInvalidPath,
				"xpub cannot derive hardened paths",
				nil,
			)
		}
	}

	// Derive each level
	currentKey := key
	for i, index := range indices {
		derivedKey, err := currentKey.NewChildKey(index)
		if err != nil {
			return nil, NewNonRetryableError(
				ErrCodeInvalidPath,
				fmt.Sprintf("failed to derive child key at level %d", i),
				err,
			)
		}
		currentKey = derivedKey
	}

	return currentKey, nil
}

// parsePath parses a BIP44 derivation path into child indices.
//
// Examples:
// - "m/44'/0'/0'/0/0" → [0x8000002C, 0x80000000, 0x80000000, 0, 0]
// - "0/0" → [0, 0]
//
// Apostrophe (') adds 0x80000000 to make it hardened.
func parsePath(path string) ([]uint32, error) {
	// Simple parser for BIP44 paths
	// Format: m/44'/0'/0'/0/0 or 0/0 (for xpub relative paths)

	if path == "" || path == "m" {
		return []uint32{}, nil
	}

	// Remove "m/" prefix if present
	if len(path) >= 2 && path[:2] == "m/" {
		path = path[2:]
	}

	// Split by "/"
	parts := []string{}
	current := ""
	for _, c := range path {
		if c == '/' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}

	indices := make([]uint32, len(parts))
	for i, part := range parts {
		var index uint32
		hardened := false

		// Check for hardened marker (')
		if len(part) > 0 && part[len(part)-1] == '\'' {
			hardened = true
			part = part[:len(part)-1]
		}

		// Parse number
		var num uint32
		_, err := fmt.Sscanf(part, "%d", &num)
		if err != nil {
			return nil, NewNonRetryableError(
				ErrCodeInvalidPath,
				fmt.Sprintf("invalid path component: %s", part),
				err,
			)
		}

		if hardened {
			index = num + bip32.FirstHardenedChild
		} else {
			index = num
		}

		indices[i] = index
	}

	return indices, nil
}
