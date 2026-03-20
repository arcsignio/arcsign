package blacklist

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// OFAC sanctioned ETH addresses (nightly updates)
	ofacURL = "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.json"

	// Scam Sniffer malicious contract addresses (7-day delayed public list)
	scamSnifferAddressURL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json"

	// Scam Sniffer phishing domains
	scamSnifferDomainURL = "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json"

	// MetaMask eth-phishing-detect config (continuously updated)
	metaMaskPhishingURL = "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/main/src/config.json"

	// Default HTTP timeout for fetching blacklists
	fetchTimeout = 30 * time.Second
)

// httpFetcher is the default HTTP-based fetcher.
type httpFetcher struct{}

func (f *httpFetcher) Fetch(ctx context.Context, url string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, fetchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch %s: HTTP %d", url, resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024)) // 50MB max
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	return body, nil
}

// fetchOFACAddresses fetches OFAC sanctioned ETH addresses.
// Format: JSON array of strings ["0x...", "0x..."]
func fetchOFACAddresses(ctx context.Context, fetcher Fetcher) ([]string, error) {
	body, err := fetcher.Fetch(ctx, ofacURL)
	if err != nil {
		return nil, fmt.Errorf("OFAC fetch: %w", err)
	}

	var addresses []string
	if err := json.Unmarshal(body, &addresses); err != nil {
		return nil, fmt.Errorf("OFAC parse: %w", err)
	}

	// Normalize: lowercase
	result := make([]string, 0, len(addresses))
	for _, addr := range addresses {
		addr = strings.TrimSpace(addr)
		if addr != "" {
			result = append(result, strings.ToLower(addr))
		}
	}

	return result, nil
}

// fetchScamSnifferAddresses fetches Scam Sniffer malicious contract addresses.
// Format: JSON array of strings or object with addresses field.
func fetchScamSnifferAddresses(ctx context.Context, fetcher Fetcher) ([]string, error) {
	body, err := fetcher.Fetch(ctx, scamSnifferAddressURL)
	if err != nil {
		return nil, fmt.Errorf("ScamSniffer addresses fetch: %w", err)
	}

	// Try array format first
	var addresses []string
	if err := json.Unmarshal(body, &addresses); err == nil {
		result := make([]string, 0, len(addresses))
		for _, addr := range addresses {
			addr = strings.TrimSpace(addr)
			if addr != "" {
				result = append(result, strings.ToLower(addr))
			}
		}
		return result, nil
	}

	// Try object format { "addresses": [...] }
	var obj struct {
		Addresses []string `json:"addresses"`
	}
	if err := json.Unmarshal(body, &obj); err != nil {
		return nil, fmt.Errorf("ScamSniffer addresses parse: %w", err)
	}

	result := make([]string, 0, len(obj.Addresses))
	for _, addr := range obj.Addresses {
		addr = strings.TrimSpace(addr)
		if addr != "" {
			result = append(result, strings.ToLower(addr))
		}
	}
	return result, nil
}

// fetchScamSnifferDomains fetches Scam Sniffer phishing domains.
// Format: JSON array of strings.
func fetchScamSnifferDomains(ctx context.Context, fetcher Fetcher) ([]string, error) {
	body, err := fetcher.Fetch(ctx, scamSnifferDomainURL)
	if err != nil {
		return nil, fmt.Errorf("ScamSniffer domains fetch: %w", err)
	}

	var domains []string
	if err := json.Unmarshal(body, &domains); err == nil {
		result := make([]string, 0, len(domains))
		for _, d := range domains {
			d = strings.TrimSpace(strings.ToLower(d))
			if d != "" {
				result = append(result, d)
			}
		}
		return result, nil
	}

	// Try object format
	var obj struct {
		Domains []string `json:"domains"`
	}
	if err := json.Unmarshal(body, &obj); err != nil {
		return nil, fmt.Errorf("ScamSniffer domains parse: %w", err)
	}

	result := make([]string, 0, len(obj.Domains))
	for _, d := range obj.Domains {
		d = strings.TrimSpace(strings.ToLower(d))
		if d != "" {
			result = append(result, d)
		}
	}
	return result, nil
}

// metaMaskConfig represents the MetaMask eth-phishing-detect config structure.
type metaMaskConfig struct {
	Blacklist []string `json:"blacklist"`
	Fuzzylist []string `json:"fuzzylist"`
	Whitelist []string `json:"whitelist"`
}

// fetchMetaMaskPhishingDomains fetches MetaMask's phishing domain list.
// Format: JSON object with "blacklist", "fuzzylist", "whitelist" arrays.
func fetchMetaMaskPhishingDomains(ctx context.Context, fetcher Fetcher) ([]string, error) {
	body, err := fetcher.Fetch(ctx, metaMaskPhishingURL)
	if err != nil {
		return nil, fmt.Errorf("MetaMask phishing fetch: %w", err)
	}

	var config metaMaskConfig
	if err := json.Unmarshal(body, &config); err != nil {
		return nil, fmt.Errorf("MetaMask phishing parse: %w", err)
	}

	// Build whitelist set for exclusion
	whitelistSet := make(map[string]struct{}, len(config.Whitelist))
	for _, w := range config.Whitelist {
		whitelistSet[strings.ToLower(strings.TrimSpace(w))] = struct{}{}
	}

	// Merge blacklist + fuzzylist, excluding whitelisted
	result := make([]string, 0, len(config.Blacklist)+len(config.Fuzzylist))
	seen := make(map[string]struct{}, len(config.Blacklist)+len(config.Fuzzylist))

	for _, d := range config.Blacklist {
		d = strings.TrimSpace(strings.ToLower(d))
		if d == "" {
			continue
		}
		if _, whitelisted := whitelistSet[d]; whitelisted {
			continue
		}
		if _, exists := seen[d]; exists {
			continue
		}
		seen[d] = struct{}{}
		result = append(result, d)
	}

	for _, d := range config.Fuzzylist {
		d = strings.TrimSpace(strings.ToLower(d))
		if d == "" {
			continue
		}
		if _, whitelisted := whitelistSet[d]; whitelisted {
			continue
		}
		if _, exists := seen[d]; exists {
			continue
		}
		seen[d] = struct{}{}
		result = append(result, d)
	}

	return result, nil
}
