import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSignReview } from '@/hooks/useSignReview';
import { useSignGate } from '@/hooks/useSignGate';
import * as api from '@/services/tauri-api';
import { invoke } from '@tauri-apps/api/core';
import { encodeFunctionData, erc20Abi } from 'viem';

const mockInvoke = vi.mocked(invoke);
beforeEach(() => {
  mockInvoke.mockReset();
  vi.restoreAllMocks();
});

const TRANSFER = encodeFunctionData({
  abi: erc20Abi,
  functionName: 'transfer',
  args: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1000000n],
});

const params = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  chainId: '1',
  value: '0',
  data: TRANSFER,
  usbPath: '/Volumes/arcsign',
  sessionToken: 'tok',
};

describe('useSignReview', () => {
  it('exposes a decoded intent carrying an ERC-8213 digest', async () => {
    vi.spyOn(api, 'checkTransactionSecurity').mockResolvedValue({
      requiresAcknowledge: false, riskLevel: 'safe', warnings: [],
    } as never);
    mockInvoke.mockResolvedValue(null); // no ERC-7730 descriptor

    const { result } = renderHook(() => useSignReview(params));

    await waitFor(() => expect(result.current.intent).toBeDefined());
    expect(result.current.intent?.digest?.primary).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('keeps the backend security verdict exactly as received', async () => {
    // The gate's authority is the backend. Adding intent must not shift it.
    vi.spyOn(api, 'checkTransactionSecurity').mockResolvedValue({
      requiresAcknowledge: true, riskLevel: 'danger', warnings: [],
    } as never);
    mockInvoke.mockResolvedValue(null);

    const { result } = renderHook(() => useSignReview(params));

    await waitFor(() => expect(result.current.security).toBeDefined());
    expect(result.current.requiresAcknowledge).toBe(true);
    expect(result.current.security?.riskLevel).toBe('danger');
  });

  it('still reports the security verdict when decoding fails', async () => {
    // Readability is advisory; losing it must not disturb the gate.
    vi.spyOn(api, 'checkTransactionSecurity').mockResolvedValue({
      requiresAcknowledge: true, riskLevel: 'danger', warnings: [],
    } as never);
    mockInvoke.mockImplementation(() => Promise.reject(new Error('decode blew up')));

    const { result } = renderHook(() => useSignReview({ ...params, data: '0xzz' }));

    await waitFor(() => expect(result.current.security).toBeDefined());
    expect(result.current.requiresAcknowledge).toBe(true);
  });

  it('returns an empty review when there is no transaction yet', () => {
    const { result } = renderHook(() => useSignReview(null));
    expect(result.current.security).toBeUndefined();
    expect(result.current.requiresAcknowledge).toBe(false);
    expect(result.current.intent).toBeUndefined();
  });

  it('keeps useSignGate as an alias of the same implementation', () => {
    // The old name is kept for one release so no call site is silently missed.
    expect(useSignGate).toBe(useSignReview);
  });
});
