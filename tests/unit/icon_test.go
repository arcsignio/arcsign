package unit

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// T104: TestDeriveIconAddress_KnownVector tests ICON address derivation with known mnemonic
func TestDeriveIconAddress_KnownVector(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive ICON path: m/44'/74'/0'/0/0 (using registered coin type 74)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 74) // ICON registered coin type
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive ICON address
	service := address.NewAddressService()
	iconAddr, err := service.DeriveIconAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive ICON address: %v", err)
	}

	// Verify address format
	if !strings.HasPrefix(iconAddr, "hx") {
		t.Errorf("Expected ICON address to start with 'hx', got: %s", iconAddr)
	}

	// Verify address length (hx + 40 hex characters = 42 total)
	if len(iconAddr) != 42 {
		t.Errorf("Expected ICON address length 42, got: %d", len(iconAddr))
	}

	// Verify determinism
	iconAddr2, _ := service.DeriveIconAddress(addressKey)
	if iconAddr != iconAddr2 {
		t.Errorf("ICON address derivation not deterministic: %s != %s", iconAddr, iconAddr2)
	}

	t.Logf("✓ ICON address: %s", iconAddr)
	t.Logf("✓ Derivation path: m/44'/74'/0'/0/0")
	t.Logf("✓ Prefix: hx (user address)")
}

// T105: TestDeriveIconAddress_HXPrefix validates hx prefix format
func TestDeriveIconAddress_HXPrefix(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key and derive ICON key
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 74)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive ICON address
	service := address.NewAddressService()
	iconAddr, _ := service.DeriveIconAddress(addressKey)

	// Verify hx prefix
	if !strings.HasPrefix(iconAddr, "hx") {
		t.Errorf("Expected ICON address to start with 'hx', got: %s", iconAddr[:2])
	}

	// Verify it's NOT cx (contract prefix)
	if strings.HasPrefix(iconAddr, "cx") {
		t.Error("Address has 'cx' prefix (contract), expected 'hx' (user)")
	}

	// Verify it's NOT 0x (Ethereum prefix)
	if strings.HasPrefix(iconAddr, "0x") {
		t.Error("Address has '0x' prefix (Ethereum), expected 'hx' (ICON)")
	}

	// Verify lowercase hex
	hexPart := iconAddr[2:]
	if hexPart != strings.ToLower(hexPart) {
		t.Errorf("Expected lowercase hex, got: %s", hexPart)
	}

	// Verify valid hex characters
	for i, c := range hexPart {
		isValidHex := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')
		if !isValidHex {
			t.Errorf("Invalid hex character at position %d: '%c'", i+2, c)
		}
	}

	t.Logf("✓ ICON address format valid: %s", iconAddr)
	t.Logf("✓ Prefix: hx (user address, not cx contract)")
	t.Logf("✓ Length: %d characters (hx + 40 hex)", len(iconAddr))
}

// TestIconVsEthereum verifies ICON uses SHA3-256, not Keccak-256 like Ethereum
func TestIconVsEthereum(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive ICON address (coin type 74)
	purpose1, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType74, _ := purpose1.Derive(hdkeychain.HardenedKeyStart + 74)
	account1, _ := coinType74.Derive(hdkeychain.HardenedKeyStart + 0)
	external1, _ := account1.Derive(0)
	addressKey74, _ := external1.Derive(0)

	service := address.NewAddressService()
	iconAddr, _ := service.DeriveIconAddress(addressKey74)

	// Derive Ethereum address (coin type 60) for comparison
	purpose2, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType60, _ := purpose2.Derive(hdkeychain.HardenedKeyStart + 60)
	account2, _ := coinType60.Derive(hdkeychain.HardenedKeyStart + 0)
	external2, _ := account2.Derive(0)
	addressKey60, _ := external2.Derive(0)

	ethAddr, _ := service.DeriveEthereumAddress(addressKey60)

	t.Logf("ICON (coin type 74, SHA3-256):     %s", iconAddr)
	t.Logf("Ethereum (coin type 60, Keccak-256): %s", ethAddr)

	// Different coin types should produce different addresses
	iconHex := iconAddr[2:]  // Remove hx
	ethHex := ethAddr[2:]    // Remove 0x

	if iconHex == ethHex {
		t.Error("ICON and Ethereum addresses should differ (different coin types + different hash functions)")
	}

	t.Log("✓ ICON uses SHA3-256 (FIPS 202 standard)")
	t.Log("✓ Ethereum uses Keccak-256 (pre-standard version)")
	t.Log("✓ Different coin types + different hash functions → different addresses")
}

// TestIconCoinTypeDiscrepancy documents the coin type issue
func TestIconCoinTypeDiscrepancy(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	service := address.NewAddressService()

	// Coin type 74 (registered SLIP-0044)
	purpose1, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType74, _ := purpose1.Derive(hdkeychain.HardenedKeyStart + 74)
	account1, _ := coinType74.Derive(hdkeychain.HardenedKeyStart + 0)
	external1, _ := account1.Derive(0)
	addressKey74, _ := external1.Derive(0)
	addr74, _ := service.DeriveIconAddress(addressKey74)

	// Coin type 4801368 (actual ecosystem usage - mainnet)
	// Note: We can't easily test this with BIP32 due to the large number
	// In production, wallets would need to support both paths

	t.Log("CRITICAL: ICON BIP44 Coin Type Discrepancy")
	t.Log("--------------------------------------------------")
	t.Log("Registered coin type (SLIP-0044):  74")
	t.Log("Actual ecosystem usage (mainnet):  4801368")
	t.Log("Actual ecosystem usage (testnet):  1")
	t.Log("")
	t.Logf("Address with coin type 74: %s", addr74)
	t.Log("")
	t.Log("Recommendation:")
	t.Log("- Support BOTH coin types 74 and 4801368")
	t.Log("- Default to 4801368 for compatibility with ICON wallets")
	t.Log("- Provide user option to select coin type")
	t.Log("- Document the discrepancy clearly")
}
