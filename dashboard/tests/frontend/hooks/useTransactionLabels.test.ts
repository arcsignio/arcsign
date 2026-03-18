import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import type { TxLabelEntry } from '@/types/txLabel';

vi.mock('@/services/tauri-api', () => ({
  getTransactionLabels: vi.fn(),
  setTransactionLabel: vi.fn(),
  deleteTransactionLabel: vi.fn(),
}));

import * as tauriApi from '@/services/tauri-api';

const mockLabel: TxLabelEntry = {
  network: 'ethereum',
  txHash: '0xabc123',
  label: {
    name: 'Swap USDC',
    category: 'swap',
    notes: 'Test swap',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
};

const USB_PATH = '/dev/usb0';
const SESSION_TOKEN = 'test-token';

describe('useTransactionLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with empty labels', () => {
      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));
      expect(result.current.labels).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('loadLabels', () => {
    it('loads labels successfully', async () => {
      (tauriApi.getTransactionLabels as any).mockResolvedValue({
        labels: [mockLabel],
      });

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadLabels();
      });

      expect(result.current.labels).toHaveLength(1);
      expect(result.current.labels[0].label.name).toBe('Swap USDC');
      expect(result.current.isLoading).toBe(false);
    });

    it('loads labels with network filter', async () => {
      (tauriApi.getTransactionLabels as any).mockResolvedValue({
        labels: [mockLabel],
      });

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadLabels('ethereum');
      });

      expect(tauriApi.getTransactionLabels).toHaveBeenCalledWith(
        USB_PATH, 'ethereum', SESSION_TOKEN
      );
    });

    it('handles load error', async () => {
      (tauriApi.getTransactionLabels as any).mockRejectedValue(new Error('Read error'));

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadLabels();
      });

      expect(result.current.error).toBe('Read error');
      expect(result.current.isLoading).toBe(false);
    });

    it('handles null labels in response', async () => {
      (tauriApi.getTransactionLabels as any).mockResolvedValue({ labels: null });

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadLabels();
      });

      expect(result.current.labels).toEqual([]);
    });
  });

  describe('setLabel', () => {
    it('adds a new label', async () => {
      (tauriApi.setTransactionLabel as any).mockResolvedValue({
        label: mockLabel.label,
      });

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      let success = false;
      await act(async () => {
        success = await result.current.setLabel({
          network: 'ethereum',
          txHash: '0xabc123',
          name: 'Swap USDC',
          category: 'swap',
        });
      });

      expect(success).toBe(true);
      expect(result.current.labels).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('updates an existing label', async () => {
      // First load existing labels
      (tauriApi.getTransactionLabels as any).mockResolvedValue({
        labels: [mockLabel],
      });

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadLabels();
      });

      // Update the label
      const updatedLabel = { ...mockLabel.label, name: 'Updated Swap' };
      (tauriApi.setTransactionLabel as any).mockResolvedValue({
        label: updatedLabel,
      });

      await act(async () => {
        await result.current.setLabel({
          network: 'ethereum',
          txHash: '0xabc123',
          name: 'Updated Swap',
        });
      });

      expect(result.current.labels).toHaveLength(1);
      expect(result.current.labels[0].label.name).toBe('Updated Swap');
    });

    it('returns false on error', async () => {
      (tauriApi.setTransactionLabel as any).mockRejectedValue(new Error('Write error'));

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      let success = false;
      await act(async () => {
        success = await result.current.setLabel({
          network: 'ethereum',
          txHash: '0xabc123',
          name: 'Swap USDC',
        });
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Write error');
    });
  });

  describe('deleteLabel', () => {
    it('removes a label from list', async () => {
      (tauriApi.getTransactionLabels as any).mockResolvedValue({
        labels: [mockLabel],
      });

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadLabels();
      });

      (tauriApi.deleteTransactionLabel as any).mockResolvedValue(undefined);

      let success = false;
      await act(async () => {
        success = await result.current.deleteLabel('ethereum', '0xabc123');
      });

      expect(success).toBe(true);
      expect(result.current.labels).toHaveLength(0);
    });

    it('returns false on error', async () => {
      (tauriApi.deleteTransactionLabel as any).mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      let success = false;
      await act(async () => {
        success = await result.current.deleteLabel('ethereum', '0xabc123');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Delete failed');
    });
  });

  describe('getLabelForTx', () => {
    it('returns label for known tx', async () => {
      (tauriApi.getTransactionLabels as any).mockResolvedValue({
        labels: [mockLabel],
      });

      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadLabels();
      });

      const found = result.current.getLabelForTx('ethereum', '0xabc123');
      expect(found).toBeDefined();
      expect(found!.label.name).toBe('Swap USDC');
    });

    it('returns undefined for unknown tx', async () => {
      const { result } = renderHook(() => useTransactionLabels(USB_PATH, SESSION_TOKEN));
      const found = result.current.getLabelForTx('ethereum', '0xunknown');
      expect(found).toBeUndefined();
    });
  });
});
