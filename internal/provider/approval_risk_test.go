package provider

import "testing"

func TestClassifyApprovalRisk(t *testing.T) {
	cases := []struct {
		name string
		in   RiskInput
		want RiskLevel
	}{
		// Malicious always wins, regardless of every other signal.
		{"malicious beats known+limited", RiskInput{IsUnlimited: false, SpenderKnown: true, IsEOA: false, IsMalicious: true}, RiskRed},
		{"malicious beats unlimited+known", RiskInput{IsUnlimited: true, SpenderKnown: true, IsMalicious: true}, RiskRed},

		// EOA spender is red (Rabby rule 1022) — beats everything except malicious priority above.
		{"EOA limited unknown", RiskInput{IsUnlimited: false, SpenderKnown: false, IsEOA: true}, RiskRed},
		{"EOA even if 'known' flag somehow set", RiskInput{SpenderKnown: true, IsEOA: true}, RiskRed},

		// unlimited × known four quadrants (no EOA, no malicious).
		{"unlimited + unknown contract", RiskInput{IsUnlimited: true, SpenderKnown: false, IsEOA: false}, RiskRed},
		{"unlimited + known", RiskInput{IsUnlimited: true, SpenderKnown: true, IsEOA: false}, RiskYellow},
		{"limited + unknown contract", RiskInput{IsUnlimited: false, SpenderKnown: false, IsEOA: false}, RiskYellow},
		{"limited + known", RiskInput{IsUnlimited: false, SpenderKnown: true, IsEOA: false}, RiskGreen},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ClassifyApprovalRisk(tc.in); got != tc.want {
				t.Errorf("ClassifyApprovalRisk(%+v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// Priority order must be: malicious > EOA > (unlimited/known quadrants).
func TestClassifyApprovalRiskPriority(t *testing.T) {
	// malicious + EOA + everything → still red (malicious checked first, but both red anyway)
	if got := ClassifyApprovalRisk(RiskInput{IsMalicious: true, IsEOA: true, IsUnlimited: true}); got != RiskRed {
		t.Errorf("malicious+EOA+unlimited should be red, got %q", got)
	}
	// EOA with limited+known must NOT downgrade to green — EOA dominates.
	if got := ClassifyApprovalRisk(RiskInput{IsEOA: true, SpenderKnown: true, IsUnlimited: false}); got != RiskRed {
		t.Errorf("EOA must dominate known+limited, got %q", got)
	}
}

func TestRiskLevelValues(t *testing.T) {
	// The string values cross the FFI boundary to the frontend — lock them.
	if RiskRed != "red" || RiskYellow != "yellow" || RiskGreen != "green" {
		t.Errorf("risk level string values changed: %q %q %q", RiskRed, RiskYellow, RiskGreen)
	}
}
