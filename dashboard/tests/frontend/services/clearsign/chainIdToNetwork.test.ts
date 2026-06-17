import { describe, it, expect } from 'vitest';
import { chainIdToNetwork } from '@/services/clearsign/chainIdToNetwork';

describe('chainIdToNetwork', () => {
  it('maps known numeric chainIds', () => {
    expect(chainIdToNetwork(1)).toBe('eth-mainnet');
    expect(chainIdToNetwork(137)).toBe('polygon-mainnet');
    expect(chainIdToNetwork(42161)).toBe('arb-mainnet');
    expect(chainIdToNetwork(10)).toBe('opt-mainnet');
    expect(chainIdToNetwork(8453)).toBe('base-mainnet');
    expect(chainIdToNetwork(56)).toBe('bnb-mainnet');
    expect(chainIdToNetwork(97)).toBe('bnb-mainnet');
    expect(chainIdToNetwork(43114)).toBe('avalanche-mainnet');
  });

  it('handles hex string chainIds', () => {
    expect(chainIdToNetwork('0x1')).toBe('eth-mainnet');
    expect(chainIdToNetwork('0x89')).toBe('polygon-mainnet');  // 137
    expect(chainIdToNetwork('0xa86a')).toBe('avalanche-mainnet'); // 43114
  });

  it('handles decimal string chainIds', () => {
    expect(chainIdToNetwork('1')).toBe('eth-mainnet');
    expect(chainIdToNetwork('137')).toBe('polygon-mainnet');
    expect(chainIdToNetwork('43114')).toBe('avalanche-mainnet');
  });

  it('falls back to eth-mainnet for unknown chainIds', () => {
    expect(chainIdToNetwork(99999)).toBe('eth-mainnet');
    expect(chainIdToNetwork(0)).toBe('eth-mainnet');
  });

  it('falls back to eth-mainnet for undefined/null', () => {
    expect(chainIdToNetwork(undefined)).toBe('eth-mainnet');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(chainIdToNetwork(null as any)).toBe('eth-mainnet');
  });
});
