import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUpdateChecker } from '@/hooks/useUpdateChecker';

const mockCheck = vi.fn();
const mockRelaunch = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}));

function makeUpdate(overrides: Partial<{
  version: string;
  date: string;
  body: string;
  downloadAndInstall: (cb?: (event: { event: string }) => void) => Promise<void>;
}> = {}) {
  return {
    version: '2.0.0',
    date: '2025-01-01',
    body: 'New features',
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

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
      mockCheck.mockResolvedValue(makeUpdate());

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.status).toBe('available');
      expect(result.current.state.manifest?.version).toBe('2.0.0');
    });

    it('sets status to up-to-date when no update', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.status).toBe('up-to-date');
    });

    it('handles error status', async () => {
      mockCheck.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('Network failure');
    });

    it('treats "could not fetch" as up-to-date', async () => {
      mockCheck.mockRejectedValue(new Error('Could not fetch latest release'));

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
      mockCheck.mockResolvedValue(makeUpdate());

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
      mockCheck.mockResolvedValue(makeUpdate({ version: '2.0.0' }));

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
      const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
      mockCheck.mockResolvedValue(makeUpdate({ downloadAndInstall }));

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      // First check to populate updateRef
      await act(async () => {
        await result.current.checkForUpdates();
      });

      await act(async () => {
        await result.current.startInstall();
      });

      expect(downloadAndInstall).toHaveBeenCalled();
      expect(result.current.state.status).toBe('done');
    });

    it('handles install error', async () => {
      const downloadAndInstall = vi.fn().mockRejectedValue(new Error('Install failed'));
      mockCheck.mockResolvedValue(makeUpdate({ downloadAndInstall }));

      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.checkForUpdates();
      });

      await act(async () => {
        await result.current.startInstall();
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('Install failed');
    });

    it('errors when called before checkForUpdates', async () => {
      const { result } = renderHook(() => useUpdateChecker({ enabled: false }));

      await act(async () => {
        await result.current.startInstall();
      });

      expect(result.current.state.status).toBe('error');
      expect(result.current.state.error).toBe('No update available');
    });
  });

  describe('auto-check', () => {
    it('auto-checks after delay when enabled', async () => {
      mockCheck.mockResolvedValue(null);

      renderHook(() => useUpdateChecker({ enabled: true }));

      // Advance past the 5 second delay
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Allow the async check to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCheck).toHaveBeenCalled();
    });

    it('does not auto-check when disabled', () => {
      renderHook(() => useUpdateChecker({ enabled: false }));

      vi.advanceTimersByTime(10000);

      expect(mockCheck).not.toHaveBeenCalled();
    });
  });
});
