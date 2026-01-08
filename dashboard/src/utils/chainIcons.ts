/**
 * Chain Icons Utility
 * Maps blockchain symbols to their respective logo URLs
 * Uses multiple CDN sources for reliable icon loading
 */

/**
 * Direct URLs for major blockchain icons
 * Using reliable CDN sources (CoinGecko, TrustWallet, etc.)
 */
const CHAIN_ICON_URLS: Record<string, string> = {
  // Major Chains - Using CoinGecko asset platform icons
  'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'SOL': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  'ADA': 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  'DOT': 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  'LTC': 'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
  'TRX': 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
  'ATOM': 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
  'LINK': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  'XLM': 'https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png',
  'ALGO': 'https://assets.coingecko.com/coins/images/4380/small/download.png',
  'NEAR': 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
  'VET': 'https://assets.coingecko.com/coins/images/1167/small/VET_Token_Icon.png',
  'HBAR': 'https://assets.coingecko.com/coins/images/3688/small/hbar.png',
  'FIL': 'https://assets.coingecko.com/coins/images/12817/small/filecoin.png',
  'APT': 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',
  'SUI': 'https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg',
  'ETC': 'https://assets.coingecko.com/coins/images/453/small/ethereum-classic-logo.png',
  'XMR': 'https://assets.coingecko.com/coins/images/69/small/monero_logo.png',
  'XRP': 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  'BCH': 'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png',
  'DOGE': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  'EOS': 'https://assets.coingecko.com/coins/images/738/small/eos-eos-logo.png',
  'DASH': 'https://assets.coingecko.com/coins/images/19/small/dash-logo.png',
  'ZEC': 'https://assets.coingecko.com/coins/images/486/small/circle-zcash-color.png',
  'XTZ': 'https://assets.coingecko.com/coins/images/976/small/Tezos-logo.png',
  'WAVES': 'https://assets.coingecko.com/coins/images/425/small/waves.png',

  // Layer 2
  'ARB': 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  'OP': 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  'BASE': 'https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg',
  'ZKS': 'https://assets.coingecko.com/coins/images/28597/small/zksync.jpeg',
  'STRK': 'https://assets.coingecko.com/coins/images/26433/small/starknet.png',

  // Regional
  'KLAY': 'https://assets.coingecko.com/coins/images/9672/small/klaytn.png',
  'CRO': 'https://assets.coingecko.com/coins/images/7310/small/cro_token_logo.png',
  'HT': 'https://assets.coingecko.com/coins/images/2822/small/huobi-token-logo.png',
  'ONE': 'https://assets.coingecko.com/coins/images/4344/small/Y88JAze.png',

  // Cosmos
  'OSMO': 'https://assets.coingecko.com/coins/images/16724/small/osmo.png',
  'JUNO': 'https://assets.coingecko.com/coins/images/19249/small/Juno_Logo_%28Salmon%29.png',
  'EVMOS': 'https://assets.coingecko.com/coins/images/24023/small/evmos.png',
  'SCRT': 'https://assets.coingecko.com/coins/images/11871/small/secret_logo.png',

  // Alt EVM
  'FTM': 'https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png',
  'CELO': 'https://assets.coingecko.com/coins/images/11090/small/InjsrgVl_400x400.jpg',
  'GLMR': 'https://assets.coingecko.com/coins/images/22459/small/glmr.png',
  'METIS': 'https://assets.coingecko.com/coins/images/15595/small/metis.jpeg',
  'GNO': 'https://assets.coingecko.com/coins/images/662/small/logo_square_simple_300px.png',

  // Specialized
  'KSM': 'https://assets.coingecko.com/coins/images/9568/small/m4zRhP5e_400x400.jpg',
  'ZIL': 'https://assets.coingecko.com/coins/images/2687/small/Zilliqa-logo.png',
  'ICX': 'https://assets.coingecko.com/coins/images/1060/small/icon-icx-logo.png',
  'IOST': 'https://assets.coingecko.com/coins/images/2523/small/IOST.png',
  'TON': 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
};

/**
 * Fallback colors for chains when icon fails to load
 */
const CHAIN_COLORS: Record<string, string> = {
  'BTC': '#F7931A',
  'ETH': '#627EEA',
  'BNB': '#F0B90B',
  'SOL': '#14F195',
  'ADA': '#0033AD',
  'AVAX': '#E84142',
  'DOT': '#E6007A',
  'MATIC': '#8247E5',
  'LTC': '#345D9D',
  'TRX': '#FF0013',
  'ATOM': '#2E3148',
  'LINK': '#2A5ADA',
  'XLM': '#000000',
  'ALGO': '#000000',
  'NEAR': '#000000',
  'XRP': '#23292F',
  'DOGE': '#C2A633',
  'ARB': '#28A0F0',
  'OP': '#FF0420',
  'BASE': '#0052FF',
  'FTM': '#1969FF',
  'KLAY': '#FF4E00',
  'CRO': '#002D74',
};

/**
 * Chains that support full transaction interaction (send/receive)
 * Based on ChainAdapter implementation
 */
export const SUPPORTED_CHAINS = new Set([
  // Bitcoin
  'BTC',
  // EVM chains with full adapter support
  'ETH',
  'BNB',
  'MATIC',
  'ARB',
  'OP',
  'BASE',
]);

/**
 * Check if a chain supports full transaction interaction
 */
export function isChainSupported(symbol: string): boolean {
  return SUPPORTED_CHAINS.has(symbol.toUpperCase());
}

/**
 * Get the icon URL for a blockchain symbol
 */
export function getChainIconUrl(symbol: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  return CHAIN_ICON_URLS[normalizedSymbol] || '';
}

/**
 * Get fallback color for a chain
 * Used when CDN icons fail to load
 */
export function getChainFallbackIcon(symbol: string): string {
  return CHAIN_COLORS[symbol.toUpperCase()] || '#6B7280';
}

/**
 * Chain category labels for grouping
 */
export const CHAIN_CATEGORIES = {
  SUPPORTED: 'Supported Chains',
  UNSUPPORTED: 'Other Chains',
} as const;
