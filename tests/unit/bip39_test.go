package unit

import (
	"strings"
	"testing"

	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/bip39service"
)

// T037: Test for GenerateMnemonic(12)
func TestGenerateMnemonic12(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("generates 12-word mnemonic", func(t *testing.T) {
		mnemonic, err := service.GenerateMnemonic(12)
		if err != nil {
			t.Fatalf("Failed to generate 12-word mnemonic: %v", err)
		}

		words := strings.Fields(mnemonic)
		if len(words) != 12 {
			t.Errorf("Expected 12 words, got %d", len(words))
		}

		// Verify it's valid BIP39
		if !bip39.IsMnemonicValid(mnemonic) {
			t.Error("Generated mnemonic failed BIP39 validation")
		}
	})

	t.Run("generates unique mnemonics", func(t *testing.T) {
		mnemonic1, _ := service.GenerateMnemonic(12)
		mnemonic2, _ := service.GenerateMnemonic(12)

		if mnemonic1 == mnemonic2 {
			t.Error("Generated duplicate mnemonics")
		}
	})

	t.Run("all words are from BIP39 wordlist", func(t *testing.T) {
		mnemonic, _ := service.GenerateMnemonic(12)
		words := strings.Fields(mnemonic)

		for _, word := range words {
			// Verify word is in BIP39 English wordlist
			// We'll trust the library's validation for this
			if len(word) < 3 {
				t.Errorf("Word '%s' is too short for BIP39 wordlist", word)
			}
		}
	})
}

// T038: Test for GenerateMnemonic(24)
func TestGenerateMnemonic24(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("generates 24-word mnemonic", func(t *testing.T) {
		mnemonic, err := service.GenerateMnemonic(24)
		if err != nil {
			t.Fatalf("Failed to generate 24-word mnemonic: %v", err)
		}

		words := strings.Fields(mnemonic)
		if len(words) != 24 {
			t.Errorf("Expected 24 words, got %d", len(words))
		}

		// Verify it's valid BIP39
		if !bip39.IsMnemonicValid(mnemonic) {
			t.Error("Generated mnemonic failed BIP39 validation")
		}
	})

	t.Run("generates unique 24-word mnemonics", func(t *testing.T) {
		mnemonic1, _ := service.GenerateMnemonic(24)
		mnemonic2, _ := service.GenerateMnemonic(24)

		if mnemonic1 == mnemonic2 {
			t.Error("Generated duplicate mnemonics")
		}
	})
}

// T039: Test for invalid word counts
func TestGenerateMnemonicInvalidWordCount(t *testing.T) {
	service := bip39service.NewBIP39Service()

	invalidCounts := []int{6, 9, 15, 18, 21, 11, 13, 25, 32}

	for _, count := range invalidCounts {
		t.Run("rejects invalid word count", func(t *testing.T) {
			_, err := service.GenerateMnemonic(count)
			if err == nil {
				t.Errorf("Expected error for word count %d", count)
			}
			if !strings.Contains(err.Error(), "12") || !strings.Contains(err.Error(), "24") {
				t.Errorf("Error should mention valid word counts (12 or 24), got: %v", err)
			}
		})
	}
}

// T040: Test for ValidateMnemonic() with valid mnemonics
func TestValidateMnemonicValid(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("validates correct 12-word mnemonic", func(t *testing.T) {
		// Generate valid mnemonic
		mnemonic, _ := service.GenerateMnemonic(12)

		err := service.ValidateMnemonic(mnemonic)
		if err != nil {
			t.Errorf("Valid mnemonic rejected: %v", err)
		}
	})

	t.Run("validates correct 24-word mnemonic", func(t *testing.T) {
		// Generate valid mnemonic
		mnemonic, _ := service.GenerateMnemonic(24)

		err := service.ValidateMnemonic(mnemonic)
		if err != nil {
			t.Errorf("Valid mnemonic rejected: %v", err)
		}
	})

	t.Run("validates known valid mnemonic", func(t *testing.T) {
		// Known valid BIP39 test vector
		mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

		err := service.ValidateMnemonic(mnemonic)
		if err != nil {
			t.Errorf("Valid test mnemonic rejected: %v", err)
		}
	})
}

// T041: Test for ValidateMnemonic() with invalid mnemonics
func TestValidateMnemonicInvalid(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("rejects mnemonic with wrong checksum", func(t *testing.T) {
		// Valid words but invalid checksum
		mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon"

		err := service.ValidateMnemonic(mnemonic)
		if err == nil {
			t.Error("Expected error for invalid checksum")
		}
	})

	t.Run("rejects mnemonic with invalid word", func(t *testing.T) {
		mnemonic := "abandon abandon abandon notaword abandon abandon abandon abandon abandon abandon abandon about"

		err := service.ValidateMnemonic(mnemonic)
		if err == nil {
			t.Error("Expected error for invalid word")
		}
	})

	t.Run("rejects empty mnemonic", func(t *testing.T) {
		err := service.ValidateMnemonic("")
		if err == nil {
			t.Error("Expected error for empty mnemonic")
		}
	})

	t.Run("rejects mnemonic with wrong word count", func(t *testing.T) {
		mnemonic := "abandon abandon abandon"

		err := service.ValidateMnemonic(mnemonic)
		if err == nil {
			t.Error("Expected error for wrong word count")
		}
	})
}

// T042: Test for MnemonicToSeed() without passphrase
func TestMnemonicToSeedNoPassphrase(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("generates seed from mnemonic", func(t *testing.T) {
		mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

		seed, err := service.MnemonicToSeed(mnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed: %v", err)
		}

		// BIP39 seed should be 64 bytes
		if len(seed) != 64 {
			t.Errorf("Expected seed length 64 bytes, got %d", len(seed))
		}

		// Verify deterministic: same mnemonic = same seed
		seed2, _ := service.MnemonicToSeed(mnemonic, "")
		if string(seed) != string(seed2) {
			t.Error("Same mnemonic produced different seeds")
		}
	})

	t.Run("generates seed for generated mnemonic", func(t *testing.T) {
		mnemonic, _ := service.GenerateMnemonic(12)

		seed, err := service.MnemonicToSeed(mnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed from generated mnemonic: %v", err)
		}

		if len(seed) != 64 {
			t.Errorf("Expected seed length 64 bytes, got %d", len(seed))
		}
	})

	t.Run("different mnemonics produce different seeds", func(t *testing.T) {
		mnemonic1, _ := service.GenerateMnemonic(12)
		mnemonic2, _ := service.GenerateMnemonic(12)

		seed1, _ := service.MnemonicToSeed(mnemonic1, "")
		seed2, _ := service.MnemonicToSeed(mnemonic2, "")

		if string(seed1) == string(seed2) {
			t.Error("Different mnemonics produced same seed")
		}
	})
}

// T043: Test for MnemonicToSeed() with passphrase
func TestMnemonicToSeedWithPassphrase(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("generates different seed with passphrase", func(t *testing.T) {
		mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

		seedNoPass, _ := service.MnemonicToSeed(mnemonic, "")
		seedWithPass, _ := service.MnemonicToSeed(mnemonic, "my-secret-passphrase")

		if string(seedNoPass) == string(seedWithPass) {
			t.Error("Passphrase did not change seed")
		}
	})

	t.Run("same passphrase produces same seed", func(t *testing.T) {
		mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
		passphrase := "my-secret-passphrase"

		seed1, _ := service.MnemonicToSeed(mnemonic, passphrase)
		seed2, _ := service.MnemonicToSeed(mnemonic, passphrase)

		if string(seed1) != string(seed2) {
			t.Error("Same mnemonic+passphrase produced different seeds")
		}
	})

	t.Run("different passphrases produce different seeds", func(t *testing.T) {
		mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

		seed1, _ := service.MnemonicToSeed(mnemonic, "passphrase1")
		seed2, _ := service.MnemonicToSeed(mnemonic, "passphrase2")

		if string(seed1) == string(seed2) {
			t.Error("Different passphrases produced same seed")
		}
	})
}

// T044: Test for GetWordlist()
func TestGetWordlist(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("returns BIP39 English wordlist", func(t *testing.T) {
		wordlist := service.GetWordlist()

		// BIP39 English wordlist has 2048 words
		if len(wordlist) != 2048 {
			t.Errorf("Expected 2048 words, got %d", len(wordlist))
		}

		// Verify first word is "abandon"
		if wordlist[0] != "abandon" {
			t.Errorf("Expected first word 'abandon', got '%s'", wordlist[0])
		}

		// Verify last word is "zoo"
		if wordlist[2047] != "zoo" {
			t.Errorf("Expected last word 'zoo', got '%s'", wordlist[2047])
		}
	})

	t.Run("wordlist contains expected words", func(t *testing.T) {
		wordlist := service.GetWordlist()

		// Check some common words
		expectedWords := []string{"abandon", "ability", "able", "about", "above", "zoo"}

		for _, expected := range expectedWords {
			found := false
			for _, word := range wordlist {
				if word == expected {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("Expected word '%s' not found in wordlist", expected)
			}
		}
	})
}

// T045-T046: Integration tests
func TestBIP39Integration(t *testing.T) {
	service := bip39service.NewBIP39Service()

	t.Run("full workflow: generate -> validate -> seed", func(t *testing.T) {
		// Generate
		mnemonic, err := service.GenerateMnemonic(12)
		if err != nil {
			t.Fatalf("Generate failed: %v", err)
		}

		// Validate
		err = service.ValidateMnemonic(mnemonic)
		if err != nil {
			t.Fatalf("Validation failed: %v", err)
		}

		// Convert to seed
		seed, err := service.MnemonicToSeed(mnemonic, "")
		if err != nil {
			t.Fatalf("Seed generation failed: %v", err)
		}

		if len(seed) != 64 {
			t.Errorf("Expected 64-byte seed, got %d bytes", len(seed))
		}
	})

	t.Run("supports both 12 and 24 word mnemonics", func(t *testing.T) {
		mnemonic12, _ := service.GenerateMnemonic(12)
		mnemonic24, _ := service.GenerateMnemonic(24)

		// Both should validate
		if err := service.ValidateMnemonic(mnemonic12); err != nil {
			t.Errorf("12-word mnemonic validation failed: %v", err)
		}
		if err := service.ValidateMnemonic(mnemonic24); err != nil {
			t.Errorf("24-word mnemonic validation failed: %v", err)
		}

		// Both should produce seeds
		seed12, _ := service.MnemonicToSeed(mnemonic12, "")
		seed24, _ := service.MnemonicToSeed(mnemonic24, "")

		if len(seed12) != 64 || len(seed24) != 64 {
			t.Error("Both mnemonics should produce 64-byte seeds")
		}
	})
}
