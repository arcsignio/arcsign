package provider

import "github.com/arcsignio/arcsign/internal/rpc"

// This file implements the no-API-key ("degraded") balance path for the Alchemy
// chains (Ethereum/Polygon/Arbitrum/Optimism/Base). Without a key we can't
// discover which tokens an address holds (no free indexer for these chains), so
// we query, over public RPCs:
//   1. the native coin balance (eth_getBalance), and
//   2. a curated set of common tokens (Multicall3 balanceOf — see common_tokens.go).
// USD values are left 0 here and filled later by DefiLlama (免 key).

// internalToRegistryChain maps a provider-internal network id to the rpc
// registry's chain key. Most ids are already registered as aliases
// (polygon-mainnet, arbitrum-mainnet, …); only eth-mainnet needs a mapping
// because the registry registers Ethereum under "ethereum".
var internalToRegistryChain = map[string]string{
	NetworkEthMainnet:      "ethereum",
	NetworkPolygonMainnet:  "polygon-mainnet",
	NetworkArbitrumMainnet: "arbitrum-mainnet",
	NetworkOptimismMainnet: "optimism-mainnet",
	NetworkBaseMainnet:     "base-mainnet",
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
