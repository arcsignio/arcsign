package provider

import (
	"path/filepath"
	"testing"
)

const testTTPassword = "correct horse battery staple"

func newTestTouchedStore(t *testing.T) (*TouchedTokenStore, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "touched_tokens.enc")
	store, err := NewTouchedTokenStore(path, testTTPassword)
	if err != nil {
		t.Fatalf("NewTouchedTokenStore: %v", err)
	}
	return store, path
}

// TestTouchedTokenAddAndRead is the core round-trip: add a token an address has
// interacted with, read it back. This is the per-user "table B" — tokens the
// user holds that aren't in the curated common-token list (airdrops, swap
// outputs, manually imported).
func TestTouchedTokenAddAndRead(t *testing.T) {
	store, _ := newTestTouchedStore(t)
	defer store.Close()

	tok := TokenRef{Address: "0xTOKEN", Network: NetworkEthMainnet, Symbol: "PEPE", Decimals: 18}
	if err := store.AddToken("0xUSER", tok); err != nil {
		t.Fatalf("AddToken: %v", err)
	}

	got := store.TokensForAddress("0xUSER")
	if len(got) != 1 {
		t.Fatalf("expected 1 token, got %d (%v)", len(got), got)
	}
	if got[0].Symbol != "PEPE" || got[0].Network != NetworkEthMainnet || got[0].Decimals != 18 {
		t.Errorf("token round-trip mismatch: %+v", got[0])
	}
}

// TestTouchedTokenDedup ensures adding the same (network, token address) twice
// for one user does not create duplicates — repeated swaps/scans are idempotent.
func TestTouchedTokenDedup(t *testing.T) {
	store, _ := newTestTouchedStore(t)
	defer store.Close()

	tok := TokenRef{Address: "0xAbC", Network: NetworkBnbMainnet, Symbol: "CAKE", Decimals: 18}
	_ = store.AddToken("0xUSER", tok)
	// Same token, different address-casing in the contract address — must dedup.
	_ = store.AddToken("0xUSER", TokenRef{Address: "0xABC", Network: NetworkBnbMainnet, Symbol: "CAKE", Decimals: 18})

	if got := store.TokensForAddress("0xUSER"); len(got) != 1 {
		t.Errorf("expected dedup to 1 token, got %d (%v)", len(got), got)
	}
}

// TestTouchedTokenPersistsAcrossReload verifies the encrypted file survives a
// store reopen (AES-256-GCM round-trip + atomic write), same as ProviderConfigStore.
func TestTouchedTokenPersistsAcrossReload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "touched_tokens.enc")

	store, err := NewTouchedTokenStore(path, testTTPassword)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_ = store.AddToken("0xUSER", TokenRef{Address: "0xT", Network: NetworkPolygonMainnet, Symbol: "GHST", Decimals: 18})
	store.Close()

	reopened, err := NewTouchedTokenStore(path, testTTPassword)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer reopened.Close()

	if got := reopened.TokensForAddress("0xUSER"); len(got) != 1 || got[0].Symbol != "GHST" {
		t.Errorf("token did not persist across reload: %v", got)
	}
}

// TestTouchedTokenWrongPasswordFails ensures the file is genuinely encrypted —
// a wrong password must not decrypt it.
func TestTouchedTokenWrongPasswordFails(t *testing.T) {
	path := filepath.Join(t.TempDir(), "touched_tokens.enc")
	store, _ := NewTouchedTokenStore(path, testTTPassword)
	_ = store.AddToken("0xUSER", TokenRef{Address: "0xT", Network: NetworkEthMainnet, Symbol: "X", Decimals: 18})
	store.Close()

	if _, err := NewTouchedTokenStore(path, "wrong-password"); err == nil {
		t.Error("expected decryption to fail with wrong password")
	}
}

// TestTouchedTokenLastScannedBlock covers the incremental-scan cursor: persist
// how far we've scanned per network so the next startup scan resumes instead of
// re-scanning from the start block.
func TestTouchedTokenLastScannedBlock(t *testing.T) {
	store, _ := newTestTouchedStore(t)
	defer store.Close()

	if got := store.GetLastScannedBlock(NetworkEthMainnet); got != 0 {
		t.Errorf("expected 0 for unscanned network, got %d", got)
	}
	if err := store.SetLastScannedBlock(NetworkEthMainnet, 19_000_000); err != nil {
		t.Fatalf("SetLastScannedBlock: %v", err)
	}
	if got := store.GetLastScannedBlock(NetworkEthMainnet); got != 19_000_000 {
		t.Errorf("expected 19000000, got %d", got)
	}
}

// TestTouchedTokenEmptyForUnknownAddress returns empty, not nil-panic.
func TestTouchedTokenEmptyForUnknownAddress(t *testing.T) {
	store, _ := newTestTouchedStore(t)
	defer store.Close()
	if got := store.TokensForAddress("0xNOBODY"); len(got) != 0 {
		t.Errorf("expected empty for unknown address, got %v", got)
	}
}
