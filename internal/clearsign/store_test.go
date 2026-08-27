package clearsign

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStoreRoundTrip(t *testing.T) {
	p := filepath.Join(t.TempDir(), "descriptors.enc")

	s, err := NewDescriptorStore(p, "correct-horse-battery")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	payload := []byte(`{"version":"2026-08-25","descriptors":[]}`)
	if err := s.Save(payload); err != nil {
		t.Fatalf("save: %v", err)
	}
	s.Close()

	s2, err := NewDescriptorStore(p, "correct-horse-battery")
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer s2.Close()

	got, ok := s2.Load()
	if !ok {
		t.Fatal("load returned not-ok after save")
	}
	if string(got) != string(payload) {
		t.Errorf("round trip mismatch: %s", got)
	}
}

func TestStoreWrongPasswordFails(t *testing.T) {
	p := filepath.Join(t.TempDir(), "descriptors.enc")

	s, err := NewDescriptorStore(p, "password-one")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	if err := s.Save([]byte(`{"descriptors":[]}`)); err != nil {
		t.Fatalf("save: %v", err)
	}
	s.Close()

	if _, err := NewDescriptorStore(p, "password-two"); err == nil {
		t.Error("wrong password must fail to open")
	}
}

func TestStoreDetectsTampering(t *testing.T) {
	p := filepath.Join(t.TempDir(), "descriptors.enc")

	s, err := NewDescriptorStore(p, "pw")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	if err := s.Save([]byte(`{"descriptors":[]}`)); err != nil {
		t.Fatalf("save: %v", err)
	}
	s.Close()

	// Flip one byte in the middle of the ciphertext. AES-GCM is an AEAD, so any
	// modification must fail authentication on open rather than yielding
	// attacker-chosen plaintext.
	raw, err := os.ReadFile(p)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	raw[len(raw)/2] ^= 0x01
	if err := os.WriteFile(p, raw, 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	if _, err := NewDescriptorStore(p, "pw"); err == nil {
		t.Error("tampered file must fail to open")
	}
}

func TestStoreMissingFileStartsEmpty(t *testing.T) {
	s, err := NewDescriptorStore(filepath.Join(t.TempDir(), "nope.enc"), "pw")
	if err != nil {
		t.Fatalf("missing file should not error: %v", err)
	}
	defer s.Close()
	if _, ok := s.Load(); ok {
		t.Error("empty store must report not-ok")
	}
}

// TestStoreCloseZeroesPassword verifies the password is cleared from memory on
// Close. A descriptor store holds the same secret that unlocks the wallet's
// other encrypted stores, so it must not linger on the heap after use.
func TestStoreCloseZeroesPassword(t *testing.T) {
	s, err := NewDescriptorStore(filepath.Join(t.TempDir(), "d.enc"), "super-secret")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	s.Close()
	if s.password != nil {
		t.Errorf("password buffer must be nil after Close, got %v", s.password)
	}
}

// TestStoreLoadReturnsCopy guards against a caller mutating the store's
// internal buffer through the returned slice.
func TestStoreLoadReturnsCopy(t *testing.T) {
	p := filepath.Join(t.TempDir(), "d.enc")
	s, err := NewDescriptorStore(p, "pw")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer s.Close()

	if err := s.Save([]byte(`{"descriptors":[1]}`)); err != nil {
		t.Fatalf("save: %v", err)
	}
	first, _ := s.Load()
	first[0] = 'X'

	second, _ := s.Load()
	if second[0] == 'X' {
		t.Error("Load must return a copy; caller mutation leaked into the store")
	}
}

// TestStoreSaveAfterCloseFails guards against silently re-encrypting under an
// empty password once Close has zeroed it — that would write a file the real
// password can never open.
func TestStoreSaveAfterCloseFails(t *testing.T) {
	s, err := NewDescriptorStore(filepath.Join(t.TempDir(), "d.enc"), "pw")
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	s.Close()
	if err := s.Save([]byte(`{"descriptors":[]}`)); err == nil {
		t.Error("Save after Close must fail rather than re-key with an empty password")
	}
}
