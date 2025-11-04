// Package bitcoin - Transaction signing implementation
package bitcoin

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/btcsuite/btcd/btcec/v2"
	"github.com/btcsuite/btcd/btcec/v2/ecdsa"
	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/chaincfg"
)

// BTCDSigner implements chainadapter.Signer for Bitcoin using ECDSA secp256k1.
//
// This implementation is for demonstration/testing purposes.
// Production implementations should use hardware wallets or secure key management.
type BTCDSigner struct {
	privateKey *btcec.PrivateKey
	address    string
	network    string
}

// NewBTCDSigner creates a new Bitcoin signer from a WIF private key.
//
// Parameters:
// - wif: Wallet Import Format private key
// - network: Bitcoin network ("mainnet", "testnet3", "regtest")
//
// Returns:
// - Signer instance
// - Error if WIF is invalid
func NewBTCDSigner(wif string, network string) (*BTCDSigner, error) {
	// Determine network parameters
	var netParams *chaincfg.Params
	switch network {
	case "mainnet":
		netParams = &chaincfg.MainNetParams
	case "testnet3":
		netParams = &chaincfg.TestNet3Params
	case "regtest":
		netParams = &chaincfg.RegressionNetParams
	default:
		return nil, fmt.Errorf("unsupported network: %s", network)
	}

	// Decode WIF
	wifKey, err := btcutil.DecodeWIF(wif)
	if err != nil {
		return nil, fmt.Errorf("invalid WIF: %w", err)
	}

	// Derive P2WPKH address from public key
	pubKey := wifKey.PrivKey.PubKey()
	pubKeyHash := btcutil.Hash160(pubKey.SerializeCompressed())
	addr, err := btcutil.NewAddressWitnessPubKeyHash(pubKeyHash, netParams)
	if err != nil {
		return nil, fmt.Errorf("failed to derive address: %w", err)
	}

	return &BTCDSigner{
		privateKey: wifKey.PrivKey,
		address:    addr.EncodeAddress(),
		network:    network,
	}, nil
}

// NewBTCDSignerFromPrivateKey creates a signer from raw private key bytes.
//
// Parameters:
// - privKeyBytes: 32-byte private key
// - network: Bitcoin network
//
// Returns:
// - Signer instance
// - Error if private key is invalid
func NewBTCDSignerFromPrivateKey(privKeyBytes []byte, network string) (*BTCDSigner, error) {
	if len(privKeyBytes) != 32 {
		return nil, fmt.Errorf("private key must be 32 bytes, got %d", len(privKeyBytes))
	}

	// Determine network parameters
	var netParams *chaincfg.Params
	switch network {
	case "mainnet":
		netParams = &chaincfg.MainNetParams
	case "testnet3":
		netParams = &chaincfg.TestNet3Params
	case "regtest":
		netParams = &chaincfg.RegressionNetParams
	default:
		return nil, fmt.Errorf("unsupported network: %s", network)
	}

	// Parse private key
	privKey, pubKey := btcec.PrivKeyFromBytes(privKeyBytes)

	// Derive P2WPKH address
	pubKeyHash := btcutil.Hash160(pubKey.SerializeCompressed())
	addr, err := btcutil.NewAddressWitnessPubKeyHash(pubKeyHash, netParams)
	if err != nil {
		return nil, fmt.Errorf("failed to derive address: %w", err)
	}

	return &BTCDSigner{
		privateKey: privKey,
		address:    addr.EncodeAddress(),
		network:    network,
	}, nil
}

// Sign signs the given payload using ECDSA secp256k1.
//
// Contract:
// - Verifies that the requested address matches the signer's address
// - Returns DER-encoded ECDSA signature
// - Signature format: R || S (64 bytes, 32 bytes each)
//
// Parameters:
// - payload: Binary data to sign (transaction hash)
// - address: Address that should sign (for verification)
//
// Returns:
// - Signature bytes (DER-encoded)
// - Error if address mismatch or signing fails
func (s *BTCDSigner) Sign(payload []byte, address string) ([]byte, error) {
	// Verify address matches
	if address != s.address {
		return nil, fmt.Errorf("address mismatch: signer controls %s, requested %s", s.address, address)
	}

	// Hash the payload (Bitcoin uses double SHA256 for transaction signing)
	hash := sha256.Sum256(payload)
	txHash := sha256.Sum256(hash[:])

	// Sign the hash
	signature := ecdsa.Sign(s.privateKey, txHash[:])

	// Serialize signature to DER format
	sigBytes := signature.Serialize()

	return sigBytes, nil
}

// SignRaw signs the payload directly without double-hashing.
//
// This is used when the payload is already a hash (e.g., from PSBT).
//
// Parameters:
// - hash: Pre-computed hash to sign (32 bytes)
// - address: Address that should sign
//
// Returns:
// - Signature bytes (DER-encoded)
// - Error if validation fails
func (s *BTCDSigner) SignRaw(hash []byte, address string) ([]byte, error) {
	// Verify address matches
	if address != s.address {
		return nil, fmt.Errorf("address mismatch: signer controls %s, requested %s", s.address, address)
	}

	// Verify hash length
	if len(hash) != 32 {
		return nil, fmt.Errorf("hash must be 32 bytes, got %d", len(hash))
	}

	// Sign the hash
	signature := ecdsa.Sign(s.privateKey, hash)

	// Serialize signature to DER format
	sigBytes := signature.Serialize()

	return sigBytes, nil
}

// GetAddress returns the P2WPKH address controlled by this signer.
func (s *BTCDSigner) GetAddress() string {
	return s.address
}

// GetPublicKey returns the compressed public key bytes.
func (s *BTCDSigner) GetPublicKey() []byte {
	return s.privateKey.PubKey().SerializeCompressed()
}

// VerifySignature verifies a signature against a payload and public key.
//
// This is a utility function for signature verification.
//
// Parameters:
// - payload: Original payload that was signed
// - signature: DER-encoded signature bytes
// - pubKeyBytes: Compressed public key (33 bytes)
//
// Returns:
// - true if signature is valid
// - Error if verification fails
func VerifySignature(payload []byte, signature []byte, pubKeyBytes []byte) (bool, error) {
	// Parse public key
	pubKey, err := btcec.ParsePubKey(pubKeyBytes)
	if err != nil {
		return false, fmt.Errorf("invalid public key: %w", err)
	}

	// Parse signature
	sig, err := ecdsa.ParseDERSignature(signature)
	if err != nil {
		return false, fmt.Errorf("invalid signature: %w", err)
	}

	// Hash the payload (double SHA256)
	hash := sha256.Sum256(payload)
	txHash := sha256.Sum256(hash[:])

	// Verify signature
	valid := sig.Verify(txHash[:], pubKey)
	return valid, nil
}

// SerializeSignatureCompact converts DER signature to compact format (64 bytes: R || S).
//
// Note: This is a simplified implementation. In production, you would need to
// extract R and S values from the DER encoding manually or use additional libraries.
func SerializeSignatureCompact(derSig []byte) ([]byte, error) {
	_, err := ecdsa.ParseDERSignature(derSig)
	if err != nil {
		return nil, fmt.Errorf("invalid DER signature: %w", err)
	}

	// For now, return the DER signature as-is
	// In production, this would extract R||S (64 bytes) from DER encoding
	return derSig, nil
}

// ComputeTransactionHash computes the Bitcoin transaction hash (double SHA256).
//
// This is used to generate the transaction ID (txid) from serialized transaction.
//
// Parameters:
// - serializedTx: Fully serialized transaction bytes
//
// Returns:
// - Transaction hash (hex string, little-endian)
func ComputeTransactionHash(serializedTx []byte) string {
	// Double SHA256
	hash := sha256.Sum256(serializedTx)
	txHash := sha256.Sum256(hash[:])

	// Reverse bytes for little-endian display
	reversed := make([]byte, 32)
	for i := 0; i < 32; i++ {
		reversed[i] = txHash[31-i]
	}

	return hex.EncodeToString(reversed)
}
