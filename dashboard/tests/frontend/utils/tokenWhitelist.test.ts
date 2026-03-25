/**
 * Tests for src/utils/tokenWhitelist.ts
 * Verifies token whitelist checking and batch token verification
 */

import { describe, it, expect, vi } from 'vitest';
import { checkTokenWhitelist, batchCheckTokens } from '@/utils/tokenWhitelist';
import type { TransferCheckInput } from '@/utils/tokenWhitelist';

// Mock the tokenList service that tokenWhitelist depends on
vi.mock('@/services/tokenList', () => ({
  findTokenByAddress: vi.fn(),
}));

import { findTokenByAddress } from '@/services/tokenList';
const mockFindToken = vi.mocked(findTokenByAddress);

describe('tokenWhitelist utility', () => {
  // ==========================================================================
  // checkTokenWhitelist
  // ==========================================================================
  describe('checkTokenWhitelist', () => {
    it('returns native_token for external transfers (no warning)', async () => {
      const result = await checkTokenWhitelist('0x123', 'eth-mainnet', 'external');
      expect(result).toEqual({
        isKnown: true,
        shouldWarn: false,
        reason: 'native_token',
      });
      // Should not call findTokenByAddress for native transfers
      expect(mockFindToken).not.toHaveBeenCalled();
    });

    it('returns native_token for internal transfers', async () => {
      const result = await checkTokenWhitelist('0x123', 'eth-mainnet', 'internal');
      expect(result).toEqual({
        isKnown: true,
        shouldWarn: false,
        reason: 'native_token',
      });
    });

    it('warns for NFT (erc721) transfers', async () => {
      const result = await checkTokenWhitelist('0xnft', 'eth-mainnet', 'erc721');
      expect(result).toEqual({
        isKnown: false,
        shouldWarn: true,
        reason: 'unknown_token',
      });
    });

    it('warns for NFT (erc1155) with null contract address', async () => {
      const result = await checkTokenWhitelist(null, 'eth-mainnet', 'erc1155');
      expect(result).toEqual({
        isKnown: false,
        shouldWarn: true,
        reason: 'unknown_token',
      });
    });

    it('warns for NFT (erc721) with zero address', async () => {
      const result = await checkTokenWhitelist(
        '0x0000000000000000000000000000000000000000',
        'eth-mainnet',
        'erc721'
      );
      expect(result).toEqual({
        isKnown: false,
        shouldWarn: true,
        reason: 'unknown_token',
      });
    });

    it('returns native_token for erc20 with null contract address', async () => {
      const result = await checkTokenWhitelist(null, 'eth-mainnet', 'erc20');
      expect(result).toEqual({
        isKnown: true,
        shouldWarn: false,
        reason: 'native_token',
      });
    });

    it('returns native_token for erc20 with zero address', async () => {
      const result = await checkTokenWhitelist(
        '0x0000000000000000000000000000000000000000',
        'eth-mainnet',
        'erc20'
      );
      expect(result).toEqual({
        isKnown: true,
        shouldWarn: false,
        reason: 'native_token',
      });
    });

    it('returns unknown_network for unsupported network', async () => {
      const result = await checkTokenWhitelist('0xtoken', 'solana-mainnet', 'erc20');
      expect(result).toEqual({
        isKnown: false,
        shouldWarn: true,
        reason: 'unknown_network',
      });
    });

    it('returns whitelist_verified when token is found in CoinGecko list', async () => {
      mockFindToken.mockImplementation(() =>
        Promise.resolve({
          address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          logoURI: 'https://example.com/usdt.png',
          chainId: 1,
          chainName: 'Ethereum',
        })
      );

      const result = await checkTokenWhitelist(
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        'eth-mainnet',
        'erc20'
      );

      expect(result).toEqual({
        isKnown: true,
        shouldWarn: false,
        reason: 'whitelist_verified',
      });
      expect(mockFindToken).toHaveBeenCalledWith(
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        'ethereum'
      );
    });

    it('returns unknown_token when token is not in whitelist', async () => {
      mockFindToken.mockImplementation(() => Promise.resolve(null));

      const result = await checkTokenWhitelist(
        '0xscamtoken',
        'eth-mainnet',
        'erc20'
      );

      expect(result).toEqual({
        isKnown: false,
        shouldWarn: true,
        reason: 'unknown_token',
      });
    });

    it('returns unknown_token when findTokenByAddress throws', async () => {
      mockFindToken.mockImplementation(() => Promise.reject(new Error('fetch failed')));

      const result = await checkTokenWhitelist(
        '0xtoken',
        'eth-mainnet',
        'erc20'
      );

      expect(result).toEqual({
        isKnown: false,
        shouldWarn: true,
        reason: 'unknown_token',
      });
    });

    it('maps polygon-mainnet to polygon chain key', async () => {
      mockFindToken.mockImplementation(() => Promise.resolve(null));

      await checkTokenWhitelist('0xtoken', 'polygon-mainnet', 'erc20');

      expect(mockFindToken).toHaveBeenCalledWith('0xtoken', 'polygon');
    });

    it('maps bnb-mainnet to bsc chain key', async () => {
      mockFindToken.mockImplementation(() => Promise.resolve(null));

      await checkTokenWhitelist('0xtoken', 'bnb-mainnet', 'erc20');

      expect(mockFindToken).toHaveBeenCalledWith('0xtoken', 'bsc');
    });
  });

  // ==========================================================================
  // batchCheckTokens
  // ==========================================================================
  describe('batchCheckTokens', () => {
    it('returns results for all transfers', async () => {
      mockFindToken.mockImplementation(() => Promise.resolve(null));

      const transfers: TransferCheckInput[] = [
        { contractAddress: null, network: 'eth-mainnet', category: 'external', uniqueId: 'tx1' },
        { contractAddress: '0xtoken', network: 'eth-mainnet', category: 'erc20', uniqueId: 'tx2' },
      ];

      const results = await batchCheckTokens(transfers);

      expect(results.size).toBe(2);
      expect(results.get('tx1')?.reason).toBe('native_token');
      expect(results.get('tx2')?.reason).toBe('unknown_token');
    });

    it('deduplicates identical checks across transfers', async () => {
      mockFindToken.mockImplementation(() => Promise.resolve(null));

      const transfers: TransferCheckInput[] = [
        { contractAddress: '0xAAA', network: 'eth-mainnet', category: 'erc20', uniqueId: 'tx1' },
        { contractAddress: '0xaaa', network: 'eth-mainnet', category: 'erc20', uniqueId: 'tx2' },
      ];

      const results = await batchCheckTokens(transfers);

      // Both should get the same result
      expect(results.get('tx1')).toEqual(results.get('tx2'));
      // findTokenByAddress should only be called once (deduplicated)
      expect(mockFindToken).toHaveBeenCalledTimes(1);
    });

    it('handles empty transfers array', async () => {
      const results = await batchCheckTokens([]);
      expect(results.size).toBe(0);
    });

    it('processes different networks in parallel', async () => {
      mockFindToken.mockImplementation(() => Promise.resolve(null));

      const transfers: TransferCheckInput[] = [
        { contractAddress: '0xtoken', network: 'eth-mainnet', category: 'erc20', uniqueId: 'tx1' },
        { contractAddress: '0xtoken', network: 'polygon-mainnet', category: 'erc20', uniqueId: 'tx2' },
      ];

      const results = await batchCheckTokens(transfers);

      expect(results.size).toBe(2);
      // Different networks = different cache keys = 2 calls
      expect(mockFindToken).toHaveBeenCalledTimes(2);
    });
  });
});
