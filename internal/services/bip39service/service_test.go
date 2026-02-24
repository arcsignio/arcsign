package bip39service

import (
	"strings"
	"testing"
)

func newService() *BIP39Service {
	return NewBIP39Service()
}

func TestGenerateMnemonic_12Words(t *testing.T) {
	svc := newService()

	mnemonic, err := svc.GenerateMnemonic(12)
	if err != nil {
		t.Fatalf("GenerateMnemonic(12) failed: %v", err)
	}

	words := strings.Fields(mnemonic)
	if len(words) != 12 {
		t.Errorf("expected 12 words, got %d", len(words))
	}
}

func TestGenerateMnemonic_24Words(t *testing.T) {
	svc := newService()

	mnemonic, err := svc.GenerateMnemonic(24)
	if err != nil {
		t.Fatalf("GenerateMnemonic(24) failed: %v", err)
	}

	words := strings.Fields(mnemonic)
	if len(words) != 24 {
		t.Errorf("expected 24 words, got %d", len(words))
	}
}

func TestGenerateMnemonic_InvalidWordCount(t *testing.T) {
	svc := newService()

	invalidCounts := []int{0, 1, 6, 15, 18, 48}
	for _, count := range invalidCounts {
		_, err := svc.GenerateMnemonic(count)
		if err == nil {
			t.Errorf("GenerateMnemonic(%d) should fail, but succeeded", count)
		}
	}
}

func TestGenerateMnemonic_Uniqueness(t *testing.T) {
	svc := newService()

	m1, err := svc.GenerateMnemonic(12)
	if err != nil {
		t.Fatalf("first generation failed: %v", err)
	}

	m2, err := svc.GenerateMnemonic(12)
	if err != nil {
		t.Fatalf("second generation failed: %v", err)
	}

	if m1 == m2 {
		t.Error("two consecutive GenerateMnemonic calls produced identical mnemonics")
	}
}

func TestValidateMnemonic_Valid12(t *testing.T) {
	svc := newService()

	// Standard BIP39 test vector (all-zeros entropy)
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	if err := svc.ValidateMnemonic(mnemonic); err != nil {
		t.Errorf("valid 12-word mnemonic rejected: %v", err)
	}
}

func TestValidateMnemonic_Valid24(t *testing.T) {
	svc := newService()

	// Generate a valid 24-word mnemonic to test validation
	mnemonic, err := svc.GenerateMnemonic(24)
	if err != nil {
		t.Fatalf("failed to generate 24-word mnemonic: %v", err)
	}

	if err := svc.ValidateMnemonic(mnemonic); err != nil {
		t.Errorf("valid 24-word mnemonic rejected: %v", err)
	}
}

func TestValidateMnemonic_Empty(t *testing.T) {
	svc := newService()

	if err := svc.ValidateMnemonic(""); err == nil {
		t.Error("empty mnemonic should be rejected")
	}
}

func TestValidateMnemonic_WhitespaceOnly(t *testing.T) {
	svc := newService()

	if err := svc.ValidateMnemonic("   "); err == nil {
		t.Error("whitespace-only mnemonic should be rejected")
	}
}

func TestValidateMnemonic_InvalidWord(t *testing.T) {
	svc := newService()

	// Replace one valid word with a non-BIP39 word
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon notaword"

	if err := svc.ValidateMnemonic(mnemonic); err == nil {
		t.Error("mnemonic with non-BIP39 word should be rejected")
	}
}

func TestValidateMnemonic_BadChecksum(t *testing.T) {
	svc := newService()

	// Valid words but wrong checksum (last word changed)
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zoo"

	if err := svc.ValidateMnemonic(mnemonic); err == nil {
		t.Error("mnemonic with bad checksum should be rejected")
	}
}

func TestValidateMnemonic_WhitespaceHandling(t *testing.T) {
	svc := newService()

	// Leading/trailing whitespace should be handled
	mnemonic := "  abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about  "

	if err := svc.ValidateMnemonic(mnemonic); err != nil {
		t.Errorf("mnemonic with leading/trailing whitespace should be accepted: %v", err)
	}
}

func TestValidateMnemonic_GeneratedMnemonicIsValid(t *testing.T) {
	svc := newService()

	// Generate and immediately validate
	mnemonic, err := svc.GenerateMnemonic(12)
	if err != nil {
		t.Fatalf("generation failed: %v", err)
	}

	if err := svc.ValidateMnemonic(mnemonic); err != nil {
		t.Errorf("generated mnemonic failed validation: %v", err)
	}
}

func TestMnemonicToSeed_ValidMnemonic(t *testing.T) {
	svc := newService()

	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	seed, err := svc.MnemonicToSeed(mnemonic, "")
	if err != nil {
		t.Fatalf("MnemonicToSeed failed: %v", err)
	}

	if len(seed) != 64 {
		t.Errorf("seed length: got %d, want 64", len(seed))
	}

	// Seed should not be all zeros
	allZero := true
	for _, b := range seed {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		t.Error("seed is all zeros")
	}
}

func TestMnemonicToSeed_WithPassphrase(t *testing.T) {
	svc := newService()

	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	seedNoPass, err := svc.MnemonicToSeed(mnemonic, "")
	if err != nil {
		t.Fatalf("MnemonicToSeed without passphrase failed: %v", err)
	}

	seedWithPass, err := svc.MnemonicToSeed(mnemonic, "my-secret-passphrase")
	if err != nil {
		t.Fatalf("MnemonicToSeed with passphrase failed: %v", err)
	}

	if len(seedNoPass) != 64 || len(seedWithPass) != 64 {
		t.Errorf("unexpected seed lengths: %d and %d", len(seedNoPass), len(seedWithPass))
	}

	// Seeds with and without passphrase MUST differ
	same := true
	for i := range seedNoPass {
		if seedNoPass[i] != seedWithPass[i] {
			same = false
			break
		}
	}
	if same {
		t.Error("seeds with and without passphrase should differ")
	}
}

func TestMnemonicToSeed_Deterministic(t *testing.T) {
	svc := newService()

	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	seed1, err := svc.MnemonicToSeed(mnemonic, "")
	if err != nil {
		t.Fatalf("first seed derivation failed: %v", err)
	}

	seed2, err := svc.MnemonicToSeed(mnemonic, "")
	if err != nil {
		t.Fatalf("second seed derivation failed: %v", err)
	}

	for i := range seed1 {
		if seed1[i] != seed2[i] {
			t.Fatalf("seed derivation is not deterministic: byte %d differs", i)
		}
	}
}

func TestMnemonicToSeed_InvalidMnemonic(t *testing.T) {
	svc := newService()

	_, err := svc.MnemonicToSeed("invalid words here not bip39", "")
	if err == nil {
		t.Fatal("MnemonicToSeed should fail with invalid mnemonic")
	}
}

func TestGetWordlist_Returns2048(t *testing.T) {
	svc := newService()

	wordlist := svc.GetWordlist()
	if len(wordlist) != 2048 {
		t.Errorf("wordlist length: got %d, want 2048", len(wordlist))
	}
}

func TestGetWordlist_ContainsKnownWords(t *testing.T) {
	svc := newService()

	wordlist := svc.GetWordlist()
	wordSet := make(map[string]bool, len(wordlist))
	for _, w := range wordlist {
		wordSet[w] = true
	}

	knownWords := []string{"abandon", "ability", "able", "about", "zoo"}
	for _, w := range knownWords {
		if !wordSet[w] {
			t.Errorf("expected word %q not in wordlist", w)
		}
	}
}
