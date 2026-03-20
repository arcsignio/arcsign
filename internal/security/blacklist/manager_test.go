package blacklist

import (
	"context"
	"fmt"
	"testing"
)

func TestCheckAddress_Empty(t *testing.T) {
	m := NewManager(nil)
	if match := m.CheckAddress(""); match != nil {
		t.Error("expected nil for empty address")
	}
}

func TestCheckAddress_NotFound(t *testing.T) {
	m := NewManager(nil)
	m.AddAddress("0xabc123", "OFAC", "sanctioned")

	if match := m.CheckAddress("0xdef456"); match != nil {
		t.Error("expected nil for non-blacklisted address")
	}
}

func TestCheckAddress_Found(t *testing.T) {
	m := NewManager(nil)
	m.AddAddress("0xABC123", "OFAC", "sanctioned")

	match := m.CheckAddress("0xabc123") // case-insensitive
	if match == nil {
		t.Fatal("expected match for blacklisted address")
	}
	if match.Source != "OFAC" {
		t.Errorf("expected source OFAC, got %s", match.Source)
	}
	if match.Category != "sanctioned" {
		t.Errorf("expected category sanctioned, got %s", match.Category)
	}
}

func TestCheckAddress_CaseInsensitive(t *testing.T) {
	m := NewManager(nil)
	m.AddAddress("0xDeAdBeEf", "ScamSniffer", "scam")

	// Should match regardless of case
	if match := m.CheckAddress("0xDEADBEEF"); match == nil {
		t.Error("expected case-insensitive match")
	}
	if match := m.CheckAddress("0xdeadbeef"); match == nil {
		t.Error("expected case-insensitive match (lowercase)")
	}
}

func TestIsAddressSafe(t *testing.T) {
	m := NewManager(nil)
	m.AddAddress("0xevil", "OFAC", "sanctioned")

	if m.IsAddressSafe("0xevil") {
		t.Error("expected unsafe for blacklisted address")
	}
	if !m.IsAddressSafe("0xgood") {
		t.Error("expected safe for non-blacklisted address")
	}
}

func TestCheckDomain_Empty(t *testing.T) {
	m := NewManager(nil)
	if match := m.CheckDomain(""); match != nil {
		t.Error("expected nil for empty domain")
	}
}

func TestCheckDomain_ExactMatch(t *testing.T) {
	m := NewManager(nil)
	m.AddDomain("evil.com", "MetaMask", "phishing")

	match := m.CheckDomain("evil.com")
	if match == nil {
		t.Fatal("expected match for blacklisted domain")
	}
	if match.Source != "MetaMask" {
		t.Errorf("expected source MetaMask, got %s", match.Source)
	}
}

func TestCheckDomain_SubdomainMatch(t *testing.T) {
	m := NewManager(nil)
	m.AddDomain("evil.com", "ScamSniffer", "phishing")

	match := m.CheckDomain("sub.evil.com")
	if match == nil {
		t.Fatal("expected subdomain to match parent domain")
	}
	if match.Value != "evil.com" {
		t.Errorf("expected matched value evil.com, got %s", match.Value)
	}

	// Deep subdomain
	match = m.CheckDomain("deep.sub.evil.com")
	if match == nil {
		t.Fatal("expected deep subdomain to match parent domain")
	}
}

func TestCheckDomain_NoFalsePositive(t *testing.T) {
	m := NewManager(nil)
	m.AddDomain("evil.com", "MetaMask", "phishing")

	// "notevil.com" should NOT match "evil.com"
	if match := m.CheckDomain("notevil.com"); match != nil {
		t.Error("expected no match for different domain")
	}
}

func TestCheckDomain_CaseInsensitive(t *testing.T) {
	m := NewManager(nil)
	m.AddDomain("Evil.Com", "MetaMask", "phishing")

	if match := m.CheckDomain("EVIL.COM"); match == nil {
		t.Error("expected case-insensitive match")
	}
}

func TestCheckDomain_TrailingDot(t *testing.T) {
	m := NewManager(nil)
	m.AddDomain("evil.com.", "MetaMask", "phishing")

	if match := m.CheckDomain("evil.com"); match == nil {
		t.Error("expected match ignoring trailing dot")
	}
}

func TestIsDomainSafe(t *testing.T) {
	m := NewManager(nil)
	m.AddDomain("phishing.site", "MetaMask", "phishing")

	if m.IsDomainSafe("phishing.site") {
		t.Error("expected unsafe for blacklisted domain")
	}
	if !m.IsDomainSafe("safe.site") {
		t.Error("expected safe for non-blacklisted domain")
	}
}

func TestStats(t *testing.T) {
	m := NewManager(nil)
	m.AddAddress("0x1", "OFAC", "sanctioned")
	m.AddAddress("0x2", "OFAC", "sanctioned")
	m.AddDomain("evil.com", "MetaMask", "phishing")

	addrCount, domCount, _ := m.Stats()
	if addrCount != 2 {
		t.Errorf("expected 2 addresses, got %d", addrCount)
	}
	if domCount != 1 {
		t.Errorf("expected 1 domain, got %d", domCount)
	}
}

func TestUpdate_WithMockFetcher(t *testing.T) {
	mock := &mockFetcher{
		responses: map[string][]byte{
			ofacURL:               []byte(`["0xOFAC1", "0xOFAC2"]`),
			scamSnifferAddressURL: []byte(`["0xScam1"]`),
			scamSnifferDomainURL:  []byte(`["scam-domain.com"]`),
			metaMaskPhishingURL:   []byte(`{"blacklist":["phish1.com","phish2.com"],"fuzzylist":["phish3.com"],"whitelist":["phish2.com"]}`),
		},
	}
	m := NewManager(mock)

	err := m.Update(context.Background())
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}

	// Check addresses
	addrCount, domCount, lastUpdated := m.Stats()
	if addrCount != 3 { // 2 OFAC + 1 ScamSniffer
		t.Errorf("expected 3 addresses, got %d", addrCount)
	}

	// Check domains: phish1 + phish3 (phish2 whitelisted) + scam-domain = 3
	if domCount != 3 {
		t.Errorf("expected 3 domains, got %d", domCount)
	}

	if lastUpdated.IsZero() {
		t.Error("expected lastUpdated to be set")
	}

	// Verify specific entries
	if m.CheckAddress("0xofac1") == nil {
		t.Error("expected OFAC address to be blacklisted")
	}
	if m.CheckDomain("phish1.com") == nil {
		t.Error("expected phish1.com to be blacklisted")
	}
	if m.CheckDomain("phish2.com") != nil {
		t.Error("expected phish2.com to be whitelisted (not blacklisted)")
	}
}

func TestUpdate_PartialFailure(t *testing.T) {
	// Only OFAC succeeds, others fail
	mock := &mockFetcher{
		responses: map[string][]byte{
			ofacURL: []byte(`["0xOFAC1"]`),
		},
	}
	m := NewManager(mock)

	// Should not return error because at least one source succeeded
	err := m.Update(context.Background())
	if err != nil {
		t.Fatalf("expected no error with partial success, got: %v", err)
	}

	if m.CheckAddress("0xofac1") == nil {
		t.Error("expected OFAC address to be loaded")
	}
}

func TestUpdate_AllFail(t *testing.T) {
	mock := &mockFetcher{
		responses: map[string][]byte{}, // all URLs will fail
	}
	m := NewManager(mock)

	err := m.Update(context.Background())
	if err == nil {
		t.Error("expected error when all sources fail")
	}
}

// mockFetcher for testing
type mockFetcher struct {
	responses map[string][]byte
}

func (f *mockFetcher) Fetch(_ context.Context, url string) ([]byte, error) {
	data, ok := f.responses[url]
	if !ok {
		return nil, fmt.Errorf("mock: no response for %s", url)
	}
	return data, nil
}
