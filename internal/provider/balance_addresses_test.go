package provider

import (
	"sort"
	"testing"
)

// TestCollectBalanceAddressesGroupsByAddress verifies that wallet entries are
// collapsed into one AddressWithNetworks per address, accumulating every
// resolvable EVM network. This is the input builder for the self-hosted balance
// path — it does NOT split by third-party provider (that's the whole point of
// the feature-dimension refactor: all balances go through one public-RPC path).
func TestCollectBalanceAddressesGroupsByAddress(t *testing.T) {
	entries := []WalletAddressEntry{
		{Address: "0xabc", CoinName: "Ethereum"},
		{Address: "0xabc", CoinName: "Polygon"},
		{Address: "0xabc", CoinName: "BNB Chain"},
		{Address: "0xdef", CoinName: "Avalanche"},
	}

	got := CollectBalanceAddresses(entries)

	// Index by address for assertion.
	byAddr := map[string][]string{}
	for _, a := range got {
		nets := append([]string(nil), a.Networks...)
		sort.Strings(nets)
		byAddr[a.Address] = nets
	}

	if len(byAddr) != 2 {
		t.Fatalf("expected 2 distinct addresses, got %d (%v)", len(byAddr), byAddr)
	}

	wantAbc := []string{NetworkBnbMainnet, NetworkEthMainnet, NetworkPolygonMainnet}
	sort.Strings(wantAbc)
	if got := byAddr["0xabc"]; !equalStrings(got, wantAbc) {
		t.Errorf("0xabc networks = %v, want %v", got, wantAbc)
	}
	if got := byAddr["0xdef"]; !equalStrings(got, []string{NetworkAvalancheMainnet}) {
		t.Errorf("0xdef networks = %v, want [%s]", got, NetworkAvalancheMainnet)
	}
}

// TestCollectBalanceAddressesSkipsUnresolvable ensures non-EVM / unknown coins
// (e.g. Bitcoin) are skipped — the self-hosted balance path is EVM-only.
func TestCollectBalanceAddressesSkipsUnresolvable(t *testing.T) {
	entries := []WalletAddressEntry{
		{Address: "bc1q...", CoinName: "Bitcoin"},
		{Address: "0xabc", CoinName: "Ethereum"},
	}

	got := CollectBalanceAddresses(entries)

	if len(got) != 1 {
		t.Fatalf("expected 1 EVM address, got %d (%v)", len(got), got)
	}
	if got[0].Address != "0xabc" {
		t.Errorf("kept address = %q, want 0xabc", got[0].Address)
	}
}

// TestCollectBalanceAddressesEmpty handles the no-address case cleanly.
func TestCollectBalanceAddressesEmpty(t *testing.T) {
	if got := CollectBalanceAddresses(nil); len(got) != 0 {
		t.Errorf("expected empty result for nil input, got %v", got)
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
