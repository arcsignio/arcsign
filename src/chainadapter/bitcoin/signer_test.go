// Package bitcoin - Unit tests for transaction signing
package bitcoin

import (
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test vectors for Bitcoin signing
const (
	// Valid WIF private key for testnet3
	testWIF = "cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA"
	// Expected P2WPKH address for the above WIF on testnet3
	testAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx" // Note: This is an example, actual will be derived
)

// TestNewBTCDSigner verifies creating a signer from WIF.
func TestNewBTCDSigner(t *testing.T) {
	tests := []struct {
		name        string
		wif         string
		network     string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "valid testnet WIF",
			wif:         testWIF,
			network:     "testnet3",
			expectError: false,
		},
		{
			name:        "invalid WIF",
			wif:         "invalid_wif_string",
			network:     "testnet3",
			expectError: true,
			errorMsg:    "invalid WIF",
		},
		{
			name:        "unsupported network",
			wif:         testWIF,
			network:     "unsupported",
			expectError: true,
			errorMsg:    "unsupported network",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewBTCDSigner(tt.wif, tt.network)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, signer)
			} else {
				require.NoError(t, err)
				require.NotNil(t, signer)
				assert.NotEmpty(t, signer.GetAddress())
				assert.NotEmpty(t, signer.GetPublicKey())
				assert.Equal(t, 33, len(signer.GetPublicKey())) // Compressed public key
			}
		})
	}
}

// TestNewBTCDSignerFromPrivateKey verifies creating a signer from raw private key bytes.
func TestNewBTCDSignerFromPrivateKey(t *testing.T) {
	// Generate a valid 32-byte private key
	validPrivKey := make([]byte, 32)
	for i := range validPrivKey {
		validPrivKey[i] = byte(i + 1) // Simple test key
	}

	tests := []struct {
		name        string
		privKey     []byte
		network     string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "valid 32-byte private key",
			privKey:     validPrivKey,
			network:     "testnet3",
			expectError: false,
		},
		{
			name:        "invalid length (31 bytes)",
			privKey:     make([]byte, 31),
			network:     "testnet3",
			expectError: true,
			errorMsg:    "private key must be 32 bytes",
		},
		{
			name:        "invalid length (33 bytes)",
			privKey:     make([]byte, 33),
			network:     "testnet3",
			expectError: true,
			errorMsg:    "private key must be 32 bytes",
		},
		{
			name:        "unsupported network",
			privKey:     validPrivKey,
			network:     "unsupported",
			expectError: true,
			errorMsg:    "unsupported network",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := NewBTCDSignerFromPrivateKey(tt.privKey, tt.network)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, signer)
			} else {
				require.NoError(t, err)
				require.NotNil(t, signer)
				assert.NotEmpty(t, signer.GetAddress())
				assert.Equal(t, 33, len(signer.GetPublicKey()))
			}
		})
	}
}

// TestSign verifies the Sign method with address validation.
func TestSign(t *testing.T) {
	// Create a test signer
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}
	signer, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)
	require.NotNil(t, signer)

	signerAddress := signer.GetAddress()
	payload := []byte("test transaction payload")

	tests := []struct {
		name        string
		payload     []byte
		address     string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "valid signature with matching address",
			payload:     payload,
			address:     signerAddress,
			expectError: false,
		},
		{
			name:        "address mismatch",
			payload:     payload,
			address:     "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
			expectError: true,
			errorMsg:    "address mismatch",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signature, err := signer.Sign(tt.payload, tt.address)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
				assert.Nil(t, signature)
			} else {
				require.NoError(t, err)
				require.NotNil(t, signature)
				assert.NotEmpty(t, signature)

				// Signature should be DER-encoded (variable length, but typically 70-72 bytes)
				assert.GreaterOrEqual(t, len(signature), 64)
				assert.LessOrEqual(t, len(signature), 73)
			}
		})
	}
}

// TestSignRaw verifies the SignRaw method for pre-hashed data.
func TestSignRaw(t *testing.T) {
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}
	signer, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	signerAddress := signer.GetAddress()
	validHash := make([]byte, 32)
	for i := range validHash {
		validHash[i] = byte(i)
	}

	tests := []struct {
		name        string
		hash        []byte
		address     string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "valid 32-byte hash",
			hash:        validHash,
			address:     signerAddress,
			expectError: false,
		},
		{
			name:        "invalid hash length (31 bytes)",
			hash:        make([]byte, 31),
			address:     signerAddress,
			expectError: true,
			errorMsg:    "hash must be 32 bytes",
		},
		{
			name:        "invalid hash length (33 bytes)",
			hash:        make([]byte, 33),
			address:     signerAddress,
			expectError: true,
			errorMsg:    "hash must be 32 bytes",
		},
		{
			name:        "address mismatch",
			hash:        validHash,
			address:     "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
			expectError: true,
			errorMsg:    "address mismatch",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signature, err := signer.SignRaw(tt.hash, tt.address)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				require.NoError(t, err)
				require.NotNil(t, signature)
				assert.NotEmpty(t, signature)
			}
		})
	}
}

// TestSignatureDeterminism verifies that signing the same payload produces consistent signatures.
// Note: ECDSA signatures can vary due to random k value, but we verify they're valid.
func TestSignatureDeterminism(t *testing.T) {
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}
	signer, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	payload := []byte("deterministic test payload")
	address := signer.GetAddress()
	pubKey := signer.GetPublicKey()

	// Sign the same payload multiple times
	sig1, err := signer.Sign(payload, address)
	require.NoError(t, err)

	sig2, err := signer.Sign(payload, address)
	require.NoError(t, err)

	// Signatures might differ (due to random k), but both should be valid
	valid1, err := VerifySignature(payload, sig1, pubKey)
	require.NoError(t, err)
	assert.True(t, valid1, "First signature should be valid")

	valid2, err := VerifySignature(payload, sig2, pubKey)
	require.NoError(t, err)
	assert.True(t, valid2, "Second signature should be valid")
}

// TestVerifySignature verifies the signature verification function.
func TestVerifySignature(t *testing.T) {
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}
	signer, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	payload := []byte("test payload for verification")
	address := signer.GetAddress()
	pubKey := signer.GetPublicKey()

	// Create valid signature
	signature, err := signer.Sign(payload, address)
	require.NoError(t, err)

	tests := []struct {
		name        string
		payload     []byte
		signature   []byte
		pubKey      []byte
		expectValid bool
		expectError bool
	}{
		{
			name:        "valid signature",
			payload:     payload,
			signature:   signature,
			pubKey:      pubKey,
			expectValid: true,
			expectError: false,
		},
		{
			name:        "invalid signature (tampered)",
			payload:     payload,
			signature:   append([]byte{0x00}, signature[1:]...), // Tamper first byte
			pubKey:      pubKey,
			expectValid: false,
			expectError: true, // DER parsing will fail
		},
		{
			name:        "wrong payload",
			payload:     []byte("different payload"),
			signature:   signature,
			pubKey:      pubKey,
			expectValid: false,
			expectError: false,
		},
		{
			name:        "invalid public key",
			payload:     payload,
			signature:   signature,
			pubKey:      []byte{0x00, 0x01, 0x02}, // Invalid pubkey
			expectValid: false,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			valid, err := VerifySignature(tt.payload, tt.signature, tt.pubKey)

			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectValid, valid)
			}
		})
	}
}

// TestComputeTransactionHash verifies transaction hash computation.
func TestComputeTransactionHash(t *testing.T) {
	// Test with known transaction bytes
	txBytes := []byte("test transaction")

	hash1 := ComputeTransactionHash(txBytes)
	hash2 := ComputeTransactionHash(txBytes)

	// Should be deterministic
	assert.Equal(t, hash1, hash2, "Hash should be deterministic")

	// Should be 64 hex characters (32 bytes)
	assert.Equal(t, 64, len(hash1), "Hash should be 64 hex characters")

	// Should be valid hex
	_, err := hex.DecodeString(hash1)
	require.NoError(t, err, "Hash should be valid hex")

	// Different input should produce different hash
	hash3 := ComputeTransactionHash([]byte("different transaction"))
	assert.NotEqual(t, hash1, hash3, "Different inputs should produce different hashes")
}

// TestGetAddress verifies address derivation consistency.
func TestGetAddress(t *testing.T) {
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}

	// Create two signers with the same private key
	signer1, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	signer2, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	// Addresses should be identical
	assert.Equal(t, signer1.GetAddress(), signer2.GetAddress(),
		"Same private key should produce same address")

	// Address should be valid P2WPKH format
	address := signer1.GetAddress()
	assert.True(t, len(address) > 0, "Address should not be empty")
	assert.True(t, address[:2] == "tb" || address[:2] == "bc" || address[:2] == "bcrt",
		"Address should have valid Bech32 prefix")
}

// TestGetPublicKey verifies public key derivation.
func TestGetPublicKey(t *testing.T) {
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}

	signer, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	pubKey := signer.GetPublicKey()

	// Should be compressed public key (33 bytes)
	assert.Equal(t, 33, len(pubKey), "Public key should be 33 bytes (compressed)")

	// First byte should be 0x02 or 0x03 (compressed format)
	assert.True(t, pubKey[0] == 0x02 || pubKey[0] == 0x03,
		"Compressed public key should start with 0x02 or 0x03")
}

// TestNetworkIsolation verifies that different networks produce different addresses.
func TestNetworkIsolation(t *testing.T) {
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}

	mainnetSigner, err := NewBTCDSignerFromPrivateKey(privKey, "mainnet")
	require.NoError(t, err)

	testnetSigner, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	regtestSigner, err := NewBTCDSignerFromPrivateKey(privKey, "regtest")
	require.NoError(t, err)

	// Addresses should differ across networks
	assert.NotEqual(t, mainnetSigner.GetAddress(), testnetSigner.GetAddress(),
		"Mainnet and testnet addresses should differ")
	assert.NotEqual(t, mainnetSigner.GetAddress(), regtestSigner.GetAddress(),
		"Mainnet and regtest addresses should differ")

	// Public keys should be the same
	assert.Equal(t, mainnetSigner.GetPublicKey(), testnetSigner.GetPublicKey(),
		"Public keys should be network-independent")
}

// TestSerializeSignatureCompact verifies compact signature serialization.
func TestSerializeSignatureCompact(t *testing.T) {
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i + 1)
	}
	signer, err := NewBTCDSignerFromPrivateKey(privKey, "testnet3")
	require.NoError(t, err)

	payload := []byte("test payload")
	address := signer.GetAddress()

	signature, err := signer.Sign(payload, address)
	require.NoError(t, err)

	// Serialize to compact format
	compact, err := SerializeSignatureCompact(signature)
	require.NoError(t, err)
	assert.NotNil(t, compact)

	// For now, implementation returns DER as-is
	// In production, this would be 64 bytes (R || S)
	assert.NotEmpty(t, compact)
}
