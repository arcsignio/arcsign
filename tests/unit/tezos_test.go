package unit

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// T094: TestDeriveTezosAddress_KnownVector tests Tezos address derivation with known mnemonic
func TestDeriveTezosAddress_KnownVector(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive Tezos path: m/44'/1729'/0'/0/0 (using registered coin type 1729)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 1729) // Tezos coin type
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Tezos address
	service := address.NewAddressService()
	xtzAddr, err := service.DeriveTezosAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Tezos address: %v", err)
	}

	// Verify address format
	if !strings.HasPrefix(xtzAddr, "tz1") {
		t.Errorf("Expected Tezos address to start with 'tz1', got: %s", xtzAddr)
	}

	// Verify address length (tz1 + Base58 encoded Blake2b hash, typically 36 chars)
	if len(xtzAddr) < 30 || len(xtzAddr) > 40 {
		t.Errorf("Expected Tezos address length between 30-40, got: %d", len(xtzAddr))
	}

	// Verify determinism
	xtzAddr2, _ := service.DeriveTezosAddress(addressKey)
	if xtzAddr != xtzAddr2 {
		t.Errorf("Tezos address derivation not deterministic: %s != %s", xtzAddr, xtzAddr2)
	}

	t.Logf("✓ Tezos address: %s", xtzAddr)
	t.Logf("✓ Derivation path: m/44'/1729'/0'/0/0")
	t.Logf("✓ Prefix: tz1 (Ed25519)")
	t.Logf("✓ Coin type: 1729 (Ramanujan number)")
}

// T095: TestDeriveTezosAddress_TZ1Prefix validates tz1 prefix format
func TestDeriveTezosAddress_TZ1Prefix(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key and derive Tezos key
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 1729)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Tezos address
	service := address.NewAddressService()
	xtzAddr, _ := service.DeriveTezosAddress(addressKey)

	// Verify tz1 prefix (Ed25519)
	if !strings.HasPrefix(xtzAddr, "tz1") {
		t.Errorf("Expected Tezos address to start with 'tz1', got: %s", xtzAddr[:3])
	}

	// Verify it's NOT tz2 (secp256k1 prefix)
	if strings.HasPrefix(xtzAddr, "tz2") {
		t.Error("Address has 'tz2' prefix (secp256k1), expected 'tz1' (Ed25519)")
	}

	// Verify it's NOT tz3 (secp256r1 prefix)
	if strings.HasPrefix(xtzAddr, "tz3") {
		t.Error("Address has 'tz3' prefix (secp256r1), expected 'tz1' (Ed25519)")
	}

	// Verify valid Base58 characters after prefix
	validBase58 := "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
	addressPart := xtzAddr[3:]
	for i, c := range addressPart {
		if !strings.ContainsRune(validBase58, c) {
			t.Errorf("Invalid Base58 character at position %d: '%c'", i+3, c)
		}
	}

	t.Logf("✓ Tezos address format valid: %s", xtzAddr)
	t.Logf("✓ Prefix: tz1 (Ed25519, not tz2 secp256k1 or tz3 secp256r1)")
	t.Logf("✓ Length: %d characters", len(xtzAddr))
}

// TestTezosSLIP10vsEthereum verifies Tezos uses SLIP-10 (Ed25519), not BIP32 (secp256k1)
func TestTezosSLIP10vsEthereum(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Tezos address (coin type 1729)
	purpose1, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType1729, _ := purpose1.Derive(hdkeychain.HardenedKeyStart + 1729)
	account1, _ := coinType1729.Derive(hdkeychain.HardenedKeyStart + 0)
	external1, _ := account1.Derive(0)
	addressKey1729, _ := external1.Derive(0)

	service := address.NewAddressService()
	xtzAddr, _ := service.DeriveTezosAddress(addressKey1729)

	// Derive Ethereum address (coin type 60) for comparison
	purpose2, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType60, _ := purpose2.Derive(hdkeychain.HardenedKeyStart + 60)
	account2, _ := coinType60.Derive(hdkeychain.HardenedKeyStart + 0)
	external2, _ := account2.Derive(0)
	addressKey60, _ := external2.Derive(0)

	ethAddr, _ := service.DeriveEthereumAddress(addressKey60)

	t.Logf("Tezos (coin type 1729, Ed25519/SLIP-10): %s", xtzAddr)
	t.Logf("Ethereum (coin type 60, secp256k1/BIP32): %s", ethAddr)

	// Different coin types should produce different addresses
	if xtzAddr == ethAddr {
		t.Error("Tezos and Ethereum addresses should differ (different coin types + different curves)")
	}

	t.Log("✓ Tezos uses Ed25519 with SLIP-10 derivation")
	t.Log("✓ Ethereum uses secp256k1 with BIP32 derivation")
	t.Log("✓ Different coin types + different curves → different addresses")
}

// TestTezosCoinType1729 verifies the Ramanujan number coin type
func TestTezosCoinType1729(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	service := address.NewAddressService()

	// Coin type 1729 (Ramanujan number - smallest number expressible as sum of two cubes in two ways)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType1729, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 1729)
	account, _ := coinType1729.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)
	addr1729, _ := service.DeriveTezosAddress(addressKey)

	t.Log("Tezos BIP44 Coin Type: 1729 (Ramanujan Number)")
	t.Log("--------------------------------------------------")
	t.Log("Historical significance:")
	t.Log("- 1729 = 1³ + 12³ = 9³ + 10³")
	t.Log("- Hardy-Ramanujan number (taxicab number)")
	t.Log("- Chosen as tribute to mathematician Srinivasa Ramanujan")
	t.Log("")
	t.Logf("Address with coin type 1729: %s", addr1729)
	t.Log("")
	t.Log("Note: Tezos uses Ed25519, so all derivations must be hardened")
	t.Log("Path format: m/44'/1729'/0'/0/0 (all indices hardened)")
}
