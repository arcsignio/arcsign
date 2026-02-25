/**
 * Application configuration storage with encryption
 * Feature: App-level authentication and configuration storage
 *
 * Handles encryption/decryption of app_config.enc using:
 * - Argon2id for password derivation
 * - AES-256-GCM for encryption
 * - Salt stored in the encrypted file
 */

package app

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/argon2"
)

const (
	// AppConfigFileName is the name of the encrypted config file
	AppConfigFileName = "app_config.enc"

	// Argon2id parameters — aligned with mnemonic encryption (crypto/encryption.go)
	Argon2Time    = 4
	Argon2Memory  = 256 * 1024 // 256 MiB
	Argon2Threads = 4
	Argon2KeyLen  = 32

	// Legacy Argon2 parameters (for migration of old app_config.enc files)
	legacyArgon2Time   uint32 = 1
	legacyArgon2Memory uint32 = 64 * 1024
)

// EncryptedConfig represents the structure of app_config.enc file
type EncryptedConfig struct {
	Salt       string `json:"salt"`       // Base64-encoded salt for Argon2id
	Nonce      string `json:"nonce"`      // Base64-encoded nonce for AES-GCM
	Ciphertext string `json:"ciphertext"` // Base64-encoded encrypted data
}

// AppConfigExists checks if app_config.enc exists at the given USB path
func AppConfigExists(usbPath string) bool {
	configPath := filepath.Join(usbPath, AppConfigFileName)
	_, err := os.Stat(configPath)
	return err == nil
}

// InitializeAppConfig creates a new encrypted app_config.enc file
// This should be called on first-time setup
func InitializeAppConfig(password, usbPath string) error {
	// Create new AppConfig
	config := NewAppConfig()

	// Save encrypted config
	return SaveAppConfig(config, password, usbPath)
}

// LoadAppConfig loads and decrypts app_config.enc
// Supports transparent migration from legacy Argon2 parameters (Time=1, Memory=64MB)
// to current parameters (Time=4, Memory=256MB).
func LoadAppConfig(password, usbPath string) (*AppConfig, error) {
	configPath := filepath.Join(usbPath, AppConfigFileName)

	// Read encrypted file
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read app config: %w", err)
	}

	// Parse encrypted config structure
	var encConfig EncryptedConfig
	if err := json.Unmarshal(data, &encConfig); err != nil {
		return nil, fmt.Errorf("failed to parse app config: %w", err)
	}

	// Decode base64 fields
	salt, err := base64.StdEncoding.DecodeString(encConfig.Salt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode salt: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(encConfig.Nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to decode nonce: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encConfig.Ciphertext)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	// Try current (strong) parameters first
	config, err := tryDecryptAppConfig(password, salt, nonce, ciphertext, Argon2Time, Argon2Memory)
	if err == nil {
		return config, nil
	}

	// Fallback: try legacy parameters for migration
	config, legacyErr := tryDecryptAppConfig(password, salt, nonce, ciphertext, legacyArgon2Time, legacyArgon2Memory)
	if legacyErr != nil {
		// Neither worked — password is incorrect
		return nil, fmt.Errorf("failed to decrypt app config (incorrect password?): %w", err)
	}

	// Migration: re-encrypt with strong parameters
	fmt.Fprintf(os.Stderr, "[Security] Migrating app_config.enc to stronger Argon2 parameters\n")
	if saveErr := SaveAppConfig(config, password, usbPath); saveErr != nil {
		fmt.Fprintf(os.Stderr, "[Security] Warning: failed to re-encrypt with new parameters: %v\n", saveErr)
	}

	return config, nil
}

// tryDecryptAppConfig attempts to decrypt with specific Argon2 parameters
func tryDecryptAppConfig(password string, salt, nonce, ciphertext []byte, argon2Time, argon2Memory uint32) (*AppConfig, error) {
	key := argon2.IDKey([]byte(password), salt, argon2Time, argon2Memory, Argon2Threads, Argon2KeyLen)
	defer func() {
		for i := range key {
			key[i] = 0
		}
	}()

	plaintext, err := decryptAESGCM(key, nonce, ciphertext)
	if err != nil {
		return nil, err
	}
	defer func() {
		for i := range plaintext {
			plaintext[i] = 0
		}
	}()

	config, err := FromJSON(plaintext)
	if err != nil {
		return nil, err
	}

	return config, nil
}

// SaveAppConfig encrypts and saves AppConfig to app_config.enc
func SaveAppConfig(config *AppConfig, password, usbPath string) error {
	// Serialize config to JSON
	plaintext, err := config.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to serialize config: %w", err)
	}
	defer func() {
		// Clear plaintext from memory
		for i := range plaintext {
			plaintext[i] = 0
		}
	}()

	// Generate salt
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return fmt.Errorf("failed to generate salt: %w", err)
	}

	// Derive key from password
	key := argon2.IDKey([]byte(password), salt, Argon2Time, Argon2Memory, Argon2Threads, Argon2KeyLen)
	defer func() {
		// Clear key from memory
		for i := range key {
			key[i] = 0
		}
	}()

	// Encrypt data
	nonce, ciphertext, err := encryptAESGCM(key, plaintext)
	if err != nil {
		return fmt.Errorf("failed to encrypt config: %w", err)
	}

	// Create encrypted config structure
	encConfig := EncryptedConfig{
		Salt:       base64.StdEncoding.EncodeToString(salt),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}

	// Serialize encrypted config
	encData, err := json.MarshalIndent(encConfig, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize encrypted config: %w", err)
	}

	// Write to file
	configPath := filepath.Join(usbPath, AppConfigFileName)
	if err := os.WriteFile(configPath, encData, 0600); err != nil {
		return fmt.Errorf("failed to write app config: %w", err)
	}

	return nil
}

// VerifyAppPassword verifies the password by attempting to decrypt app_config.enc
// Uses constant-time behavior to prevent timing side-channel attacks.
func VerifyAppPassword(password, usbPath string) error {
	const minDuration = 200 * time.Millisecond
	start := time.Now()
	_, err := LoadAppConfig(password, usbPath)
	// Ensure constant timing regardless of success/failure
	elapsed := time.Since(start)
	if elapsed < minDuration {
		time.Sleep(minDuration - elapsed)
	}
	return err
}

// encryptAESGCM encrypts plaintext using AES-256-GCM
func encryptAESGCM(key, plaintext []byte) (nonce, ciphertext []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, err
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return nonce, ciphertext, nil
}

// decryptAESGCM decrypts ciphertext using AES-256-GCM
func decryptAESGCM(key, nonce, ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(nonce) != gcm.NonceSize() {
		return nil, errors.New("invalid nonce size")
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// ComputePasswordHash computes SHA-256 hash of password for verification
// Note: This is NOT used for encryption, only for quick password verification
func ComputePasswordHash(password string) string {
	hash := sha256.Sum256([]byte(password))
	return base64.StdEncoding.EncodeToString(hash[:])
}
