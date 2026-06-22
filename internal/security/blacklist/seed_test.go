package blacklist

import (
	"context"
	"errors"
	"testing"
)

type failFetcher struct{}

func (failFetcher) Fetch(ctx context.Context, url string) ([]byte, error) {
	return nil, errors.New("offline")
}

func TestSeed_OFACLoadedOnConstruction(t *testing.T) {
	m := NewManager(nil)
	if match := m.CheckAddress("0x8589427373d6d84e98730d7795d8f6f8731fda16"); match == nil {
		t.Fatal("expected OFAC seed address to be blacklisted on construction (offline)")
	} else if match.Source != "embedded-ofac" {
		t.Errorf("expected source embedded-ofac, got %s", match.Source)
	}
}

func TestSeed_MaliciousSpendersReused(t *testing.T) {
	m := NewManager(nil)
	addrCount, _, _ := m.Stats()
	if addrCount < 100 {
		t.Fatalf("expected seed to include reused malicious spenders (got %d addresses)", addrCount)
	}
}

func TestSeed_SurvivesFailedUpdate(t *testing.T) {
	m := NewManager(failFetcher{})
	_ = m.Update(context.Background()) // all sources fail (offline)
	if match := m.CheckAddress("0x8589427373d6d84e98730d7795d8f6f8731fda16"); match == nil {
		t.Fatal("seed must survive a failed Update (offline must not leave us naked)")
	}
}

func TestSeed_UpdateMergesWithoutOverwritingSeedSource(t *testing.T) {
	m := NewManager(&seedMergeFetcher{})
	_ = m.Update(context.Background())
	if match := m.CheckAddress("0x8589427373d6d84e98730d7795d8f6f8731fda16"); match == nil {
		t.Fatal("seed address missing after merge")
	} else if match.Source != "embedded-ofac" {
		t.Errorf("seed source overwritten by online merge: got %s", match.Source)
	}
	if match := m.CheckAddress("0x1111111111111111111111111111111111111111"); match == nil {
		t.Error("online-only address should be added by merge")
	}
}

type seedMergeFetcher struct{}

func (seedMergeFetcher) Fetch(ctx context.Context, url string) ([]byte, error) {
	if url == ofacURL {
		return []byte(`["0x8589427373D6D84E98730D7795D8f6f8731FDA16","0x1111111111111111111111111111111111111111"]`), nil
	}
	return nil, errors.New("not needed")
}
