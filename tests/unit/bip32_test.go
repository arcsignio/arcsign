package unit

import (
	"fmt"
	"strings"
	"testing"

	"github.com/yourusername/arcsign/internal/services/hdkey"
)

// T076: Test for NewMasterKey() - derive master key from seed
func TestNewMasterKey(t *testing.T) {
	service := hdkey.NewHDKeyService()

	t.Run("derives master key from valid seed", func(t *testing.T) {
		// Generate a test seed (64 bytes)
		seed := make([]byte, 64)
		for i := range seed {
			seed[i] = byte(i)
		}

		masterKey, err := service.NewMasterKey(seed)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		if masterKey == nil {
			t.Error("Master key should not be nil")
		}
	})

	t.Run("fails with invalid seed length", func(t *testing.T) {
		// Too short (less than 16 bytes)
		shortSeed := make([]byte, 8)
		_, err := service.NewMasterKey(shortSeed)
		if err == nil {
			t.Error("Expected error for short seed")
		}

		// Too long (more than 64 bytes)
		longSeed := make([]byte, 128)
		_, err = service.NewMasterKey(longSeed)
		if err == nil {
			t.Error("Expected error for long seed")
		}
	})

	t.Run("produces different keys for different seeds", func(t *testing.T) {
		seed1 := make([]byte, 64)
		seed2 := make([]byte, 64)
		for i := range seed2 {
			seed2[i] = byte(i + 1)
		}

		key1, _ := service.NewMasterKey(seed1)
		key2, _ := service.NewMasterKey(seed2)

		// Keys should be different
		if key1.String() == key2.String() {
			t.Error("Different seeds should produce different master keys")
		}
	})
}

// T077: Test for DerivePath() - BIP32 path derivation
func TestDerivePath(t *testing.T) {
	service := hdkey.NewHDKeyService()

	seed := make([]byte, 64)
	for i := range seed {
		seed[i] = byte(i)
	}
	masterKey, _ := service.NewMasterKey(seed)

	t.Run("derives valid BIP44 Bitcoin path", func(t *testing.T) {
		// m/44'/0'/0'/0/0 - Bitcoin, account 0, external, address 0
		path := "m/44'/0'/0'/0/0"

		derivedKey, err := service.DerivePath(masterKey, path)
		if err != nil {
			t.Fatalf("Failed to derive path: %v", err)
		}

		if derivedKey == nil {
			t.Error("Derived key should not be nil")
		}
	})

	t.Run("derives valid BIP44 Ethereum path", func(t *testing.T) {
		// m/44'/60'/0'/0/0 - Ethereum, account 0, external, address 0
		path := "m/44'/60'/0'/0/0"

		derivedKey, err := service.DerivePath(masterKey, path)
		if err != nil {
			t.Fatalf("Failed to derive path: %v", err)
		}

		if derivedKey == nil {
			t.Error("Derived key should not be nil")
		}
	})

	t.Run("fails with invalid path format", func(t *testing.T) {
		invalidPaths := []string{
			"invalid",            // Not a number
			"m/44'/abc'/0'/0/0", // Invalid number
		}

		for _, path := range invalidPaths {
			_, err := service.DerivePath(masterKey, path)
			if err == nil {
				t.Errorf("Expected error for invalid path: %s", path)
			}
		}
	})

	t.Run("different paths produce different keys", func(t *testing.T) {
		path1 := "m/44'/0'/0'/0/0"
		path2 := "m/44'/0'/0'/0/1"

		key1, _ := service.DerivePath(masterKey, path1)
		key2, _ := service.DerivePath(masterKey, path2)

		if key1.String() == key2.String() {
			t.Error("Different paths should produce different keys")
		}
	})
}

// T078: Test for GetPublicKey() - extract public key
func TestGetPublicKey(t *testing.T) {
	service := hdkey.NewHDKeyService()

	seed := make([]byte, 64)
	masterKey, _ := service.NewMasterKey(seed)
	derivedKey, _ := service.DerivePath(masterKey, "m/44'/0'/0'/0/0")

	t.Run("extracts public key from derived key", func(t *testing.T) {
		pubKey, err := service.GetPublicKey(derivedKey)
		if err != nil {
			t.Fatalf("Failed to get public key: %v", err)
		}

		if len(pubKey) == 0 {
			t.Error("Public key should not be empty")
		}

		// Compressed public keys are 33 bytes
		if len(pubKey) != 33 {
			t.Errorf("Expected 33-byte compressed public key, got %d bytes", len(pubKey))
		}
	})

	t.Run("public key is deterministic", func(t *testing.T) {
		pubKey1, _ := service.GetPublicKey(derivedKey)
		pubKey2, _ := service.GetPublicKey(derivedKey)

		if string(pubKey1) != string(pubKey2) {
			t.Error("Same key should produce same public key")
		}
	})
}

// T079: Test for GetPrivateKey() - extract private key
func TestGetPrivateKey(t *testing.T) {
	service := hdkey.NewHDKeyService()

	seed := make([]byte, 64)
	masterKey, _ := service.NewMasterKey(seed)
	derivedKey, _ := service.DerivePath(masterKey, "m/44'/0'/0'/0/0")

	t.Run("extracts private key from derived key", func(t *testing.T) {
		privKey, err := service.GetPrivateKey(derivedKey)
		if err != nil {
			t.Fatalf("Failed to get private key: %v", err)
		}

		if len(privKey) == 0 {
			t.Error("Private key should not be empty")
		}

		// Private keys are 32 bytes
		if len(privKey) != 32 {
			t.Errorf("Expected 32-byte private key, got %d bytes", len(privKey))
		}
	})

	t.Run("private key is deterministic", func(t *testing.T) {
		privKey1, _ := service.GetPrivateKey(derivedKey)
		privKey2, _ := service.GetPrivateKey(derivedKey)

		if string(privKey1) != string(privKey2) {
			t.Error("Same key should produce same private key")
		}
	})

	t.Run("different keys have different private keys", func(t *testing.T) {
		key1, _ := service.DerivePath(masterKey, "m/44'/0'/0'/0/0")
		key2, _ := service.DerivePath(masterKey, "m/44'/0'/0'/0/1")

		privKey1, _ := service.GetPrivateKey(key1)
		privKey2, _ := service.GetPrivateKey(key2)

		if string(privKey1) == string(privKey2) {
			t.Error("Different keys should have different private keys")
		}
	})
}

// T080: Test for GetExtendedPublicKey() - xpub
func TestGetExtendedPublicKey(t *testing.T) {
	service := hdkey.NewHDKeyService()

	seed := make([]byte, 64)
	masterKey, _ := service.NewMasterKey(seed)

	t.Run("gets extended public key", func(t *testing.T) {
		xpub, err := service.GetExtendedPublicKey(masterKey)
		if err != nil {
			t.Fatalf("Failed to get extended public key: %v", err)
		}

		// xpub starts with "xpub"
		if !strings.HasPrefix(xpub, "xpub") {
			t.Errorf("Expected xpub to start with 'xpub', got: %s", xpub[:4])
		}
	})

	t.Run("xpub is deterministic", func(t *testing.T) {
		xpub1, _ := service.GetExtendedPublicKey(masterKey)
		xpub2, _ := service.GetExtendedPublicKey(masterKey)

		if xpub1 != xpub2 {
			t.Error("Same key should produce same xpub")
		}
	})
}

// T081: Test for GetExtendedPrivateKey() - xprv
func TestGetExtendedPrivateKey(t *testing.T) {
	service := hdkey.NewHDKeyService()

	seed := make([]byte, 64)
	masterKey, _ := service.NewMasterKey(seed)

	t.Run("gets extended private key", func(t *testing.T) {
		xprv, err := service.GetExtendedPrivateKey(masterKey)
		if err != nil {
			t.Fatalf("Failed to get extended private key: %v", err)
		}

		// xprv starts with "xprv"
		if !strings.HasPrefix(xprv, "xprv") {
			t.Errorf("Expected xprv to start with 'xprv', got: %s", xprv[:4])
		}
	})

	t.Run("xprv is deterministic", func(t *testing.T) {
		xprv1, _ := service.GetExtendedPrivateKey(masterKey)
		xprv2, _ := service.GetExtendedPrivateKey(masterKey)

		if xprv1 != xprv2 {
			t.Error("Same key should produce same xprv")
		}
	})
}

// T082: Integration test - full BIP32 workflow
func TestBIP32Integration(t *testing.T) {
	service := hdkey.NewHDKeyService()

	t.Run("full BIP32 derivation workflow", func(t *testing.T) {
		// 1. Create seed
		seed := make([]byte, 64)
		for i := range seed {
			seed[i] = byte(i % 256)
		}

		// 2. Generate master key
		masterKey, err := service.NewMasterKey(seed)
		if err != nil {
			t.Fatalf("Master key generation failed: %v", err)
		}

		// 3. Derive account key (m/44'/0'/0')
		accountKey, err := service.DerivePath(masterKey, "m/44'/0'/0'")
		if err != nil {
			t.Fatalf("Account key derivation failed: %v", err)
		}

		// 4. Derive address key (m/44'/0'/0'/0/0)
		addressKey, err := service.DerivePath(masterKey, "m/44'/0'/0'/0/0")
		if err != nil {
			t.Fatalf("Address key derivation failed: %v", err)
		}

		// 5. Extract keys
		pubKey, err := service.GetPublicKey(addressKey)
		if err != nil {
			t.Fatalf("Public key extraction failed: %v", err)
		}

		privKey, err := service.GetPrivateKey(addressKey)
		if err != nil {
			t.Fatalf("Private key extraction failed: %v", err)
		}

		// 6. Get extended keys
		xpub, err := service.GetExtendedPublicKey(accountKey)
		if err != nil {
			t.Fatalf("Extended public key failed: %v", err)
		}

		xprv, err := service.GetExtendedPrivateKey(accountKey)
		if err != nil {
			t.Fatalf("Extended private key failed: %v", err)
		}

		// Verify all keys are valid
		if len(pubKey) != 33 {
			t.Error("Invalid public key length")
		}
		if len(privKey) != 32 {
			t.Error("Invalid private key length")
		}
		if !strings.HasPrefix(xpub, "xpub") {
			t.Error("Invalid xpub format")
		}
		if !strings.HasPrefix(xprv, "xprv") {
			t.Error("Invalid xprv format")
		}
	})

	t.Run("derives multiple addresses", func(t *testing.T) {
		seed := make([]byte, 64)
		masterKey, _ := service.NewMasterKey(seed)

		// Derive first 5 addresses
		addresses := make([][]byte, 5)
		for i := 0; i < 5; i++ {
			path := fmt.Sprintf("m/44'/0'/0'/0/%d", i)
			key, err := service.DerivePath(masterKey, path)
			if err != nil {
				t.Fatalf("Failed to derive address %d: %v", i, err)
			}

			pubKey, err := service.GetPublicKey(key)
			if err != nil {
				t.Fatalf("Failed to get public key for address %d: %v", i, err)
			}

			addresses[i] = pubKey
		}

		// Verify all addresses are unique
		for i := 0; i < len(addresses); i++ {
			for j := i + 1; j < len(addresses); j++ {
				if string(addresses[i]) == string(addresses[j]) {
					t.Errorf("Address %d and %d are identical", i, j)
				}
			}
		}
	})
}
