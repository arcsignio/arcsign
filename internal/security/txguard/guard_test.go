package txguard

import (
	"context"
	"testing"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
	"github.com/arcsignio/arcsign/internal/security/simulation"
)

func TestCheck_FreeUser(t *testing.T) {
	blMgr := blacklist.NewManager(nil)
	blMgr.AddAddress("0xevil", "OFAC", "sanctioned")

	guard := NewGuard(blMgr, simulation.NewSimulator())

	report := guard.Check(context.Background(), false, "0xevil", "ethereum", "test-key", simulation.TxParams{})

	if !report.ProRequired {
		t.Error("expected proRequired=true for free user (simulation gated)")
	}
	// New semantics: blacklist is free and runs for everyone, so a Free user
	// targeting a blacklisted address still gets the match + danger risk.
	if report.BlacklistMatch == nil {
		t.Error("expected blacklist check to run for free user (blacklist is free)")
	}
	if report.RiskLevel != RiskDanger {
		t.Errorf("expected danger risk level for free user on blacklisted addr, got %s", report.RiskLevel)
	}
}

func TestCheck_ProUser_SafeAddress(t *testing.T) {
	blMgr := blacklist.NewManager(nil)
	blMgr.AddAddress("0xevil", "OFAC", "sanctioned")

	// No simulator (nil) to avoid real API calls
	guard := NewGuard(blMgr, nil)

	report := guard.Check(context.Background(), true, "0xsafe", "ethereum", "", simulation.TxParams{})

	if report.ProRequired {
		t.Error("expected proRequired=false for pro user")
	}
	if report.BlacklistMatch != nil {
		t.Error("expected no blacklist match for safe address")
	}
	if report.RiskLevel != RiskSafe {
		t.Errorf("expected risk level safe, got %s", report.RiskLevel)
	}
	if len(report.Warnings) != 0 {
		t.Errorf("expected 0 warnings, got %d", len(report.Warnings))
	}
}

func TestCheck_ProUser_BlacklistedAddress(t *testing.T) {
	blMgr := blacklist.NewManager(nil)
	blMgr.AddAddress("0xDangerousAddr", "OFAC", "sanctioned")

	guard := NewGuard(blMgr, nil)

	report := guard.Check(context.Background(), true, "0xdangerousaddr", "ethereum", "", simulation.TxParams{})

	if report.ProRequired {
		t.Error("expected proRequired=false for pro user")
	}
	if report.BlacklistMatch == nil {
		t.Fatal("expected blacklist match for dangerous address")
	}
	if report.BlacklistMatch.Source != "OFAC" {
		t.Errorf("expected source OFAC, got %s", report.BlacklistMatch.Source)
	}
	if report.RiskLevel != RiskDanger {
		t.Errorf("expected risk level danger, got %s", report.RiskLevel)
	}
	if len(report.Warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(report.Warnings))
	}
	if report.Warnings[0].Type != "BLACKLISTED_ADDRESS" {
		t.Errorf("expected warning type BLACKLISTED_ADDRESS, got %s", report.Warnings[0].Type)
	}
}

func TestCheck_ProUser_EmptyAddress(t *testing.T) {
	blMgr := blacklist.NewManager(nil)
	guard := NewGuard(blMgr, nil)

	report := guard.Check(context.Background(), true, "", "ethereum", "", simulation.TxParams{})

	if report.BlacklistMatch != nil {
		t.Error("expected no match for empty address")
	}
	if report.RiskLevel != RiskSafe {
		t.Errorf("expected safe, got %s", report.RiskLevel)
	}
}

func TestCheck_NilBlacklistManager(t *testing.T) {
	guard := NewGuard(nil, nil)

	report := guard.Check(context.Background(), true, "0xany", "ethereum", "", simulation.TxParams{})

	if report.BlacklistMatch != nil {
		t.Error("expected no match with nil blacklist manager")
	}
}

func TestCheckDomain(t *testing.T) {
	blMgr := blacklist.NewManager(nil)
	blMgr.AddDomain("evil-dapp.com", "MetaMask", "phishing")

	guard := NewGuard(blMgr, nil)

	// Match
	match := guard.CheckDomain("evil-dapp.com")
	if match == nil {
		t.Fatal("expected match for phishing domain")
	}
	if match.Source != "MetaMask" {
		t.Errorf("expected source MetaMask, got %s", match.Source)
	}

	// No match
	if guard.CheckDomain("safe-dapp.com") != nil {
		t.Error("expected no match for safe domain")
	}
}

func TestCheckDomain_NilManager(t *testing.T) {
	guard := NewGuard(nil, nil)
	if guard.CheckDomain("anything.com") != nil {
		t.Error("expected nil with nil blacklist manager")
	}
}

func TestCheck_ProUser_WithSimulationResult(t *testing.T) {
	blMgr := blacklist.NewManager(nil)
	// No real simulator — just test that report structure is correct
	guard := NewGuard(blMgr, nil)

	report := guard.Check(context.Background(), true, "0xsafe", "ethereum", "", simulation.TxParams{
		From: "0xSender", To: "0xReceiver", Value: "0x0",
	})

	// Without simulator or API key, simulation should be nil
	if report.Simulation != nil {
		t.Error("expected nil simulation without simulator/API key")
	}
	if report.RiskLevel != RiskSafe {
		t.Errorf("expected safe, got %s", report.RiskLevel)
	}
}

func newGuardWithBlacklistedAddr(addr string) *Guard {
	blMgr := blacklist.NewManager(nil)
	blMgr.AddAddress(addr, "OFAC", "sanctioned")
	return NewGuard(blMgr, nil)
}

func TestCheck_FreeUserStillGetsBlacklist(t *testing.T) {
	addr := "0x000000000000000000000000000000000000dead"
	g := newGuardWithBlacklistedAddr(addr)
	r := g.Check(context.Background(), false, addr, "ethereum", "", simulation.TxParams{To: addr})
	if r.BlacklistMatch == nil {
		t.Fatal("Free user must still get the blacklist match (blacklist is free)")
	}
	if !r.RequiresAcknowledge {
		t.Error("a blacklist hit must set RequiresAcknowledge")
	}
	if r.RiskLevel != RiskDanger {
		t.Errorf("expected danger, got %s", r.RiskLevel)
	}
}

func TestCheck_SafeAddrNoAcknowledge(t *testing.T) {
	g := NewGuard(blacklist.NewManager(nil), nil)
	r := g.Check(context.Background(), false, "0x1111111111111111111111111111111111111111", "ethereum", "", simulation.TxParams{})
	if r.RequiresAcknowledge {
		t.Error("a non-blacklisted address must NOT require acknowledge")
	}
}

func TestCheck_ProRequiredMeansSimulationSkipped(t *testing.T) {
	addr := "0x000000000000000000000000000000000000dead"
	g := newGuardWithBlacklistedAddr(addr)
	r := g.Check(context.Background(), false, addr, "ethereum", "", simulation.TxParams{To: addr})
	if !r.ProRequired {
		t.Error("Free user → ProRequired true (simulation gated)")
	}
	if r.BlacklistMatch == nil {
		t.Error("ProRequired must NOT suppress the blacklist result")
	}
}
