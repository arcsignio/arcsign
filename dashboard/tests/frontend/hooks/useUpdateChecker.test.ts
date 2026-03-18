import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUpdateChecker } from '@/hooks/useUpdateChecker';

// Mock Tauri updater API
const mockCheckUpdate = vi.fn();
const mockInstallUpdate = vi.fn();
const mockOnUpdaterEvent = vi.fn();
const mockRelaunch = vi.fn();

vi.mock('@tauri-apps/api/updater', () => ({
  checkUpdate: (...args: any[]) => mockCheckUpdate(...args),
  installUpdate: (...args: any[]) => mockInstallUpdate(...args),
  onUpdaterEvent: (...args: any[]) => mockOnUpdaterEvent(...args),
}));

vi.mock('@tauri-apps/api/process', () => ({
  relaunch: (...args: any[]) => mockRelaunch(...args),
}));

describe('useUpdateChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts idle', () => {
      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));
      expect(result.current.state.status).toBe('idle');
      expect(result.current.state.manifest).toBeNull();
      expect(result.current.state.error).toBeNull();
    });
  });

  describe('checkForUpdates', () => {
    it('sets status to available when update found', async () => {
      mockCheckUpdate.mockResolvedValue({
        shouldUpdate: true,
        manifest: { version: '2.0.0', date: '2025-01-01', body: 'New features' },
      });

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.status).toBe('available');
      expect(result.current.state.manifest?.version).toBe('2.0.0');
    });

    it('sets status to up-to-date when no update', async () => {
      mockCheckUpdate.mockResolvedValue({
        shouldUpdate: false,
        manifest: null,
      });

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.status).toBe('up-to-date');
    });

    it('handles error status', async () => {
      mockCheckUpdate.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('Network failure');
    });

    it('treats "could not fetch" as up-to-date', async () => {
      mockCheckUpdate.mockRejectedValue(new Error('Could not fetch latest release'));

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.status).toBe('up-to-date');
      expect(result.current.state.error).toBeNull();
    });
  });

  describe('dismissUpdate', () => {
    it('resets state to idle', async () => {
      mockCheckUpdate.mockResolvedValue({
        shouldUpdate: true,
        manifest: { version: '2.0.0', date: '2025-01-01', body: 'Update' },
      });

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      act(() => {
        result.current.dismissUpdate();
      });

      expect(result.current.state.status).toBe('idle');
    });
  });

  describe('skipVersion', () => {
    it('saves skipped version to localStorage', async () => {
      mockCheckUpdate.mockResolvedValue({
        shouldUpdate: true,
        manifest: { version: '2.0.0', date: '2025-01-01', body: 'Update' },
      });

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      act(() => {
        result.current.skipVersion();
      });

      expect(localStorage.getItem('arcsign-skipped-version')).toBe('2.0.0');
      expect(result.current.state.status).toBe('idle');
    });
  });

  describe('startInstall', () => {
    it('starts download and install process', async () => {
      const mockUnlisten = vi.fn();
      mockOnUpdaterEvent.mockResolvedValue(mockUnlisten);
      mockInstallUpdate.mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.startInstall();
      });

      expect(result.current.state.status).toBe('downloading');
      expect(mockOnUpdaterEvent).toHaveBeenCalled();
      expect(mockInstallUpdate).toHaveBeenCalled();
    });

    it('handles install error', async () => {
      mockOnUpdaterEvent.mockResolvedValue(vi.fn());
      mockInstallUpdate.mockRejectedValue(new Error('Install failed'));

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.startInstall();
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('Install failed');
    });
  });

  describe('auto-check', () => {
    it('auto-checks after delay when enabled', async () => {
      mockCheckUpdate.mockResolvedValue({
        shouldUpdate: false,
        manifest: null,
      });

      renderHook(() => useUpdateChecker({ enabled: true }));

      // Advance past the 5 second delay
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Allow the async check to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheckUpdate).toHaveBeenCalled();
    });

    it('does not auto-check when disabled', () => {
      renderHook(() => useUpdateChecker({ enabled: false }));

      vi.advanceTimersByTime(10000);

      expect(mockCheckUpdate).not.toHaveBeenCalled();
    });
  });
});
