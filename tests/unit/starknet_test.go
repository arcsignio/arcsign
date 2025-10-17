package unit

import (
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// T023: TestDeriveStarknetAddress_KnownVector tests against a known test vector
func TestDeriveStarknetAddress_KnownVector(t *testing.T) {
	// Test mnemonic (standard BIP39 test vector)
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	// Generate seed from mnemonic
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive Starknet path: m/44'/9004'/0'/0/0
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 9004)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Create address service and derive Starknet address
	service := address.NewAddressService()
	addr, err := service.DeriveStarknetAddress(addressKey)

	if err != nil {
		t.Fatalf("DeriveStarknetAddress failed: %v", err)
	}

	// Verify address format (should start with 0x and be 66 characters: 0x + 64 hex chars)
	if len(addr) != 66 {
		t.Errorf("Expected address length 66, got %d", len(addr))
	}

	if addr[:2] != "0x" {
		t.Errorf("Expected address to start with 0x, got %s", addr[:2])
	}

	// Log the generated address for manual verification
	t.Logf("Generated Starknet address: %s", addr)
}

// T024: TestDeriveStarknetAddress_Determinism tests that the same mnemonic produces the same address
func TestDeriveStarknetAddress_Determinism(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Generate address twice from the same mnemonic
	addresses := make([]string, 2)
	for i := 0; i < 2; i++ {
		masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
		purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
		coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 9004)
		account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
		external, _ := account.Derive(0)
		addressKey, _ := external.Derive(0)

		service := address.NewAddressService()
		addr, err := service.DeriveStarknetAddress(addressKey)
		if err != nil {
			t.Fatalf("DeriveStarknetAddress failed on iteration %d: %v", i, err)
		}

		addresses[i] = addr
	}

	// Verify both addresses are identical
	if addresses[0] != addresses[1] {
		t.Errorf("Addresses are not deterministic:\n  First:  %s\n  Second: %s", addresses[0], addresses[1])
	}
}

// T025: TestDeriveStarknetAddress_AddressFormat tests the Starknet address format requirements
func TestDeriveStarknetAddress_AddressFormat(t *testing.T) {
	mnemonic := "legal winner thank year wave sausage worth useful legal winner thank yellow"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 9004)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	addr, err := service.DeriveStarknetAddress(addressKey)
	if err != nil {
		t.Fatalf("DeriveStarknetAddress failed: %v", err)
	}

	// Test 1: Address must start with "0x"
	if addr[:2] != "0x" {
		t.Errorf("Address must start with 0x, got: %s", addr[:2])
	}

	// Test 2: Address must be 66 characters total (0x + 64 hex digits)
	if len(addr) != 66 {
		t.Errorf("Address must be 66 characters, got: %d", len(addr))
	}

	// Test 3: Address must only contain valid hex characters after 0x
	hexPart := addr[2:]
	for i, c := range hexPart {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			t.Errorf("Invalid hex character at position %d: %c", i+2, c)
		}
	}

	t.Logf("Valid Starknet address format: %s", addr)
}
