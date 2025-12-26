/**
 * React Hook for Token Lists
 * Provides easy access to token information from CoinGecko token lists
 */

import { useState, useEffect } from "react";
import {
  getCommonTokens,
  getAllTokens,
  searchTokenBySymbol,
  findTokenByAddress,
  getTopTokens,
  type ChainKey,
  type NormalizedToken,
} from "@/services/tokenList";
import { PRIORITY_TOKEN_SYMBOLS } from "@/constants/commonTokens";

/**
 * Hook to load common tokens across all chains
 */
export function useCommonTokens(perChain: number = 15) {
  const [tokens, setTokens] = useState<Map<ChainKey, NormalizedToken[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadTokens = async () => {
      try {
        setIsLoading(true);
        const commonTokens = await getCommonTokens(perChain);
        if (mounted) {
          setTokens(commonTokens);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load tokens"
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadTokens();

    return () => {
      mounted = false;
    };
  }, [perChain]);

  return { tokens, isLoading, error };
}

/**
 * Hook to load ALL tokens across all chains (for logo lookup by address)
 * This loads the complete token lists, not just top N
 */
export function useAllTokens() {
  const [tokens, setTokens] = useState<Map<ChainKey, NormalizedToken[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadTokens = async () => {
      try {
        setIsLoading(true);
        const allTokens = await getAllTokens();
        if (mounted) {
          setTokens(allTokens);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load all tokens"
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadTokens();

    return () => {
      mounted = false;
    };
  }, []);

  return { tokens, isLoading, error };
}

/**
 * Hook to load priority tokens (those that should always be displayed)
 */
export function usePriorityTokens() {
  const [tokens, setTokens] = useState<NormalizedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadTokens = async () => {
      try {
        setIsLoading(true);
        const allTokens: NormalizedToken[] = [];

        // Load priority tokens
        for (const symbol of PRIORITY_TOKEN_SYMBOLS) {
          const results = await searchTokenBySymbol(symbol);
          allTokens.push(...results);
        }

        if (mounted) {
          setTokens(allTokens);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load priority tokens"
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadTokens();

    return () => {
      mounted = false;
    };
  }, []);

  return { tokens, isLoading, error };
}

/**
 * Hook to search for tokens by symbol
 */
export function useTokenSearch(symbol: string, chains?: ChainKey[]) {
  const [tokens, setTokens] = useState<NormalizedToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol || symbol.length < 2) {
      setTokens([]);
      return;
    }

    let mounted = true;

    const searchTokens = async () => {
      try {
        setIsLoading(true);
        const results = await searchTokenBySymbol(symbol, chains);
        if (mounted) {
          setTokens(results);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Search failed");
          setTokens([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Debounce search
    const timer = setTimeout(searchTokens, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [symbol, chains]);

  return { tokens, isLoading, error };
}

/**
 * Hook to find a token by address
 */
export function useTokenByAddress(address: string | null, chain: ChainKey) {
  const [token, setToken] = useState<NormalizedToken | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setToken(null);
      return;
    }

    let mounted = true;

    const findToken = async () => {
      try {
        setIsLoading(true);
        const result = await findTokenByAddress(address, chain);
        if (mounted) {
          setToken(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Token lookup failed");
          setToken(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    findToken();

    return () => {
      mounted = false;
    };
  }, [address, chain]);

  return { token, isLoading, error };
}

/**
 * Hook to get top tokens for a specific chain
 */
export function useTopTokens(chain: ChainKey, limit: number = 20) {
  const [tokens, setTokens] = useState<NormalizedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadTokens = async () => {
      try {
        setIsLoading(true);
        const topTokens = await getTopTokens(chain, limit);
        if (mounted) {
          setTokens(topTokens);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load top tokens"
          );
          setTokens([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadTokens();

    return () => {
      mounted = false;
    };
  }, [chain, limit]);

  return { tokens, isLoading, error };
}

/**
 * Get token metadata (logo, decimals) by address
 * Useful for enriching user's token balances with metadata
 */
export function useTokenMetadata(tokenAddresses: string[], chain: ChainKey) {
  const [metadata, setMetadata] = useState<Map<string, NormalizedToken>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (tokenAddresses.length === 0) {
      setMetadata(new Map());
      return;
    }

    let mounted = true;

    const loadMetadata = async () => {
      try {
        setIsLoading(true);
        const results = new Map<string, NormalizedToken>();

        await Promise.all(
          tokenAddresses.map(async (address) => {
            const token = await findTokenByAddress(address, chain);
            if (token) {
              results.set(address.toLowerCase(), token);
            }
          })
        );

        if (mounted) {
          setMetadata(results);
        }
      } catch (err) {
        console.error("Failed to load token metadata:", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      mounted = false;
    };
  }, [tokenAddresses.join(","), chain]);

  return { metadata, isLoading };
}
