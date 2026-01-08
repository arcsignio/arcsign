/**
 * Token Icons Utility
 * Provides local icons for priority tokens with CDN fallback
 */

/**
 * Local icon paths for priority tokens
 * These are the most commonly used tokens that should load instantly
 */
const LOCAL_TOKEN_ICONS: Record<string, string> = {
  // Stablecoins
  'USDT': '/icons/tokens/usdt.png',
  'USDC': '/icons/tokens/usdc.png',
  'DAI': '/icons/tokens/dai.png',
  'BUSD': '/icons/tokens/busd.png',

  // Native/Wrapped tokens
  'ETH': '/icons/tokens/eth.png',
  'WETH': '/icons/tokens/weth.png',
  'BTC': '/icons/tokens/btc.png',
  'WBTC': '/icons/tokens/wbtc.png',
  'BNB': '/icons/tokens/bnb.png',
  'WBNB': '/icons/tokens/wbnb.png',
  'MATIC': '/icons/tokens/matic.png',
  'WMATIC': '/icons/tokens/wmatic.png',

  // DeFi tokens
  'UNI': '/icons/tokens/uni.png',
  'AAVE': '/icons/tokens/aave.png',
  'LINK': '/icons/tokens/link.png',
  'CRV': '/icons/tokens/crv.png',
  'MKR': '/icons/tokens/mkr.png',
  'SNX': '/icons/tokens/snx.png',
  'COMP': '/icons/tokens/comp.png',
  'SUSHI': '/icons/tokens/sushi.png',

  // Layer 2 tokens
  'OP': '/icons/tokens/op.png',
  'ARB': '/icons/tokens/arb.png',

  // Exchange tokens
  'OKB': '/icons/tokens/okb.png',
};

/**
 * Check if a token has a local icon available
 */
export function hasLocalTokenIcon(symbol: string): boolean {
  return symbol.toUpperCase() in LOCAL_TOKEN_ICONS;
}

/**
 * Get the icon URL for a token
 * Returns local path if available, otherwise returns the provided CDN URL
 *
 * @param symbol - Token symbol (e.g., "USDT", "ETH")
 * @param cdnUrl - Fallback CDN URL from token list
 * @returns Icon URL (local or CDN)
 */
export function getTokenIconUrl(symbol: string, cdnUrl?: string): string {
  const upperSymbol = symbol.toUpperCase();

  // Use local icon if available
  if (LOCAL_TOKEN_ICONS[upperSymbol]) {
    return LOCAL_TOKEN_ICONS[upperSymbol];
  }

  // Fall back to CDN URL
  return cdnUrl || '';
}

/**
 * Priority token symbols that have local icons
 */
export const PRIORITY_TOKEN_SYMBOLS = Object.keys(LOCAL_TOKEN_ICONS);

/**
 * Get all local token icon paths (for preloading)
 */
export function getAllLocalTokenIconPaths(): string[] {
  return Object.values(LOCAL_TOKEN_ICONS);
}
