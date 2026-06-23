import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSignGate } from '@/hooks/useSignGate';
import * as api from '@/services/tauri-api';

vi.mock('@/services/tauri-api', async (orig) => ({
  ...(await orig<typeof import('@/services/tauri-api')>()),
  checkTransactionSecurity: vi.fn(),
}));

const params = { from: '0xa', to: '0xbad', chainId: '1', value: '0x0', data: '0x', usbPath: '/d', sessionToken: 't', isPro: false };

beforeEach(() => vi.clearAllMocks());

describe('useSignGate', () => {
  it('reads requiresAcknowledge from the backend report (does not compute it)', async () => {
    vi.mocked(api.checkTransactionSecurity).mockResolvedValue({ proRequired: true, warnings: [], riskLevel: 'danger', requiresAcknowledge: true } as never);
    const { result } = renderHook(() => useSignGate(params));
    await waitFor(() => expect(result.current.requiresAcknowledge).toBe(true));
    expect(result.current.acknowledged).toBe(false);
  });

  it('not required when the backend says so', async () => {
    vi.mocked(api.checkTransactionSecurity).mockResolvedValue({ proRequired: true, warnings: [], riskLevel: 'safe', requiresAcknowledge: false } as never);
    const { result } = renderHook(() => useSignGate(params));
    await waitFor(() => expect(result.current.security).not.toBeUndefined());
    expect(result.current.requiresAcknowledge).toBe(false);
  });

  it('acknowledged toggles via setAcknowledged', async () => {
    vi.mocked(api.checkTransactionSecurity).mockResolvedValue({ proRequired: true, warnings: [], riskLevel: 'danger', requiresAcknowledge: true } as never);
    const { result } = renderHook(() => useSignGate(params));
    await waitFor(() => expect(result.current.requiresAcknowledge).toBe(true));
    act(() => result.current.setAcknowledged(true));
    expect(result.current.acknowledged).toBe(true);
  });

  it('check failure is graceful (no throw, not required)', async () => {
    vi.mocked(api.checkTransactionSecurity).mockRejectedValue(new Error('no key'));
    const { result } = renderHook(() => useSignGate(params));
    await waitFor(() => expect(api.checkTransactionSecurity).toHaveBeenCalled());
    expect(result.current.requiresAcknowledge).toBe(false);
  });

  it('does nothing when params is null', () => {
    const { result } = renderHook(() => useSignGate(null));
    expect(api.checkTransactionSecurity).not.toHaveBeenCalled();
    expect(result.current.requiresAcknowledge).toBe(false);
  });
});
