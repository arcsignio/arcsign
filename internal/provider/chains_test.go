package provider

import "testing"

// TestAllMainnetNetworksHaveMappings is a table-driven guard: every mainnet
// network returned for UI display must have a provider, a label, and resolve
// back through the chain-name aliases. New chains that forget any of these
// mappings will fail here.
func TestAllMainnetNetworksHaveMappings(t *testing.T) {
	for _, network := range AllMainnetNetworks() {
		t.Run(network, func(t *testing.T) {
			if got := GetProviderForNetwork(network); got == "" {
				t.Errorf("no provider mapped for %q", network)
			}
			if label, ok := NetworkLabels[network]; !ok || label == "" {
				t.Errorf("no label for %q", network)
			}
			if _, ok := ProviderCapabilities[GetProviderForNetwork(network)]; !ok {
				t.Errorf("provider for %q has no capabilities entry", network)
			}
		})
	}
}

// TestAvalancheRouting locks in the Avalanche -> Glacier wiring specifically.
func TestAvalancheRouting(t *testing.T) {
	if GetProviderForNetwork(NetworkAvalancheMainnet) != ProviderGlacier {
		t.Errorf("avalanche-mainnet should route to Glacier")
	}
	if cap := ProviderCapabilities[ProviderGlacier]; cap.RequiresAPIKey {
		t.Error("Glacier should be no-key (RequiresAPIKey=false)")
	}

	// The wallet CoinName "Avalanche" must resolve to the internal network,
	// otherwise GetTokenBalances/GetNFTs silently skip the address.
	for _, name := range []string{"Avalanche", "avalanche", "avax", "AVAX"} {
		net, ok := GetInternalNetwork(name)
		if !ok || net != NetworkAvalancheMainnet {
			t.Errorf("GetInternalNetwork(%q) = (%q, %v), want avalanche-mainnet", name, net, ok)
		}
	}
}
