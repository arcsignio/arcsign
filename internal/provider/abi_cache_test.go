package provider

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func tempCachePath(t *testing.T) string {
	return filepath.Join(t.TempDir(), "abi_cache.enc")
}

// heapPw returns a heap-allocated copy of a password so Close()'s in-place
// SecureZero (which mirrors ProviderConfigStore) doesn't fault on a read-only
// string literal. Production passwords come from FFI C-strings (already heap).
func heapPw(s string) string { return string([]byte(s)) }

func sampleEntry() *AbiCacheEntry {
	return &AbiCacheEntry{
		ABI:        json.RawMessage(`[{"type":"function","name":"swap","inputs":[],"outputs":[]}]`),
		MatchLevel: "full",
		Source:     "sourcify",
		Address:    "0x40a1fe393a7f566f27df6ace18e6773be844dafc",
		ChainID:    56,
		FetchedAt:  1719000000,
	}
}

func TestAbiCache_SetGetRoundTrip(t *testing.T) {
	path := tempCachePath(t)
	store, err := NewAbiCacheStore(path, heapPw("pw-test-123"))
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	defer store.Close()
	if err := store.Set(sampleEntry()); err != nil {
		t.Fatalf("set: %v", err)
	}

	store2, err := NewAbiCacheStore(path, heapPw("pw-test-123"))
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer store2.Close()
	got := store2.Get(56, "0x40A1FE393A7F566F27DF6ACE18E6773BE844DAFC") // case-insensitive
	if got == nil {
		t.Fatal("expected hit, got nil")
	}
	if got.MatchLevel != "full" || got.ChainID != 56 {
		t.Fatalf("wrong entry: %+v", got)
	}
}

func TestAbiCache_AddressMismatch_TreatedAsCorrupt(t *testing.T) {
	path := tempCachePath(t)
	store, _ := NewAbiCacheStore(path, heapPw("pw"))
	defer store.Close()
	store.Set(sampleEntry())
	if got := store.Get(56, "0xdeadbeef00000000000000000000000000000000"); got != nil {
		t.Fatal("address mismatch must be a miss")
	}
}

func TestAbiCache_ChainIdMismatch_Miss(t *testing.T) {
	path := tempCachePath(t)
	store, _ := NewAbiCacheStore(path, heapPw("pw"))
	defer store.Close()
	store.Set(sampleEntry())
	if got := store.Get(1, "0x40a1fe393a7f566f27df6ace18e6773be844dafc"); got != nil {
		t.Fatal("chainId mismatch must be a miss")
	}
}

func TestAbiCache_CorruptFile_Graceful(t *testing.T) {
	path := tempCachePath(t)
	if err := os.WriteFile(path, []byte("not encrypted garbage"), 0600); err != nil {
		t.Fatal(err)
	}
	store, err := NewAbiCacheStore(path, heapPw("pw"))
	if err != nil {
		t.Fatalf("corrupt file should be graceful, got: %v", err)
	}
	defer store.Close()
	if got := store.Get(56, "0x40a1fe393a7f566f27df6ace18e6773be844dafc"); got != nil {
		t.Fatal("corrupt store must be empty")
	}
}

func TestAbiCache_EvictsOldestOverLimit(t *testing.T) {
	// Shrink the cap so we only do a few Argon2 encrypt cycles (full cap would
	// be ~250s). The eviction LOGIC is identical regardless of the number.
	orig := maxAbiCacheEntries
	maxAbiCacheEntries = 3
	defer func() { maxAbiCacheEntries = orig }()

	path := tempCachePath(t)
	store, _ := NewAbiCacheStore(path, heapPw("pw"))
	defer store.Close()
	for i := 0; i < maxAbiCacheEntries+2; i++ { // 5 sets, cap 3
		e := sampleEntry()
		e.Address = "0x" + padHex(i)
		e.FetchedAt = int64(i) // increasing → lowest i is oldest
		store.Set(e)
	}
	if n := store.size(); n > maxAbiCacheEntries {
		t.Fatalf("size %d exceeds cap %d", n, maxAbiCacheEntries)
	}
	// oldest (i=0, i=1) should have been evicted; newest (i=4) kept
	if got := store.Get(56, "0x"+padHex(0)); got != nil {
		t.Fatal("oldest entry should have been evicted")
	}
	if got := store.Get(56, "0x"+padHex(4)); got == nil {
		t.Fatal("newest entry should be kept")
	}
}

func TestAbiCache_Clear(t *testing.T) {
	path := tempCachePath(t)
	store, _ := NewAbiCacheStore(path, heapPw("pw"))
	store.Set(sampleEntry())
	if err := store.Clear(); err != nil {
		t.Fatalf("clear: %v", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("clear must remove the cache file")
	}
	store.Close()
}

func padHex(i int) string {
	h := []byte("0000000000000000000000000000000000000000")
	x := i
	idx := 39
	for x > 0 && idx >= 0 {
		h[idx] = "0123456789abcdef"[x%16]
		x /= 16
		idx--
	}
	return string(h)
}
