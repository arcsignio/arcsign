package provider

import "testing"

func TestRegistryChainFor(t *testing.T) {
	cases := map[string]string{
		NetworkEthMainnet:      "ethereum",         // the one that needs explicit mapping
		NetworkPolygonMainnet:  "polygon-mainnet",  // registry-aliased → pass through
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
	if d, ok := NewNodeRealWDP("", "").(DegradedProvider); !ok || !d.IsDegraded() {
		t.Error("no-key NodeReal should report IsDegraded() == true")
	}
	if d, ok := NewNodeRealWDP("k", "").(DegradedProvider); !ok || d.IsDegraded() {
		t.Error("keyed NodeReal should report IsDegraded() == false")
	}
}
