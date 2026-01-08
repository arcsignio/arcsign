/**
 * Chain Icons Utility
 * Maps blockchain symbols to their respective logo URLs
 * Uses cryptocurrency icon CDN for consistent, high-quality icons
 */

// Using cryptocurrency-icons CDN (https://github.com/spothq/cryptocurrency-icons)
const ICON_BASE_URL = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color';

/**
 * Map of blockchain symbols to their icon filenames
 * Some symbols need special mapping (e.g., BNB uses 'bnb.png')
 */
const SYMBOL_TO_ICON: Record<string, string> = {
  // Base Chains
  'BTC': 'btc',
  'ETH': 'eth',
  'BNB': 'bnb',
  'SOL': 'sol',
  'ADA': 'ada',
  'AVAX': 'avax',
  'DOT': 'dot',
  'MATIC': 'matic',
  'LTC': 'ltc',
  'TRX': 'trx',
  'ATOM': 'atom',
  'LINK': 'link',
  'XLM': 'xlm',
  'ALGO': 'algo',
  'NEAR': 'near',
  'VET': 'vet',
  'HBAR': 'hbar',
  'FIL': 'fil',
  'APT': 'generic', // Aptos not in standard icons
  'SUI': 'generic', // Sui not in standard icons
  'ETC': 'etc',
  'XMR': 'xmr',
  'XRP': 'xrp',
  'BCH': 'bch',
  'DOGE': 'doge',
  'EOS': 'eos',
  'DASH': 'dash',
  'ZEC': 'zec',
  'XTZ': 'xtz',
  'WAVES': 'waves',

  // Layer 2
  'ARB': 'generic', // Arbitrum
  'OP': 'generic',  // Optimism
  'BASE': 'generic', // Base
  'ZKS': 'generic', // zkSync
  'STRK': 'generic', // Starknet
  'LINEA': 'generic', // Linea

  // Regional
  'KLAY': 'generic',
  'CRO': 'cro',
  'HT': 'ht',
  'ONE': 'one',

  // Cosmos
  'OSMO': 'generic',
  'JUNO': 'generic',
  'EVMOS': 'generic',
  'SCRT': 'generic',

  // Alt EVM
  'FTM': 'ftm',
  'CELO': 'celo',
  'GLMR': 'generic',
  'METIS': 'generic',
  'GNO': 'gno',

  // Specialized
  'KSM': 'ksm',
  'ZIL': 'zil',
  'WAN': 'wan',
  'ICX': 'icx',
  'IOST': 'iost',
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
  const iconName = SYMBOL_TO_ICON[normalizedSymbol] || 'generic';
  return `${ICON_BASE_URL}/${iconName}.png`;
}

/**
 * Get inline SVG fallback for common chains
 * Used when CDN icons fail to load
 */
export function getChainFallbackIcon(symbol: string): string {
  const colors: Record<string, string> = {
    'BTC': '#F7931A',
    'ETH': '#627EEA',
    'BNB': '#F0B90B',
    'SOL': '#00FFA3',
    'MATIC': '#8247E5',
    'ARB': '#28A0F0',
    'OP': '#FF0420',
    'BASE': '#0052FF',
    'DOGE': '#C2A633',
    'LTC': '#BFBBBB',
  };

  return colors[symbol.toUpperCase()] || '#6B7280';
}

/**
 * Chain category labels for grouping
 */
export const CHAIN_CATEGORIES = {
  SUPPORTED: 'Supported Chains',
  UNSUPPORTED: 'Other Chains',
} as const;
