/**
 * Chain Icons Utility
 * Maps blockchain symbols to their respective logo URLs
 * Supports both short (BTC) and long (BITCOIN) symbol formats
 *
 * Supported chains: Bitcoin + EVM ecosystem
 */

/**
 * Direct URLs for major blockchain icons
 * Using local files in public/icons/chains/ for reliability (no CORS issues)
 */
const CHAIN_ICON_URLS: Record<string, string> = {
  // Bitcoin
  'BTC': '/icons/chains/btc.png',

  // EVM Mainnet
  'ETH': '/icons/chains/eth.png',
  'BNB': '/icons/chains/bnb.png',
  'AVAX': '/icons/chains/avax.png',
  'MATIC': '/icons/chains/matic.png',
  'ETC': '/icons/chains/etc.png',
  'VET': '/icons/chains/vet.png',

  // Layer 2
  'ARB': '/icons/chains/arb.png',
  'OP': '/icons/chains/op.png',
  'BASE': '/icons/chains/base.png',
  'ZKS': '/icons/chains/zks.png',
  'LINEA': '/icons/chains/linea.png',

  // Regional EVM
  'KLAY': '/icons/chains/klay.png',
  'CRO': '/icons/chains/cro.png',
  'HT': '/icons/chains/ht.png',

  // Alt EVM
  'FTM': '/icons/chains/ftm.png',
  'CELO': '/icons/chains/celo.png',
  'GLMR': '/icons/chains/glmr.png',
  'METIS': '/icons/chains/metis.png',
  'GNO': '/icons/chains/gno.png',
  'WAN': '/icons/chains/wan.png',
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
  'AVALANCHE': 'AVAX',
  'POLYGON': 'MATIC',
  'ETHEREUM CLASSIC': 'ETC',
  'VECHAIN': 'VET',
  'ARBITRUM': 'ARB',
  'OPTIMISM': 'OP',
  'BASE': 'BASE',
  'ZKSYNC': 'ZKS',
  'LINEA': 'LINEA',
  'KLAYTN': 'KLAY',
  'CRONOS': 'CRO',
  'HUOBI': 'HT',
  'FANTOM': 'FTM',
  'CELO': 'CELO',
  'MOONBEAM': 'GLMR',
  'METIS': 'METIS',
  'GNOSIS': 'GNO',
  'WANCHAIN': 'WAN',
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
  'AVAX': '#E84142',
  'MATIC': '#8247E5',
  'ETC': '#328332',
  'VET': '#15BDFF',
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
 * Supports both short and full name formats
 */
const SUPPORTED_SYMBOLS = new Set([
  // Currently Supported - Short symbols (EVM chains only)
  'ETH', 'BNB', 'MATIC', 'ARB', 'OP', 'BASE', 'AVAX',
  // Currently Supported - Full names
  'ETHEREUM', 'BINANCE', 'BNB CHAIN', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'AVALANCHE',
]);

/**
 * Chains coming in next phase (address generation enabled, transaction support coming)
 * These will appear in "Other Chains" section with disclaimer
 */
const COMING_SOON_SYMBOLS = new Set([
  // Short symbols
  'BTC', 'ZKS', 'LINEA',
  // Full names
  'BITCOIN', 'ZKSYNC',
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
