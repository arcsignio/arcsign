// Package ethereum - Transaction signing implementation
package ethereum

import (
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
)

// EthereumSigner implements chainadapter.Signer for Ethereum using ECDSA secp256k1.
//
// This implementation supports EIP-155 (replay protection) and EIP-1559 (dynamic fees).
type EthereumSigner struct {
	privateKey *ecdsa.PrivateKey
	address    string
	chainID    *big.Int
}

// NewEthereumSigner creates a new Ethereum signer from a hex-encoded private key.
//
// Parameters:
// - privateKeyHex: Hex-encoded private key (64 characters, with or without "0x" prefix)
// - chainID: Ethereum chain ID (1 for mainnet, 5 for goerli, 11155111 for sepolia)
//
// Returns:
// - Signer instance
// - Error if private key is invalid
func NewEthereumSigner(privateKeyHex string, chainID int64) (*EthereumSigner, error) {
	// Remove "0x" prefix if present
	if len(privateKeyHex) >= 2 && privateKeyHex[:2] == "0x" {
		privateKeyHex = privateKeyHex[2:]
	}

	// Decode private key
	privKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid private key hex: %w", err)
	}

	// Parse private key
	privKey, err := crypto.ToECDSA(privKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	// Derive address from public key
	pubKey := privKey.Public()
	pubKeyECDSA, ok := pubKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("error casting public key to ECDSA")
	}

	address := crypto.PubkeyToAddress(*pubKeyECDSA)

	return &EthereumSigner{
		privateKey: privKey,
		address:    address.Hex(), // Checksummed address
		chainID:    big.NewInt(chainID),
	}, nil
}

// NewEthereumSignerFromPrivateKey creates a signer from raw private key bytes.
//
// Parameters:
// - privKeyBytes: 32-byte private key
// - chainID: Ethereum chain ID
//
// Returns:
// - Signer instance
// - Error if private key is invalid
func NewEthereumSignerFromPrivateKey(privKeyBytes []byte, chainID int64) (*EthereumSigner, error) {
	if len(privKeyBytes) != 32 {
		return nil, fmt.Errorf("private key must be 32 bytes, got %d", len(privKeyBytes))
	}

	// Parse private key
	privKey, err := crypto.ToECDSA(privKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	// Derive address
	pubKey := privKey.Public()
	pubKeyECDSA, ok := pubKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("error casting public key to ECDSA")
	}

	address := crypto.PubkeyToAddress(*pubKeyECDSA)

	return &EthereumSigner{
		privateKey: privKey,
		address:    address.Hex(),
		chainID:    big.NewInt(chainID),
	}, nil
}

// Sign signs the given payload using ECDSA secp256k1 with EIP-155 replay protection.
//
// Contract:
// - Verifies that the requested address matches the signer's address
// - Returns signature bytes (R || S || V format, 65 bytes)
// - Applies EIP-155 replay protection (V = 27 + chainID * 2 + {0,1})
//
// Parameters:
// - payload: Binary data to sign (transaction hash, Keccak256)
// - address: Address that should sign (for verification)
//
// Returns:
// - Signature bytes (R || S || V, 65 bytes)
// - Error if address mismatch or signing fails
func (s *EthereumSigner) Sign(payload []byte, address string) ([]byte, error) {
	// Verify address matches (case-insensitive comparison)
	if common.HexToAddress(address).Hex() != s.address {
		return nil, fmt.Errorf("address mismatch: signer controls %s, requested %s", s.address, address)
	}

	// Hash the payload (Ethereum uses Keccak256)
	hash := crypto.Keccak256Hash(payload)

	// Sign the hash
	signature, err := crypto.Sign(hash.Bytes(), s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("signing failed: %w", err)
	}

	// crypto.Sign returns [R || S || V] where V is 0 or 1
	// We need to adjust V for EIP-155: V = chainID * 2 + 35 + {0,1}
	if len(signature) != 65 {
		return nil, fmt.Errorf("unexpected signature length: %d", len(signature))
	}

	// Adjust V for EIP-155
	v := signature[64]
	signature[64] = v + byte(s.chainID.Int64()*2+35)

	return signature, nil
}

// SignTransaction signs an Ethereum transaction (EIP-1559 or legacy).
//
// This is a higher-level method that signs a go-ethereum types.Transaction.
//
// Parameters:
// - tx: Unsigned Ethereum transaction
//
// Returns:
// - Signed transaction
// - Error if signing fails
func (s *EthereumSigner) SignTransaction(tx *types.Transaction) (*types.Transaction, error) {
	// Create EIP-155 signer
	signer := types.NewLondonSigner(s.chainID)

	// Sign the transaction
	signedTx, err := types.SignTx(tx, signer, s.privateKey)
	if err != nil {
		return nil, fmt.Errorf("transaction signing failed: %w", err)
	}

	return signedTx, nil
}

// GetAddress returns the checksummed Ethereum address controlled by this signer.
func (s *EthereumSigner) GetAddress() string {
	return s.address
}

// GetPublicKey returns the uncompressed public key bytes (65 bytes: 0x04 || X || Y).
func (s *EthereumSigner) GetPublicKey() []byte {
	pubKey := s.privateKey.Public()
	pubKeyECDSA := pubKey.(*ecdsa.PublicKey)
	return crypto.FromECDSAPub(pubKeyECDSA)
}

// GetChainID returns the chain ID for this signer.
func (s *EthereumSigner) GetChainID() *big.Int {
	return new(big.Int).Set(s.chainID)
}

// VerifySignature verifies an Ethereum signature against a hash and address.
//
// Parameters:
// - hash: Hash that was signed (32 bytes)
// - signature: Signature bytes (R || S || V, 65 bytes)
// - address: Expected signer address
//
// Returns:
// - true if signature is valid
// - Error if verification fails
func VerifySignature(hash []byte, signature []byte, address string) (bool, error) {
	if len(hash) != 32 {
		return false, fmt.Errorf("hash must be 32 bytes, got %d", len(hash))
	}

	if len(signature) != 65 {
		return false, fmt.Errorf("signature must be 65 bytes, got %d", len(signature))
	}

	// Recover public key from signature
	// Note: crypto.Ecrecover expects V as 0 or 1, so we need to normalize
	sigCopy := make([]byte, 65)
	copy(sigCopy, signature)

	// Normalize V to 0 or 1
	if sigCopy[64] >= 35 {
		// EIP-155 format: V = chainID * 2 + 35 + {0,1}
		sigCopy[64] = (sigCopy[64] - 35) % 2
	} else if sigCopy[64] >= 27 {
		// Legacy format: V = 27 + {0,1}
		sigCopy[64] -= 27
	}

	pubKeyBytes, err := crypto.Ecrecover(hash, sigCopy)
	if err != nil {
		return false, fmt.Errorf("public key recovery failed: %w", err)
	}

	// Convert pubKeyBytes to address
	pubKey, err := crypto.UnmarshalPubkey(pubKeyBytes)
	if err != nil {
		return false, fmt.Errorf("invalid public key: %w", err)
	}

	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	expectedAddr := common.HexToAddress(address)

	return recoveredAddr == expectedAddr, nil
}

// ComputeTransactionHash computes the Ethereum transaction hash (Keccak256).
//
// This is used to generate the transaction ID from serialized RLP-encoded transaction.
//
// Parameters:
// - rlpEncodedTx: RLP-encoded transaction bytes
//
// Returns:
// - Transaction hash (hex string with "0x" prefix)
func ComputeTransactionHash(rlpEncodedTx []byte) string {
	hash := crypto.Keccak256Hash(rlpEncodedTx)
	return hash.Hex()
}
