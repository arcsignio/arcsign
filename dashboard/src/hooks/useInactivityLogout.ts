/**
 * useInactivityLogout Hook
 * Feature: User Dashboard for Wallet Management
 * Task: T092 - Auto-logout after 15 minutes of inactivity
 * Requirement: SEC-006 - Auto-logout functionality
 * Generated: 2025-10-17
 */

import { useEffect, useRef, useState } from 'react';
import tauriApi from '@/services/tauri-api';
import { useDashboardStore } from '@/stores/dashboardStore';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_BEFORE_LOGOUT = 60 * 1000; // 1 minute warning before logout

interface UseInactivityLogoutOptions {
  enabled?: boolean;
  onWarning?: () => void;
  onLogout?: () => void;
}

/**
 * Hook to handle auto-logout after period of inactivity
 * Monitors user activity and logs out after 15 minutes of inactivity (SEC-006)
 */
export function useInactivityLogout(options: UseInactivityLogoutOptions = {}) {
  const { enabled = true, onWarning, onLogout } = options;

  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);

  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { reset: resetStore } = useDashboardStore();

  /**
   * Clear all sensitive data and reset application state
   */
  const performLogout = async () => {
    try {
      // Clear sensitive memory in backend
      await tauriApi.clearSensitiveMemory();

      // Reset frontend state
      resetStore();

      // Call custom logout callback if provided
      if (onLogout) {
        onLogout();
      }
    } catch (error) {
      console.error('Error during auto-logout:', error);
      // Still reset state even if backend call fails
      resetStore();
      if (onLogout) {
        onLogout();
      }
    }
  };

  /**
   * Start countdown from 60 seconds
   */
  const startCountdown = () => {
    setRemainingSeconds(60);

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    countdownTimerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /**
   * Show warning dialog before logout
   */
  const showLogoutWarning = () => {
    setShowWarning(true);
    startCountdown();

    if (onWarning) {
      onWarning();
    }

    // Set final logout timer
    logoutTimerRef.current = setTimeout(() => {
      performLogout();
    }, WARNING_BEFORE_LOGOUT);
  };

  /**
   * Reset all timers on user activity
   */
  const resetTimers = () => {
    // Hide warning if shown
    if (showWarning) {
      setShowWarning(false);
    }

    // Clear existing timers
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }

    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    // Start new warning timer (14 minutes)
    warningTimerRef.current = setTimeout(() => {
      showLogoutWarning();
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_LOGOUT);
  };

  /**
   * Handle user activity events
   */
  const handleActivity = () => {
    if (enabled) {
      resetTimers();
    }
  };

  /**
   * Stay logged in (dismiss warning)
   */
  const stayLoggedIn = () => {
    setShowWarning(false);
    resetTimers();
  };

  /**
   * Manual logout
   */
  const logout = () => {
    performLogout();
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Activity event types to monitor
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle activity handler to avoid excessive timer resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandleActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          handleActivity();
          throttleTimeout = null;
        }, 1000); // Only reset timers once per second max
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledHandleActivity);
    });

    // Start initial timer
    resetTimers();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledHandleActivity);
      });

      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [enabled]);

  return {
    showWarning,
    remainingSeconds,
    stayLoggedIn,
    logout,
  };
}
