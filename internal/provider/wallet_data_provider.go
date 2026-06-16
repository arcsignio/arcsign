package provider

// WalletDataProvider is the unified abstraction over the read-data path:
// external API -> normalize -> wallet data (token balances, NFTs, transfers).
//
// Each backend (Alchemy, NodeReal/BSC, Glacier/Avalanche) is exposed through a
// thin wrapper that implements this interface, so the FFI layer dispatches
// polymorphically (registry.Get(providerType).GetTokenBalances(...)) instead of
// hand-written `switch providerType` blocks repeated per endpoint.
//
// Contract granularity:
//   - GetTokenBalances / GetNFTs take a batch of addresses. Alchemy queries all
//     of them in a single HTTP request (its native mode); NodeReal/Glacier loop
//     internally. Using batch as the contract upper-bound preserves Alchemy's
//     one-request efficiency — a single-address contract would force it to
//     degrade to N requests, which is a behavior change.
//   - GetAssetTransfers is single-address/single-network (all three backends are
//     already at this granularity).
type WalletDataProvider interface {
	// Name returns the provider key ("alchemy" / "nodereal" / "glacier").
	Name() string

	// GetTokenBalances returns ERC-20 (and native) balances for the given
	// addresses, already normalized to SimplifiedTokenBalance.
	GetTokenBalances(addrs []AddressWithNetworks) ([]SimplifiedTokenBalance, error)

	// GetNFTs returns ERC-721/ERC-1155 holdings for the given addresses.
	GetNFTs(addrs []AddressWithNetworks) ([]SimplifiedNFT, error)

	// GetAssetTransfers returns transaction history for one address on one
	// network. Returns (transfers, nextPageKey, error).
	GetAssetTransfers(address, network string, maxCount int, pageKey string) ([]AssetTransfer, string, error)
}

// DegradedProvider is an optional capability a WalletDataProvider may implement
// to report that it is running without its API key — it still returns basic
// data (native + common-token balances) but full token discovery / NFTs /
// history are unavailable until the user adds a key. The FFI layer uses this to
// surface a soft "degraded" hint (not a hard "missing_key" error) to the UI.
type DegradedProvider interface {
	// IsDegraded reports whether the provider is in the no-key degraded mode.
	IsDegraded() bool
}

// AddressWithNetworks is the provider-neutral batch input: one wallet address
// and the networks to query it on. (Mirrors AlchemyAddressWithNetworks but
// without leaking the Alchemy-specific type into the interface.)
type AddressWithNetworks struct {
	Address  string
	Networks []string
}
