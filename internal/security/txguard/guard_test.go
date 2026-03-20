package txguard

import (
	"context"
	"testing"

	"github.com/Jason-chen-taiwan/arcSignv2/internal/security/blacklist"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/security/simulation"
)

func TestCheck_FreeUser(t *testing.T) {
	blMgr := blacklist.NewManager(nil)
	blMgr.AddAddress("0xevil", "OFAC", "sanctioned")

	guard := NewGuard(blMgr, simulation.NewSimulator())

	report := guard.Check(context.Background(), false, "0xevil", "ethereum", "test-key", simulation.TxParams{})

	if !report.ProRequired {
		t.Error("expected proRequired=true for free user")
	}
	// Free user should NOT get blacklist results (no checks performed)
	if report.BlacklistMatch != nil {
		t.Error("expected no blacklist check for free user")
	}
	if report.RiskLevel != RiskSafe {
		t.Error("expected safe risk level for free user (no checks performed)")
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
