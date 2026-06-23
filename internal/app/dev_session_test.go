package app

import (
	"crypto/rand"
	"strings"
	"testing"
	"time"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"

	"github.com/arcsignio/arcsign/internal/security"
)

// newTestDevSession builds a DevSessionManager with a single pre-loaded
// SecureSigner, without touching wallet decryption / USB. Returns the manager,
// the session token, and the signer's address.
func newTestDevSession(t *testing.T) (*DevSessionManager, string, string) {
	t.Helper()

	keyBytes := make([]byte, 32)
	if _, err := rand.Read(keyBytes); err != nil {
		t.Fatalf("rand: %v", err)
	}
	key, err := ethcrypto.ToECDSA(append([]byte(nil), keyBytes...))
	if err != nil {
		t.Fatalf("ToECDSA: %v", err)
	}
	address := ethcrypto.PubkeyToAddress(key.PublicKey).Hex()

	signer, err := security.NewSecureSigner(keyBytes, address, "ethereum")
	if err != nil {
		t.Fatalf("NewSecureSigner: %v", err)
	}

	dsm := &DevSessionManager{sessions: make(map[string]*DevSession)}
	token := "test-token"
	now := time.Now()
	dsm.sessions[token] = &DevSession{
		Token:     token,
		ExpiresAt: now.Add(time.Hour),
		LastUsed:  now,
		signers:   map[string]*security.SecureSigner{strings.ToLower(address): signer},
	}
	return dsm, token, address
}

// TestDevSessionSignMessageIsEIP191 verifies dev-session personal_sign applies
// the EIP-191 prefix: the produced signature must recover to the signer's
// address when verified against EIP191Hash(message), and must NOT verify
// against a raw (unprefixed) keccak of the message.
func TestDevSessionSignMessageIsEIP191(t *testing.T) {
	dsm, token, address := newTestDevSession(t)
	message := []byte("Sign in to dApp #42")

	sig, err := dsm.SignMessage(token, address, message)
	if err != nil {
		t.Fatalf("SignMessage: %v", err)
	}
	if len(sig) != 65 {
		t.Fatalf("expected 65-byte signature, got %d", len(sig))
	}

	// Normalize V (SecureSigner returns 0/1) for ecrecover.
	recSig := append([]byte(nil), sig...)
	if recSig[64] >= 27 {
		recSig[64] -= 27
	}

	// Must recover against the EIP-191 prefixed hash.
	eip191 := security.EIP191Hash(message)
	pub, err := ethcrypto.SigToPub(eip191, recSig)
	if err != nil {
		t.Fatalf("SigToPub against EIP-191 hash: %v", err)
	}
	recovered := ethcrypto.PubkeyToAddress(*pub).Hex()
	if !strings.EqualFold(recovered, address) {
		t.Errorf("signature does not recover to signer against EIP-191 hash: got %s want %s", recovered, address)
	}

	// Must NOT be a signature over the raw (unprefixed) message.
	rawHash := ethcrypto.Keccak256(message)
	if pubRaw, err := ethcrypto.SigToPub(rawHash, recSig); err == nil {
		if strings.EqualFold(ethcrypto.PubkeyToAddress(*pubRaw).Hex(), address) {
			t.Error("signature recovers against raw message hash — EIP-191 prefix is missing")
		}
	}
}
