package provider

import "strings"

// Curated registry of well-known approval spenders (DEX routers, NFT
// marketplaces, bridges) used to turn a bare spender address into a protocol
// name + category in the Token Approvals view. Offline, no external API — same
// pattern as common_tokens.go.
//
// Adding a chain/spender = add a row here; the enrichment path picks it up
// automatically. A spender in this list is treated as a known contract, so the
// no-key eth_getCode EOA probe is skipped for it (saves an RPC round-trip).
//
// Addresses are stored lowercase. DEX routers are aligned with the swap
// integration (src/swap/oneinch, src/swap/kyberswap); the rest are canonical,
// widely-documented protocol contract addresses.

// KnownSpender is a curated, human-recognizable approval target.
type KnownSpender struct {
	Address  string // lowercase contract address
	Name     string // human label, e.g. "Uniswap V3: Router 2"
	Category string // "dex" | "nft-marketplace" | "bridge"
}

// Addresses that are the same on every EVM chain we support.
const (
	oneInchV6Router   = "0x111111125421ca6dc452d289314280a0f8842a65" // aligns with src/swap/oneinch
	kyberMetaRouterV2 = "0x6131b5fae19ea4f9d964eac0408e4408b66337b5" // aligns with src/swap/kyberswap
	uniswapUniversal  = "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad" // Uniswap Universal Router (multi-chain)
	permit2           = "0x000000000022d473030f116ddee9f6b43ac78ba3" // Uniswap Permit2 (multi-chain)
	seaport16         = "0x0000000000000068f116a894984e2db1123eb395" // OpenSea Seaport 1.6 (multi-chain)
	seaport15         = "0x00000000000000adc04c56bf30ac9d3c0aaf14dc" // OpenSea Seaport 1.5 (multi-chain)
)

// commonRouters returns the spenders that share an address across chains, so
// each network's list starts from the same baseline.
func commonRouters() []KnownSpender {
	return []KnownSpender{
		{oneInchV6Router, "1inch: Aggregation Router V6", "dex"},
		{kyberMetaRouterV2, "KyberSwap: Meta Aggregation Router V2", "dex"},
		{uniswapUniversal, "Uniswap: Universal Router", "dex"},
		{permit2, "Uniswap: Permit2", "dex"},
		{seaport16, "OpenSea: Seaport 1.6", "nft-marketplace"},
		{seaport15, "OpenSea: Seaport 1.5", "nft-marketplace"},
	}
}

// spendersByNetwork maps an internal network id to its curated spender set.
// Each list = the cross-chain routers + chain-specific entries.
var spendersByNetwork = map[string][]KnownSpender{
	NetworkEthMainnet: append(commonRouters(),
		KnownSpender{"0x7a250d5630b4cf539739df2c5dacb4c659f2488d", "Uniswap: V2 Router 2", "dex"},
		KnownSpender{"0xe592427a0aece92de3edee1f18e0157c05861564", "Uniswap: V3 Router", "dex"},
		KnownSpender{"0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "Uniswap: V3 Router 2", "dex"},
		KnownSpender{"0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f", "SushiSwap: Router", "dex"},
		KnownSpender{"0xdef1c0ded9bec7f1a1670819833240f027b25eff", "0x: Exchange Proxy", "dex"},
		KnownSpender{"0x00000000006c3852cbef3e08e8df289169ede581", "OpenSea: Seaport 1.1", "nft-marketplace"},
		KnownSpender{"0x000000000000ad05ccc4f10045630fb830b95127", "Blur: Marketplace", "nft-marketplace"},
	),
	NetworkPolygonMainnet: append(commonRouters(),
		KnownSpender{"0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff", "QuickSwap: Router", "dex"},
		KnownSpender{"0xe592427a0aece92de3edee1f18e0157c05861564", "Uniswap: V3 Router", "dex"},
		KnownSpender{"0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "Uniswap: V3 Router 2", "dex"},
	),
	NetworkArbitrumMainnet: append(commonRouters(),
		KnownSpender{"0xe592427a0aece92de3edee1f18e0157c05861564", "Uniswap: V3 Router", "dex"},
		KnownSpender{"0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "Uniswap: V3 Router 2", "dex"},
		KnownSpender{"0xc873fecbd354f5a56e00e710b90ef4201db2448d", "Camelot: Router", "dex"},
	),
	NetworkOptimismMainnet: append(commonRouters(),
		KnownSpender{"0xe592427a0aece92de3edee1f18e0157c05861564", "Uniswap: V3 Router", "dex"},
		KnownSpender{"0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "Uniswap: V3 Router 2", "dex"},
		KnownSpender{"0x9c12939390052919af3155f41bf4160fd3666a6f", "Velodrome: Router", "dex"},
	),
	NetworkBaseMainnet: append(commonRouters(),
		KnownSpender{"0x2626664c2603336e57b271c5c0b26f421741e481", "Uniswap: V3 Router 2", "dex"},
		KnownSpender{"0x327df1e6de05895d2ab08513aadd9313fe505d86", "BaseSwap: Router", "dex"},
		KnownSpender{"0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", "Aerodrome: Router", "dex"},
	),
	NetworkBnbMainnet: append(commonRouters(),
		KnownSpender{"0x10ed43c718714eb63d5aa57b78b54704e256024e", "PancakeSwap: V2 Router", "dex"},
		KnownSpender{"0x13f4ea83d0bd40e75c8222255bc855a974568dd4", "PancakeSwap: V3 Router", "dex"},
		KnownSpender{"0x1b81d678ffb9c0263b24a97847620c99d213eb14", "PancakeSwap: Smart Router", "dex"},
	),
}

// LookupSpender resolves a spender address to its curated entry for the given
// network. The network is normalized to the internal id (so Alchemy-style
// "arb-mainnet" matches "arbitrum-mainnet") and the address compare is
// case-insensitive.
func LookupSpender(network, addr string) (KnownSpender, bool) {
	list := spendersByNetwork[NormalizeToInternalNetwork(network)]
	la := strings.ToLower(strings.TrimSpace(addr))
	for _, s := range list {
		if s.Address == la {
			return s, true
		}
	}
	return KnownSpender{}, false
}
