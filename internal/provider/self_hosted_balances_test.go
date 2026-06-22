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
