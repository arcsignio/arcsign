package txguard

// EIP-712 typed-data risk detection helpers. The package doc comment lives in
// guard.go; this file only adds typed-data utilities.

import (
	"regexp"

	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

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

// riskyMessageKeys are message fields whose values are spender/operator-type
// addresses an attacker controls in a phishing signature.
var riskyMessageKeys = []string{"spender", "operator", "to", "token"}

// extractRiskyAddresses pulls attacker-relevant addresses out of typed data:
// the domain verifyingContract plus spender/operator/to/token fields found in
// the message (one level of nesting, covering Permit2's nested "details").
// Pure: no cgo, network, or wallet access — fully unit-testable.
func extractRiskyAddresses(td *apitypes.TypedData) []string {
	if td == nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	add := func(v interface{}) {
		s, ok := v.(string)
		if !ok || s == "" || seen[s] {
			return
		}
		seen[s] = true
		out = append(out, s)
	}

	add(td.Domain.VerifyingContract)

	var scan func(m map[string]interface{})
	scan = func(m map[string]interface{}) {
		for _, k := range riskyMessageKeys {
			if v, ok := m[k]; ok {
				add(v)
			}
		}
		for _, v := range m {
			if nested, ok := v.(map[string]interface{}); ok {
				scan(nested)
			}
		}
	}
	scan(td.Message)
	return out
}
