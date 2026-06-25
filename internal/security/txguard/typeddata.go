package txguard

// EIP-712 typed-data risk detection helpers. The package doc comment lives in
// guard.go; this file only adds typed-data utilities.

import "regexp"

// canonicalAddrRe matches a standard 0x-prefixed 20-byte hex address.
var canonicalAddrRe = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)

// isCanonicalAddress reports whether s is a canonical 0x+40hex address.
// An empty string is canonical (an absent verifyingContract is not an attack).
// A non-canonical value (e.g. a decimal number like "996101...") is the
// EIP-712 normalization bypass ScamSniffer/SlowMist disclosed.
func isCanonicalAddress(s string) bool {
	if s == "" {
		return true
	}
	return canonicalAddrRe.MatchString(s)
}
