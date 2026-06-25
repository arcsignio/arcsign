package txguard

import (
	"testing"

	"github.com/arcsignio/arcsign/internal/security/blacklist"
)

// newOfflineBlacklist builds a blacklist Manager with the embedded seed loaded
// (offline, no net). Tests add deterministic addresses via AddAddress rather
// than relying on the seed's shifting contents.
func newOfflineBlacklist(t *testing.T) *blacklist.Manager {
	t.Helper()
	return blacklist.NewManager(nil)
}

func TestCheckMessage(t *testing.T) {
	t.Run("clean message → safe", func(t *testing.T) {
		g := NewGuard(newOfflineBlacklist(t), nil)
		r := g.CheckMessage([]byte("Sign in to Example: nonce 12345"))
		if r.RiskLevel != RiskSafe || r.RequiresAcknowledge {
			t.Fatalf("want safe, got %+v", r)
		}
	})
	t.Run("message containing blacklisted address → danger + ack", func(t *testing.T) {
		const evil = "0x000000000000000000000000000000000000bAd0"
		mgr := newOfflineBlacklist(t)
		mgr.AddAddress(evil, "test", "scam")
		g := NewGuard(mgr, nil)
		r := g.CheckMessage([]byte("please send approval to " + evil + " now"))
		if !r.RequiresAcknowledge || r.BlacklistMatch == nil {
			t.Fatalf("want blacklist match+ack, got %+v", r)
		}
	})
	t.Run("nil/empty message → safe", func(t *testing.T) {
		g := NewGuard(newOfflineBlacklist(t), nil)
		r := g.CheckMessage(nil)
		if r.RiskLevel != RiskSafe || r.RequiresAcknowledge {
			t.Fatalf("want safe, got %+v", r)
		}
	})
}
