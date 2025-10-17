package contract

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// T034: TestAddressFormat_Starknet validates Starknet address format compliance
func TestAddressFormat_Starknet(t *testing.T) {
	// Setup
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive Starknet key path: m/44'/9004'/0'/0/0
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 9004)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Generate Starknet address
	service := address.NewAddressService()
	addr, err := service.DeriveStarknetAddress(addressKey)
	if err != nil {
		t.Fatalf("DeriveStarknetAddress failed: %v", err)
	}

	// Contract Test 1: Address must start with "0x"
	if !strings.HasPrefix(addr, "0x") {
		t.Errorf("Contract violation: Starknet address must start with '0x', got: %s", addr)
	}

	// Contract Test 2: Address must be exactly 66 characters (0x + 64 hex digits)
	if len(addr) != 66 {
		t.Errorf("Contract violation: Starknet address must be 66 characters, got: %d", len(addr))
	}

	// Contract Test 3: Address must contain only valid hexadecimal characters after "0x"
	hexPart := addr[2:]
	for i, c := range hexPart {
		isValidHex := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
		if !isValidHex {
			t.Errorf("Contract violation: Invalid hex character at position %d: '%c' (0x%02X)", i+2, c, c)
		}
	}

	// Contract Test 4: Address must be lowercase (Starknet standard)
	lowerAddr := strings.ToLower(addr)
	if addr != lowerAddr {
		t.Errorf("Contract violation: Starknet address should be lowercase, got mixed case: %s", addr)
	}

	// Contract Test 5: Verify determinism - same input produces same output
	addr2, err := service.DeriveStarknetAddress(addressKey)
	if err != nil {
		t.Fatalf("Second DeriveStarknetAddress call failed: %v", err)
	}
	if addr != addr2 {
		t.Errorf("Contract violation: Determinism failed. First: %s, Second: %s", addr, addr2)
	}

	// Contract Test 6: Different derivation paths must produce different addresses
	differentKey, _ := external.Derive(1) // m/44'/9004'/0'/0/1
	addr3, err := service.DeriveStarknetAddress(differentKey)
	if err != nil {
		t.Fatalf("DeriveStarknetAddress with different index failed: %v", err)
	}
	if addr == addr3 {
		t.Errorf("Contract violation: Different derivation paths produced same address: %s", addr)
	}

	t.Logf("Starknet address format contract tests passed:")
	t.Logf("  Address: %s", addr)
	t.Logf("  Length: %d characters", len(addr))
	t.Logf("  Format: 0x + 64 hex digits")
	t.Logf("  Deterministic: ✓")
	t.Logf("  Unique per path: ✓")
}

// T052: TestAddressFormat_Harmony validates Harmony address format compliance
func TestAddressFormat_Harmony(t *testing.T) {
	// Setup
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive Harmony key path: m/44'/1023'/0'/0/0
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 1023)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Generate Harmony address
	service := address.NewAddressService()
	ecdsaPrivKey, _ := addressKey.ECPrivKey()
	addr, err := service.DeriveHarmonyAddress(ecdsaPrivKey.ToECDSA())
	if err != nil {
		t.Fatalf("DeriveHarmonyAddress failed: %v", err)
	}

	// Contract Test 1: Address must start with "one1"
	if !strings.HasPrefix(addr, "one1") {
		t.Errorf("Contract violation: Harmony address must start with 'one1', got: %s", addr)
	}

	// Contract Test 2: Address must be lowercase (Bech32 standard)
	lowerAddr := strings.ToLower(addr)
	if addr != lowerAddr {
		t.Errorf("Contract violation: Harmony address must be lowercase, got mixed case: %s", addr)
	}

	// Contract Test 3: Address length should be 42 characters (one1 + 38 Bech32 encoded)
	if len(addr) < 40 || len(addr) > 50 {
		t.Errorf("Contract violation: Harmony address length should be ~42 characters, got: %d", len(addr))
	}

	// Contract Test 4: Address must contain only valid Bech32 characters (alphanumeric lowercase, excluding "1", "b", "i", "o")
	validBech32Chars := "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
	for i, c := range addr[4:] { // Skip "one1" prefix
		if !strings.ContainsRune(validBech32Chars, c) {
			t.Errorf("Contract violation: Invalid Bech32 character at position %d: '%c'", i+4, c)
		}
	}

	// Contract Test 5: Verify determinism - same input produces same output
	addr2, err := service.DeriveHarmonyAddress(ecdsaPrivKey.ToECDSA())
	if err != nil {
		t.Fatalf("Second DeriveHarmonyAddress call failed: %v", err)
	}
	if addr != addr2 {
		t.Errorf("Contract violation: Determinism failed. First: %s, Second: %s", addr, addr2)
	}

	// Contract Test 6: Different derivation paths must produce different addresses
	differentKey, _ := external.Derive(1) // m/44'/1023'/0'/0/1
	differentPrivKey, _ := differentKey.ECPrivKey()
	addr3, err := service.DeriveHarmonyAddress(differentPrivKey.ToECDSA())
	if err != nil {
		t.Fatalf("DeriveHarmonyAddress with different index failed: %v", err)
	}
	if addr == addr3 {
		t.Errorf("Contract violation: Different derivation paths produced same address: %s", addr)
	}

	// Contract Test 7: Harmony coin type 1023 vs Ethereum coin type 60 must produce different addresses
	ethPurpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	ethCoinType, _ := ethPurpose.Derive(hdkeychain.HardenedKeyStart + 60) // Ethereum
	ethAccount, _ := ethCoinType.Derive(hdkeychain.HardenedKeyStart + 0)
	ethExternal, _ := ethAccount.Derive(0)
	ethAddressKey, _ := ethExternal.Derive(0)
	ethPrivKey, _ := ethAddressKey.ECPrivKey()
	ethHarmonyAddr, _ := service.DeriveHarmonyAddress(ethPrivKey.ToECDSA())

	if addr == ethHarmonyAddr {
		t.Errorf("Contract violation: Harmony coin type 1023 and Ethereum coin type 60 produced same address (MetaMask issue)")
	}

	t.Logf("Harmony address format contract tests passed:")
	t.Logf("  Address: %s", addr)
	t.Logf("  Length: %d characters", len(addr))
	t.Logf("  Format: one1 + Bech32 encoded")
	t.Logf("  Deterministic: ✓")
	t.Logf("  Unique per path: ✓")
	t.Logf("  Correct coin type (1023, not 60): ✓")
}
