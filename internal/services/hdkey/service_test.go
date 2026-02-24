package hdkey

import (
	"encoding/hex"
	"testing"

	"github.com/tyler-smith/go-bip39"
)

// testSeed returns a deterministic 64-byte seed from the standard BIP39 test vector
func testSeed(t *testing.T) []byte {
	t.Helper()
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	seed := bip39.NewSeed(mnemonic, "")
	if len(seed) != 64 {
		t.Fatalf("unexpected seed length: %d", len(seed))
	}
	return seed
}

func TestNewMasterKey_ValidSeed(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	key, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}
	if key == nil {
		t.Fatal("NewMasterKey returned nil key")
	}
}

func TestNewMasterKey_MinimumSeed(t *testing.T) {
	svc := NewHDKeyService()
	seed := make([]byte, 16) // minimum allowed

	key, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey with 16-byte seed should succeed: %v", err)
	}
	if key == nil {
		t.Fatal("key is nil")
	}
}

func TestNewMasterKey_TooShort(t *testing.T) {
	svc := NewHDKeyService()
	seed := make([]byte, 15) // below minimum

	_, err := svc.NewMasterKey(seed)
	if err == nil {
		t.Fatal("NewMasterKey should fail with 15-byte seed")
	}
}

func TestNewMasterKey_TooLong(t *testing.T) {
	svc := NewHDKeyService()
	seed := make([]byte, 65) // above maximum

	_, err := svc.NewMasterKey(seed)
	if err == nil {
		t.Fatal("NewMasterKey should fail with 65-byte seed")
	}
}

func TestNewMasterKey_MaximumSeed(t *testing.T) {
	svc := NewHDKeyService()
	seed := make([]byte, 64) // maximum allowed
	seed[0] = 1              // non-zero

	key, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey with 64-byte seed should succeed: %v", err)
	}
	if key == nil {
		t.Fatal("key is nil")
	}
}

func TestDerivePath_BIP44Bitcoin(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	// BIP44 Bitcoin: m/44'/0'/0'/0/0
	derived, err := svc.DerivePath(masterKey, "m/44'/0'/0'/0/0")
	if err != nil {
		t.Fatalf("DerivePath failed: %v", err)
	}
	if derived == nil {
		t.Fatal("derived key is nil")
	}

	// Verify we can extract a public key from the derived key
	pubKey, err := svc.GetPublicKey(derived)
	if err != nil {
		t.Fatalf("GetPublicKey failed: %v", err)
	}
	if len(pubKey) != 33 {
		t.Errorf("compressed public key length: got %d, want 33", len(pubKey))
	}
}

func TestDerivePath_BIP44Ethereum(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	// BIP44 Ethereum: m/44'/60'/0'/0/0
	derived, err := svc.DerivePath(masterKey, "m/44'/60'/0'/0/0")
	if err != nil {
		t.Fatalf("DerivePath failed: %v", err)
	}
	if derived == nil {
		t.Fatal("derived key is nil")
	}
}

func TestDerivePath_EmptyPath(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	derived, err := svc.DerivePath(masterKey, "")
	if err != nil {
		t.Fatalf("DerivePath with empty path should succeed: %v", err)
	}

	// Should return the same key
	masterPub, _ := svc.GetPublicKey(masterKey)
	derivedPub, _ := svc.GetPublicKey(derived)

	if hex.EncodeToString(masterPub) != hex.EncodeToString(derivedPub) {
		t.Error("empty path should return the master key unchanged")
	}
}

func TestDerivePath_MasterOnlyPrefix(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	derived, err := svc.DerivePath(masterKey, "m/")
	if err != nil {
		t.Fatalf("DerivePath with 'm/' should succeed: %v", err)
	}

	masterPub, _ := svc.GetPublicKey(masterKey)
	derivedPub, _ := svc.GetPublicKey(derived)

	if hex.EncodeToString(masterPub) != hex.EncodeToString(derivedPub) {
		t.Error("'m/' path should return the master key unchanged")
	}
}

func TestDerivePath_HardenedVsNormal(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	hardened, err := svc.DerivePath(masterKey, "m/44'")
	if err != nil {
		t.Fatalf("hardened derivation failed: %v", err)
	}

	normal, err := svc.DerivePath(masterKey, "m/44")
	if err != nil {
		t.Fatalf("normal derivation failed: %v", err)
	}

	hardenedPub, _ := svc.GetPublicKey(hardened)
	normalPub, _ := svc.GetPublicKey(normal)

	if hex.EncodeToString(hardenedPub) == hex.EncodeToString(normalPub) {
		t.Error("hardened and normal derivation should produce different keys")
	}
}

func TestDerivePath_InvalidComponent(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	_, err = svc.DerivePath(masterKey, "m/abc/def")
	if err == nil {
		t.Fatal("DerivePath should fail with non-numeric path component")
	}
}

func TestGetPublicKey_Compressed(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	pubKey, err := svc.GetPublicKey(masterKey)
	if err != nil {
		t.Fatalf("GetPublicKey failed: %v", err)
	}

	if len(pubKey) != 33 {
		t.Errorf("compressed public key length: got %d, want 33", len(pubKey))
	}

	// Compressed key must start with 0x02 or 0x03
	if pubKey[0] != 0x02 && pubKey[0] != 0x03 {
		t.Errorf("compressed public key prefix: got 0x%02x, want 0x02 or 0x03", pubKey[0])
	}
}

func TestGetPrivateKey_Length(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	privKey, err := svc.GetPrivateKey(masterKey)
	if err != nil {
		t.Fatalf("GetPrivateKey failed: %v", err)
	}

	if len(privKey) != 32 {
		t.Errorf("private key length: got %d, want 32", len(privKey))
	}
}

func TestGetPrivateKey_NonZero(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	privKey, err := svc.GetPrivateKey(masterKey)
	if err != nil {
		t.Fatalf("GetPrivateKey failed: %v", err)
	}

	allZero := true
	for _, b := range privKey {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		t.Error("private key is all zeros")
	}
}

func TestGetExtendedPublicKey_Format(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	xpub, err := svc.GetExtendedPublicKey(masterKey)
	if err != nil {
		t.Fatalf("GetExtendedPublicKey failed: %v", err)
	}

	if len(xpub) == 0 {
		t.Fatal("xpub is empty")
	}

	// xpub for mainnet should start with "xpub"
	if xpub[:4] != "xpub" {
		t.Errorf("xpub prefix: got %q, want 'xpub'", xpub[:4])
	}
}

func TestGetExtendedPrivateKey_Format(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	xprv, err := svc.GetExtendedPrivateKey(masterKey)
	if err != nil {
		t.Fatalf("GetExtendedPrivateKey failed: %v", err)
	}

	if len(xprv) == 0 {
		t.Fatal("xprv is empty")
	}

	// xprv for mainnet should start with "xprv"
	if xprv[:4] != "xprv" {
		t.Errorf("xprv prefix: got %q, want 'xprv'", xprv[:4])
	}
}

func TestDeterministicDerivation(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey1, _ := svc.NewMasterKey(seed)
	derived1, _ := svc.DerivePath(masterKey1, "m/44'/0'/0'/0/0")
	pub1, _ := svc.GetPublicKey(derived1)

	masterKey2, _ := svc.NewMasterKey(seed)
	derived2, _ := svc.DerivePath(masterKey2, "m/44'/0'/0'/0/0")
	pub2, _ := svc.GetPublicKey(derived2)

	if hex.EncodeToString(pub1) != hex.EncodeToString(pub2) {
		t.Error("same seed + path should always produce same derived key")
	}
}

func TestDifferentPaths_DifferentKeys(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, _ := svc.NewMasterKey(seed)

	derived1, _ := svc.DerivePath(masterKey, "m/44'/0'/0'/0/0")
	pub1, _ := svc.GetPublicKey(derived1)

	derived2, _ := svc.DerivePath(masterKey, "m/44'/0'/0'/0/1")
	pub2, _ := svc.GetPublicKey(derived2)

	if hex.EncodeToString(pub1) == hex.EncodeToString(pub2) {
		t.Error("different paths should produce different keys")
	}
}

func TestDerivePath_DeepPath(t *testing.T) {
	svc := NewHDKeyService()
	seed := testSeed(t)

	masterKey, err := svc.NewMasterKey(seed)
	if err != nil {
		t.Fatalf("NewMasterKey failed: %v", err)
	}

	// Deep derivation path
	derived, err := svc.DerivePath(masterKey, "m/44'/60'/0'/0/0")
	if err != nil {
		t.Fatalf("deep path derivation failed: %v", err)
	}

	pubKey, err := svc.GetPublicKey(derived)
	if err != nil {
		t.Fatalf("GetPublicKey on deep-derived key failed: %v", err)
	}
	if len(pubKey) != 33 {
		t.Errorf("public key length from deep derivation: got %d, want 33", len(pubKey))
	}
}
