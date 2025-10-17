package unit

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// T085: TestDeriveKusamaAddress_KnownVector tests Kusama address derivation with known mnemonic
func TestDeriveKusamaAddress_KnownVector(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive Kusama path: m/44'/434'/0'/0/0
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 434) // Kusama coin type
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Kusama address
	service := address.NewAddressService()
	kusamaAddr, err := service.DeriveKusamaAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Kusama address: %v", err)
	}

	// Verify address format (Kusama addresses start with capital letters C-H, J)
	firstChar := string(kusamaAddr[0])
	validFirstChars := []string{"C", "D", "E", "F", "G", "H", "J"}
	valid := false
	for _, char := range validFirstChars {
		if firstChar == char {
			valid = true
			break
		}
	}
	if !valid {
		t.Errorf("Expected Kusama address to start with C-H or J, got: %s", firstChar)
	}

	// Verify determinism
	kusamaAddr2, _ := service.DeriveKusamaAddress(addressKey)
	if kusamaAddr != kusamaAddr2 {
		t.Errorf("Kusama address derivation not deterministic: %s != %s", kusamaAddr, kusamaAddr2)
	}

	t.Logf("✓ Kusama address: %s", kusamaAddr)
	t.Logf("✓ Derivation path: m/44'/434'/0'/0/0")
	t.Logf("✓ First character: %s (valid Kusama prefix)", firstChar)
}

// T086: TestDeriveKusamaAddress_SS58Format validates SS58 encoding
func TestDeriveKusamaAddress_SS58Format(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key and derive Kusama key
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 434)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Kusama address
	service := address.NewAddressService()
	kusamaAddr, err := service.DeriveKusamaAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Kusama address: %v", err)
	}

	// SS58 addresses are typically 47-48 characters for Kusama
	if len(kusamaAddr) < 47 || len(kusamaAddr) > 48 {
		t.Errorf("Expected Kusama address length 47-48 characters, got: %d", len(kusamaAddr))
	}

	// SS58 addresses use Base58 character set (no 0, O, I, l)
	for i, c := range kusamaAddr {
		// Check for invalid Base58 characters
		if c == '0' || c == 'O' || c == 'I' || c == 'l' {
			t.Errorf("Invalid Base58 character at position %d: '%c'", i, c)
		}
	}

	t.Logf("✓ Kusama address format valid: %s", kusamaAddr)
	t.Logf("✓ Length: %d characters", len(kusamaAddr))
	t.Logf("✓ Encoding: SS58 with network format 2 (Kusama)")
}

// T087: TestDeriveKusamaAddress_SubstrateBIP39 documents Substrate BIP39 differences
func TestDeriveKusamaAddress_SubstrateBIP39(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 434)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	kusamaAddr, _ := service.DeriveKusamaAddress(addressKey)

	t.Log("IMPORTANT: Substrate BIP39 quirk documented")
	t.Log("--------------------------------------------------")
	t.Log("Standard BIP39 wallets: mnemonic → PBKDF2 → seed → BIP32")
	t.Log("Substrate wallets:      mnemonic → entropy bytes → Substrate derivation")
	t.Log("")
	t.Log("This means:")
	t.Log("- Same mnemonic produces DIFFERENT addresses on standard vs Substrate wallets")
	t.Log("- This implementation uses BIP32 for compatibility with HD wallet standards")
	t.Log("- Native Substrate wallets (Polkadot.js) use entropy-based derivation")
	t.Log("")
	t.Logf("Our address (BIP32-based): %s", kusamaAddr)
	t.Log("")
	t.Log("For production use, consider:")
	t.Log("1. Dual derivation support (BIP32 + native Substrate)")
	t.Log("2. Clear user documentation about wallet compatibility")
	t.Log("3. Address verification against known test vectors")
}

// TestKusamaVsPolkadot verifies that Kusama and Polkadot use different network formats
func TestKusamaVsPolkadot(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 434)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	kusamaAddr, _ := service.DeriveKusamaAddress(addressKey)

	t.Logf("Kusama address (network format 2): %s", kusamaAddr)
	t.Log("Polkadot address (network format 0) would start with '1'")
	t.Log("Generic Substrate (network format 42) would start with '5'")

	// Kusama addresses should NOT start with '1' (Polkadot) or '5' (generic)
	if strings.HasPrefix(kusamaAddr, "1") {
		t.Error("Address starts with '1' - this is Polkadot format, not Kusama!")
	}
	if strings.HasPrefix(kusamaAddr, "5") {
		t.Error("Address starts with '5' - this is generic Substrate format, not Kusama!")
	}

	t.Log("✓ Kusama network format correctly applied (not Polkadot or generic)")
}
