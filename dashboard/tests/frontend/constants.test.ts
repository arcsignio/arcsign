import { describe, it, expect } from 'vitest';
import {
  WALLET_LIMIT_FREE,
  WALLET_LIMIT_PER_NFT,
  walletLimit,
  CONTRACTS,
  ACTIVE_NETWORK,
  MEMBERSHIP_PRICE,
  APPROVE_SELECTOR,
  MINT_SELECTOR,
  BIND_DEVICE_SELECTOR,
} from '@/constants/contracts';

describe('Contract Constants', () => {
  describe('Wallet Limit Formula', () => {
    it('WALLET_LIMIT_FREE equals 1', () => {
      expect(WALLET_LIMIT_FREE).toBe(1);
    });

    it('WALLET_LIMIT_PER_NFT equals 3', () => {
      expect(WALLET_LIMIT_PER_NFT).toBe(3);
    });

    it('walletLimit returns 1 for 0 NFTs (free)', () => {
      expect(walletLimit(0)).toBe(1);
    });

    it('walletLimit returns 4 for 1 NFT', () => {
      expect(walletLimit(1)).toBe(4);
    });

    it('walletLimit returns 7 for 2 NFTs', () => {
      expect(walletLimit(2)).toBe(7);
    });

    it('walletLimit returns 10 for 3 NFTs', () => {
      expect(walletLimit(3)).toBe(10);
    });

    it('walletLimit follows formula: 1 + (nftCount * 3)', () => {
      const testCases = [
        { nftCount: 0, expected: 1 },
        { nftCount: 1, expected: 4 },
        { nftCount: 5, expected: 16 },
        { nftCount: 10, expected: 31 },
      ];

      for (const { nftCount, expected } of testCases) {
        expect(walletLimit(nftCount)).toBe(expected);
      }
    });
  });

  describe('Network Configuration', () => {
    it('mainnet has correct chain ID', () => {
      expect(CONTRACTS.mainnet.chainId).toBe(56);
    });

    it('testnet has correct chain ID', () => {
      expect(CONTRACTS.testnet.chainId).toBe(97);
    });

    it('mainnet has BSC explorer URL', () => {
      expect(CONTRACTS.mainnet.explorer).toContain('bscscan.com');
    });

    it('testnet has testnet explorer URL', () => {
      expect(CONTRACTS.testnet.explorer).toContain('testnet');
    });

    it('mainnet has valid NFT contract address', () => {
      expect(CONTRACTS.mainnet.nftContract).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('testnet has valid NFT contract address', () => {
      expect(CONTRACTS.testnet.nftContract).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe('Function Selectors', () => {
    it('APPROVE_SELECTOR is correct 4-byte selector', () => {
      expect(APPROVE_SELECTOR).toMatch(/^0x[0-9a-f]{8}$/);
      expect(APPROVE_SELECTOR).toBe('0x095ea7b3');
    });

    it('MINT_SELECTOR is correct', () => {
      expect(MINT_SELECTOR).toMatch(/^0x[0-9a-f]{8}$/);
      expect(MINT_SELECTOR).toBe('0x1249c58b');
    });

    it('BIND_DEVICE_SELECTOR is correct', () => {
      expect(BIND_DEVICE_SELECTOR).toMatch(/^0x[0-9a-f]{8}$/);
    });
  });

  describe('Membership Price', () => {
    it('is a valid BigNumber string', () => {
      expect(MEMBERSHIP_PRICE).toMatch(/^\d+$/);
    });

    it('is at least 1e18 (1 token unit)', () => {
      expect(BigInt(MEMBERSHIP_PRICE)).toBeGreaterThanOrEqual(BigInt(10) ** BigInt(18));
    });
  });
});
