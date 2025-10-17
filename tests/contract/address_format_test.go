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
