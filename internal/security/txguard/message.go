package txguard

// Lightweight personal_sign message gate. The package doc comment lives in
// guard.go; this file only adds the free-text message blacklist scan.

import (
	"regexp"
	"strings"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
)

// embeddedAddrRe finds 0x-prefixed 20-byte hex addresses inside free text.
// (canonicalAddrRe in typeddata.go is anchored ^...$, so unusable for FindAll.)
var embeddedAddrRe = regexp.MustCompile(`0x[0-9a-fA-F]{40}`)

// CheckMessage is the lightweight personal_sign gate: scan a text message for
// embedded 0x addresses and run each through the blacklist. Text messages
// rarely carry structured risk, so this is best-effort, not exhaustive.
// RequiresAcknowledge is computed here (backend), never on the frontend.
func (g *Guard) CheckMessage(msg []byte) *SecurityReport {
	report := &SecurityReport{
		Warnings:  make([]blacklist.Warning, 0),
		RiskLevel: RiskSafe,
	}
	if g.blacklistMgr == nil || len(msg) == 0 {
		report.RequiresAcknowledge = false
		return report
	}
	for _, addr := range embeddedAddrRe.FindAllString(string(msg), -1) {
		if match := g.blacklistMgr.CheckAddress(strings.ToLower(addr)); match != nil {
			report.BlacklistMatch = match
			report.Warnings = append(report.Warnings, blacklist.Warning{
				Type:    "BLACKLISTED_ADDRESS",
				Source:  match.Source,
				Message: "訊息內含黑名單地址 (" + match.Category + ")",
			})
			report.RiskLevel = RiskDanger
			break
		}
	}
	report.RequiresAcknowledge = report.BlacklistMatch != nil || report.RiskLevel == RiskDanger
	return report
}
