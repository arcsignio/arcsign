package provider

// This file adapts the three concrete clients (Alchemy, NodeReal/BSCTrace,
// Glacier) to the unified WalletDataProvider interface. The wrappers do NOT
// change client behavior — they only move the address-loop / normalization that
// previously lived in the FFI layer down into one place per provider.

// ================================================================================
// Alchemy
// ================================================================================

type alchemyWDP struct {
	client *AlchemyClient
	hasKey bool // whether an Alchemy key is configured (token discovery/NFT/history need it)
}

// NewAlchemyWDP wraps an AlchemyClient as a WalletDataProvider. apiKey may be
// empty: without a key we serve a degraded path (native + common-token balances
// via public RPCs). Full token discovery, NFTs and transaction history still
// require the key.
func NewAlchemyWDP(apiKey string) WalletDataProvider {
	return &alchemyWDP{client: NewAlchemyClient(apiKey), hasKey: apiKey != ""}
}

func (w *alchemyWDP) Name() string { return ProviderAlchemy }

// IsDegraded reports the no-key mode (basic balances only, no full discovery/NFT/history).
func (w *alchemyWDP) IsDegraded() bool { return !w.hasKey }

func (w *alchemyWDP) GetTokenBalances(addrs []AddressWithNetworks) ([]SimplifiedTokenBalance, error) {
	if len(addrs) == 0 {
		return nil, nil
	}
	// No key → unified degraded path (native + curated common tokens via public
	// RPCs). Same helper every provider uses. USD filled later by DefiLlama.
	if !w.hasKey {
		return degradedTokenBalances(addrs), nil
	}
	// With key: Alchemy queries ALL addresses in one request — do not loop.
	resp, err := w.client.GetTokenBalancesByAddress(toAlchemyAddresses(addrs))
	if err != nil {
		return nil, err
	}
	return SimplifyTokenBalances(resp), nil
}

func (w *alchemyWDP) GetNFTs(addrs []AddressWithNetworks) ([]SimplifiedNFT, error) {
	if len(addrs) == 0 {
		return nil, nil
	}
	// NFT discovery needs the Alchemy key (no free indexer for these chains).
	if !w.hasKey {
		return nil, nil
	}
	resp, err := w.client.GetNFTsByAddress(toAlchemyAddresses(addrs))
	if err != nil {
		return nil, err
	}
	return SimplifyNFTs(resp), nil
}

func (w *alchemyWDP) GetAssetTransfers(address, network string, maxCount int, pageKey string) ([]AssetTransfer, string, error) {
	// Transaction history needs the Alchemy key.
	if !w.hasKey {
		return nil, "", nil
	}
	return w.client.GetAssetTransfers(address, network, maxCount, pageKey)
}

func toAlchemyAddresses(addrs []AddressWithNetworks) []AlchemyAddressWithNetworks {
	out := make([]AlchemyAddressWithNetworks, 0, len(addrs))
	for _, a := range addrs {
		// AddressWithNetworks and AlchemyAddressWithNetworks have identical
		// fields, so a direct conversion is enough (satisfies gosimple S1016).
		out = append(out, AlchemyAddressWithNetworks(a))
	}
	return out
}

// ================================================================================
// NodeReal / BSCTrace
// ================================================================================

type nodeRealWDP struct {
	client *BSCTraceClient
	hasKey bool // whether a NodeReal key is configured (full token holdings need it)
}

// NewNodeRealWDP wraps a BSCTraceClient as a WalletDataProvider. apiKey may be
// empty: without a key BSC falls back to the unified degraded path (native BNB +
// curated common BEP-20s via public RPC + Multicall3); the NodeReal enhanced API
// (full token-holdings discovery + NFTs) requires the key.
func NewNodeRealWDP(apiKey string) WalletDataProvider {
	return &nodeRealWDP{client: NewBSCTraceClient(apiKey), hasKey: apiKey != ""}
}

func (w *nodeRealWDP) Name() string { return ProviderNodeReal }

// IsDegraded reports the no-key mode (native + common tokens only, no full
// BEP-20 holdings discovery).
func (w *nodeRealWDP) IsDegraded() bool { return !w.hasKey }

func (w *nodeRealWDP) GetTokenBalances(addrs []AddressWithNetworks) ([]SimplifiedTokenBalance, error) {
	if len(addrs) == 0 {
		return nil, nil
	}
	// No key → unified degraded path (same helper as the Alchemy chains): native
	// BNB + curated common BEP-20s (USDC/USDT/WBNB/ankrBNB) via public RPC.
	if !w.hasKey {
		return degradedTokenBalances(addrs), nil
	}
	// With key: NodeReal enhanced full BEP-20 holdings discovery.
	var all []SimplifiedTokenBalance
	for _, a := range addrs {
		tokens, err := w.client.GetTokenHoldingsBSC(a.Address)
		if err != nil {
			return all, err
		}
		all = append(all, tokens...)
	}
	return all, nil
}

func (w *nodeRealWDP) GetNFTs(addrs []AddressWithNetworks) ([]SimplifiedNFT, error) {
	// NFT discovery needs the NodeReal key (no free indexer for BSC).
	if !w.hasKey {
		return nil, nil
	}
	var all []SimplifiedNFT
	for _, a := range addrs {
		nfts, err := w.client.GetNFTHoldingsBSC(a.Address)
		if err != nil {
			return all, err
		}
		all = append(all, nfts...)
	}
	return all, nil
}

func (w *nodeRealWDP) GetAssetTransfers(address, _ string, maxCount int, pageKey string) ([]AssetTransfer, string, error) {
	// Transaction history needs the NodeReal key.
	if !w.hasKey {
		return nil, "", nil
	}
	// BSC network is fixed for NodeReal; the network arg is ignored.
	return w.client.GetAssetTransfersBSC(address, maxCount, pageKey)
}

// ================================================================================
// Glacier / Avalanche
// ================================================================================

type glacierWDP struct {
	client *GlacierClient
}

// NewGlacierWDP wraps a GlacierClient as a WalletDataProvider. apiKey is optional
// (Glacier has an anonymous tier).
func NewGlacierWDP(apiKey string) WalletDataProvider {
	return &glacierWDP{client: NewGlacierClient(apiKey)}
}

func (w *glacierWDP) Name() string { return ProviderGlacier }

func (w *glacierWDP) GetTokenBalances(addrs []AddressWithNetworks) ([]SimplifiedTokenBalance, error) {
	var all []SimplifiedTokenBalance
	for _, a := range addrs {
		tokens, err := w.client.GetTokenHoldingsAVAX(a.Address)
		if err != nil {
			return all, err
		}
		all = append(all, tokens...)
	}
	return all, nil
}

func (w *glacierWDP) GetNFTs(addrs []AddressWithNetworks) ([]SimplifiedNFT, error) {
	var all []SimplifiedNFT
	for _, a := range addrs {
		nfts, err := w.client.GetNFTHoldingsAVAX(a.Address)
		if err != nil {
			return all, err
		}
		all = append(all, nfts...)
	}
	return all, nil
}

func (w *glacierWDP) GetAssetTransfers(address, _ string, maxCount int, pageKey string) ([]AssetTransfer, string, error) {
	// Avalanche C-Chain is fixed for Glacier; the network arg is ignored.
	return w.client.GetAssetTransfersAVAX(address, maxCount, pageKey)
}
