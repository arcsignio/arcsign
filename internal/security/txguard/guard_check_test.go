package txguard

import (
	"context"
	"testing"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
	"github.com/arcsignio/arcsign/internal/security/simulation"
)

// TestCheckNonAlchemyChainGraceful verifies that a non-Alchemy chain (BSC)
// still gets a non-nil report, so signing is never blocked.
func TestCheckNonAlchemyChainGraceful(t *testing.T) {
	g := NewGuard(blacklist.NewManager(nil), simulation.NewSimulator())
	r := g.Check(context.Background(), "0x000000000000000000000000000000000000dEaD", "bsc", "", simulation.TxParams{
		From: "0x1",
		To:   "0x2",
	})
	if r == nil {
		t.Fatal("report must not be nil for a non-Alchemy chain")
	}
}
