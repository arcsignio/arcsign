// Package blacklist provides a manager for known malicious addresses and phishing domains.
// An offline seed is embedded (go:embed) and loaded synchronously on construction —
// OFAC sanctioned addresses (public domain) + the MIT MEW/Revoke list reused from the
// provider package — so the check works on first sign and offline. The online Update
// then MERGES a fuller list (Scam Sniffer, MetaMask eth-phishing-detect) on top without
// overwriting the seed. See seed.go and data/NOTICE.
package blacklist

import (
	"context"
	"strings"
	"sync"
	"time"
)

// BlacklistEntry stores metadata about a blacklisted item.
type BlacklistEntry struct {
	Source    string    // e.g. "OFAC", "ScamSniffer", "MetaMask"
	Category string    // e.g. "sanctioned", "phishing", "scam"
	AddedAt  time.Time // when this entry was added to local cache
}

// BlacklistMatch is returned when an address or domain matches a blacklist.
type BlacklistMatch struct {
	Value    string `json:"value"`    // the matched address or domain
	Source   string `json:"source"`   // which blacklist source
	Category string `json:"category"` // type of threat
}

// Warning represents a security warning for the frontend.
type Warning struct {
	Type    string `json:"type"`    // BLACKLISTED_ADDRESS, BLACKLISTED_DOMAIN
	Source  string `json:"source"`  // OFAC, ScamSniffer, MetaMask
	Message string `json:"message"` // human-readable warning
}

// Manager manages blacklisted addresses and domains with thread-safe access.
type Manager struct {
	addresses   map[string]BlacklistEntry // lowercase address → entry
	domains     map[string]BlacklistEntry // lowercase domain → entry
	mu          sync.RWMutex
	lastUpdated time.Time
	httpFetcher Fetcher // injectable for testing
}

// Fetcher abstracts HTTP fetching for testability.
type Fetcher interface {
	Fetch(ctx context.Context, url string) ([]byte, error)
}

// NewManager creates a new blacklist manager with empty lists.
func NewManager(fetcher Fetcher) *Manager {
	if fetcher == nil {
		fetcher = &httpFetcher{}
	}
	return &Manager{
		addresses:   seedEntries(), // offline seed loaded synchronously (OFAC + MEW/Revoke)
		domains:     make(map[string]BlacklistEntry),
		httpFetcher: fetcher,
	}
}

// Update fetches the latest blacklists from all sources and merges them.
func (m *Manager) Update(ctx context.Context) error {
	var allAddresses []addressWithSource
	var allDomains []domainWithSource
	var errs []error

	// Fetch OFAC sanctioned addresses
	ofacAddrs, err := fetchOFACAddresses(ctx, m.httpFetcher)
	if err != nil {
		errs = append(errs, err)
	} else {
		for _, addr := range ofacAddrs {
			allAddresses = append(allAddresses, addressWithSource{
				Address:  addr,
				Source:   "OFAC",
				Category: "sanctioned",
			})
		}
	}

	// Fetch Scam Sniffer addresses
	ssAddrs, err := fetchScamSnifferAddresses(ctx, m.httpFetcher)
	if err != nil {
		errs = append(errs, err)
	} else {
		for _, addr := range ssAddrs {
			allAddresses = append(allAddresses, addressWithSource{
				Address:  addr,
				Source:   "ScamSniffer",
				Category: "scam",
			})
		}
	}

	// Fetch Scam Sniffer domains
	ssDomains, err := fetchScamSnifferDomains(ctx, m.httpFetcher)
	if err != nil {
		errs = append(errs, err)
	} else {
		for _, d := range ssDomains {
			allDomains = append(allDomains, domainWithSource{
				Domain:   d,
				Source:   "ScamSniffer",
				Category: "phishing",
			})
		}
	}

	// Fetch MetaMask phishing domains
	mmDomains, err := fetchMetaMaskPhishingDomains(ctx, m.httpFetcher)
	if err != nil {
		errs = append(errs, err)
	} else {
		for _, d := range mmDomains {
			allDomains = append(allDomains, domainWithSource{
				Domain:   d,
				Source:   "MetaMask",
				Category: "phishing",
			})
		}
	}

	now := time.Now()
	m.mu.Lock()
	// Merge online addresses into the existing map (seeded offline). Do NOT
	// overwrite an existing entry — the embedded-ofac/embedded-mew seed source
	// must survive; online sources only ADD new addresses.
	for _, a := range allAddresses {
		key := strings.ToLower(a.Address)
		if _, exists := m.addresses[key]; !exists {
			m.addresses[key] = BlacklistEntry{Source: a.Source, Category: a.Category, AddedAt: now}
		}
	}
	for _, d := range allDomains {
		key := strings.ToLower(d.Domain)
		if _, exists := m.domains[key]; !exists {
			m.domains[key] = BlacklistEntry{Source: d.Source, Category: d.Category, AddedAt: now}
		}
	}
	m.lastUpdated = now
	m.mu.Unlock()

	// Return first error if all sources failed
	if len(errs) == 4 {
		return errs[0]
	}
	return nil
}

// CheckAddress checks if an address is blacklisted. Returns nil if safe.
func (m *Manager) CheckAddress(address string) *BlacklistMatch {
	if address == "" {
		return nil
	}
	key := strings.ToLower(address)
	m.mu.RLock()
	entry, found := m.addresses[key]
	m.mu.RUnlock()
	if !found {
		return nil
	}
	return &BlacklistMatch{
		Value:    address,
		Source:   entry.Source,
		Category: entry.Category,
	}
}

// CheckDomain checks if a domain is blacklisted. Supports subdomain matching.
// e.g. "evil.example.com" matches if "example.com" is blacklisted.
func (m *Manager) CheckDomain(domain string) *BlacklistMatch {
	if domain == "" {
		return nil
	}
	domain = strings.ToLower(strings.TrimSuffix(domain, "."))

	m.mu.RLock()
	defer m.mu.RUnlock()

	// Exact match
	if entry, found := m.domains[domain]; found {
		return &BlacklistMatch{
			Value:    domain,
			Source:   entry.Source,
			Category: entry.Category,
		}
	}

	// Subdomain match: check parent domains
	parts := strings.Split(domain, ".")
	for i := 1; i < len(parts)-1; i++ {
		parent := strings.Join(parts[i:], ".")
		if entry, found := m.domains[parent]; found {
			return &BlacklistMatch{
				Value:    parent,
				Source:   entry.Source,
				Category: entry.Category,
			}
		}
	}

	return nil
}

// IsAddressSafe returns true if the address is NOT blacklisted.
func (m *Manager) IsAddressSafe(address string) bool {
	return m.CheckAddress(address) == nil
}

// IsDomainSafe returns true if the domain is NOT blacklisted.
func (m *Manager) IsDomainSafe(domain string) bool {
	return m.CheckDomain(domain) == nil
}

// Stats returns current blacklist statistics.
func (m *Manager) Stats() (addressCount, domainCount int, lastUpdated time.Time) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.addresses), len(m.domains), m.lastUpdated
}

// AddAddress manually adds an address to the blacklist (for testing or custom lists).
func (m *Manager) AddAddress(address, source, category string) {
	key := strings.ToLower(address)
	m.mu.Lock()
	m.addresses[key] = BlacklistEntry{
		Source:   source,
		Category: category,
		AddedAt:  time.Now(),
	}
	m.mu.Unlock()
}

// AddDomain manually adds a domain to the blacklist.
func (m *Manager) AddDomain(domain, source, category string) {
	key := strings.ToLower(strings.TrimSuffix(domain, "."))
	m.mu.Lock()
	m.domains[key] = BlacklistEntry{
		Source:   source,
		Category: category,
		AddedAt:  time.Now(),
	}
	m.mu.Unlock()
}

// internal helper types
type addressWithSource struct {
	Address  string
	Source   string
	Category string
}

type domainWithSource struct {
	Domain   string
	Source   string
	Category string
}
