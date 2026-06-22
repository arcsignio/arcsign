package provider

import (
	"testing"

	"github.com/arcsignio/arcsign/internal/rpc"
)

func TestRegistryChainFor(t *testing.T) {
	cases := map[string]string{
		NetworkEthMainnet:      "ethereum",        // explicit mapping
		NetworkBnbMainnet:      "bsc",             // explicit mapping (registry has no "bnb-mainnet")
		NetworkPolygonMainnet:  "polygon-mainnet", // registry-aliased → pass through
		NetworkArbitrumMainnet: "arbitrum-mainnet",
		NetworkOptimismMainnet: "optimism-mainnet",
		NetworkBaseMainnet:     "base-mainnet",
	}
	for net, want := range cases {
		if got := registryChainFor(net); got != want {
			t.Errorf("registryChainFor(%q) = %q, want %q", net, got, want)
		}
	}
}

// BSC must resolve to real RPC endpoints in the unified degraded path, and its
// common-token set must include USDC (the gap that hid BSC USDC before).
func TestBSCDegradedResolvable(t *testing.T) {
	if got := registryChainFor(NetworkBnbMainnet); got != "bsc" {
		t.Fatalf("BSC should map to a registry chain that has RPCs, got %q", got)
	}
	syms := symbolsOf(CommonTokensFor(NetworkBnbMainnet))
	for _, want := range []string{"USDC", "USDT"} {
		if !syms[want] {
			t.Errorf("BSC common tokens must include %q for the no-key path", want)
		}
	}
}

// Avalanche must resolve to real RPC endpoints in the self-hosted balance path,
// and its common-token set must include the major stablecoins. Avalanche was the
// one chain missing degraded/self-hosted support (it previously only worked via
// the keyless Glacier indexer, which doesn't go through the public-RPC path).
func TestAvalancheDegradedResolvable(t *testing.T) {
	got := registryChainFor(NetworkAvalancheMainnet)
	endpoints, err := rpc.DefaultRegistry.GetAllRPCEndpoints(got)
	if err != nil || len(endpoints) == 0 {
		t.Fatalf("Avalanche should map to a registry chain with RPCs; registryChainFor=%q endpoints=%d err=%v", got, len(endpoints), err)
	}
	syms := symbolsOf(CommonTokensFor(NetworkAvalancheMainnet))
	for _, want := range []string{"USDC", "USDT"} {
		if !syms[want] {
			t.Errorf("Avalanche common tokens must include %q for the self-hosted path", want)
		}
	}
}

// TestEveryMainnetChainHasSelfHostedSupport is the guard that the self-hosted
// balance path covers ALL chains: each mainnet network must (1) resolve to an
// rpc-registry chain that has endpoints, and (2) have a non-empty common-token
// set. A new chain that forgets either mapping fails here — this is the
// "register in one place" contract for the balance path.
func TestEveryMainnetChainHasSelfHostedSupport(t *testing.T) {
	for _, network := range AllMainnetNetworks() {
		t.Run(network, func(t *testing.T) {
			chainKey := registryChainFor(network)
			endpoints, err := rpc.DefaultRegistry.GetAllRPCEndpoints(chainKey)
			if err != nil || len(endpoints) == 0 {
				t.Errorf("%s: no RPC endpoints (registryChainFor=%q, err=%v)", network, chainKey, err)
			}
			if len(CommonTokensFor(network)) == 0 {
				t.Errorf("%s: no common tokens for self-hosted balance path", network)
			}
		})
	}
}

// Without a key, Alchemy must NOT error and must report degraded so the UI can
// prompt the user. NFTs and transfers must be empty (no free indexer).
func TestAlchemyDegradedCapability(t *testing.T) {
	noKey := NewAlchemyWDP("")
	withKey := NewAlchemyWDP("some-key")

	if d, ok := noKey.(DegradedProvider); !ok || !d.IsDegraded() {
		t.Error("no-key Alchemy should report IsDegraded() == true")
	}
	if d, ok := withKey.(DegradedProvider); !ok || d.IsDegraded() {
		t.Error("keyed Alchemy should report IsDegraded() == false")
	}

	// No-key NFTs / transfers are empty, not an error.
	nfts, err := noKey.GetNFTs([]AddressWithNetworks{{Address: "0x1", Networks: []string{NetworkEthMainnet}}})
	if err != nil || len(nfts) != 0 {
		t.Errorf("no-key GetNFTs should be empty/no error, got %d / %v", len(nfts), err)
	}
	tx, pk, err := noKey.GetAssetTransfers("0x1", NetworkEthMainnet, 10, "")
	if err != nil || len(tx) != 0 || pk != "" {
		t.Errorf("no-key GetAssetTransfers should be empty/no error, got %d / %q / %v", len(tx), pk, err)
	}
}

// NodeReal also exposes the degraded capability based on its key.
func TestNodeRealDegradedCapability(t *testing.T) {
	if d, ok := NewNodeRealWDP("").(DegradedProvider); !ok || !d.IsDegraded() {
		t.Error("no-key NodeReal should report IsDegraded() == true")
	}
	if d, ok := NewNodeRealWDP("k").(DegradedProvider); !ok || d.IsDegraded() {
		t.Error("keyed NodeReal should report IsDegraded() == false")
	}
}
