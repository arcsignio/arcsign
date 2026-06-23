// Package txguard provides a unified transaction security check entry point.
// It combines blacklist checking and transaction simulation, gated by Pro membership.
package txguard

import (
	"context"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
	"github.com/arcsignio/arcsign/internal/security/simulation"
)

// RiskLevel indicates the overall risk assessment.
const (
	RiskSafe    = "safe"
	RiskWarning = "warning"
	RiskDanger  = "danger"
)

// SecurityReport is the complete security assessment for a transaction.
type SecurityReport struct {
	ProRequired    bool                       `json:"proRequired"`
	BlacklistMatch *blacklist.BlacklistMatch   `json:"blacklistMatch,omitempty"`
	Simulation     *simulation.SimulationResult `json:"simulation,omitempty"`
	Warnings       []blacklist.Warning         `json:"warnings"`
	RiskLevel      string                      `json:"riskLevel"`
	RequiresAcknowledge bool                   `json:"requiresAcknowledge"`
}

// Guard is the unified transaction security checker.
type Guard struct {
	blacklistMgr *blacklist.Manager
	simulator    *simulation.Simulator
}

// NewGuard creates a new TxGuard with the given blacklist manager and simulator.
func NewGuard(blMgr *blacklist.Manager, sim *simulation.Simulator) *Guard {
	return &Guard{
		blacklistMgr: blMgr,
		simulator:    sim,
	}
}

// Check performs security checks on a transaction.
// The blacklist check runs for EVERYONE (free, zero-cost, embedded seed).
// Transaction simulation is Pro-only (needs an Alchemy key, has cost), so
// ProRequired now means ONLY "simulation didn't run", not "report invalid".
func (g *Guard) Check(ctx context.Context, isPro bool, toAddress string, chainID string, alchemyKey string, tx simulation.TxParams) *SecurityReport {
	report := &SecurityReport{
		Warnings:  make([]blacklist.Warning, 0),
		RiskLevel: RiskSafe,
	}

	// 1. Blacklist check — runs for EVERYONE (free, zero-cost, embedded seed).
	if g.blacklistMgr != nil && toAddress != "" {
		if match := g.blacklistMgr.CheckAddress(toAddress); match != nil {
			report.BlacklistMatch = match
			report.Warnings = append(report.Warnings, blacklist.Warning{
				Type:    "BLACKLISTED_ADDRESS",
				Source:  match.Source,
				Message: "目標地址在 " + match.Source + " 黑名單中 (" + match.Category + ")",
			})
			report.RiskLevel = RiskDanger
		}
	}

	// 2. Transaction simulation — Pro only (needs Alchemy key, has cost).
	// ProRequired now means ONLY "simulation didn't run", not "report invalid".
	report.ProRequired = !isPro
	if isPro && g.simulator != nil && alchemyKey != "" {
		simResult, err := g.simulator.SimulateTransaction(ctx, chainID, alchemyKey, tx)
		if err == nil && simResult != nil {
			report.Simulation = simResult
			if !simResult.Success && report.RiskLevel != RiskDanger {
				report.RiskLevel = RiskWarning
				report.Warnings = append(report.Warnings, blacklist.Warning{
					Type:    "SIMULATION_FAILED",
					Source:  "Simulation",
					Message: "交易模擬失敗: " + simResult.Error,
				})
			}
		}
	}

	// 3. Backend-computed danger judgment (moved off the frontend): a blacklist
	// hit or danger risk requires the user to acknowledge before signing.
	report.RequiresAcknowledge = report.BlacklistMatch != nil || report.RiskLevel == RiskDanger

	return report
}

// CheckDomain checks if a domain is blacklisted (for WalletConnect dApp validation).
func (g *Guard) CheckDomain(domain string) *blacklist.BlacklistMatch {
	if g.blacklistMgr == nil {
		return nil
	}
	return g.blacklistMgr.CheckDomain(domain)
}
