package blacklist

import (
	_ "embed"
	"strings"

	"github.com/arcsignio/arcsign/internal/provider"
)

//go:embed data/ofac_sanctioned.txt
var ofacSeedRaw string

// seedEntries returns the embedded offline seed: OFAC sanctioned addresses
// (public domain) + the MIT-licensed MEW/Revoke list reused from the provider
// package's already-embedded data. Lowercase keys. Never fetched at runtime.
func seedEntries() map[string]BlacklistEntry {
	out := make(map[string]BlacklistEntry)
	for _, line := range strings.Split(ofacSeedRaw, "\n") {
		a := strings.ToLower(strings.TrimSpace(line))
		if strings.HasPrefix(a, "#") {
			continue
		}
		if strings.HasPrefix(a, "0x") && len(a) == 42 {
			out[a] = BlacklistEntry{Source: "embedded-ofac", Category: "sanctioned"}
		}
	}
	for _, a := range provider.AllMaliciousSpenders() {
		a = strings.ToLower(a)
		if _, exists := out[a]; !exists {
			out[a] = BlacklistEntry{Source: "embedded-mew", Category: "malicious"}
		}
	}
	return out
}
