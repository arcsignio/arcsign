/**
 * Tests for src/utils/chainIcons.ts
 * Verifies chain icon URL resolution, fallback colors, and support status checks
 */

import { describe, it, expect } from 'vitest';
import {
  getChainIconUrl,
  getChainFallbackIcon,
  isChainSupported,
  isChainComingSoon,
  isChainEnabled,
  CHAIN_CATEGORIES,
} from '@/utils/chainIcons';

describe('chainIcons utility', () => {
  // ==========================================================================
  // getChainIconUrl
  // ==========================================================================
  describe('getChainIconUrl', () => {
    it('returns correct URL for known short symbol (BTC)', () => {
      expect(getChainIconUrl('BTC')).toBe('/icons/chains/btc.png');
    });

    it('returns correct URL for known short symbol (ETH)', () => {
      expect(getChainIconUrl('ETH')).toBe('/icons/chains/eth.png');
    });

    it('handles case-insensitive input', () => {
      expect(getChainIconUrl('eth')).toBe('/icons/chains/eth.png');
      expect(getChainIconUrl('Bnb')).toBe('/icons/chains/bnb.png');
    });

    it('resolves full name to correct icon URL (BITCOIN -> BTC)', () => {
      expect(getChainIconUrl('BITCOIN')).toBe('/icons/chains/btc.png');
      expect(getChainIconUrl('ETHEREUM')).toBe('/icons/chains/eth.png');
      expect(getChainIconUrl('POLYGON')).toBe('/icons/chains/matic.png');
    });

    it('returns empty string for unknown chain', () => {
      expect(getChainIconUrl('UNKNOWN_CHAIN')).toBe('');
      expect(getChainIconUrl('SOLANA')).toBe('');
    });

    it('handles Layer 2 chains', () => {
      expect(getChainIconUrl('ARB')).toBe('/icons/chains/arb.png');
      expect(getChainIconUrl('OP')).toBe('/icons/chains/op.png');
      expect(getChainIconUrl('BASE')).toBe('/icons/chains/base.png');
    });
  });

  // ==========================================================================
  // getChainFallbackIcon
  // ==========================================================================
  describe('getChainFallbackIcon', () => {
    it('returns correct color for BTC', () => {
      expect(getChainFallbackIcon('BTC')).toBe('#F7931A');
    });

    it('returns correct color for ETH', () => {
      expect(getChainFallbackIcon('ETH')).toBe('#627EEA');
    });

    it('resolves full name to correct color', () => {
      expect(getChainFallbackIcon('BITCOIN')).toBe('#F7931A');
      expect(getChainFallbackIcon('ETHEREUM')).toBe('#627EEA');
    });

    it('returns default gray for unknown chain', () => {
      expect(getChainFallbackIcon('UNKNOWN')).toBe('#6B7280');
      expect(getChainFallbackIcon('SOLANA')).toBe('#6B7280');
    });

    it('handles case-insensitive input', () => {
      expect(getChainFallbackIcon('btc')).toBe('#F7931A');
    });
  });

  // ==========================================================================
  // isChainSupported
  // ==========================================================================
  describe('isChainSupported', () => {
    it('returns true for supported EVM chains (short symbol)', () => {
      expect(isChainSupported('ETH')).toBe(true);
      expect(isChainSupported('BNB')).toBe(true);
      expect(isChainSupported('MATIC')).toBe(true);
      expect(isChainSupported('ARB')).toBe(true);
      expect(isChainSupported('OP')).toBe(true);
      expect(isChainSupported('BASE')).toBe(true);
    });

    it('returns true for supported chains using full names', () => {
      expect(isChainSupported('ETHEREUM')).toBe(true);
      expect(isChainSupported('POLYGON')).toBe(true);
      expect(isChainSupported('ARBITRUM')).toBe(true);
      expect(isChainSupported('OPTIMISM')).toBe(true);
    });

    it('returns false for BTC (not yet supported for transactions)', () => {
      expect(isChainSupported('BTC')).toBe(false);
      expect(isChainSupported('BITCOIN')).toBe(false);
    });

    it('returns false for completely unknown chains', () => {
      expect(isChainSupported('SOLANA')).toBe(false);
      expect(isChainSupported('CARDANO')).toBe(false);
    });
  });

  // ==========================================================================
  // isChainComingSoon
  // ==========================================================================
  describe('isChainComingSoon', () => {
    it('returns true for coming soon chains', () => {
      expect(isChainComingSoon('BTC')).toBe(true);
      expect(isChainComingSoon('AVAX')).toBe(true);
      expect(isChainComingSoon('ZKS')).toBe(true);
    });

    it('returns true for coming soon chains using full names', () => {
      expect(isChainComingSoon('BITCOIN')).toBe(true);
      expect(isChainComingSoon('AVALANCHE')).toBe(true);
      expect(isChainComingSoon('ZKSYNC')).toBe(true);
    });

    it('returns false for already supported chains', () => {
      expect(isChainComingSoon('ETH')).toBe(false);
      expect(isChainComingSoon('MATIC')).toBe(false);
    });
  });

  // ==========================================================================
  // isChainEnabled
  // ==========================================================================
  describe('isChainEnabled', () => {
    it('returns true for supported chains (address generation enabled)', () => {
      expect(isChainEnabled('ETH')).toBe(true);
      expect(isChainEnabled('ARB')).toBe(true);
    });

    it('returns true for coming-soon chains (address generation enabled)', () => {
      expect(isChainEnabled('BTC')).toBe(true);
      expect(isChainEnabled('AVAX')).toBe(true);
    });

    it('returns false for chains not in either set', () => {
      expect(isChainEnabled('SOLANA')).toBe(false);
      expect(isChainEnabled('FTM')).toBe(false);
    });
  });

  // ==========================================================================
  // CHAIN_CATEGORIES
  // ==========================================================================
  describe('CHAIN_CATEGORIES', () => {
    it('exports expected category labels', () => {
      expect(CHAIN_CATEGORIES.SUPPORTED).toBe('Supported Chains');
      expect(CHAIN_CATEGORIES.UNSUPPORTED).toBe('Other Chains');
    });
  });
});
