// Package chainadapter - Simple signer implementation for FFI layer
package chainadapter

import (
	"fmt"

	"github.com/arcsign/chainadapter"
	"github.com/btcsuite/btcd/btcec"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

// SimpleSigner implements chainadapter.Signer using a raw private key.
//
// Design Note:
// - Address derivation is NOT done here - addresses must be provided from wallet service
// - chainID is only used to select the correct signing algorithm (Bitcoin vs Ethereum)
// - This signer only verifies address matches and signs payloads
//
// Security Warning:
// - Private key is stored in memory (should be zeroed after use)
// - For production, consider using hardware wallets or secure enclaves
type SimpleSigner struct {
	privateKey []byte
	address    string
	chainID    string // Only for selecting signing algorithm, NOT for address derivation
}

// NewSimpleSigner creates a new signer from a hex-encoded private key and address.
//
// Parameters:
// - privateKeyHex: Private key in hex format (with or without 0x prefix)
// - address: The address that corresponds to this private key (already derived by wallet service)
// - chainID: Chain identifier, only used to select signing algorithm ("bitcoin", "ethereum", etc.)
//
// Returns:
// - Signer instance
// - Error if private key is invalid
//
// Note: Address derivation MUST be done by wallet service before calling this
func NewSimpleSigner(privateKeyHex string, address string, chainID string) (*SimpleSigner, error) {
	// Remove 0x prefix if present
	if len(privateKeyHex) >= 2 && privateKeyHex[:2] == "0x" {
		privateKeyHex = privateKeyHex[2:]
	}

	// Convert hex to bytes
	privateKeyBytes, err := hexToBytes(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key hex: %w", err)
	}

	// Basic validation: private key must be 32 bytes
	if len(privateKeyBytes) != 32 {
		return nil, fmt.Errorf("invalid private key length: expected 32 bytes, got %d", len(privateKeyBytes))
	}

	return &SimpleSigner{
		privateKey: privateKeyBytes,
		address:    address,
		chainID:    chainID,
	}, nil
}

// Sign signs the given payload.
//
// Contract:
// - MUST verify that the signing address matches the requested address
// - MUST return raw signature bytes (chain-specific format)
// - MUST NOT leak private key material
func (s *SimpleSigner) Sign(payload []byte, address string) ([]byte, error) {
	// Verify address matches
	if s.address != address {
		return nil, fmt.Errorf("address mismatch: signer controls %s, requested %s", s.address, address)
	}

	// Sign based on chainID
	if s.chainID == "bitcoin" || s.chainID == "bitcoin-testnet" || s.chainID == "bitcoin-regtest" {
		// Bitcoin signature (ECDSA secp256k1)
		privKey, _ := btcec.PrivKeyFromBytes(btcec.S256(), s.privateKey)
		signature, _ := btcec.SignCompact(btcec.S256(), privKey, payload, false)
		return signature, nil
	} else if s.chainID == "ethereum" || s.chainID == "ethereum-goerli" || s.chainID == "ethereum-sepolia" {
		// Ethereum signature (ECDSA secp256k1 with recovery)
		privKey, _ := ethcrypto.ToECDSA(s.privateKey)
		signature, err := ethcrypto.Sign(payload, privKey)
		if err != nil {
			return nil, fmt.Errorf("Ethereum signing failed: %w", err)
		}
		return signature, nil
	}

	return nil, fmt.Errorf("unsupported chainID: %s", s.chainID)
}

// GetAddress returns the address controlled by this signer.
func (s *SimpleSigner) GetAddress() string {
	return s.address
}

// Zeroize clears the private key from memory.
func (s *SimpleSigner) Zeroize() {
	for i := range s.privateKey {
		s.privateKey[i] = 0
	}
	s.privateKey = nil
}

// Helper functions

func hexToBytes(hexStr string) ([]byte, error) {
	if len(hexStr)%2 != 0 {
		return nil, fmt.Errorf("hex string has odd length")
	}

	bytes := make([]byte, len(hexStr)/2)
	for i := 0; i < len(hexStr); i += 2 {
		high := hexCharToByte(hexStr[i])
		low := hexCharToByte(hexStr[i+1])

		if high == 255 || low == 255 {
			return nil, fmt.Errorf("invalid hex character at position %d", i)
		}

		bytes[i/2] = (high << 4) | low
	}

	return bytes, nil
}

func hexCharToByte(c byte) byte {
	switch {
	case c >= '0' && c <= '9':
		return c - '0'
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10
	default:
		return 255
	}
}

// Ensure SimpleSigner implements chainadapter.Signer
var _ chainadapter.Signer = (*SimpleSigner)(nil)
