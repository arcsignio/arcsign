/**
 * Chain Icons Utility
 * Maps blockchain symbols to their respective logo URLs
 * Supports both short (BTC) and long (BITCOIN) symbol formats
 */

/**
 * Direct URLs for major blockchain icons
 * Using local files in public/icons/chains/ for reliability (no CORS issues)
 */
const CHAIN_ICON_URLS: Record<string, string> = {
  // Major Chains - Local icons
  'BTC': '/icons/chains/btc.png',
  'ETH': '/icons/chains/eth.png',
  'BNB': '/icons/chains/bnb.png',
  'SOL': '/icons/chains/sol.png',
  'ADA': '/icons/chains/ada.png',
  'AVAX': '/icons/chains/avax.png',
  'DOT': '/icons/chains/dot.png',
  'MATIC': '/icons/chains/matic.png',
  'LTC': '/icons/chains/ltc.png',
  'TRX': '/icons/chains/trx.png',
  'ATOM': '/icons/chains/atom.png',
  'LINK': '/icons/chains/link.png',
  'XLM': '/icons/chains/xlm.png',
  'ALGO': '/icons/chains/algo.png',
  'NEAR': '/icons/chains/near.png',
  'VET': '/icons/chains/vet.png',
  'HBAR': '/icons/chains/hbar.png',
  'FIL': '/icons/chains/fil.png',
  'APT': '/icons/chains/apt.png',
  'SUI': '/icons/chains/sui.png',
  'ETC': '/icons/chains/etc.png',
  'XMR': '/icons/chains/xmr.png',
  'XRP': '/icons/chains/xrp.png',
  'BCH': '/icons/chains/bch.png',
  'DOGE': '/icons/chains/doge.png',
  'EOS': '/icons/chains/eos.png',
  'DASH': '/icons/chains/dash.png',
  'ZEC': '/icons/chains/zec.png',
  'XTZ': '/icons/chains/xtz.png',
  'WAVES': '/icons/chains/waves.png',
  'TON': '/icons/chains/ton.png',
  'ICP': '/icons/chains/icp.png',

  // Layer 2
  'ARB': '/icons/chains/arb.png',
  'OP': '/icons/chains/op.png',
  'BASE': '/icons/chains/base.png',
  'ZKS': '/icons/chains/zks.png',
  'STRK': '/icons/chains/strk.png',
  'LINEA': '/icons/chains/linea.png',

  // Regional
  'KLAY': '/icons/chains/klay.png',
  'CRO': '/icons/chains/cro.png',
  'HT': '/icons/chains/ht.png',
  'ONE': '/icons/chains/one.png',

  // Cosmos
  'OSMO': '/icons/chains/osmo.png',
  'JUNO': '/icons/chains/juno.png',
  'EVMOS': '/icons/chains/evmos.png',
  'SCRT': '/icons/chains/scrt.png',

  // Alt EVM
  'FTM': '/icons/chains/ftm.png',
  'CELO': '/icons/chains/celo.png',
  'GLMR': '/icons/chains/glmr.png',
  'METIS': '/icons/chains/metis.png',
  'GNO': '/icons/chains/gno.png',

  // Specialized
  'KSM': '/icons/chains/ksm.png',
  'ZIL': '/icons/chains/zil.png',
  'ICX': '/icons/chains/icx.png',
  'IOST': '/icons/chains/iost.png',
  'FLOW': '/icons/chains/flow.png',
  'NEO': '/icons/chains/neo.png',
  'THETA': '/icons/chains/theta.png',
  'EGLD': '/icons/chains/egld.png',
  'MINA': '/icons/chains/mina.png',
  'XDC': '/icons/chains/xdc.png',
  'QTUM': '/icons/chains/qtum.png',
  'ONT': '/icons/chains/ont.png',
  'ZEN': '/icons/chains/zen.png',
  'SC': '/icons/chains/sc.png',
  'DGB': '/icons/chains/dgb.png',
  'DCR': '/icons/chains/dcr.png',
  'BTG': '/icons/chains/btg.png',
  'RVN': '/icons/chains/rvn.png',
  'LSK': '/icons/chains/lsk.png',
  'NANO': '/icons/chains/nano.png',
  'STEEM': '/icons/chains/steem.png',
  'ARDR': '/icons/chains/ardr.png',
  'STRAX': '/icons/chains/strax.png',
  'NIM': '/icons/chains/nim.png',
  'WAN': '/icons/chains/wan.png',
  'FIRO': '/icons/chains/firo.png',
  'VLX': '/icons/chains/vlx.png',
  'SYS': '/icons/chains/sys.png',
  'KMD': '/icons/chains/kmd.png',
  'AION': '/icons/chains/aion.png',
};

/**
 * Map full names to short symbols
 * Supports addresses that use full names like "BITCOIN" instead of "BTC"
 */
const FULL_NAME_TO_SYMBOL: Record<string, string> = {
  'BITCOIN': 'BTC',
  'ETHEREUM': 'ETH',
  'BINANCE': 'BNB',
  'BNB CHAIN': 'BNB',
  'SOLANA': 'SOL',
  'CARDANO': 'ADA',
  'AVALANCHE': 'AVAX',
  'POLKADOT': 'DOT',
  'POLYGON': 'MATIC',
  'LITECOIN': 'LTC',
  'TRON': 'TRX',
  'COSMOS': 'ATOM',
  'CHAINLINK': 'LINK',
  'STELLAR': 'XLM',
  'ALGORAND': 'ALGO',
  'NEAR PROTOCOL': 'NEAR',
  'VECHAIN': 'VET',
  'HEDERA': 'HBAR',
  'FILECOIN': 'FIL',
  'APTOS': 'APT',
  'SUI': 'SUI',
  'ETHEREUM CLASSIC': 'ETC',
  'MONERO': 'XMR',
  'XRP': 'XRP',
  'RIPPLE': 'XRP',
  'BITCOIN CASH': 'BCH',
  'DOGECOIN': 'DOGE',
  'EOS': 'EOS',
  'DASH': 'DASH',
  'ZCASH': 'ZEC',
  'TEZOS': 'XTZ',
  'WAVES': 'WAVES',
  'TONCOIN': 'TON',
  'TON': 'TON',
  'INTERNET COMPUTER': 'ICP',
  'ARBITRUM': 'ARB',
  'OPTIMISM': 'OP',
  'BASE': 'BASE',
  'ZKSYNC': 'ZKS',
  'STARKNET': 'STRK',
  'LINEA': 'LINEA',
  'KLAYTN': 'KLAY',
  'CRONOS': 'CRO',
  'HUOBI': 'HT',
  'HARMONY': 'ONE',
  'OSMOSIS': 'OSMO',
  'JUNO': 'JUNO',
  'EVMOS': 'EVMOS',
  'SECRET': 'SCRT',
  'FANTOM': 'FTM',
  'CELO': 'CELO',
  'MOONBEAM': 'GLMR',
  'METIS': 'METIS',
  'GNOSIS': 'GNO',
  'KUSAMA': 'KSM',
  'ZILLIQA': 'ZIL',
  'ICON': 'ICX',
  'IOST': 'IOST',
  'FLOW': 'FLOW',
  'NEO': 'NEO',
  'THETA': 'THETA',
  'ELROND': 'EGLD',
  'MULTIVERSX': 'EGLD',
  'MINA': 'MINA',
  'XDC NETWORK': 'XDC',
  'QTUM': 'QTUM',
  'ONTOLOGY': 'ONT',
  'HORIZEN': 'ZEN',
  'SIACOIN': 'SC',
  'DIGIBYTE': 'DGB',
  'DECRED': 'DCR',
  'BITCOIN GOLD': 'BTG',
  'RAVENCOIN': 'RVN',
  'LISK': 'LSK',
  'NANO': 'NANO',
  'STEEM': 'STEEM',
  'ARDOR': 'ARDR',
  'STRATIS': 'STRAX',
  'NIMIQ': 'NIM',
  'WANCHAIN': 'WAN',
  'FIRO': 'FIRO',
  'VELAS': 'VLX',
  'SYSCOIN': 'SYS',
  'KOMODO': 'KMD',
  'AION': 'AION',
};

/**
 * Normalize symbol to standard format
 */
function normalizeSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  // Check if it's a full name that needs conversion
  if (FULL_NAME_TO_SYMBOL[upper]) {
    return FULL_NAME_TO_SYMBOL[upper];
  }
  return upper;
}

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
  'TON': '#0088CC',
  'APT': '#4CD7A5',
  'SUI': '#6FBCF0',
};

/**
 * Chains that support full transaction interaction (send/receive)
 * Based on ChainAdapter implementation
 * Supports both short and full name formats
 */
const SUPPORTED_SYMBOLS = new Set([
  // Currently Supported - Short symbols (EVM chains only)
  'ETH', 'BNB', 'MATIC', 'ARB', 'OP', 'BASE',
  // Currently Supported - Full names
  'ETHEREUM', 'BINANCE', 'BNB CHAIN', 'POLYGON', 'ARBITRUM', 'OPTIMISM',
]);

/**
 * Chains coming in next phase (address generation enabled, transaction support coming)
 * These will appear in "Other Chains" section with disclaimer
 */
const COMING_SOON_SYMBOLS = new Set([
  // Short symbols
  'BTC', 'SOL', 'TRX', 'AVAX', 'ZKS', 'STRK', 'LINEA',
  // Full names
  'BITCOIN', 'SOLANA', 'TRON', 'AVALANCHE', 'ZKSYNC', 'STARKNET',
]);

/**
 * All chains that should have addresses generated (supported + coming soon)
 */
const ENABLED_SYMBOLS = new Set([
  ...SUPPORTED_SYMBOLS,
  ...COMING_SOON_SYMBOLS,
]);

/**
 * Check if a chain supports full transaction interaction
 */
export function isChainSupported(symbol: string): boolean {
  const normalized = normalizeSymbol(symbol);
  return SUPPORTED_SYMBOLS.has(symbol.toUpperCase()) || SUPPORTED_SYMBOLS.has(normalized);
}

/**
 * Check if a chain is coming soon (address enabled but no transaction support yet)
 */
export function isChainComingSoon(symbol: string): boolean {
  const normalized = normalizeSymbol(symbol);
  return COMING_SOON_SYMBOLS.has(symbol.toUpperCase()) || COMING_SOON_SYMBOLS.has(normalized);
}

/**
 * Check if a chain has address generation enabled (supported or coming soon)
 */
export function isChainEnabled(symbol: string): boolean {
  const normalized = normalizeSymbol(symbol);
  return ENABLED_SYMBOLS.has(symbol.toUpperCase()) || ENABLED_SYMBOLS.has(normalized);
}

/**
 * Get the icon URL for a blockchain symbol
 */
export function getChainIconUrl(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  return CHAIN_ICON_URLS[normalized] || CHAIN_ICON_URLS[symbol.toUpperCase()] || '';
}

/**
 * Get fallback color for a chain
 * Used when CDN icons fail to load
 */
export function getChainFallbackIcon(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  return CHAIN_COLORS[normalized] || CHAIN_COLORS[symbol.toUpperCase()] || '#6B7280';
}

/**
 * Chain category labels for grouping
 */
export const CHAIN_CATEGORIES = {
  SUPPORTED: 'Supported Chains',
  UNSUPPORTED: 'Other Chains',
} as const;
