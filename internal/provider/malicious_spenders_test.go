package provider

import (
	"strings"
	"testing"
)

func TestMaliciousSetLoaded(t *testing.T) {
	// The embedded list must parse into a non-trivial set (comment lines skipped).
	if len(maliciousSet) < 100 {
		t.Fatalf("malicious set looks too small: %d (embed/parse broken?)", len(maliciousSet))
	}
}

func TestIsMaliciousSpenderHit(t *testing.T) {
	// Pick any address actually present in the embedded set and confirm a hit,
	// including a case-insensitive (checksummed-looking) variant.
	var sample string
	for a := range maliciousSet {
		sample = a
		break
	}
	if sample == "" {
		t.Fatal("no sample address in malicious set")
	}
	if !IsMaliciousSpender(sample) {
		t.Errorf("known malicious address %q should hit", sample)
	}
	// Upper-cased variant must also hit (normalization).
	upper := "0x" + uppercaseHex(sample[2:])
	if !IsMaliciousSpender(upper) {
		t.Errorf("case-insensitive lookup failed for %q", upper)
	}
	// Surrounding whitespace must be tolerated.
	if !IsMaliciousSpender("  " + sample + "  ") {
		t.Errorf("whitespace-trimmed lookup failed for %q", sample)
	}
}

func TestIsMaliciousSpenderMiss(t *testing.T) {
	if IsMaliciousSpender("0x000000000000000000000000000000000000c0de") {
		t.Error("an arbitrary address must not be flagged malicious")
	}
	if IsMaliciousSpender("") {
		t.Error("empty string must not be flagged malicious")
	}
}

func TestMaliciousSetEntriesAreValid(t *testing.T) {
	// Every loaded entry must be a clean lowercase 42-char address (comment lines
	// and malformed entries must have been filtered out).
	for a := range maliciousSet {
		if len(a) != 42 || a[:2] != "0x" {
			t.Fatalf("malicious set has malformed entry: %q", a)
		}
	}
}

func uppercaseHex(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'a' && c <= 'f' {
			b[i] = c - 32
		}
	}
	return string(b)
}

func TestAllMaliciousSpenders_ReturnsFullSet(t *testing.T) {
	all := AllMaliciousSpenders()
	if len(all) == 0 {
		t.Fatal("expected a non-empty embedded blocklist")
	}
	// every returned address must be recognized by IsMaliciousSpender (same underlying set)
	n := 5
	if len(all) < n {
		n = len(all)
	}
	for _, a := range all[:n] {
		if !IsMaliciousSpender(a) {
			t.Errorf("AllMaliciousSpenders returned %s but IsMaliciousSpender says false", a)
		}
	}
	// all lowercase, 42-char 0x addresses
	m := 20
	if len(all) < m {
		m = len(all)
	}
	for _, a := range all[:m] {
		if len(a) != 42 || a[:2] != "0x" || a != strings.ToLower(a) {
			t.Errorf("malformed address in set: %q", a)
		}
	}
}
