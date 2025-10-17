package unit

import (
	"bytes"
	"testing"

	"github.com/yourusername/arcsign/internal/services/crypto"
)

// T015: Test for clearBytes() function
func TestClearBytes(t *testing.T) {
	t.Run("clears byte slice", func(t *testing.T) {
		data := []byte("sensitive data here")
		original := make([]byte, len(data))
		copy(original, data)

		crypto.ClearBytes(data)

		// Verify all bytes are zeroed
		for i, b := range data {
			if b != 0 {
				t.Errorf("Byte at index %d not cleared: got %d, want 0", i, b)
			}
		}

		// Verify original was not all zeros (sanity check)
		allZeros := true
		for _, b := range original {
			if b != 0 {
				allZeros = false
				break
			}
		}
		if allZeros {
			t.Error("Test data was already all zeros")
		}
	})

	t.Run("handles empty slice", func(t *testing.T) {
		data := []byte{}
		crypto.ClearBytes(data) // Should not panic
	})

	t.Run("handles nil slice", func(t *testing.T) {
		var data []byte
		crypto.ClearBytes(data) // Should not panic
	})
}

// T017 & T019: Test for EncryptMnemonic() and DecryptMnemonic() roundtrip
func TestEncryptDecryptMnemonic(t *testing.T) {
	password := "MySecureP@ssw0rd!"
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	t.Run("encrypts and decrypts mnemonic successfully", func(t *testing.T) {
		encrypted, err := crypto.EncryptMnemonic(mnemonic, password)
		if err != nil {
			t.Fatalf("EncryptMnemonic failed: %v", err)
		}

		// Verify encrypted structure
		if len(encrypted.Salt) != 16 {
			t.Errorf("Expected salt length 16, got %d", len(encrypted.Salt))
		}
		if len(encrypted.Nonce) != 12 {
			t.Errorf("Expected nonce length 12, got %d", len(encrypted.Nonce))
		}
		if len(encrypted.Ciphertext) == 0 {
			t.Error("Ciphertext is empty")
		}
		if encrypted.Version != 1 {
			t.Errorf("Expected version 1, got %d", encrypted.Version)
		}

		// Decrypt and verify
		decrypted, err := crypto.DecryptMnemonic(encrypted, password)
		if err != nil {
			t.Fatalf("DecryptMnemonic failed: %v", err)
		}

		if decrypted != mnemonic {
			t.Errorf("Decrypted mnemonic doesn't match.\nGot:  %s\nWant: %s", decrypted, mnemonic)
		}
	})

	t.Run("fails with wrong password", func(t *testing.T) {
		encrypted, err := crypto.EncryptMnemonic(mnemonic, password)
		if err != nil {
			t.Fatalf("EncryptMnemonic failed: %v", err)
		}

		wrongPassword := "WrongPassword123!"
		_, err = crypto.DecryptMnemonic(encrypted, wrongPassword)
		if err == nil {
			t.Error("Expected decryption to fail with wrong password")
		}
	})

	t.Run("produces different ciphertexts with same input", func(t *testing.T) {
		encrypted1, _ := crypto.EncryptMnemonic(mnemonic, password)
		encrypted2, _ := crypto.EncryptMnemonic(mnemonic, password)

		// Salts should be different (random)
		if bytes.Equal(encrypted1.Salt, encrypted2.Salt) {
			t.Error("Expected different salts for different encryptions")
		}

		// Nonces should be different (random)
		if bytes.Equal(encrypted1.Nonce, encrypted2.Nonce) {
			t.Error("Expected different nonces for different encryptions")
		}

		// Both should decrypt to same mnemonic
		decrypted1, _ := crypto.DecryptMnemonic(encrypted1, password)
		decrypted2, _ := crypto.DecryptMnemonic(encrypted2, password)

		if decrypted1 != mnemonic || decrypted2 != mnemonic {
			t.Error("Both encryptions should decrypt to original mnemonic")
		}
	})
}

// T021: Test for SerializeEncryptedData() and DeserializeEncryptedData()
func TestSerializeDeserialize(t *testing.T) {
	password := "TestPassword123!"
	mnemonic := "test test test test test test test test test test test junk"

	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		encrypted, err := crypto.EncryptMnemonic(mnemonic, password)
		if err != nil {
			t.Fatalf("EncryptMnemonic failed: %v", err)
		}

		// Serialize
		serialized := crypto.SerializeEncryptedData(encrypted)

		// Expected format: [version:1][time:4][memory:4][threads:1][salt:16][nonce:12][ciphertext:variable]
		minSize := 1 + 4 + 4 + 1 + 16 + 12 // 38 bytes minimum
		if len(serialized) < minSize {
			t.Errorf("Serialized data too small: got %d bytes, want at least %d", len(serialized), minSize)
		}

		// Deserialize
		deserialized, err := crypto.DeserializeEncryptedData(serialized)
		if err != nil {
			t.Fatalf("DeserializeEncryptedData failed: %v", err)
		}

		// Verify fields match
		if deserialized.Version != encrypted.Version {
			t.Errorf("Version mismatch: got %d, want %d", deserialized.Version, encrypted.Version)
		}
		if deserialized.Argon2Time != encrypted.Argon2Time {
			t.Errorf("Argon2Time mismatch: got %d, want %d", deserialized.Argon2Time, encrypted.Argon2Time)
		}
		if !bytes.Equal(deserialized.Salt, encrypted.Salt) {
			t.Error("Salt mismatch")
		}
		if !bytes.Equal(deserialized.Nonce, encrypted.Nonce) {
			t.Error("Nonce mismatch")
		}
		if !bytes.Equal(deserialized.Ciphertext, encrypted.Ciphertext) {
			t.Error("Ciphertext mismatch")
		}

		// Verify decryption still works
		decrypted, err := crypto.DecryptMnemonic(deserialized, password)
		if err != nil {
			t.Fatalf("DecryptMnemonic after deserialization failed: %v", err)
		}
		if decrypted != mnemonic {
			t.Errorf("Decrypted mnemonic doesn't match after serialization roundtrip")
		}
	})

	t.Run("fails with corrupted data", func(t *testing.T) {
		corruptedData := []byte{1, 2, 3, 4, 5} // Too short
		_, err := crypto.DeserializeEncryptedData(corruptedData)
		if err == nil {
			t.Error("Expected error for corrupted data")
		}
	})
}

// T066: Test for DecryptMnemonic() with wrong password (GCM authentication error)
func TestDecryptWithWrongPassword(t *testing.T) {
	password := "CorrectPassword123!"
	mnemonic := "correct horse battery staple correct horse battery staple correct horse battery staple"

	encrypted, err := crypto.EncryptMnemonic(mnemonic, password)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	t.Run("wrong password produces authentication error", func(t *testing.T) {
		wrongPassword := "WrongPassword456!"
		_, err := crypto.DecryptMnemonic(encrypted, wrongPassword)
		if err == nil {
			t.Error("Expected authentication error with wrong password")
		}
		// GCM authentication should fail
		if err != nil && err.Error() != "" {
			// Expected - authentication tag verification failed
		}
	})

	t.Run("tampered ciphertext produces authentication error", func(t *testing.T) {
		tamperedEncrypted := *encrypted
		tamperedEncrypted.Ciphertext = make([]byte, len(encrypted.Ciphertext))
		copy(tamperedEncrypted.Ciphertext, encrypted.Ciphertext)
		tamperedEncrypted.Ciphertext[0] ^= 0xFF // Flip bits

		_, err := crypto.DecryptMnemonic(&tamperedEncrypted, password)
		if err == nil {
			t.Error("Expected authentication error with tampered ciphertext")
		}
	})
}
