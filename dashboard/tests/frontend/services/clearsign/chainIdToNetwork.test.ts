import { describe, it, expect } from 'vitest';
import { chainIdToNetwork, networkToChainId } from '@/services/clearsign/chainIdToNetwork';

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

describe('networkToChainId', () => {
  it('maps internal network ids back to numeric chainIds', () => {
    expect(networkToChainId('eth-mainnet')).toBe(1);
    expect(networkToChainId('polygon-mainnet')).toBe(137);
    expect(networkToChainId('arb-mainnet')).toBe(42161);
    expect(networkToChainId('opt-mainnet')).toBe(10);
    expect(networkToChainId('base-mainnet')).toBe(8453);
    expect(networkToChainId('avalanche-mainnet')).toBe(43114);
  });

  it('maps bnb-mainnet to 56 (mainnet, not the 97 testnet)', () => {
    expect(networkToChainId('bnb-mainnet')).toBe(56);
  });

  it('returns undefined for an unknown network', () => {
    expect(networkToChainId('does-not-exist')).toBeUndefined();
  });
});
