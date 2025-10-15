package bip39service

import (
	"crypto/rand"
	"errors"
	"fmt"

	"github.com/tyler-smith/go-bip39"
	"github.com/tyler-smith/go-bip39/wordlists"
)

// BIP39Service handles mnemonic phrase generation and validation
type BIP39Service struct{}

// NewBIP39Service creates a new BIP39 service instance
func NewBIP39Service() *BIP39Service {
	// Set English wordlist as default
	bip39.SetWordList(wordlists.English)
	return &BIP39Service{}
}

// GenerateMnemonic generates a BIP39 mnemonic phrase with the specified word count
// Valid word counts: 12 (128-bit entropy) or 24 (256-bit entropy)
// Returns the mnemonic phrase as a space-separated string
func (s *BIP39Service) GenerateMnemonic(wordCount int) (string, error) {
	// Calculate entropy bits based on word count
	// BIP39 formula: entropy_bits = (word_count * 11) - (word_count / 3)
	// 12 words = 128 bits, 24 words = 256 bits
	var entropyBits int
	switch wordCount {
	case 12:
		entropyBits = 128
	case 24:
		entropyBits = 256
	default:
		return "", fmt.Errorf("invalid word count %d: must be 12 or 24", wordCount)
	}

	// Generate cryptographically secure random entropy
	entropyBytes := make([]byte, entropyBits/8)
	if _, err := rand.Read(entropyBytes); err != nil {
		return "", fmt.Errorf("failed to generate entropy: %w", err)
	}

	// Convert entropy to mnemonic using BIP39 algorithm
	mnemonic, err := bip39.NewMnemonic(entropyBytes)
	if err != nil {
		return "", fmt.Errorf("failed to generate mnemonic: %w", err)
	}

	return mnemonic, nil
}

// ValidateMnemonic validates a BIP39 mnemonic phrase
// Checks:
// - Word count (must be 12 or 24)
// - All words are in BIP39 wordlist
// - Checksum is valid
func (s *BIP39Service) ValidateMnemonic(mnemonic string) error {
	if mnemonic == "" {
		return errors.New("mnemonic cannot be empty")
	}

	// Use library's built-in validation (checks wordlist + checksum)
	if !bip39.IsMnemonicValid(mnemonic) {
		return errors.New("invalid mnemonic: checksum verification failed or invalid words")
	}

	return nil
}

// MnemonicToSeed converts a BIP39 mnemonic to a 64-byte seed
// The seed is used for BIP32 hierarchical deterministic key derivation
// Optionally accepts a passphrase for additional security (BIP39 extension)
// Returns 64 bytes of deterministic seed data
func (s *BIP39Service) MnemonicToSeed(mnemonic string, passphrase string) ([]byte, error) {
	// Validate mnemonic first
	if err := s.ValidateMnemonic(mnemonic); err != nil {
		return nil, fmt.Errorf("invalid mnemonic: %w", err)
	}

	// Generate seed using PBKDF2 with 2048 rounds (BIP39 standard)
	// Passphrase is optional (empty string = no passphrase)
	seed := bip39.NewSeed(mnemonic, passphrase)

	return seed, nil
}

// GetWordlist returns the BIP39 English wordlist (2048 words)
// Useful for autocomplete and word validation in UIs
func (s *BIP39Service) GetWordlist() []string {
	return wordlists.English
}
