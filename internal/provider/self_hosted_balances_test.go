package provider

import "testing"

// TestGetSelfHostedTokenBalancesEmpty verifies the exported self-hosted balance
// entry point handles the no-address case without hitting the network. This is
// the primary balance path (public RPC + Multicall3, no API key) — the network
// fetch logic itself is covered by multicall_test.go / degraded behavior.
func TestGetSelfHostedTokenBalancesEmpty(t *testing.T) {
	if got := GetSelfHostedTokenBalances(nil); len(got) != 0 {
		t.Errorf("expected no balances for nil input, got %v", got)
	}
	if got := GetSelfHostedTokenBalances([]AddressWithNetworks{}); len(got) != 0 {
		t.Errorf("expected no balances for empty input, got %v", got)
	}
}

// TestGetSelfHostedTokenBalancesSkipsUnknownNetwork ensures an address whose
// network has no RPC-registry entry is skipped (best-effort, no panic), rather
// than failing the whole batch.
func TestGetSelfHostedTokenBalancesSkipsUnknownNetwork(t *testing.T) {
	got := GetSelfHostedTokenBalances([]AddressWithNetworks{
		{Address: "0xabc", Networks: []string{"definitely-not-a-real-network"}},
	})
	if len(got) != 0 {
		t.Errorf("expected no balances for unresolvable network, got %v", got)
	}
}

// TestGetSelfHostedTokenBalancesWithExtraEmpty verifies the extra-tokens variant
// (which folds in per-address touched tokens / table B) handles the empty case
// without hitting the network. The merge logic itself is covered by
// merge_tokens_test.go.
func TestGetSelfHostedTokenBalancesWithExtraEmpty(t *testing.T) {
	if got := GetSelfHostedTokenBalancesWithExtra(nil, nil); len(got) != 0 {
		t.Errorf("expected no balances for nil input, got %v", got)
	}
	// Unresolvable network with extra tokens must still be skipped, not panic.
	got := GetSelfHostedTokenBalancesWithExtra(
		[]AddressWithNetworks{{Address: "0xabc", Networks: []string{"nope"}}},
		map[string][]TokenRef{"0xabc": {{Address: "0xT", Network: "nope", Symbol: "X", Decimals: 18}}},
	)
	if len(got) != 0 {
		t.Errorf("expected no balances for unresolvable network, got %v", got)
	}
}
