package provider

import (
	_ "embed"
	"strings"
)

// Embedded blocklist of known malicious / phishing / exploited addresses, used
// by the Token Approvals view to flag dangerous spenders. Built only from
// MIT-licensed sources (see data/NOTICE). Static + offline: it ships with the
// app version and is never fetched at runtime (privacy-preserving by design).
//
// The lookup is chain-agnostic: a malicious address is dangerous on any chain,
// so we match on the bare address regardless of network.

//go:embed data/malicious_spenders.txt
var maliciousRaw string

// maliciousSet is the parsed blocklist: lowercase address -> present. Lines
// starting with '#' (header/attribution) and malformed entries are skipped.
var maliciousSet = parseMaliciousSet(maliciousRaw)

func parseMaliciousSet(raw string) map[string]struct{} {
	m := make(map[string]struct{})
	for _, line := range strings.Split(raw, "\n") {
		a := strings.ToLower(strings.TrimSpace(line))
		if strings.HasPrefix(a, "#") {
			continue
		}
		if strings.HasPrefix(a, "0x") && len(a) == 42 {
			m[a] = struct{}{}
		}
	}
	return m
}

// IsMaliciousSpender reports whether the address is on the embedded blocklist.
// The address is normalized (trimmed + lowercased), so callers may pass a
// checksummed or whitespace-padded value.
func IsMaliciousSpender(addr string) bool {
	a := strings.ToLower(strings.TrimSpace(addr))
	_, ok := maliciousSet[a]
	return ok
}

// AllMaliciousSpenders returns every address in the embedded blocklist (lowercase).
// Used by the txguard blacklist seed to reuse this MIT-licensed offline data
// without duplicating the file.
func AllMaliciousSpenders() []string {
	out := make([]string, 0, len(maliciousSet))
	for a := range maliciousSet {
		out = append(out, a)
	}
	return out
}
