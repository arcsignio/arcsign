package provider

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unsafe"

	"github.com/arcsignio/arcsign/internal/security"
	"github.com/arcsignio/arcsign/internal/services/crypto"
)

// maxAbiCacheEntries caps the persisted cache. ABIs are small and the
// contract-address keyspace a user signs is tiny, so 500 is ample; over the
// cap we evict the oldest by FetchedAt. (var, not const, so tests can shrink it.)
var maxAbiCacheEntries = 500

// AbiCacheEntry is one persisted verified ABI. Address/ChainID are stored in the
// value and re-checked on Get (tamper defense, on top of AES-256-GCM).
type AbiCacheEntry struct {
	ABI        json.RawMessage `json:"abi"`
	MatchLevel string          `json:"matchLevel"`
	Source     string          `json:"source"`
	Address    string          `json:"address"`
	ChainID    int             `json:"chainId"`
	FetchedAt  int64           `json:"fetchedAt"`
}

type AbiCacheStore struct {
	entries  map[string]*AbiCacheEntry
	mutex    sync.RWMutex
	path     string
	password string
}

type abiCacheFile struct {
	Version string                    `json:"version"`
	Entries map[string]*AbiCacheEntry `json:"entries"`
}

func abiCacheKey(chainID int, address string) string {
	return fmt.Sprintf("%d:%s", chainID, strings.ToLower(address))
}

// NewAbiCacheStore opens (or starts empty on a missing/undecryptable file).
// A corrupt/undecryptable file is treated as empty (graceful), never a hard error.
func NewAbiCacheStore(path, password string) (*AbiCacheStore, error) {
	s := &AbiCacheStore{
		entries:  make(map[string]*AbiCacheEntry),
		path:     path,
		password: password,
	}
	if err := s.load(); err != nil {
		if !os.IsNotExist(err) {
			s.entries = make(map[string]*AbiCacheEntry)
		}
	}
	return s, nil
}

func (s *AbiCacheStore) load() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	data, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	decrypted, err := crypto.Decrypt(data, s.password)
	if err != nil {
		return fmt.Errorf("decrypt abi cache: %w", err)
	}
	var f abiCacheFile
	if err := json.Unmarshal(decrypted, &f); err != nil {
		return fmt.Errorf("parse abi cache: %w", err)
	}
	// Version is written as "1.0" by saveLocked; we don't hard-reject other
	// versions here — graceful: just use whatever parsed (forward-compatible).
	if f.Entries != nil {
		s.entries = f.Entries
	}
	return nil
}

func (s *AbiCacheStore) Get(chainID int, address string) *AbiCacheEntry {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	e := s.entries[abiCacheKey(chainID, address)]
	if e == nil {
		return nil
	}
	if e.ChainID != chainID || !strings.EqualFold(e.Address, address) {
		return nil
	}
	return e
}

func (s *AbiCacheStore) Set(e *AbiCacheEntry) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.entries[abiCacheKey(e.ChainID, e.Address)] = e
	s.evictIfNeededLocked()
	return s.saveLocked()
}

func (s *AbiCacheStore) evictIfNeededLocked() {
	if len(s.entries) <= maxAbiCacheEntries {
		return
	}
	type kv struct {
		key string
		at  int64
	}
	all := make([]kv, 0, len(s.entries))
	for k, v := range s.entries {
		all = append(all, kv{k, v.FetchedAt})
	}
	sort.Slice(all, func(i, j int) bool { return all[i].at < all[j].at })
	for i := 0; i < len(all)-maxAbiCacheEntries; i++ {
		delete(s.entries, all[i].key)
	}
}

func (s *AbiCacheStore) size() int {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return len(s.entries)
}

// saveLocked encrypts and atomically writes the cache. Caller MUST hold s.mutex.
func (s *AbiCacheStore) saveLocked() error {
	f := abiCacheFile{Version: "1.0", Entries: s.entries}
	jsonData, err := json.Marshal(f)
	if err != nil {
		return fmt.Errorf("marshal abi cache: %w", err)
	}
	encrypted, err := crypto.Encrypt(jsonData, s.password)
	if err != nil {
		return fmt.Errorf("encrypt abi cache: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		return fmt.Errorf("mkdir abi cache: %w", err)
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, encrypted, 0600); err != nil {
		return fmt.Errorf("write temp abi cache: %w", err)
	}
	if err := os.Rename(tmp, s.path); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("rename abi cache: %w", err)
	}
	return nil
}

func (s *AbiCacheStore) Clear() error {
	s.mutex.Lock()
	s.entries = make(map[string]*AbiCacheEntry)
	s.mutex.Unlock()
	if err := os.Remove(s.path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *AbiCacheStore) Close() {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.password != "" {
		b := unsafe.Slice(unsafe.StringData(s.password), len(s.password))
		security.SecureZero(b)
		s.password = ""
	}
}
