/**
 * Tests for WalletConnect chain support.
 * Critically guards that every supported chain id maps to a backend chain
 * string — a missing mapping silently falls back to "ethereum", which would
 * sign/broadcast on the WRONG chain.
 */

import { describe, it, expect } from 'vitest';
import { getChainString, getNativeSymbol } from '@/services/walletconnect/utils/validators';
import { SUPPORTED_CHAIN_IDS, CHAIN_ID_MAP, SUPPORTED_CHAINS } from '@/services/walletconnect/types';

describe('WalletConnect chain support', () => {
  it('includes Avalanche (43114) in the supported set', () => {
    expect(SUPPORTED_CHAIN_IDS).toContain(43114);
    expect(SUPPORTED_CHAINS.AVALANCHE).toBe('eip155:43114');
    expect(CHAIN_ID_MAP[43114]).toBe('eip155:43114');
  });

  it('maps Avalanche chainId to the backend "avalanche" string', () => {
    // Must NOT fall back to "ethereum" — that would sign on the wrong chain.
    expect(getChainString(43114)).toBe('avalanche');
    expect(getNativeSymbol(43114)).toBe('AVAX');
  });

  it('every supported chain id resolves to a non-fallback backend string', () => {
    // getChainString returns "ethereum" both for ETH and as the fallback, so
    // assert each id maps to its own expected string explicitly.
    const expected: Record<number, string> = {
      1: 'ethereum',
      56: 'bsc',
      137: 'polygon',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base',
      43114: 'avalanche',
    };
    for (const id of SUPPORTED_CHAIN_IDS) {
      expect(getChainString(id)).toBe(expected[id]);
    }
  });

  it('every supported chain id has a native symbol', () => {
    for (const id of SUPPORTED_CHAIN_IDS) {
      expect(getNativeSymbol(id)).toMatch(/^[A-Z]+$/);
    }
  });
});
