import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenApprovals } from '@/hooks/useTokenApprovals';

vi.mock('@/services/tauri-api', () => ({
  default: {
    getTokenApprovals: vi.fn(),
  },
}));

import tauriApi from '@/services/tauri-api';

const mockApproval = {
  spender: '0xspender1',
  token: '0xtoken1',
  tokenSymbol: 'USDC',
  allowance: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  chain: 'ethereum',
};

describe('useTokenApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with empty approvals', () => {
      const { result } = renderHook(() =>
        useTokenApprovals('wallet1', 'pass', '/dev/usb0', 'token')
      );
      expect(result.current.approvals).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('refresh (loadApprovals)', () => {
    it('loads approvals successfully', async () => {
      (tauriApi.getTokenApprovals as any).mockResolvedValue({
        data: { approvals: [mockApproval] },
      });

      const { result } = renderHook(() =>
        useTokenApprovals('wallet1', 'pass', '/dev/usb0', 'token')
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.approvals).toHaveLength(1);
      expect(result.current.approvals[0].tokenSymbol).toBe('USDC');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles direct response (no data wrapper)', async () => {
      (tauriApi.getTokenApprovals as any).mockResolvedValue({
        approvals: [mockApproval],
      });

      const { result } = renderHook(() =>
        useTokenApprovals('wallet1', 'pass', '/dev/usb0')
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.approvals).toHaveLength(1);
    });

    it('handles error', async () => {
      (tauriApi.getTokenApprovals as any).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() =>
        useTokenApprovals('wallet1', 'pass', '/dev/usb0')
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.approvals).toEqual([]);
      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });

    it('skips load when walletId is empty', async () => {
      const { result } = renderHook(() =>
        useTokenApprovals('', 'pass', '/dev/usb0')
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(tauriApi.getTokenApprovals).not.toHaveBeenCalled();
    });

    it('skips load when password is empty', async () => {
      const { result } = renderHook(() =>
        useTokenApprovals('wallet1', '', '/dev/usb0')
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(tauriApi.getTokenApprovals).not.toHaveBeenCalled();
    });

    it('skips load when usbPath is empty', async () => {
      const { result } = renderHook(() =>
        useTokenApprovals('wallet1', 'pass', '')
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(tauriApi.getTokenApprovals).not.toHaveBeenCalled();
    });

    it('handles empty approvals response', async () => {
      (tauriApi.getTokenApprovals as any).mockResolvedValue({
        data: { approvals: [] },
      });

      const { result } = renderHook(() =>
        useTokenApprovals('wallet1', 'pass', '/dev/usb0')
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.approvals).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });
});
