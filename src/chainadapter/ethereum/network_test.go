package ethereum

import "testing"

// TestNetworkIDToChainID locks in the networkID -> frontend chainID mapping so
// new chains (or accidental edits) can't silently fall through to the default
// "ethereum", which would cause cross-chain signing/broadcast errors.
func TestNetworkIDToChainID(t *testing.T) {
	cases := map[int64]string{
		1:        "ethereum",
		5:        "ethereum-goerli",
		11155111: "ethereum-sepolia",
		56:       "bnb",
		97:       "bnb-testnet",
		137:      "polygon",
		42161:    "arbitrum",
		10:       "optimism",
		8453:     "base",
		43114:    "avalanche",
	}
	for id, want := range cases {
		if got := networkIDToChainID(id); got != want {
			t.Errorf("networkIDToChainID(%d) = %q, want %q", id, got, want)
		}
	}

	// Unknown networkID falls back to "ethereum" by design.
	if got := networkIDToChainID(999999); got != "ethereum" {
		t.Errorf("unknown networkID fallback = %q, want ethereum", got)
	}
}
