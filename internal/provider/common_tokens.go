package provider

// Common token whitelist used for the no-API-key (degraded) path: when the user
// hasn't configured an Alchemy key, we can't discover which tokens they hold
// (no free indexer for these chains), so we query a curated set of well-known
// tokens via a public RPC. Addresses are from the official CoinGecko token lists
// (public/token-lists/*.json) and the staking registry (stakingRegistry.ts).
//
// Adding a chain/token = add a row here; the no-key path picks it up automatically.

// CommonToken is a known token to probe on the no-key path.
type CommonToken struct {
	Symbol   string
	Address  string // lowercase contract address
	Decimals int
}

// commonTokensByNetwork maps an internal network id to its curated token set.
// Native coins are NOT here (queried separately via eth_getBalance). Includes
// liquid-staking receipt tokens (stETH/ankrETH/eETH/ankrBNB) so staked balances
// show without a key.
var commonTokensByNetwork = map[string][]CommonToken{
	NetworkEthMainnet: {
		{"USDT", "0xdac17f958d2ee523a2206206994597c13d831ec7", 6},
		{"USDC", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 6},
		{"DAI", "0x6b175474e89094c44da98b954eedeac495271d0f", 18},
		{"WETH", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 18},
		{"WBTC", "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", 8},
		{"UNI", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", 18},
		{"LINK", "0x514910771af9ca656af840dff83e8264ecf986ca", 18},
		{"AAVE", "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", 18},
		// liquid staking receipts
		{"stETH", "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", 18},
		{"ankrETH", "0xe95a203b1a91a908f9b9ce46459d101078c2c3cb", 18},
		{"eETH", "0x35fa164735182de50811e8e2e824cfb9b6118ac2", 18},
	},
	NetworkPolygonMainnet: {
		{"USDT", "0x9417669fbf23357d2774e9d421307bd5ea1006d2", 6},
		{"USDC", "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", 6},
		{"DAI", "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", 18},
		{"WETH", "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", 18},
		{"WBTC", "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", 8},
		{"LINK", "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39", 18},
	},
	NetworkArbitrumMainnet: {
		{"USDC", "0xaf88d065e77c8cc2239327c5edb3a432268e5831", 6},
		{"USDT", "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", 6},
		{"DAI", "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", 18},
		{"WETH", "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", 18},
		{"WBTC", "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", 8},
		{"ARB", "0x912ce59144191c1204e64559fe8253a0e49e6548", 18},
	},
	NetworkOptimismMainnet: {
		{"USDC", "0x0b2c639c533813f4aa9d7837caf62653d097ff85", 6},
		{"USDT", "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", 6},
		{"DAI", "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", 18},
		{"WETH", "0x4200000000000000000000000000000000000006", 18},
		{"WBTC", "0x68f180fcce6836688e9084f035309e29bf0a2095", 8},
		{"OP", "0x4200000000000000000000000000000000000042", 18},
	},
	NetworkBaseMainnet: {
		{"USDC", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 6},
		{"USDT", "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", 6},
		{"DAI", "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", 18},
		{"WETH", "0x4200000000000000000000000000000000000006", 18},
		{"WBTC", "0x1cea84203673764244e05693e42e6ace62be9ba5", 8},
	},
	NetworkBnbMainnet: {
		{"USDT", "0x55d398326f99059ff775485246999027b3197955", 18},
		{"USDC", "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", 18},
		{"WBNB", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", 18},
		{"ETH", "0x2170ed0880ac9a755fd29b2688956bd959f933f8", 18},
		// liquid staking receipt
		{"ankrBNB", "0x52f24a5e03aee338da5fd9df68d2b6fae1178827", 18},
	},
	NetworkAvalancheMainnet: {
		{"USDC", "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", 6},  // native USDC
		{"USDT", "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", 6},  // native USDT
		{"WAVAX", "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", 18}, // wrapped AVAX
		{"WETH.e", "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", 18},
		{"WBTC.e", "0x50b7545627a5162f82a992c33b87adc75187b218", 8},
		{"DAI.e", "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", 18},
	},
}

// CommonTokensFor returns the curated token set for an internal network id.
func CommonTokensFor(network string) []CommonToken {
	return commonTokensByNetwork[NormalizeToInternalNetwork(network)]
}
