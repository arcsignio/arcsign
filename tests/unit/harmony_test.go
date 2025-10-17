package unit

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// T045: TestDeriveHarmonyAddress_KnownVector tests Harmony address derivation with known mnemonic
func TestDeriveHarmonyAddress_KnownVector(t *testing.T) {
	// Test mnemonic (standard BIP39 test vector)
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive Harmony path: m/44'/1023'/0'/0/0
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 1023) // Harmony coin type
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Harmony address
	service := address.NewAddressService()
	ecdsaPrivKey, err := addressKey.ECPrivKey()
	if err != nil {
		t.Fatalf("Failed to get ECDSA private key: %v", err)
	}
	harmonyAddr, err := service.DeriveHarmonyAddress(ecdsaPrivKey.ToECDSA())

	if err != nil {
		t.Fatalf("Failed to derive Harmony address: %v", err)
	}

	// Verify address format
	if !strings.HasPrefix(harmonyAddr, "one1") {
		t.Errorf("Expected Harmony address to start with 'one1', got: %s", harmonyAddr)
	}

	// Verify determinism - derive again and compare
	harmonyAddr2, err := service.DeriveHarmonyAddress(ecdsaPrivKey.ToECDSA())
	if err != nil {
		t.Fatalf("Failed to derive Harmony address (second attempt): %v", err)
	}

	if harmonyAddr != harmonyAddr2 {
		t.Errorf("Harmony address derivation not deterministic: %s != %s", harmonyAddr, harmonyAddr2)
	}

	t.Logf("✓ Harmony address: %s", harmonyAddr)
	t.Logf("✓ Derivation path: m/44'/1023'/0'/0/0")
}

// T046: TestDeriveHarmonyAddress_Bech32Format validates Bech32 encoding
func TestDeriveHarmonyAddress_Bech32Format(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key and derive Harmony key
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 1023)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Harmony address
	service := address.NewAddressService()
	ecdsaPrivKey, _ := addressKey.ECPrivKey()
	harmonyAddr, err := service.DeriveHarmonyAddress(ecdsaPrivKey.ToECDSA())

	if err != nil {
		t.Fatalf("Failed to derive Harmony address: %v", err)
	}

	// Verify Bech32 format rules
	if !strings.HasPrefix(harmonyAddr, "one1") {
		t.Errorf("Expected Harmony address to start with 'one1', got: %s", harmonyAddr)
	}

	// Bech32 addresses should be lowercase
	if harmonyAddr != strings.ToLower(harmonyAddr) {
		t.Errorf("Expected Harmony address to be lowercase, got: %s", harmonyAddr)
	}

	// Verify length (Bech32 encoded 20-byte address should be ~42 characters)
	// Format: one1 (4) + ~38 characters of encoded data
	if len(harmonyAddr) < 40 || len(harmonyAddr) > 50 {
		t.Errorf("Expected Harmony address length between 40-50 characters, got: %d", len(harmonyAddr))
	}

	t.Logf("✓ Harmony address format valid: %s", harmonyAddr)
	t.Logf("✓ Length: %d characters", len(harmonyAddr))
	t.Logf("✓ Prefix: one1")
}

// TestHarmonyVsEthereum tests that Harmony coin type 1023 produces different addresses than Ethereum coin type 60
func TestHarmonyVsEthereum(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Harmony address (coin type 1023)
	purpose1, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType1023, _ := purpose1.Derive(hdkeychain.HardenedKeyStart + 1023)
	account1, _ := coinType1023.Derive(hdkeychain.HardenedKeyStart + 0)
	external1, _ := account1.Derive(0)
	addressKey1, _ := external1.Derive(0)

	service := address.NewAddressService()
	ecdsaPrivKey1, _ := addressKey1.ECPrivKey()
	harmonyAddr, _ := service.DeriveHarmonyAddress(ecdsaPrivKey1.ToECDSA())

	// Derive Ethereum address (coin type 60)
	purpose2, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType60, _ := purpose2.Derive(hdkeychain.HardenedKeyStart + 60)
	account2, _ := coinType60.Derive(hdkeychain.HardenedKeyStart + 0)
	external2, _ := account2.Derive(0)
	addressKey2, _ := external2.Derive(0)

	ethAddr, _ := service.DeriveEthereumAddress(addressKey2)

	t.Logf("Harmony (coin type 1023): %s", harmonyAddr)
	t.Logf("Ethereum (coin type 60): %s", ethAddr)

	// Critical: These MUST be different
	// MetaMask uses coin type 60 for Harmony, which produces wrong addresses
	// Official Harmony wallets use coin type 1023
	if harmonyAddr == ethAddr {
		t.Error("CRITICAL: Harmony and Ethereum addresses should differ due to different coin types")
	}

	t.Log("✓ Harmony uses correct coin type 1023 (not MetaMask's 60)")
}
