/**
 * Token Whitelist Checker
 * Uses CoinGecko token lists to verify if tokens are known/legitimate
 * For use in Transaction History to warn users about unknown tokens
 */

import { findTokenByAddress, type ChainKey } from '@/services/tokenList';

/**
 * Map Alchemy network IDs to tokenList chain keys
 */
export const NETWORK_TO_CHAIN_MAP: Record<string, ChainKey> = {
  'eth-mainnet': 'ethereum',
  'polygon-mainnet': 'polygon',
  'arbitrum-mainnet': 'arbitrum',
  'optimism-mainnet': 'optimism',
  'base-mainnet': 'base',
  'bnb-mainnet': 'bsc',
  'avalanche-mainnet': 'avalanche',
};

export interface TokenCheckResult {
  isKnown: boolean;
  shouldWarn: boolean;
  reason: 'unknown_token' | 'native_token' | 'whitelist_verified' | 'unknown_network';
}

/**
 * Check if a token is in the CoinGecko whitelist
 *
 * @param contractAddress - The token contract address (can be null for native tokens)
 * @param network - Alchemy network ID (e.g., 'eth-mainnet')
 * @param category - Transfer category ('external', 'internal', 'erc20', etc.)
 */
export async function checkTokenWhitelist(
  contractAddress: string | null | undefined,
  network: string,
  category: string
): Promise<TokenCheckResult> {
  // Native tokens (external/internal transfers) should not be warned
  if (category === 'external' || category === 'internal') {
    return {
      isKnown: true,
      shouldWarn: false,
      reason: 'native_token',
    };
  }

  // NFTs (erc721/erc1155) without contract address should be warned
  // These are often spam/scam NFT airdrops
  if (category === 'erc721' || category === 'erc1155') {
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      console.warn(`[tokenWhitelist] NFT without contract address - marking as suspicious`);
      return {
        isKnown: false,
        shouldWarn: true,
        reason: 'unknown_token',
      };
    }
    // NFTs are not in CoinGecko token lists, so always warn for NFTs not in whitelist
    // Skip the whitelist check and mark as unknown
    console.log(`[tokenWhitelist] NFT transfer detected (${category}), marking as unverified`);
    return {
      isKnown: false,
      shouldWarn: true,
      reason: 'unknown_token',
    };
  }

  // If no contract address for ERC20, treat as native token
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return {
      isKnown: true,
      shouldWarn: false,
      reason: 'native_token',
    };
  }

  // Map network to chain key
  const chainKey = NETWORK_TO_CHAIN_MAP[network];
  if (!chainKey) {
    // Unknown network - can't verify, show warning (fail-safe)
    return {
      isKnown: false,
      shouldWarn: true,
      reason: 'unknown_network',
    };
  }

  // Check whitelist
  try {
    const token = await findTokenByAddress(contractAddress, chainKey);
    if (token) {
      return {
        isKnown: true,
        shouldWarn: false,
        reason: 'whitelist_verified',
      };
    }
  } catch (error) {
    console.warn('[tokenWhitelist] Failed to check whitelist:', error);
  }

  // Token not found in whitelist
  return {
    isKnown: false,
    shouldWarn: true,
    reason: 'unknown_token',
  };
}

export interface TransferCheckInput {
  contractAddress: string | null | undefined;
  network: string;
  category: string;
  uniqueId: string;
}

/**
 * Batch check multiple tokens (optimized for transaction list)
 * Uses parallel processing and caching for better performance
 */
export async function batchCheckTokens(
  transfers: TransferCheckInput[]
): Promise<Map<string, TokenCheckResult>> {
  const results = new Map<string, TokenCheckResult>();

  // Create a cache key for deduplication
  const cacheMap = new Map<string, string[]>();

  // Group transfers by their cache key to avoid duplicate checks
  transfers.forEach((transfer) => {
    const cacheKey = `${transfer.network}-${transfer.contractAddress?.toLowerCase() || 'native'}-${transfer.category}`;
    if (!cacheMap.has(cacheKey)) {
      cacheMap.set(cacheKey, []);
    }
    cacheMap.get(cacheKey)!.push(transfer.uniqueId);
  });

  // Create unique check list
  const uniqueChecks = transfers.filter((transfer, index, self) => {
    const cacheKey = `${transfer.network}-${transfer.contractAddress?.toLowerCase() || 'native'}-${transfer.category}`;
    return self.findIndex((t) =>
      `${t.network}-${t.contractAddress?.toLowerCase() || 'native'}-${t.category}` === cacheKey
    ) === index;
  });

  // Process all unique checks in parallel
  const checkPromises = uniqueChecks.map(async (transfer) => {
    const result = await checkTokenWhitelist(
      transfer.contractAddress,
      transfer.network,
      transfer.category
    );
    const cacheKey = `${transfer.network}-${transfer.contractAddress?.toLowerCase() || 'native'}-${transfer.category}`;
    return { cacheKey, result };
  });

  const checkResults = await Promise.all(checkPromises);

  // Map results back to all transfer uniqueIds
  checkResults.forEach(({ cacheKey, result }) => {
    const uniqueIds = cacheMap.get(cacheKey) || [];
    uniqueIds.forEach((uniqueId) => {
      results.set(uniqueId, result);
    });
  });

  return results;
}
