package txguard

import (
	"context"
	"testing"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
	"github.com/arcsignio/arcsign/internal/security/simulation"
)

// TestCheckFreeReturnsProRequired verifies that a Free user gets proRequired=true
// from guard.Check, matching the behaviour expected by CheckTransactionSecurity FFI.
func TestCheckFreeReturnsProRequired(t *testing.T) {
	g := NewGuard(blacklist.NewManager(nil), simulation.NewSimulator())
	r := g.Check(context.Background(), false, "0xabc", "ethereum", "", simulation.TxParams{})
	if r == nil {
		t.Fatal("report must not be nil")
	}
	if !r.ProRequired {
		t.Errorf("Free user should get proRequired=true, got false")
	}
}

// TestCheckProNonAlchemyChainGraceful verifies that a Pro user on a non-Alchemy
// chain (BSC) gets a non-nil report without proRequired, so signing is never blocked.
func TestCheckProNonAlchemyChainGraceful(t *testing.T) {
	g := NewGuard(blacklist.NewManager(nil), simulation.NewSimulator())
	r := g.Check(context.Background(), true, "0x000000000000000000000000000000000000dEaD", "bsc", "", simulation.TxParams{
		From: "0x1",
		To:   "0x2",
	})
	if r == nil {
		t.Fatal("report must not be nil for a non-Alchemy chain")
	}
	if r.ProRequired {
		t.Errorf("Pro user should not get proRequired=true")
	}
}
