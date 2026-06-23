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

// TestBalanceProviderIsSelfHostedForAllChains locks in the feature-dimension
// routing: balance queries on EVERY mainnet chain go to the self-hosted public
// RPC + Multicall3 path, NOT to the per-chain third-party provider (Alchemy /
// NodeReal / Glacier). This is the core contract of the balance-multicall
// refactor — balances are decentralized, while NFTs/history stay on their
// third-party provider via GetProviderForNetwork.
func TestBalanceProviderIsSelfHostedForAllChains(t *testing.T) {
	for _, network := range AllMainnetNetworks() {
		t.Run(network, func(t *testing.T) {
			if got := GetBalanceProviderForNetwork(network); got != ProviderSelfHosted {
				t.Errorf("GetBalanceProviderForNetwork(%q) = %q, want %q (balances must use self-hosted RPC+Multicall)", network, got, ProviderSelfHosted)
			}
		})
	}
}

// TestBalanceProviderNormalizesAliases ensures provider-specific / alias network
// ids still resolve to the self-hosted balance path.
func TestBalanceProviderNormalizesAliases(t *testing.T) {
	for _, alias := range []string{"arb-mainnet", "opt-mainnet"} {
		if got := GetBalanceProviderForNetwork(alias); got != ProviderSelfHosted {
			t.Errorf("GetBalanceProviderForNetwork(%q) = %q, want %q", alias, got, ProviderSelfHosted)
		}
	}
}

// TestNftRoutingUnchanged is a guard that the feature-dimension split does NOT
// alter the existing chain-dimension routing used by NFTs / transaction history.
// Balances move to self-hosted; everything else must stay on its provider.
func TestNftRoutingUnchanged(t *testing.T) {
	cases := map[string]string{
		NetworkEthMainnet:       ProviderAlchemy,
		NetworkPolygonMainnet:   ProviderAlchemy,
		NetworkArbitrumMainnet:  ProviderAlchemy,
		NetworkOptimismMainnet:  ProviderAlchemy,
		NetworkBaseMainnet:      ProviderAlchemy,
		NetworkBnbMainnet:       ProviderNodeReal,
		NetworkAvalancheMainnet: ProviderGlacier,
	}
	for network, want := range cases {
		if got := GetProviderForNetwork(network); got != want {
			t.Errorf("GetProviderForNetwork(%q) = %q, want %q (NFT/history routing must be unchanged)", network, got, want)
		}
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
