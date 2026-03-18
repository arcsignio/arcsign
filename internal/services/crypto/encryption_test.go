package crypto

import (
	"bytes"
	"testing"

	"github.com/Jason-chen-taiwan/arcSignv2/internal/models"
)

const testPassword = "TestP@ssw0rd!Secure123"

func TestEncryptMnemonic_ValidInput_12Words(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	if encrypted == nil {
		t.Fatal("EncryptMnemonic returned nil")
	}
	if len(encrypted.Salt) != Argon2SaltLen {
		t.Errorf("salt length: got %d, want %d", len(encrypted.Salt), Argon2SaltLen)
	}
	if len(encrypted.Nonce) != AESNonceLen {
		t.Errorf("nonce length: got %d, want %d", len(encrypted.Nonce), AESNonceLen)
	}
	if len(encrypted.Ciphertext) == 0 {
		t.Error("ciphertext is empty")
	}
	if encrypted.Version != 1 {
		t.Errorf("version: got %d, want 1", encrypted.Version)
	}
	// Ciphertext should differ from plaintext
	if bytes.Equal(encrypted.Ciphertext, []byte(mnemonic)) {
		t.Error("ciphertext equals plaintext — encryption not applied")
	}
}

func TestEncryptMnemonic_ValidInput_24Words(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}
	if encrypted == nil {
		t.Fatal("EncryptMnemonic returned nil")
	}
	if bytes.Equal(encrypted.Ciphertext, []byte(mnemonic)) {
		t.Error("ciphertext equals plaintext")
	}
}

func TestEncryptDecryptRoundTrip_12Words(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	decrypted, err := DecryptMnemonic(encrypted, testPassword)
	if err != nil {
		t.Fatalf("DecryptMnemonic failed: %v", err)
	}

	if decrypted != mnemonic {
		t.Errorf("round-trip failed: got %q, want %q", decrypted, mnemonic)
	}
}

func TestEncryptDecryptRoundTrip_24Words(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	decrypted, err := DecryptMnemonic(encrypted, testPassword)
	if err != nil {
		t.Fatalf("DecryptMnemonic failed: %v", err)
	}

	if decrypted != mnemonic {
		t.Errorf("round-trip mismatch for 24-word mnemonic")
	}
}

func TestDecryptMnemonic_WrongPassword(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	_, err = DecryptMnemonic(encrypted, "WrongP@ssw0rd!123")
	if err == nil {
		t.Fatal("DecryptMnemonic should fail with wrong password")
	}
}

func TestDecryptMnemonic_NilEncryptedData(t *testing.T) {
	_, err := DecryptMnemonic(nil, testPassword)
	if err == nil {
		t.Fatal("DecryptMnemonic should fail with nil encrypted data")
	}
}

func TestDecryptMnemonic_InvalidSaltLength(t *testing.T) {
	encrypted := &models.EncryptedMnemonic{
		Salt:          []byte{1, 2, 3}, // too short
		Nonce:         make([]byte, AESNonceLen),
		Ciphertext:    []byte{1, 2, 3},
		Argon2Time:    Argon2Time,
		Argon2Memory:  Argon2Memory,
		Argon2Threads: Argon2Threads,
		Version:       1,
	}

	_, err := DecryptMnemonic(encrypted, testPassword)
	if err == nil {
		t.Fatal("DecryptMnemonic should fail with invalid salt length")
	}
}

func TestDecryptMnemonic_InvalidNonceLength(t *testing.T) {
	encrypted := &models.EncryptedMnemonic{
		Salt:          make([]byte, Argon2SaltLen),
		Nonce:         []byte{1, 2, 3}, // too short
		Ciphertext:    []byte{1, 2, 3},
		Argon2Time:    Argon2Time,
		Argon2Memory:  Argon2Memory,
		Argon2Threads: Argon2Threads,
		Version:       1,
	}

	_, err := DecryptMnemonic(encrypted, testPassword)
	if err == nil {
		t.Fatal("DecryptMnemonic should fail with invalid nonce length")
	}
}

func TestDecryptMnemonic_TamperedCiphertext(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	// Tamper with ciphertext
	if len(encrypted.Ciphertext) > 0 {
		encrypted.Ciphertext[0] ^= 0xff
	}

	_, err = DecryptMnemonic(encrypted, testPassword)
	if err == nil {
		t.Fatal("DecryptMnemonic should fail with tampered ciphertext")
	}
}

func TestEncryptMnemonic_UniqueNonce(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	enc1, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("first encryption failed: %v", err)
	}

	enc2, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("second encryption failed: %v", err)
	}

	if bytes.Equal(enc1.Nonce, enc2.Nonce) {
		t.Error("two encryptions produced the same nonce — nonce reuse vulnerability")
	}
}

func TestEncryptMnemonic_UniqueSalt(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	enc1, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("first encryption failed: %v", err)
	}

	enc2, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("second encryption failed: %v", err)
	}

	if bytes.Equal(enc1.Salt, enc2.Salt) {
		t.Error("two encryptions produced the same salt")
	}
}

func TestEncryptMnemonic_UniqueCiphertext(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	enc1, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("first encryption failed: %v", err)
	}

	enc2, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("second encryption failed: %v", err)
	}

	if bytes.Equal(enc1.Ciphertext, enc2.Ciphertext) {
		t.Error("two encryptions of same data produced identical ciphertext")
	}
}

func TestSerializeDeserializeRoundTrip(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	serialized := SerializeEncryptedData(encrypted)
	deserialized, err := DeserializeEncryptedData(serialized)
	if err != nil {
		t.Fatalf("DeserializeEncryptedData failed: %v", err)
	}

	if !bytes.Equal(deserialized.Salt, encrypted.Salt) {
		t.Error("salt mismatch after serialize/deserialize")
	}
	if !bytes.Equal(deserialized.Nonce, encrypted.Nonce) {
		t.Error("nonce mismatch after serialize/deserialize")
	}
	if !bytes.Equal(deserialized.Ciphertext, encrypted.Ciphertext) {
		t.Error("ciphertext mismatch after serialize/deserialize")
	}
	if deserialized.Argon2Time != encrypted.Argon2Time {
		t.Errorf("Argon2Time: got %d, want %d", deserialized.Argon2Time, encrypted.Argon2Time)
	}
	if deserialized.Argon2Memory != encrypted.Argon2Memory {
		t.Errorf("Argon2Memory: got %d, want %d", deserialized.Argon2Memory, encrypted.Argon2Memory)
	}
	if deserialized.Argon2Threads != encrypted.Argon2Threads {
		t.Errorf("Argon2Threads: got %d, want %d", deserialized.Argon2Threads, encrypted.Argon2Threads)
	}
	if deserialized.Version != encrypted.Version {
		t.Errorf("Version: got %d, want %d", deserialized.Version, encrypted.Version)
	}
}

func TestDeserializeEncryptedData_TooShort(t *testing.T) {
	// Minimum size is 38 bytes (1+4+4+1+16+12)
	shortData := make([]byte, 37)

	_, err := DeserializeEncryptedData(shortData)
	if err == nil {
		t.Fatal("DeserializeEncryptedData should fail with data shorter than minimum")
	}
}

func TestDeserializeEncryptedData_ExactMinimum(t *testing.T) {
	// Exactly 38 bytes — valid structure with 0-byte ciphertext
	data := make([]byte, 38)
	data[0] = 1 // version

	result, err := DeserializeEncryptedData(data)
	if err != nil {
		t.Fatalf("DeserializeEncryptedData failed with minimum-size data: %v", err)
	}
	if result.Version != 1 {
		t.Errorf("version: got %d, want 1", result.Version)
	}
}

func TestEncryptDecrypt_GenericData(t *testing.T) {
	data := []byte("This is arbitrary binary data \x00\x01\x02\xff")

	encryptedData, err := Encrypt(data, testPassword)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	decryptedData, err := Decrypt(encryptedData, testPassword)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if !bytes.Equal(decryptedData, data) {
		t.Error("Encrypt/Decrypt round-trip failed for generic data")
	}
}

func TestDecrypt_WrongPassword(t *testing.T) {
	data := []byte("secret data")

	encryptedData, err := Encrypt(data, testPassword)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	_, err = Decrypt(encryptedData, "WrongP@ss123!")
	if err == nil {
		t.Fatal("Decrypt should fail with wrong password")
	}
}

func TestDecrypt_TamperedData(t *testing.T) {
	data := []byte("secret data")

	encryptedData, err := Encrypt(data, testPassword)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Tamper with the last byte (in ciphertext region)
	if len(encryptedData) > 0 {
		encryptedData[len(encryptedData)-1] ^= 0xff
	}

	_, err = Decrypt(encryptedData, testPassword)
	if err == nil {
		t.Fatal("Decrypt should fail with tampered data")
	}
}

func TestClearBytes_MemoryZeroed(t *testing.T) {
	data := []byte{1, 2, 3, 4, 5, 6, 7, 8}
	ClearBytes(data)

	for i, b := range data {
		if b != 0 {
			t.Errorf("ClearBytes failed: byte %d is %d, expected 0", i, b)
		}
	}
}

func TestClearBytes_NilSlice(t *testing.T) {
	// Should not panic
	ClearBytes(nil)
}

func TestClearBytes_EmptySlice(t *testing.T) {
	// Should not panic
	ClearBytes([]byte{})
}

func TestEncryptMnemonic_Argon2Parameters(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	encrypted, err := EncryptMnemonic(mnemonic, testPassword)
	if err != nil {
		t.Fatalf("EncryptMnemonic failed: %v", err)
	}

	if encrypted.Argon2Time != Argon2Time {
		t.Errorf("Argon2Time: got %d, want %d", encrypted.Argon2Time, Argon2Time)
	}
	if encrypted.Argon2Memory != Argon2Memory {
		t.Errorf("Argon2Memory: got %d, want %d", encrypted.Argon2Memory, Argon2Memory)
	}
	if encrypted.Argon2Threads != Argon2Threads {
		t.Errorf("Argon2Threads: got %d, want %d", encrypted.Argon2Threads, Argon2Threads)
	}
}
