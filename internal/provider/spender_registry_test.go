package provider

import (
	"strings"
	"testing"
)

func TestSpenderRegistryShape(t *testing.T) {
	// Every supported EVM network should carry a non-trivial curated list, and
	// every address must be a valid lowercase 0x-prefixed 42-char string.
	nets := []string{
		NetworkEthMainnet, NetworkPolygonMainnet, NetworkArbitrumMainnet,
		NetworkOptimismMainnet, NetworkBaseMainnet, NetworkBnbMainnet,
	}
	for _, net := range nets {
		list := spendersByNetwork[net]
		if len(list) < 3 {
			t.Errorf("%s should have several known spenders, got %d", net, len(list))
		}
		seen := map[string]bool{}
		for _, s := range list {
			if !strings.HasPrefix(s.Address, "0x") || len(s.Address) != 42 {
				t.Errorf("%s/%s bad address %q", net, s.Name, s.Address)
			}
			if s.Address != strings.ToLower(s.Address) {
				t.Errorf("%s/%s address must be lowercase", net, s.Name)
			}
			if s.Name == "" || s.Category == "" {
				t.Errorf("%s/%s missing Name or Category", net, s.Address)
			}
			if seen[s.Address] {
				t.Errorf("%s duplicate address %q", net, s.Address)
			}
			seen[s.Address] = true
		}
	}
}

func TestLookupSpenderKnown(t *testing.T) {
	// 1inch v6 router (same address on all chains, from src/swap/oneinch).
	s, ok := LookupSpender(NetworkEthMainnet, "0x111111125421ca6dc452d289314280a0f8842a65")
	if !ok {
		t.Fatal("1inch v6 router should be a known spender on Ethereum")
	}
	if !strings.Contains(strings.ToLower(s.Name), "1inch") {
		t.Errorf("expected 1inch in name, got %q", s.Name)
	}
}

func TestLookupSpenderCaseInsensitive(t *testing.T) {
	// Caller may pass a checksummed/upper address; lookup must normalize.
	mixed := "0x111111125421CA6dc452d289314280a0f8842A65"
	if _, ok := LookupSpender(NetworkEthMainnet, mixed); !ok {
		t.Error("LookupSpender must be case-insensitive on the address")
	}
}

func TestLookupSpenderNetworkAlias(t *testing.T) {
	// Alchemy-style "arb-mainnet" must normalize to internal "arbitrum-mainnet".
	addr := "0x111111125421ca6dc452d289314280a0f8842a65"
	_, internalOK := LookupSpender(NetworkArbitrumMainnet, addr)
	_, aliasOK := LookupSpender("arb-mainnet", addr)
	if internalOK != aliasOK {
		t.Errorf("network alias mismatch: internal=%v alias=%v", internalOK, aliasOK)
	}
}

func TestLookupSpenderUnknown(t *testing.T) {
	if _, ok := LookupSpender(NetworkEthMainnet, "0x000000000000000000000000000000000000dead"); ok {
		t.Error("an arbitrary address must not be a known spender")
	}
}
