package provider

import (
	"sort"
	"testing"
)

// TestMergeTokensForNetworkUnion verifies the balance token list for a network
// is the union of the curated common tokens (table A) and the user's touched
// tokens (table B) for that network — this is how a swap output / airdrop /
// manually-imported token gets its balance queried alongside the common set.
func TestMergeTokensForNetworkUnion(t *testing.T) {
	extra := []TokenRef{
		{Address: "0xNEW", Network: NetworkEthMainnet, Symbol: "PEPE", Decimals: 18},
		{Address: "0xOTHER", Network: NetworkPolygonMainnet, Symbol: "GHST", Decimals: 18}, // different network, must be filtered out
	}

	merged := mergeTokensForNetwork(NetworkEthMainnet, extra)
	syms := symbolsOf(merged)

	// The curated common ETH tokens must still be present.
	for _, want := range []string{"USDC", "USDT", "WETH"} {
		if !syms[want] {
			t.Errorf("merged list missing common token %q", want)
		}
	}
	// The user's ETH touched token must be included.
	if !syms["PEPE"] {
		t.Error("merged list missing user touched token PEPE")
	}
	// A touched token for a DIFFERENT network must NOT leak in.
	if syms["GHST"] {
		t.Error("merged list wrongly included a token from another network")
	}
}

// TestMergeTokensForNetworkDedup ensures a touched token that duplicates a
// common token (same contract address) does not appear twice.
func TestMergeTokensForNetworkDedup(t *testing.T) {
	// USDC on Ethereum is already a common token.
	usdc := "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
	extra := []TokenRef{
		{Address: usdc, Network: NetworkEthMainnet, Symbol: "USDC", Decimals: 6},
	}

	merged := mergeTokensForNetwork(NetworkEthMainnet, extra)

	count := 0
	for _, tok := range merged {
		if tok.Address == usdc {
			count++
		}
	}
	if count != 1 {
		t.Errorf("expected USDC to appear once after dedup, got %d", count)
	}
}

// TestMergeTokensForNetworkNilExtra returns just the common set when the user
// has no touched tokens for the network.
func TestMergeTokensForNetworkNilExtra(t *testing.T) {
	merged := mergeTokensForNetwork(NetworkBaseMainnet, nil)
	common := CommonTokensFor(NetworkBaseMainnet)

	got := addrsOf(merged)
	want := addrsOf(common)
	sort.Strings(got)
	sort.Strings(want)
	if !equalStrings(got, want) {
		t.Errorf("with nil extra, merged should equal common set; got %v want %v", got, want)
	}
}

func addrsOf(tokens []CommonToken) []string {
	out := make([]string, 0, len(tokens))
	for _, t := range tokens {
		out = append(out, t.Address)
	}
	return out
}
