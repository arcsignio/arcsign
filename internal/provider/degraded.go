package provider

import "github.com/arcsignio/arcsign/internal/rpc"

// This file implements the unified no-API-key ("degraded") balance path used by
// EVERY EVM provider (Alchemy chains + BSC/NodeReal). Without a key we can't
// discover which tokens an address holds (no free indexer for these chains), so
// we query, over public RPCs only:
//   1. the native coin balance (eth_getBalance), and
//   2. a curated set of common tokens (Multicall3 balanceOf — see common_tokens.go).
// USD values are left 0 here and filled later by DefiLlama (免 key).
//
// There is ONE degraded implementation. A wrapper that lacks its key delegates
// to degradedTokenBalances — it does not hand-roll its own native-only path.

// internalToRegistryChain maps a provider-internal network id to the rpc
// registry's chain key. Most ids are already registered as aliases
// (polygon-mainnet, arbitrum-mainnet, …); eth-mainnet and bnb-mainnet need an
// explicit mapping (the registry registers Ethereum under "ethereum" and BSC
// under "bsc"/"bnb", not "bnb-mainnet").
var internalToRegistryChain = map[string]string{
	NetworkEthMainnet:      "ethereum",
	NetworkPolygonMainnet:  "polygon-mainnet",
	NetworkArbitrumMainnet: "arbitrum-mainnet",
	NetworkOptimismMainnet: "optimism-mainnet",
	NetworkBaseMainnet:     "base-mainnet",
	NetworkBnbMainnet:      "bsc",
	NetworkAvalancheMainnet: "avalanche", // registry registers Avalanche under "avalanche"/"avax", not "avalanche-mainnet"
}

// registryChainFor resolves the rpc-registry chain key for an internal network
// id, falling back to the id itself (the registry aliases most of them).
func registryChainFor(network string) string {
	if key, ok := internalToRegistryChain[NormalizeToInternalNetwork(network)]; ok {
		return key
	}
	return NormalizeToInternalNetwork(network)
}

// degradedBalancesForNetwork returns native + common-token balances for one
// address on one network using only public RPCs (no API key). Tokens with zero
// balance are omitted. Best-effort: any sub-query failure is skipped, not fatal.
func degradedBalancesForNetwork(address, network string) []SimplifiedTokenBalance {
	chainKey := registryChainFor(network)

	endpoints, err := rpc.DefaultRegistry.GetAllRPCEndpoints(chainKey)
	if err != nil || len(endpoints) == 0 {
		return nil
	}

	var out []SimplifiedTokenBalance

	// 1. Native coin balance.
	symbol := "ETH"
	if info, err := rpc.GetChainInfo(chainKey); err == nil && info.Symbol != "" {
		symbol = info.Symbol
	}
	for _, ep := range endpoints {
		native, err := GetNativeBalance(ep, address, network, symbol)
		if err == nil {
			if native != nil {
				out = append(out, *native)
			}
			break // first endpoint that answers wins
		}
	}

	// 2. Common ERC-20 tokens via Multicall3 (one batched eth_call, with RPC fallback).
	if tokens := CommonTokensFor(network); len(tokens) > 0 {
		if bals, err := GetTokenBalancesMulticallFallback(endpoints, address, network, tokens); err == nil {
			out = append(out, bals...)
		}
	}

	return out
}

// degradedTokenBalances is the single no-key entry point shared by every EVM
// provider wrapper. For each (address, network) it returns native + common-token
// balances via public RPCs. Any provider lacking its key calls this instead of
// rolling its own native-only path, so the no-key behavior is identical across
// chains (Ethereum/Polygon/Arbitrum/Optimism/Base AND BSC).
func degradedTokenBalances(addrs []AddressWithNetworks) []SimplifiedTokenBalance {
	var all []SimplifiedTokenBalance
	for _, a := range addrs {
		for _, net := range a.Networks {
			all = append(all, degradedBalancesForNetwork(a.Address, net)...)
		}
	}
	return all
}

// GetSelfHostedTokenBalances is the PRIMARY (feature-dimension) balance entry
// point: for every (address, network) it returns native + common-token balances
// using only the public RPC pool + Multicall3 — no API key, all chains. This is
// the same engine as the former no-key "degraded" path, promoted from a fallback
// to the main balance route (see GetBalanceProviderForNetwork). USD prices are
// filled separately by EnrichPricesWithDefiLlama at the FFI layer.
func GetSelfHostedTokenBalances(addrs []AddressWithNetworks) []SimplifiedTokenBalance {
	return degradedTokenBalances(addrs)
}
