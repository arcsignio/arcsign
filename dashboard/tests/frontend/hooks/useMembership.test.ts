import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  getMembershipTierName,
  getWalletLimitForTier,
  formatExpirationDate,
  isExpiringSoon,
  getDaysRemainingText,
  useMembership,
  useCanCreateWallet,
} from '@/hooks/useMembership';
import { invoke } from '@tauri-apps/api/core';

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

describe('useMembership hook', () => {
  beforeEach(() => {
    (invoke as any).mockReset();
  });

  it('returns default state for null address', async () => {
    const { result } = renderHook(() => useMembership(null));

    expect(result.current.status).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPro).toBe(false);
    expect(result.current.walletLimit).toBe(1);
  });

  it('sets status on successful invoke', async () => {
    const mockStatus = {
      isPro: true,
      nftCount: 2,
      tokenIds: [1, 2],
      expirations: [0, 0],
      daysRemaining: 365,
      walletLimit: 7,
    };
    (invoke as any).mockImplementation(() => Promise.resolve(mockStatus));

    const { result } = renderHook(() => useMembership('0x1234'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toEqual(mockStatus);
    expect(result.current.isPro).toBe(true);
    expect(result.current.walletLimit).toBe(7);
    expect(result.current.error).toBeNull();
  });

  it('falls back to free tier on error', async () => {
    (invoke as any).mockImplementation(() => Promise.reject(new Error('Network error')));

    const { result } = renderHook(() => useMembership('0x1234'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.isPro).toBe(false);
    expect(result.current.status?.walletLimit).toBe(1);
  });

  it('falls back with generic message for non-Error rejection', async () => {
    (invoke as any).mockImplementation(() => Promise.reject('plain string error'));

    const { result } = renderHook(() => useMembership('0xabcd'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to check membership');
    expect(result.current.isPro).toBe(false);
  });

  it('refresh re-invokes the backend', async () => {
    const mockStatus = {
      isPro: true,
      nftCount: 1,
      tokenIds: [1],
      expirations: [0],
      daysRemaining: 100,
      walletLimit: 4,
    };
    (invoke as any).mockImplementation(() => Promise.resolve(mockStatus));

    const { result } = renderHook(() => useMembership('0x1234'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Call refresh
    await act(async () => {
      await result.current.refresh();
    });

    // invoke should have been called at least 2 times (initial + refresh)
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});

describe('useCanCreateWallet hook', () => {
  beforeEach(() => {
    (invoke as any).mockReset();
  });

  it('returns canCreate true when backend allows', async () => {
    (invoke as any).mockImplementation(() => Promise.resolve(true));

    const { result } = renderHook(() => useCanCreateWallet(0, false));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.canCreate).toBe(true);
  });

  it('returns canCreate false when backend denies', async () => {
    (invoke as any).mockImplementation(() => Promise.resolve(false));

    const { result } = renderHook(() => useCanCreateWallet(3, false));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.canCreate).toBe(false);
  });

  it('falls back to tier-based logic on error for free tier', async () => {
    (invoke as any).mockImplementation(() => Promise.reject(new Error('fail')));

    const { result } = renderHook(() => useCanCreateWallet(1, false));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    // WALLET_LIMIT_FREE is 1, currentWalletCount is 1, so 1 < 1 is false
    expect(result.current.canCreate).toBe(false);
  });

  it('falls back to allowing creation for pro tier on error', async () => {
    (invoke as any).mockImplementation(() => Promise.reject(new Error('fail')));

    const { result } = renderHook(() => useCanCreateWallet(10, true));

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    // Pro tier: always allowed
    expect(result.current.canCreate).toBe(true);
  });
});
