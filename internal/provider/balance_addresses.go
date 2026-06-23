package provider

// This file builds the input for the self-hosted balance path. Balances do NOT
// split by third-party provider (Alchemy/NodeReal/Glacier) — every EVM address
// is collected into a single set of (address, networks) pairs that the public
// RPC + Multicall3 path (degraded.go) queries directly. See
// GetBalanceProviderForNetwork in chains.go for the routing contract.

// WalletAddressEntry is the minimal view of a wallet address that the balance
// collector needs. The lib/FFI layer adapts models.DerivedAddress into this so
// the provider package stays free of a models dependency.
type WalletAddressEntry struct {
	Address  string
	CoinName string
}

// CollectBalanceAddresses groups wallet entries into one AddressWithNetworks per
// address, accumulating every resolvable EVM network for that address. Entries
// whose CoinName does not resolve to an internal EVM network (e.g. Bitcoin) are
// skipped — the self-hosted balance path is EVM-only. Address order is preserved
// by first appearance.
func CollectBalanceAddresses(entries []WalletAddressEntry) []AddressWithNetworks {
	order := make([]string, 0, len(entries))
	networksByAddr := make(map[string][]string)

	for _, e := range entries {
		network, ok := GetInternalNetwork(e.CoinName)
		if !ok {
			continue
		}
		if _, seen := networksByAddr[e.Address]; !seen {
			order = append(order, e.Address)
		}
		networksByAddr[e.Address] = append(networksByAddr[e.Address], network)
	}

	out := make([]AddressWithNetworks, 0, len(order))
	for _, addr := range order {
		out = append(out, AddressWithNetworks{Address: addr, Networks: networksByAddr[addr]})
	}
	return out
}
