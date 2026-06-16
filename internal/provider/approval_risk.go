package provider

// Approval risk classification for the Token Approvals security view. Pure logic,
// no I/O: every signal is computed by the caller (registry lookup, eth_getCode,
// blocklist lookup) and passed in, so this is trivially testable and the risk
// rules live in one place.
//
// The signal model follows the on-chain-computable subset of Rabby's open-source
// security engine (github.com/RabbyHub/rabby-security-engine): unlimited amount,
// spender-is-EOA (rule 1022 — an EOA as spender is almost always a scam), known
// vs unknown spender, and blocklist hit. No external API, no privacy leak.

// RiskLevel is the traffic-light risk tier shown per approval. The string values
// cross the FFI boundary to the frontend — do not change them without updating
// dashboard/src/types/approvals.ts.
type RiskLevel string

const (
	RiskRed    RiskLevel = "red"    // act now: malicious, EOA spender, or unlimited-to-unknown
	RiskYellow RiskLevel = "yellow" // caution: unlimited-to-known or limited-to-unknown
	RiskGreen  RiskLevel = "green"  // limited allowance to a known contract
)

// RiskInput carries the precomputed signals for one approval.
type RiskInput struct {
	IsUnlimited  bool // allowance >= 2^128
	SpenderKnown bool // spender is in the curated known-spender registry
	IsEOA        bool // spender has no code (externally-owned account) — only meaningful for unknown spenders
	IsMalicious  bool // spender is on the embedded blocklist
}

// ClassifyApprovalRisk maps the signals to a traffic-light tier. Priority order:
// malicious > EOA > the unlimited × known quadrants. The first two are hard red
// and dominate the amount/known signals.
func ClassifyApprovalRisk(in RiskInput) RiskLevel {
	switch {
	case in.IsMalicious:
		return RiskRed // blocklisted spender — highest priority
	case in.IsEOA:
		return RiskRed // EOA as spender is almost always a scam (Rabby rule 1022)
	case in.SpenderKnown:
		if in.IsUnlimited {
			return RiskYellow // unlimited, but a known protocol
		}
		return RiskGreen // limited + known = safest
	default: // unknown contract
		if in.IsUnlimited {
			return RiskRed // unlimited to an unknown contract
		}
		return RiskYellow // limited to an unknown contract
	}
}
