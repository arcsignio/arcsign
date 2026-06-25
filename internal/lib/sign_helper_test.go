package main

import (
	"testing"

	"github.com/arcsignio/arcsign/internal/models"
)

// walletWithAddr builds a minimal *models.Wallet whose AddressBook holds a
// single DerivedAddress with the given address + derivation path. AddressBook
// is a POINTER field on Wallet, and Addresses is []models.DerivedAddress.
func walletWithAddr(addr, path string) *models.Wallet {
	return &models.Wallet{
		AddressBook: &models.AddressBook{
			Addresses: []models.DerivedAddress{
				{Address: addr, DerivationPath: path},
			},
		},
	}
}

func TestDerivationPathFor_CaseSensitivity(t *testing.T) {
	const lower = "0xabc0000000000000000000000000000000000001"
	const mixed = "0xABc0000000000000000000000000000000000001"
	w := walletWithAddr(lower, "m/44'/60'/0'/0/0")

	t.Run("case-insensitive finds mixed-case query", func(t *testing.T) {
		p, err := derivationPathFor(w, mixed, true)
		if err != nil || p != "m/44'/60'/0'/0/0" {
			t.Fatalf("EqualFold lookup failed: p=%q err=%v", p, err)
		}
	})
	t.Run("case-sensitive rejects mixed-case query", func(t *testing.T) {
		_, err := derivationPathFor(w, mixed, false)
		if err == nil {
			t.Fatalf("exact lookup should NOT match different case")
		}
	})
	t.Run("case-sensitive matches exact", func(t *testing.T) {
		p, err := derivationPathFor(w, lower, false)
		if err != nil || p != "m/44'/60'/0'/0/0" {
			t.Fatalf("exact lookup failed: p=%q err=%v", p, err)
		}
	})
}
