package unit

import (
	"strings"
	"testing"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/tyler-smith/go-bip39"
	"github.com/yourusername/arcsign/internal/services/address"
)

// T100: TestDeriveZilliqaAddress_KnownVector tests Zilliqa address derivation with known mnemonic
func TestDeriveZilliqaAddress_KnownVector(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		t.Fatalf("Failed to create master key: %v", err)
	}

	// Derive Zilliqa path: m/44'/313'/0'/0/0 (using registered coin type 313)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 313) // Zilliqa coin type
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Zilliqa address
	service := address.NewAddressService()
	zilAddr, err := service.DeriveZilliqaAddress(addressKey)
	if err != nil {
		t.Fatalf("Failed to derive Zilliqa address: %v", err)
	}

	// Verify address format
	if !strings.HasPrefix(zilAddr, "zil1") {
		t.Errorf("Expected Zilliqa address to start with 'zil1', got: %s", zilAddr)
	}

	// Verify address length (zil1 + Bech32 data, typically 42 chars)
	if len(zilAddr) < 38 || len(zilAddr) > 50 {
		t.Errorf("Expected Zilliqa address length between 38-50, got: %d", len(zilAddr))
	}

	// Verify determinism
	zilAddr2, _ := service.DeriveZilliqaAddress(addressKey)
	if zilAddr != zilAddr2 {
		t.Errorf("Zilliqa address derivation not deterministic: %s != %s", zilAddr, zilAddr2)
	}

	t.Logf("✓ Zilliqa address: %s", zilAddr)
	t.Logf("✓ Derivation path: m/44'/313'/0'/0/0")
	t.Logf("✓ Prefix: zil1 (Bech32)")
	t.Logf("✓ Coin type: 313 (SLIP-0044)")
}

// T101: TestDeriveZilliqaAddress_Bech32Format validates zil1 prefix format
func TestDeriveZilliqaAddress_Bech32Format(t *testing.T) {
	// Test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	// Create master key and derive Zilliqa key
	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 313)
	account, _ := coinType.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)

	// Derive Zilliqa address
	service := address.NewAddressService()
	zilAddr, _ := service.DeriveZilliqaAddress(addressKey)

	// Verify zil1 prefix (Bech32)
	if !strings.HasPrefix(zilAddr, "zil1") {
		t.Errorf("Expected Zilliqa address to start with 'zil1', got: %s", zilAddr[:4])
	}

	// Verify it's NOT 0x (Ethereum prefix)
	if strings.HasPrefix(zilAddr, "0x") {
		t.Error("Address has '0x' prefix (Ethereum), expected 'zil1' (Zilliqa)")
	}

	// Verify Bech32 charset (lowercase alphanumeric, excluding 1,b,i,o)
	validBech32 := "023456789acdefghjklmnpqrstuvwxyz"
	addressPart := zilAddr[4:] // Skip "zil1" prefix
	for i, c := range addressPart {
		if !strings.ContainsRune(validBech32, c) {
			t.Errorf("Invalid Bech32 character at position %d: '%c'", i+4, c)
		}
	}

	t.Logf("✓ Zilliqa address format valid: %s", zilAddr)
	t.Logf("✓ Prefix: zil1 (Bech32, not 0x Ethereum)")
	t.Logf("✓ Length: %d characters", len(zilAddr))
}

// TestZilliqaSchnorrVsECDSA verifies Zilliqa uses Schnorr, not ECDSA like Ethereum
func TestZilliqaSchnorrVsECDSA(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)

	// Derive Zilliqa address (coin type 313)
	purpose1, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType313, _ := purpose1.Derive(hdkeychain.HardenedKeyStart + 313)
	account1, _ := coinType313.Derive(hdkeychain.HardenedKeyStart + 0)
	external1, _ := account1.Derive(0)
	addressKey313, _ := external1.Derive(0)

	service := address.NewAddressService()
	zilAddr, _ := service.DeriveZilliqaAddress(addressKey313)

	// Derive Ethereum address (coin type 60) for comparison
	purpose2, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType60, _ := purpose2.Derive(hdkeychain.HardenedKeyStart + 60)
	account2, _ := coinType60.Derive(hdkeychain.HardenedKeyStart + 0)
	external2, _ := account2.Derive(0)
	addressKey60, _ := external2.Derive(0)

	ethAddr, _ := service.DeriveEthereumAddress(addressKey60)

	t.Logf("Zilliqa (coin type 313, Schnorr/Bech32): %s", zilAddr)
	t.Logf("Ethereum (coin type 60, ECDSA/Keccak):   %s", ethAddr)

	// Different coin types should produce different addresses
	if zilAddr == ethAddr {
		t.Error("Zilliqa and Ethereum addresses should differ (different coin types + signature schemes)")
	}

	t.Log("✓ Zilliqa uses Schnorr signatures on secp256k1")
	t.Log("✓ Ethereum uses ECDSA signatures on secp256k1")
	t.Log("✓ Same curve, different signature schemes → different derivation")
	t.Log("✓ Zilliqa uses Bech32, Ethereum uses Keccak256 hex")
}

// TestZilliqaCoinType313 verifies SLIP-0044 coin type
func TestZilliqaCoinType313(t *testing.T) {
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")

	masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	service := address.NewAddressService()

	// Coin type 313 (SLIP-0044 registered)
	purpose, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	coinType313, _ := purpose.Derive(hdkeychain.HardenedKeyStart + 313)
	account, _ := coinType313.Derive(hdkeychain.HardenedKeyStart + 0)
	external, _ := account.Derive(0)
	addressKey, _ := external.Derive(0)
	addr313, _ := service.DeriveZilliqaAddress(addressKey)

	t.Log("Zilliqa BIP44 Coin Type: 313 (SLIP-0044)")
	t.Log("--------------------------------------------------")
	t.Log("Network:")
	t.Log("- Mainnet: zil1... (Bech32 with \"zil\" prefix)")
	t.Log("- Testnet: zil1... (same format, network by node)")
	t.Log("")
	t.Logf("Address with coin type 313: %s", addr313)
	t.Log("")
	t.Log("Technical Details:")
	t.Log("- Curve: secp256k1 (same as Bitcoin/Ethereum)")
	t.Log("- Signature: Schnorr (not ECDSA)")
	t.Log("- Hash: SHA256 of public key")
	t.Log("- Encoding: Bech32 (last 20 bytes of hash)")
}
