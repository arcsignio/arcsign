package unit

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// Test mnemonic for all tests
const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

// T055: TestDeriveCosmosAddress_CustomPrefix tests the generic prefix functionality
func TestDeriveCosmosAddress_CustomPrefix(t *testing.T) {
	seed := bip39.NewSeed(testMnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Cosmos Hub address (coin type 118)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 118)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	cosmosAddr, err := service.DeriveCosmosAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Cosmos address: %v", err)
	}

	// Verify Cosmos Hub prefix
	if !strings.HasPrefix(cosmosAddr, "cosmos1") {
		t.Errorf("Expected Cosmos address to start with 'cosmos1', got: %s", cosmosAddr)
	}

	t.Logf("✓ Cosmos Hub address: %s", cosmosAddr)
	t.Logf("✓ Derivation path: m/44'/118'/0'/0/0")
}

// T056: TestDeriveOsmosisAddress tests Osmosis address derivation
func TestDeriveOsmosisAddress(t *testing.T) {
	seed := bip39.NewSeed(testMnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Osmosis address (coin type 118)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 118)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	osmoAddr, err := service.DeriveOsmosisAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Osmosis address: %v", err)
	}

	// Verify Osmosis prefix
	if !strings.HasPrefix(osmoAddr, "osmo1") {
		t.Errorf("Expected Osmosis address to start with 'osmo1', got: %s", osmoAddr)
	}

	// Verify determinism
	osmoAddr2, _ := service.DeriveOsmosisAddress(addressKey)
	if osmoAddr != osmoAddr2 {
		t.Errorf("Osmosis address derivation not deterministic: %s != %s", osmoAddr, osmoAddr2)
	}

	t.Logf("✓ Osmosis address: %s", osmoAddr)
	t.Logf("✓ Prefix: osmo1")
	t.Logf("✓ Deterministic: YES")
}

// T057: TestDeriveJunoAddress tests Juno address derivation
func TestDeriveJunoAddress(t *testing.T) {
	seed := bip39.NewSeed(testMnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Juno address (coin type 118)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 118)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	junoAddr, err := service.DeriveJunoAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Juno address: %v", err)
	}

	// Verify Juno prefix
	if !strings.HasPrefix(junoAddr, "juno1") {
		t.Errorf("Expected Juno address to start with 'juno1', got: %s", junoAddr)
	}

	// Verify determinism
	junoAddr2, _ := service.DeriveJunoAddress(addressKey)
	if junoAddr != junoAddr2 {
		t.Errorf("Juno address derivation not deterministic: %s != %s", junoAddr, junoAddr2)
	}

	t.Logf("✓ Juno address: %s", junoAddr)
	t.Logf("✓ Prefix: juno1")
	t.Logf("✓ Deterministic: YES")
}

// T058: TestDeriveEvmosAddress_DualFormat tests Evmos address derivation
func TestDeriveEvmosAddress_DualFormat(t *testing.T) {
	seed := bip39.NewSeed(testMnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Evmos address (coin type 60 - EVM compatible)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 60)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	evmosAddr, err := service.DeriveEvmosAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Evmos address: %v", err)
	}

	// Verify Evmos Cosmos format prefix
	if !strings.HasPrefix(evmosAddr, "evmos1") {
		t.Errorf("Expected Evmos address to start with 'evmos1', got: %s", evmosAddr)
	}

	// Verify determinism
	evmosAddr2, _ := service.DeriveEvmosAddress(addressKey)
	if evmosAddr != evmosAddr2 {
		t.Errorf("Evmos address derivation not deterministic: %s != %s", evmosAddr, evmosAddr2)
	}

	t.Logf("✓ Evmos address (Cosmos format): %s", evmosAddr)
	t.Logf("✓ Prefix: evmos1")
	t.Logf("✓ Coin type: 60 (EVM compatible)")
	t.Logf("✓ Note: Evmos also supports Ethereum 0x format")
}

// T059: TestDeriveSecretAddress tests Secret Network address derivation
func TestDeriveSecretAddress(t *testing.T) {
	seed := bip39.NewSeed(testMnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Secret Network address (coin type 529)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 529)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	secretAddr, err := service.DeriveSecretAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Secret Network address: %v", err)
	}

	// Verify Secret Network prefix
	if !strings.HasPrefix(secretAddr, "secret1") {
		t.Errorf("Expected Secret Network address to start with 'secret1', got: %s", secretAddr)
	}

	// Verify determinism
	secretAddr2, _ := service.DeriveSecretAddress(addressKey)
	if secretAddr != secretAddr2 {
		t.Errorf("Secret Network address derivation not deterministic: %s != %s", secretAddr, secretAddr2)
	}

	t.Logf("✓ Secret Network address: %s", secretAddr)
	t.Logf("✓ Prefix: secret1")
	t.Logf("✓ Coin type: 529")
	t.Logf("✓ Deterministic: YES")
}

// TestCosmosAddresses_SameSeed_DifferentPrefixes verifies that same seed produces different addresses for different chains
func TestCosmosAddresses_SameSeed_DifferentPrefixes(t *testing.T) {
	seed := bip39.NewSeed(testMnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive same derivation path for Cosmos Hub and Osmosis (both use coin type 118)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType118, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 118)
	account, _ := coinType118.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	service := address.NewAddressService()
	cosmosAddr, _ := service.DeriveCosmosAddress(addressKey)
	osmoAddr, _ := service.DeriveOsmosisAddress(addressKey)
	junoAddr, _ := service.DeriveJunoAddress(addressKey)

	t.Logf("Same derivation path (m/44'/118'/0'/0/0):")
	t.Logf("  Cosmos Hub: %s", cosmosAddr)
	t.Logf("  Osmosis:    %s", osmoAddr)
	t.Logf("  Juno:       %s", junoAddr)

	// Extract the hex part (after prefix)
	cosmosHex := cosmosAddr[strings.Index(cosmosAddr, "1")+1:]
	osmoHex := osmoAddr[strings.Index(osmoAddr, "1")+1:]
	junoHex := junoAddr[strings.Index(junoAddr, "1")+1:]

	// The hex part should be IDENTICAL (only prefix differs)
	if cosmosHex != osmoHex || osmoHex != junoHex {
		t.Errorf("Expected same hex part for chains with coin type 118, got different values")
	}

	// But full addresses should differ due to prefix
	if cosmosAddr == osmoAddr || osmoAddr == junoAddr || cosmosAddr == junoAddr {
		t.Error("Expected different full addresses due to different prefixes")
	}

	t.Log("✓ Same seed + same coin type → same hex part, different prefixes")
}

// TestCosmosAddresses_DifferentCoinTypes verifies coin type isolation
func TestCosmosAddresses_DifferentCoinTypes(t *testing.T) {
	seed := bip39.NewSeed(testMnemonic, "")
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	service := address.NewAddressService()

	// Cosmos Hub (coin type 118)
	purpose1, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType118, _ := purpose1.Derive(hdkeychain.HardenedKeyStart + 118)
	account1, _ := coinType118.Derive(hdkeychain.HardenedKeyStart + 0)
	external1, _ := account1.Derive(0)
	addressKey118, _ := external1.Derive(0)
	cosmosAddr, _ := service.DeriveCosmosAddress(addressKey118)

	// Evmos (coin type 60)
	purpose2, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType60, _ := purpose2.Derive(hdkeychain.HardenedKeyStart + 60)
	account2, _ := coinType60.Derive(hdkeychain.HardenedKeyStart + 0)
	external2, _ := account2.Derive(0)
	addressKey60, _ := external2.Derive(0)
	evmosAddr, _ := service.DeriveEvmosAddress(addressKey60)

	// Secret Network (coin type 529)
	purpose3, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType529, _ := purpose3.Derive(hdkeychain.HardenedKeyStart + 529)
	account3, _ := coinType529.Derive(hdkeychain.HardenedKeyStart + 0)
	external3, _ := account3.Derive(0)
	addressKey529, _ := external3.Derive(0)
	secretAddr, _ := service.DeriveSecretAddress(addressKey529)

	t.Logf("Different coin types produce different addresses:")
	t.Logf("  Cosmos (118):  %s", cosmosAddr)
	t.Logf("  Evmos (60):    %s", evmosAddr)
	t.Logf("  Secret (529):  %s", secretAddr)

	// Extract hex parts
	cosmosHex := cosmosAddr[strings.Index(cosmosAddr, "1")+1:]
	evmosHex := evmosAddr[strings.Index(evmosAddr, "1")+1:]
	secretHex := secretAddr[strings.Index(secretAddr, "1")+1:]

	// Different coin types MUST produce different hex parts
	if cosmosHex == evmosHex || evmosHex == secretHex || cosmosHex == secretHex {
		t.Error("Expected different hex parts for different coin types")
	}

	t.Log("✓ Different coin types → different addresses (proper BIP44 isolation)")
}
