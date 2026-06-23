// Package security - Unit tests for memory protection utilities
package security

import (
	"bytes"
	"crypto/rand"
	"testing"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

// TestSecureZero verifies that SecureZero correctly clears memory
func TestSecureZero(t *testing.T) {
	// Create a buffer with known data
	original := make([]byte, 32)
	for i := range original {
		original[i] = byte(i)
	}

	// Make a copy for comparison
	data := make([]byte, 32)
	copy(data, original)

	// Verify data is non-zero
	allZero := true
	for _, b := range data {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		t.Fatal("Test setup failed: data should not be all zeros")
	}

	// Zero the data
	SecureZero(data)

	// Verify all bytes are zero
	for i, b := range data {
		if b != 0 {
			t.Errorf("SecureZero failed: byte %d is %d, expected 0", i, b)
		}
	}
}

// TestSecureZeroEmpty verifies SecureZero handles empty slices
func TestSecureZeroEmpty(t *testing.T) {
	// Should not panic on empty slice
	SecureZero(nil)
	SecureZero([]byte{})
}

// TestSecureZeroMultiple verifies SecureZeroMultiple clears multiple buffers
func TestSecureZeroMultiple(t *testing.T) {
	buf1 := []byte{1, 2, 3, 4}
	buf2 := []byte{5, 6, 7, 8, 9, 10}
	buf3 := []byte{11, 12}

	SecureZeroMultiple(buf1, buf2, buf3)

	for i, b := range buf1 {
		if b != 0 {
			t.Errorf("buf1[%d] = %d, expected 0", i, b)
		}
	}
	for i, b := range buf2 {
		if b != 0 {
			t.Errorf("buf2[%d] = %d, expected 0", i, b)
		}
	}
	for i, b := range buf3 {
		if b != 0 {
			t.Errorf("buf3[%d] = %d, expected 0", i, b)
		}
	}
}

// TestSecureCompare verifies constant-time comparison
func TestSecureCompare(t *testing.T) {
	a := []byte{1, 2, 3, 4}
	b := []byte{1, 2, 3, 4}
	c := []byte{1, 2, 3, 5}
	d := []byte{1, 2, 3}

	if !SecureCompare(a, b) {
		t.Error("SecureCompare should return true for equal slices")
	}

	if SecureCompare(a, c) {
		t.Error("SecureCompare should return false for different slices")
	}

	if SecureCompare(a, d) {
		t.Error("SecureCompare should return false for different length slices")
	}
}

// TestSplitSecret verifies XOR secret splitting
func TestSplitSecret(t *testing.T) {
	// Create a test secret
	secret := make([]byte, 32)
	rand.Read(secret)

	// Make a copy for comparison
	original := make([]byte, 32)
	copy(original, secret)

	// Split the secret
	shares, err := SplitSecret(secret)
	if err != nil {
		t.Fatalf("SplitSecret failed: %v", err)
	}

	// Verify original was zeroed
	allZero := true
	for _, b := range secret {
		if b != 0 {
			allZero = false
			break
		}
	}
	if !allZero {
		t.Error("SplitSecret should zero the original secret")
	}

	// Verify shares are valid
	if !shares.IsValid() {
		t.Error("Shares should be valid after split")
	}

	// Reconstruct and verify
	reconstructed := shares.Reconstruct()
	if !bytes.Equal(reconstructed, original) {
		t.Error("Reconstructed secret does not match original")
	}

	// Clean up
	SecureZero(reconstructed)
	shares.Zeroize()
}

// TestSplitSecretEmpty verifies error on empty secret
func TestSplitSecretEmpty(t *testing.T) {
	_, err := SplitSecret([]byte{})
	if err == nil {
		t.Error("SplitSecret should return error for empty secret")
	}
}

// TestSharesRefresh verifies share refresh maintains secret value
func TestSharesRefresh(t *testing.T) {
	// Create and split a secret
	secret := make([]byte, 32)
	rand.Read(secret)
	original := make([]byte, 32)
	copy(original, secret)

	shares, err := SplitSecret(secret)
	if err != nil {
		t.Fatalf("SplitSecret failed: %v", err)
	}

	// Get original shares for comparison
	oldShare1 := make([]byte, 32)
	copy(oldShare1, shares.share1)

	// Refresh shares
	err = shares.Refresh()
	if err != nil {
		t.Fatalf("Refresh failed: %v", err)
	}

	// Verify shares changed
	if bytes.Equal(oldShare1, shares.share1) {
		t.Error("Refresh should change share values")
	}

	// Verify secret still reconstructs correctly
	reconstructed := shares.Reconstruct()
	if !bytes.Equal(reconstructed, original) {
		t.Error("Reconstructed secret changed after refresh")
	}

	SecureZero(reconstructed)
	shares.Zeroize()
}

// TestSharesZeroize verifies Zeroize clears all shares
func TestSharesZeroize(t *testing.T) {
	secret := make([]byte, 32)
	rand.Read(secret)

	shares, err := SplitSecret(secret)
	if err != nil {
		t.Fatalf("SplitSecret failed: %v", err)
	}

	shares.Zeroize()

	// After zeroize, IsValid should return false
	if shares.IsValid() {
		t.Error("Shares should be invalid after Zeroize")
	}

	// Reconstruct should return nil
	if shares.Reconstruct() != nil {
		t.Error("Reconstruct should return nil after Zeroize")
	}
}

// TestSecureSignerCreation verifies SecureSigner creation and key zeroing
func TestSecureSignerCreation(t *testing.T) {
	// Create a test private key (32 bytes)
	privateKey := make([]byte, 32)
	rand.Read(privateKey)

	// Make a copy for comparison
	original := make([]byte, 32)
	copy(original, privateKey)

	// Create signer
	signer, err := NewSecureSigner(privateKey, "0x1234567890123456789012345678901234567890", "ethereum")
	if err != nil {
		t.Fatalf("NewSecureSigner failed: %v", err)
	}

	// Verify original private key was zeroed
	allZero := true
	for _, b := range privateKey {
		if b != 0 {
			allZero = false
			break
		}
	}
	if !allZero {
		t.Error("NewSecureSigner should zero the private key input")
	}

	// Verify signer is valid
	if !signer.IsValid() {
		t.Error("Signer should be valid after creation")
	}

	// Verify address
	if signer.GetAddress() != "0x1234567890123456789012345678901234567890" {
		t.Errorf("Address mismatch: got %s", signer.GetAddress())
	}

	// Clean up
	signer.Zeroize()
}

// TestSecureSignerInvalidKeyLength verifies error on wrong key length
func TestSecureSignerInvalidKeyLength(t *testing.T) {
	// 16 bytes - too short
	shortKey := make([]byte, 16)
	_, err := NewSecureSigner(shortKey, "0x1234", "ethereum")
	if err == nil {
		t.Error("Should reject private key with wrong length")
	}
}

// TestSecureSignerEmptyAddress verifies error on empty address
func TestSecureSignerEmptyAddress(t *testing.T) {
	privateKey := make([]byte, 32)
	rand.Read(privateKey)

	_, err := NewSecureSigner(privateKey, "", "ethereum")
	if err == nil {
		t.Error("Should reject empty address")
	}
}

// TestSecureSignerAddressMismatch verifies sign rejects mismatched address
func TestSecureSignerAddressMismatch(t *testing.T) {
	privateKey := make([]byte, 32)
	rand.Read(privateKey)

	signer, err := NewSecureSigner(privateKey, "0xAAAA", "ethereum")
	if err != nil {
		t.Fatalf("NewSecureSigner failed: %v", err)
	}
	defer signer.Zeroize()

	// Try to sign with different address
	_, err = signer.Sign([]byte("test"), "0xBBBB")
	if err == nil {
		t.Error("Sign should reject mismatched address")
	}
}

// TestSecureSignerZeroize verifies Zeroize invalidates signer
func TestSecureSignerZeroize(t *testing.T) {
	privateKey := make([]byte, 32)
	rand.Read(privateKey)

	signer, err := NewSecureSigner(privateKey, "0x1234", "ethereum")
	if err != nil {
		t.Fatalf("NewSecureSigner failed: %v", err)
	}

	signer.Zeroize()

	if signer.IsValid() {
		t.Error("Signer should be invalid after Zeroize")
	}
}

// TestSecureSignerSignHashMatchesPlaintext verifies SignHash produces a
// signature byte-identical to the plaintext ethcrypto.Sign path it replaces.
// This guarantees the XOR-split protection changes only key handling, never
// the signature semantics (EIP-191 / EIP-712 callers depend on this).
func TestSecureSignerSignHashMatchesPlaintext(t *testing.T) {
	privateKey := make([]byte, 32)
	rand.Read(privateKey)

	// Reference signature via the plaintext path.
	refKeyBytes := make([]byte, 32)
	copy(refKeyBytes, privateKey)
	refKey, err := ethcrypto.ToECDSA(refKeyBytes)
	if err != nil {
		t.Fatalf("ToECDSA failed: %v", err)
	}
	address := ethcrypto.PubkeyToAddress(refKey.PublicKey).Hex()

	hash := ethcrypto.Keccak256([]byte("\x19Ethereum Signed Message:\n5hello"))
	want, err := ethcrypto.Sign(hash, refKey)
	if err != nil {
		t.Fatalf("plaintext Sign failed: %v", err)
	}

	// Signature via the SecureSigner (XOR-split) path.
	signer, err := NewSecureSigner(privateKey, address, "ethereum")
	if err != nil {
		t.Fatalf("NewSecureSigner failed: %v", err)
	}
	defer signer.Zeroize()

	got, err := signer.SignHash(hash, address)
	if err != nil {
		t.Fatalf("SignHash failed: %v", err)
	}

	if !bytes.Equal(got, want) {
		t.Errorf("SignHash signature differs from plaintext path:\n got  %x\n want %x", got, want)
	}
}

// TestSecureSignerSignHashAddressMismatch verifies SignHash rejects a request
// for an address the signer does not control.
func TestSecureSignerSignHashAddressMismatch(t *testing.T) {
	privateKey := make([]byte, 32)
	rand.Read(privateKey)

	signer, err := NewSecureSigner(privateKey, "0xAAAA", "ethereum")
	if err != nil {
		t.Fatalf("NewSecureSigner failed: %v", err)
	}
	defer signer.Zeroize()

	hash := ethcrypto.Keccak256([]byte("test"))
	if _, err := signer.SignHash(hash, "0xBBBB"); err == nil {
		t.Error("SignHash should reject mismatched address")
	}
}

// TestSecureSignerSignHashNonEVM verifies SignHash refuses non-EVM chains,
// since EIP-191 / EIP-712 hash signing is EVM-only.
func TestSecureSignerSignHashNonEVM(t *testing.T) {
	privateKey := make([]byte, 32)
	rand.Read(privateKey)

	signer, err := NewSecureSigner(privateKey, "0x1234", "bitcoin")
	if err != nil {
		t.Fatalf("NewSecureSigner failed: %v", err)
	}
	defer signer.Zeroize()

	hash := ethcrypto.Keccak256([]byte("test"))
	if _, err := signer.SignHash(hash, "0x1234"); err == nil {
		t.Error("SignHash should reject non-EVM chains")
	}
}

// TestEIP191Hash verifies EIP191Hash applies the personal_sign prefix
// ("\x19Ethereum Signed Message:\n<len>") before keccak256, matching the
// EIP-191 standard. A raw keccak of the message (no prefix) must NOT match.
func TestEIP191Hash(t *testing.T) {
	message := []byte("hello")

	// Reference: the exact EIP-191 prefixed hash.
	want := ethcrypto.Keccak256([]byte("\x19Ethereum Signed Message:\n5hello"))

	got := EIP191Hash(message)

	if !bytes.Equal(got, want) {
		t.Errorf("EIP191Hash mismatch:\n got  %x\n want %x", got, want)
	}

	// Guard against regression to raw (unprefixed) signing.
	rawHash := ethcrypto.Keccak256(message)
	if bytes.Equal(got, rawHash) {
		t.Error("EIP191Hash must NOT equal raw keccak of the message (missing EIP-191 prefix)")
	}
}

// TestEIP191HashEmpty verifies the prefix length is 0 for an empty message.
func TestEIP191HashEmpty(t *testing.T) {
	want := ethcrypto.Keccak256([]byte("\x19Ethereum Signed Message:\n0"))
	got := EIP191Hash([]byte{})
	if !bytes.Equal(got, want) {
		t.Errorf("EIP191Hash(empty) mismatch:\n got  %x\n want %x", got, want)
	}
}

// BenchmarkSecureZero benchmarks secure zeroing performance
func BenchmarkSecureZero(b *testing.B) {
	data := make([]byte, 32)
	for i := range data {
		data[i] = byte(i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SecureZero(data)
		// Refill for next iteration
		for j := range data {
			data[j] = byte(j)
		}
	}
}

// BenchmarkSplitAndReconstruct benchmarks XOR splitting and reconstruction
func BenchmarkSplitAndReconstruct(b *testing.B) {
	secret := make([]byte, 32)
	rand.Read(secret)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		// Make copy since SplitSecret zeros input
		input := make([]byte, 32)
		copy(input, secret)

		shares, _ := SplitSecret(input)
		reconstructed := shares.Reconstruct()
		SecureZero(reconstructed)
		shares.Zeroize()
	}
}
