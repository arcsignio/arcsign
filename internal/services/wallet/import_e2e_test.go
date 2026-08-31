package wallet

import (
	"os"
	"path/filepath"
	"testing"
)

// The import screen rejected a phrase the user typed correctly. The frontend
// and the backend validate the mnemonic independently, so this asks the
// question the layered tests could not: does a real import, through the real
// service, actually produce a wallet?
//
// The phrase is a published BIP39 test vector (trezor/python-mnemonic
// vectors.json), not anyone's wallet. Never put a real recovery phrase in a
// test: it lands in git history, and history is forever even after a rewrite.
func TestImportWalletFromMnemonic_EndToEnd(t *testing.T) {
	phrase := "legal winner thank year wave sausage worth useful legal winner thank yellow"

	tmpDir := t.TempDir()
	svc := NewWalletService(tmpDir)

	w, err := svc.ImportWalletFromMnemonic("Wending", phrase, validPassword, false, "")
	if err != nil {
		t.Fatalf("backend rejected a valid phrase: %v", err)
	}

	if w.Name != "Wending" {
		t.Errorf("wallet name = %q, want %q", w.Name, "Wending")
	}

	if _, err := os.Stat(filepath.Join(tmpDir, w.ID)); err != nil {
		t.Errorf("wallet directory not created: %v", err)
	}
}
