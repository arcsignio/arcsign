package rpc

import (
	"strings"
	"testing"
)

// mainnetChains are the EVM chains the self-hosted balance path relies on. Each
// must resolve to RPC endpoints — a chain here with no endpoints means balances
// silently disappear for it (the failure mode we hit when Polygon's endpoints
// all started requiring API keys / shut down).
//
// ⚠️ MANUAL SYNC: this list mirrors provider.AllMainnetNetworks() but is written
// out by hand because the rpc package cannot import provider (import cycle). When
// you add a chain, add its rpc-registry chain key here too. If you forget, THIS
// test won't catch it — but provider.TestEveryMainnetChainHasSelfHostedSupport
// will (it loops AllMainnetNetworks and resolves through to this registry), so
// the gap is caught on the provider side, not here. Keeping both in sync keeps
// the failure message local to the layer that's actually broken.
var mainnetChains = []string{
	"ethereum", "polygon", "arbitrum", "optimism", "base", "bsc", "avalanche",
}

// TestEveryMainnetChainHasEndpoints guards that each chain has a primary plus at
// least one backup, so a single dead public RPC can fall back rather than taking
// the whole chain offline.
func TestEveryMainnetChainHasEndpoints(t *testing.T) {
	for _, chain := range mainnetChains {
		t.Run(chain, func(t *testing.T) {
			endpoints, err := DefaultRegistry.GetAllRPCEndpoints(chain)
			if err != nil {
				t.Fatalf("GetAllRPCEndpoints(%q) error: %v", chain, err)
			}
			if len(endpoints) < 2 {
				t.Errorf("%s: want >=2 endpoints (primary + backup) for fallback, got %d", chain, len(endpoints))
			}
			for i, ep := range endpoints {
				if !strings.HasPrefix(ep, "https://") {
					t.Errorf("%s endpoint[%d] = %q, want https:// URL", chain, i, ep)
				}
			}
		})
	}
}

// TestNoKnownDeadEndpointsAsPrimary documents the endpoints that started failing
// in 2026-06 (key-required or shut down). They may remain as backups, but must
// not be a primary — a dead primary adds fallback latency on every single query.
func TestNoKnownDeadEndpointsAsPrimary(t *testing.T) {
	deadPrimaries := []string{
		"polygon-rpc.com",                 // tenant disabled
		"polygon-mainnet.public.blastapi", // EOL
		"eth.llamarpc.com",                // 521
	}
	for _, chain := range mainnetChains {
		info, err := GetChainInfo(chain)
		if err != nil {
			t.Fatalf("GetChainInfo(%q): %v", chain, err)
		}
		for _, dead := range deadPrimaries {
			if strings.Contains(info.PrimaryRPC, dead) {
				t.Errorf("%s primary RPC %q is a known-dead endpoint; demote it to a backup", chain, info.PrimaryRPC)
			}
		}
	}
}
