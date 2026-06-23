// Package main - Tests for message signing exports.
//
// These tests exercise the signing *logic* of SignMessage / SignTypedData
// (hash construction + the SecureSigner path) end-to-end, without going through
// the cgo *C.char entry points or the wallet-decryption plumbing. The critical
// guarantee they enforce: routing signing through the XOR-split SecureSigner
// produces a signature byte-identical to the former plaintext path, so the
// security change never altered EIP-191 / EIP-712 signature semantics.
package main

import (
	"bytes"
	"crypto/ecdsa"
	"encoding/json"
	"testing"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"

	"github.com/arcsignio/arcsign/internal/security"
)

// signMessageReference reproduces the OLD plaintext SignMessage signing path
// (pre-refactor) for a given message + key, so we can assert the new path
// matches it byte-for-byte.
func signMessageReference(t *testing.T, message string, key *ecdsa.PrivateKey) []byte {
	t.Helper()
	hash, err := eip191Hash(message)
	if err != nil {
		t.Fatalf("eip191Hash: %v", err)
	}
	sig, err := ethcrypto.Sign(hash, key)
	if err != nil {
		t.Fatalf("plaintext Sign: %v", err)
	}
	if sig[64] < 27 {
		sig[64] += 27
	}
	return sig
}

// TestSignMessageEIP191MatchesPlaintext verifies the full personal_sign path
// (EIP-191 hash → SecureSigner → v adjustment) is byte-identical to the old
// plaintext path, for both plain-text and hex-encoded messages.
func TestSignMessageEIP191MatchesPlaintext(t *testing.T) {
	keyBytes := mustKey(t)
	key, err := ethcrypto.ToECDSA(append([]byte(nil), keyBytes...))
	if err != nil {
		t.Fatalf("ToECDSA: %v", err)
	}
	address := ethcrypto.PubkeyToAddress(key.PublicKey).Hex()

	cases := []struct {
		name    string
		message string
	}{
		{"plain text", "hello world"},
		{"empty", ""},
		{"hex encoded", "0xdeadbeef"},
		{"unicode", "héllo 世界"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			want := signMessageReference(t, tc.message, key)

			// New path: build EIP-191 hash, sign via SecureSigner, adjust v.
			hash, err := eip191Hash(tc.message)
			if err != nil {
				t.Fatalf("eip191Hash: %v", err)
			}
			signer, err := security.NewSecureSigner(append([]byte(nil), keyBytes...), address, "ethereum")
			if err != nil {
				t.Fatalf("NewSecureSigner: %v", err)
			}
			defer signer.Zeroize()
			got, err := signer.SignHash(hash, address)
			if err != nil {
				t.Fatalf("SignHash: %v", err)
			}
			if got[64] < 27 {
				got[64] += 27
			}

			if !bytes.Equal(got, want) {
				t.Errorf("signature mismatch for %q:\n got  %x\n want %x", tc.message, got, want)
			}
		})
	}
}

// TestSignTypedDataEIP712MatchesPlaintext verifies the full eth_signTypedData_v4
// path (EIP-712 hash → SecureSigner → v adjustment) is byte-identical to the old
// plaintext path on a representative typed-data payload.
func TestSignTypedDataEIP712MatchesPlaintext(t *testing.T) {
	keyBytes := mustKey(t)
	key, err := ethcrypto.ToECDSA(append([]byte(nil), keyBytes...))
	if err != nil {
		t.Fatalf("ToECDSA: %v", err)
	}
	address := ethcrypto.PubkeyToAddress(key.PublicKey).Hex()

	var typedData apitypes.TypedData
	if err := json.Unmarshal([]byte(sampleTypedDataJSON), &typedData); err != nil {
		t.Fatalf("unmarshal typed data: %v", err)
	}

	hash, err := hashTypedDataV4(typedData)
	if err != nil {
		t.Fatalf("hashTypedDataV4: %v", err)
	}

	// Reference: plaintext sign of the same hash.
	want, err := ethcrypto.Sign(hash.Bytes(), key)
	if err != nil {
		t.Fatalf("plaintext Sign: %v", err)
	}
	if want[64] < 27 {
		want[64] += 27
	}

	// New path via SecureSigner.
	signer, err := security.NewSecureSigner(append([]byte(nil), keyBytes...), address, "ethereum")
	if err != nil {
		t.Fatalf("NewSecureSigner: %v", err)
	}
	defer signer.Zeroize()
	got, err := signer.SignHash(hash.Bytes(), address)
	if err != nil {
		t.Fatalf("SignHash: %v", err)
	}
	if got[64] < 27 {
		got[64] += 27
	}

	if !bytes.Equal(got, want) {
		t.Errorf("EIP-712 signature mismatch:\n got  %x\n want %x", got, want)
	}
}

// mustKey returns a deterministic 32-byte test private key.
func mustKey(t *testing.T) []byte {
	t.Helper()
	k, err := hexToBytes("4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318")
	if err != nil {
		t.Fatalf("hexToBytes: %v", err)
	}
	return k
}

const sampleTypedDataJSON = `{
  "types": {
    "EIP712Domain": [
      {"name": "name", "type": "string"},
      {"name": "version", "type": "string"},
      {"name": "chainId", "type": "uint256"},
      {"name": "verifyingContract", "type": "address"}
    ],
    "Person": [
      {"name": "name", "type": "string"},
      {"name": "wallet", "type": "address"}
    ],
    "Mail": [
      {"name": "from", "type": "Person"},
      {"name": "to", "type": "Person"},
      {"name": "contents", "type": "string"}
    ]
  },
  "primaryType": "Mail",
  "domain": {
    "name": "Ether Mail",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
  },
  "message": {
    "from": {"name": "Cow", "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"},
    "to": {"name": "Bob", "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"},
    "contents": "Hello, Bob!"
  }
}`
