import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

// Mock tauri-api
vi.mock('@/services/tauri-api', () => ({
  default: {
    clearSensitiveMemory: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock dashboardStore
const mockResetStore = vi.fn();
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: () => ({
    reset: mockResetStore,
  }),
}));

// Mock AppPasswordContext
const mockLock = vi.fn();
vi.mock('@/contexts/AppPasswordContext', () => ({
  useAppPassword: () => ({
    lock: mockLock,
  }),
}));

describe('useInactivityLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts without warning', () => {
      const { result } = renderHook(() =>
        useInactivityLogout({ enabled: false })
      );
      expect(result.current.showWarning).toBe(false);
      expect(result.current.remainingSeconds).toBe(60);
    });
  });

  describe('when disabled', () => {
    it('does not set timers', () => {
      const { result } = renderHook(() =>
        useInactivityLogout({ enabled: false })
      );

      // Advance past the full timeout
      act(() => {
        vi.advanceTimersByTime(16 * 60 * 1000);
      });

      expect(result.current.showWarning).toBe(false);
    });
  });

  describe('when enabled', () => {
    it('shows warning after 14 minutes of inactivity', () => {
      const onWarning = vi.fn();
      const { result } = renderHook(() =>
        useInactivityLogout({ enabled: true, onWarning })
      );

      // Advance to just before warning (14 minutes)
      act(() => {
        vi.advanceTimersByTime(14 * 60 * 1000);
      });

      expect(result.current.showWarning).toBe(true);
      expect(onWarning).toHaveBeenCalled();
    });

    it('counts down after warning', () => {
      const { result } = renderHook(() =>
        useInactivityLogout({ enabled: true })
      );

      // Trigger warning
      act(() => {
        vi.advanceTimersByTime(14 * 60 * 1000);
      });

      expect(result.current.remainingSeconds).toBe(60);

      // Count down 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.remainingSeconds).toBe(55);
    });

    it('performs logout after full timeout', async () => {
      const onLogout = vi.fn();
      renderHook(() =>
        useInactivityLogout({ enabled: true, onLogout })
      );

      // Advance past full timeout (15 minutes)
      await act(async () => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

      expect(mockResetStore).toHaveBeenCalled();
      expect(onLogout).toHaveBeenCalled();
    });
  });

  describe('continueUsing', () => {
    it('hides warning and locks app', () => {
      const { result } = renderHook(() =>
        useInactivityLogout({ enabled: true })
      );

      // Trigger warning
      act(() => {
        vi.advanceTimersByTime(14 * 60 * 1000);
      });

      expect(result.current.showWarning).toBe(true);

      // Click continue
      act(() => {
        result.current.continueUsing();
      });

      expect(result.current.showWarning).toBe(false);
      expect(mockLock).toHaveBeenCalled();
    });
  });

  describe('manual logout', () => {
    it('performs immediate logout', async () => {
      const onLogout = vi.fn();
      const { result } = renderHook(() =>
        useInactivityLogout({ enabled: true, onLogout })
      );

      await act(async () => {
        result.current.logout();
      });

      expect(mockResetStore).toHaveBeenCalled();
      expect(onLogout).toHaveBeenCalled();
    });
  });
});
