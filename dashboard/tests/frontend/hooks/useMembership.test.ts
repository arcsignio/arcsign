import { describe, it, expect } from 'vitest';
import {
  getMembershipTierName,
  getWalletLimitForTier,
  formatExpirationDate,
  isExpiringSoon,
  getDaysRemainingText,
} from '@/hooks/useMembership';

describe('useMembership - Pure Functions', () => {
  describe('getMembershipTierName', () => {
    it('returns "Pro" for Pro members', () => {
      expect(getMembershipTierName(true)).toBe('Pro');
    });

    it('returns "Free" for free members', () => {
      expect(getMembershipTierName(false)).toBe('Free');
    });
  });

  describe('getWalletLimitForTier', () => {
    it('returns null for Pro tier (unlimited)', () => {
      expect(getWalletLimitForTier(true)).toBeNull();
    });

    it('returns 3 for Free tier', () => {
      expect(getWalletLimitForTier(false)).toBe(3);
    });
  });

  describe('formatExpirationDate', () => {
    it('returns "N/A" for zero timestamp', () => {
      expect(formatExpirationDate(0)).toBe('N/A');
    });

    it('formats valid timestamp', () => {
      // January 1, 2025 00:00:00 UTC
      const timestamp = 1735689600;
      const result = formatExpirationDate(timestamp);
      // Just check it returns a non-empty string (locale-dependent format)
      expect(result).toBeTruthy();
      expect(result).not.toBe('N/A');
    });

    it('handles large timestamps', () => {
      // Year 2030 timestamp
      const timestamp = 1893456000;
      const result = formatExpirationDate(timestamp);
      expect(result).toBeTruthy();
    });
  });

  describe('isExpiringSoon', () => {
    it('returns false for 0 days (expired)', () => {
      expect(isExpiringSoon(0)).toBe(false);
    });

    it('returns true for 1 day remaining', () => {
      expect(isExpiringSoon(1)).toBe(true);
    });

    it('returns true for 30 days remaining', () => {
      expect(isExpiringSoon(30)).toBe(true);
    });

    it('returns false for 31 days remaining', () => {
      expect(isExpiringSoon(31)).toBe(false);
    });

    it('returns true for 15 days remaining', () => {
      expect(isExpiringSoon(15)).toBe(true);
    });

    it('returns false for negative days', () => {
      expect(isExpiringSoon(-1)).toBe(false);
    });
  });

  describe('getDaysRemainingText', () => {
    it('returns "Expired" for 0 days', () => {
      expect(getDaysRemainingText(0)).toBe('Expired');
    });

    it('returns singular for 1 day', () => {
      expect(getDaysRemainingText(1)).toBe('1 day remaining');
    });

    it('returns plural for multiple days', () => {
      expect(getDaysRemainingText(30)).toBe('30 days remaining');
    });

    it('handles large numbers', () => {
      expect(getDaysRemainingText(365)).toBe('365 days remaining');
    });
  });
});
