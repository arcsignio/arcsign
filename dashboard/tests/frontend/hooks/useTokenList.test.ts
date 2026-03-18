import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the tokenList service
vi.mock('@/services/tokenList', () => ({
  getCommonTokens: vi.fn(),
  getAllTokens: vi.fn(),
  searchTokenBySymbol: vi.fn(),
  findTokenByAddress: vi.fn(),
  getTopTokens: vi.fn(),
}));

vi.mock('@/constants/commonTokens', () => ({
  PRIORITY_TOKEN_SYMBOLS: ['ETH', 'BTC', 'USDC'],
}));

import {
  useCommonTokens,
  useAllTokens,
  useTokenSearch,
  useTokenByAddress,
  useTopTokens,
} from '@/hooks/useTokenList';
import * as tokenListService from '@/services/tokenList';

const mockToken = {
  address: '0xtoken1',
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  logoURI: 'https://example.com/eth.png',
  chainId: 1,
  chainName: 'ethereum',
};

describe('useCommonTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads common tokens on mount', async () => {
    const tokensMap = new Map([['ethereum', [mockToken]]]);
    (tokenListService.getCommonTokens as any).mockResolvedValue(tokensMap);

    const { result } = renderHook(() => useCommonTokens(15));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tokens.get('ethereum')).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles error', async () => {
    (tokenListService.getCommonTokens as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCommonTokens());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });
});

describe('useAllTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for wrapped tokens
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as any;
  });

  it('loads all tokens when enabled', async () => {
    const tokensMap = new Map([['ethereum', [mockToken]]]);
    (tokenListService.getAllTokens as any).mockResolvedValue(tokensMap);

    const { result } = renderHook(() => useAllTokens(true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tokens.size).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('does not load when disabled', async () => {
    const { result } = renderHook(() => useAllTokens(false));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(tokenListService.getAllTokens).not.toHaveBeenCalled();
    expect(result.current.tokens.size).toBe(0);
  });

  it('handles error', async () => {
    (tokenListService.getAllTokens as any).mockRejectedValue(new Error('Load failed'));

    const { result } = renderHook(() => useAllTokens(true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Load failed');
  });
});

describe('useTokenSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty for short queries', () => {
    const { result } = renderHook(() => useTokenSearch('E'));
    expect(result.current.tokens).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('searches after debounce', async () => {
    (tokenListService.searchTokenBySymbol as any).mockResolvedValue([mockToken]);

    const { result } = renderHook(() => useTokenSearch('ETH'));

    // Advance past debounce timer
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(tokenListService.searchTokenBySymbol).toHaveBeenCalledWith('ETH', undefined);
  });

  it('returns empty for empty query', () => {
    const { result } = renderHook(() => useTokenSearch(''));
    expect(result.current.tokens).toEqual([]);
  });
});

describe('useTokenByAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds token by address', async () => {
    (tokenListService.findTokenByAddress as any).mockResolvedValue(mockToken);

    const { result } = renderHook(() =>
      useTokenByAddress('0xtoken1', 'ethereum' as any)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.token).toEqual(mockToken);
    expect(result.current.error).toBeNull();
  });

  it('returns null for null address', () => {
    const { result } = renderHook(() =>
      useTokenByAddress(null, 'ethereum' as any)
    );

    expect(result.current.token).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('handles error', async () => {
    (tokenListService.findTokenByAddress as any).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() =>
      useTokenByAddress('0xunknown', 'ethereum' as any)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.token).toBeNull();
    expect(result.current.error).toBe('Not found');
  });
});

describe('useTopTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads top tokens for chain', async () => {
    (tokenListService.getTopTokens as any).mockResolvedValue([mockToken]);

    const { result } = renderHook(() =>
      useTopTokens('ethereum' as any, 20)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tokens).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles error', async () => {
    (tokenListService.getTopTokens as any).mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() =>
      useTopTokens('ethereum' as any)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tokens).toEqual([]);
    expect(result.current.error).toBe('Failed');
  });
});
