package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"

	"github.com/yourusername/arcsign/internal/models"
	"golang.org/x/crypto/argon2"
)

const (
	// Argon2id parameters (OWASP-compliant)
	Argon2Time    = 4          // iterations
	Argon2Memory  = 256 * 1024 // 256 MiB in KiB
	Argon2Threads = 4          // threads
	Argon2KeyLen  = 32         // 256-bit key for AES-256
	Argon2SaltLen = 16         // 128-bit salt
	AESNonceLen   = 12         // 96-bit nonce for GCM
)

// EncryptMnemonic encrypts a mnemonic using Argon2id + AES-256-GCM
func EncryptMnemonic(mnemonic, password string) (*models.EncryptedMnemonic, error) {
	// Generate random salt
	salt := make([]byte, Argon2SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	// Derive key using Argon2id
	key := argon2.IDKey([]byte(password), salt, Argon2Time, Argon2Memory, Argon2Threads, Argon2KeyLen)
	defer ClearBytes(key)

	// Create AES-256 cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce
	nonce := make([]byte, AESNonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt and authenticate
	plaintext := []byte(mnemonic)
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	// Clear plaintext from memory
	ClearBytes(plaintext)

	return &models.EncryptedMnemonic{
		Salt:          salt,
		Nonce:         nonce,
		Ciphertext:    ciphertext, // Includes 16-byte authentication tag
		Argon2Time:    Argon2Time,
		Argon2Memory:  Argon2Memory,
		Argon2Threads: Argon2Threads,
		Version:       1,
	}, nil
}

// DecryptMnemonic decrypts an encrypted mnemonic using the provided password
func DecryptMnemonic(encrypted *models.EncryptedMnemonic, password string) (string, error) {
	// Validate encrypted data
	if encrypted == nil {
		return "", errors.New("encrypted data is nil")
	}
	if len(encrypted.Salt) != Argon2SaltLen {
		return "", fmt.Errorf("invalid salt length: got %d, want %d", len(encrypted.Salt), Argon2SaltLen)
	}
	if len(encrypted.Nonce) != AESNonceLen {
		return "", fmt.Errorf("invalid nonce length: got %d, want %d", len(encrypted.Nonce), AESNonceLen)
	}

	// Re-derive key using Argon2id
	key := argon2.IDKey(
		[]byte(password),
		encrypted.Salt,
		encrypted.Argon2Time,
		encrypted.Argon2Memory,
		encrypted.Argon2Threads,
		Argon2KeyLen,
	)
	defer ClearBytes(key)

	// Create AES-256 cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Decrypt and verify authentication tag
	plaintext, err := gcm.Open(nil, encrypted.Nonce, encrypted.Ciphertext, nil)
	if err != nil {
		return "", errors.New("authentication failed: wrong password or corrupted data")
	}
	defer ClearBytes(plaintext)

	return string(plaintext), nil
}

// SerializeEncryptedData serializes EncryptedMnemonic to binary format
// Format: [version:1][time:4][memory:4][threads:1][salt:16][nonce:12][ciphertext:variable]
func SerializeEncryptedData(encrypted *models.EncryptedMnemonic) []byte {
	// Calculate total size
	size := 1 + 4 + 4 + 1 + len(encrypted.Salt) + len(encrypted.Nonce) + len(encrypted.Ciphertext)
	result := make([]byte, size)

	offset := 0

	// Version (1 byte)
	result[offset] = encrypted.Version
	offset++

	// Argon2Time (4 bytes, big-endian)
	binary.BigEndian.PutUint32(result[offset:], encrypted.Argon2Time)
	offset += 4

	// Argon2Memory (4 bytes, big-endian)
	binary.BigEndian.PutUint32(result[offset:], encrypted.Argon2Memory)
	offset += 4

	// Argon2Threads (1 byte)
	result[offset] = encrypted.Argon2Threads
	offset++

	// Salt (16 bytes)
	copy(result[offset:], encrypted.Salt)
	offset += len(encrypted.Salt)

	// Nonce (12 bytes)
	copy(result[offset:], encrypted.Nonce)
	offset += len(encrypted.Nonce)

	// Ciphertext (variable + 16-byte auth tag)
	copy(result[offset:], encrypted.Ciphertext)

	return result
}

// DeserializeEncryptedData deserializes binary data to EncryptedMnemonic
func DeserializeEncryptedData(data []byte) (*models.EncryptedMnemonic, error) {
	// Minimum size: 1 + 4 + 4 + 1 + 16 + 12 = 38 bytes
	minSize := 1 + 4 + 4 + 1 + Argon2SaltLen + AESNonceLen
	if len(data) < minSize {
		return nil, fmt.Errorf("invalid encrypted data: size %d < minimum %d", len(data), minSize)
	}

	offset := 0

	// Version (1 byte)
	version := data[offset]
	offset++

	// Argon2Time (4 bytes, big-endian)
	argon2Time := binary.BigEndian.Uint32(data[offset:])
	offset += 4

	// Argon2Memory (4 bytes, big-endian)
	argon2Memory := binary.BigEndian.Uint32(data[offset:])
	offset += 4

	// Argon2Threads (1 byte)
	argon2Threads := data[offset]
	offset++

	// Salt (16 bytes)
	salt := make([]byte, Argon2SaltLen)
	copy(salt, data[offset:offset+Argon2SaltLen])
	offset += Argon2SaltLen

	// Nonce (12 bytes)
	nonce := make([]byte, AESNonceLen)
	copy(nonce, data[offset:offset+AESNonceLen])
	offset += AESNonceLen

	// Ciphertext (remaining bytes)
	ciphertext := make([]byte, len(data)-offset)
	copy(ciphertext, data[offset:])

	return &models.EncryptedMnemonic{
		Salt:          salt,
		Nonce:         nonce,
		Ciphertext:    ciphertext,
		Argon2Time:    argon2Time,
		Argon2Memory:  argon2Memory,
		Argon2Threads: argon2Threads,
		Version:       version,
	}, nil
}

// Encrypt encrypts arbitrary data using Argon2id + AES-256-GCM
// Returns serialized encrypted data compatible with Decrypt
func Encrypt(data []byte, password string) ([]byte, error) {
	// Convert to string for EncryptMnemonic (works with any data, not just mnemonics)
	dataStr := string(data)
	encrypted, err := EncryptMnemonic(dataStr, password)
	if err != nil {
		return nil, err
	}
	return SerializeEncryptedData(encrypted), nil
}

// Decrypt decrypts data encrypted with Encrypt function
// Returns decrypted plaintext data
func Decrypt(encryptedData []byte, password string) ([]byte, error) {
	// Deserialize encrypted data
	encrypted, err := DeserializeEncryptedData(encryptedData)
	if err != nil {
		return nil, err
	}

	// Decrypt
	decrypted, err := DecryptMnemonic(encrypted, password)
	if err != nil {
		return nil, err
	}

	return []byte(decrypted), nil
}
