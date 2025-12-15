/**
 * Token List Service - Manages CoinGecko token lists for multiple chains
 * Data Source: CoinGecko Token Lists (https://tokenlists.org/)
 *
 * Supported Chains:
 * - Ethereum (Uniswap list)
 * - Arbitrum One
 * - Polygon PoS
 * - Optimism
 * - Binance Smart Chain
 */

export interface TokenInfo {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
}

export interface TokenList {
  name: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens: TokenInfo[];
}

export interface NormalizedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  chainId: number;
  chainName: string;
}

/**
 * Chain configuration mapping
 */
export const CHAIN_CONFIG = {
  ethereum: {
    id: 1,
    name: "Ethereum",
    file: "/token-lists/ethereum.json",
    coingeckoId: "ethereum",
  },
  arbitrum: {
    id: 42161,
    name: "Arbitrum One",
    file: "/token-lists/arbitrum.json",
    coingeckoId: "arbitrum-one",
  },
  polygon: {
    id: 137,
    name: "Polygon",
    file: "/token-lists/polygon.json",
    coingeckoId: "polygon-pos",
  },
  optimism: {
    id: 10,
    name: "Optimism",
    file: "/token-lists/optimism.json",
    coingeckoId: "optimistic-ethereum",
  },
  bsc: {
    id: 56,
    name: "BSC",
    file: "/token-lists/bsc.json",
    coingeckoId: "binance-smart-chain",
  },
} as const;

export type ChainKey = keyof typeof CHAIN_CONFIG;

/**
 * In-memory cache for token lists
 */
class TokenListCache {
  private cache: Map<ChainKey, TokenList> = new Map();
  private loading: Map<ChainKey, Promise<TokenList>> = new Map();

  async getTokenList(chain: ChainKey): Promise<TokenList> {
    // Return cached if available
    if (this.cache.has(chain)) {
      return this.cache.get(chain)!;
    }

    // Return loading promise if already fetching
    if (this.loading.has(chain)) {
      return this.loading.get(chain)!;
    }

    // Start loading
    const loadPromise = this.loadTokenList(chain);
    this.loading.set(chain, loadPromise);

    try {
      const tokenList = await loadPromise;
      this.cache.set(chain, tokenList);
      return tokenList;
    } finally {
      this.loading.delete(chain);
    }
  }

  private async loadTokenList(chain: ChainKey): Promise<TokenList> {
    const config = CHAIN_CONFIG[chain];
    const response = await fetch(config.file);

    if (!response.ok) {
      throw new Error(
        `Failed to load token list for ${chain}: ${response.statusText}`
      );
    }

    return response.json();
  }

  clear() {
    this.cache.clear();
    this.loading.clear();
  }

  clearChain(chain: ChainKey) {
    this.cache.delete(chain);
  }
}

// Global cache instance
const tokenListCache = new TokenListCache();

/**
 * Get all tokens for a specific chain
 */
export async function getTokensForChain(
  chain: ChainKey
): Promise<NormalizedToken[]> {
  const tokenList = await tokenListCache.getTokenList(chain);
  const config = CHAIN_CONFIG[chain];

  return tokenList.tokens.map((token) => ({
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoURI: token.logoURI,
    chainId: token.chainId,
    chainName: config.name,
  }));
}

/**
 * Get all tokens across all supported chains
 */
export async function getAllTokens(): Promise<
  Map<ChainKey, NormalizedToken[]>
> {
  const chains: ChainKey[] = [
    "ethereum",
    "arbitrum",
    "polygon",
    "optimism",
    "bsc",
  ];
  const results = new Map<ChainKey, NormalizedToken[]>();

  await Promise.all(
    chains.map(async (chain) => {
      try {
        const tokens = await getTokensForChain(chain);
        results.set(chain, tokens);
      } catch (error) {
        console.error(`Failed to load tokens for ${chain}:`, error);
        results.set(chain, []);
      }
    })
  );

  return results;
}

/**
 * Search for a token by symbol across all chains
 */
export async function searchTokenBySymbol(
  symbol: string,
  chains?: ChainKey[]
): Promise<NormalizedToken[]> {
  const searchChains =
    chains ||
    (["ethereum", "arbitrum", "polygon", "optimism", "bsc"] as ChainKey[]);
  const results: NormalizedToken[] = [];
  const upperSymbol = symbol.toUpperCase();

  await Promise.all(
    searchChains.map(async (chain) => {
      try {
        const tokens = await getTokensForChain(chain);
        const matches = tokens.filter(
          (token) => token.symbol.toUpperCase() === upperSymbol
        );
        results.push(...matches);
      } catch (error) {
        console.error(`Failed to search tokens on ${chain}:`, error);
      }
    })
  );

  return results;
}

/**
 * Find a specific token by address on a chain
 */
export async function findTokenByAddress(
  address: string,
  chain: ChainKey
): Promise<NormalizedToken | null> {
  try {
    const tokens = await getTokensForChain(chain);
    const lowerAddress = address.toLowerCase();

    return (
      tokens.find((token) => token.address.toLowerCase() === lowerAddress) ||
      null
    );
  } catch (error) {
    console.error(`Failed to find token ${address} on ${chain}:`, error);
    return null;
  }
}

/**
 * Get top N tokens by market cap for a chain (approximated by position in list)
 * CoinGecko lists are generally ordered by popularity/market cap
 */
export async function getTopTokens(
  chain: ChainKey,
  limit: number = 20
): Promise<NormalizedToken[]> {
  const tokens = await getTokensForChain(chain);
  return tokens.slice(0, limit);
}

/**
 * Get common/popular tokens across all chains
 * Returns top tokens from each chain
 */
export async function getCommonTokens(
  perChain: number = 15
): Promise<Map<ChainKey, NormalizedToken[]>> {
  const chains: ChainKey[] = [
    "ethereum",
    "arbitrum",
    "polygon",
    "optimism",
    "bsc",
  ];
  const results = new Map<ChainKey, NormalizedToken[]>();

  await Promise.all(
    chains.map(async (chain) => {
      try {
        const topTokens = await getTopTokens(chain, perChain);
        results.set(chain, topTokens);
      } catch (error) {
        console.error(`Failed to get common tokens for ${chain}:`, error);
        results.set(chain, []);
      }
    })
  );

  return results;
}

/**
 * Get stablecoins across all chains
 */
export async function getStablecoins(): Promise<NormalizedToken[]> {
  const stablecoinSymbols = [
    "USDT",
    "USDC",
    "DAI",
    "BUSD",
    "TUSD",
    "USDD",
    "FRAX",
  ];
  const results: NormalizedToken[] = [];

  for (const symbol of stablecoinSymbols) {
    const tokens = await searchTokenBySymbol(symbol);
    results.push(...tokens);
  }

  return results;
}

/**
 * Get wrapped native tokens (WETH, WMATIC, WBNB, etc.)
 */
export async function getWrappedTokens(): Promise<NormalizedToken[]> {
  const wrappedSymbols = ["WETH", "WMATIC", "WBNB", "WAVAX", "WFTM"];
  const results: NormalizedToken[] = [];

  for (const symbol of wrappedSymbols) {
    const tokens = await searchTokenBySymbol(symbol);
    results.push(...tokens);
  }

  return results;
}

/**
 * Refresh token lists (re-download from source)
 * Note: In production, you'd want to update the JSON files periodically
 */
export function clearCache() {
  tokenListCache.clear();
}

/**
 * Get token list metadata
 */
export async function getTokenListInfo(chain: ChainKey): Promise<{
  name: string;
  version: string;
  tokenCount: number;
  timestamp: string;
}> {
  const tokenList = await tokenListCache.getTokenList(chain);
  return {
    name: tokenList.name,
    version: `${tokenList.version.major}.${tokenList.version.minor}.${tokenList.version.patch}`,
    tokenCount: tokenList.tokens.length,
    timestamp: tokenList.timestamp,
  };
}

/**
 * Export for testing/debugging
 */
export const _internal = {
  cache: tokenListCache,
  CHAIN_CONFIG,
};
