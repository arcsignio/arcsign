/**
 * Session Management Store
 *
 * Manages session tokens for authentication without storing passwords.
 * Tokens are stored in memory only (not sessionStorage) for security.
 *
 * Security Benefits:
 * - Frontend never stores passwords (even in memory after initial auth)
 * - Tokens have explicit expiration (24 hours)
 * - Backend can revoke tokens
 * - Immune to XSS attacks reading passwords from storage
 */

import { create } from 'zustand';
import tauriApi from '@/services/tauri-api';

interface SessionState {
  // Session token (stored in memory only)
  token: string | null;

  // Token expiration timestamp (Unix seconds)
  expiresAt: number | null;

  // Associated USB path for this session
  usbPath: string | null;

  // Loading state during authentication
  isAuthenticating: boolean;

  // Error message from last operation
  error: string | null;

  // Actions
  createSession: (usbPath: string, appPassword: string) => Promise<void>;
  validateSession: () => Promise<boolean>;
  revokeSession: () => Promise<void>;
  clearSession: () => void;
  isSessionValid: () => boolean;
  getToken: () => string | null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  token: null,
  expiresAt: null,
  usbPath: null,
  isAuthenticating: false,
  error: null,

  /**
   * Create a new session token by validating credentials
   */
  createSession: async (usbPath: string, appPassword: string) => {
    set({ isAuthenticating: true, error: null });

    try {
      const response = await tauriApi.createSession({
        usbPath,
        appPassword,
      });

      set({
        token: response.token,
        expiresAt: response.expiresAt,
        usbPath: response.usbPath,
        isAuthenticating: false,
        error: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      set({
        token: null,
        expiresAt: null,
        usbPath: null,
        isAuthenticating: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  },

  /**
   * Validate the current session token
   */
  validateSession: async () => {
    const { token } = get();

    if (!token) {
      return false;
    }

    try {
      const response = await tauriApi.validateSession({ token });

      if (response.valid) {
        // Update expiration time in case it changed
        set({ expiresAt: response.expiresAt });
        return true;
      } else {
        // Token is invalid, clear session
        get().clearSession();
        return false;
      }
    } catch (err) {
      // Validation failed, clear session
      get().clearSession();
      return false;
    }
  },

  /**
   * Revoke the current session token and clear state
   */
  revokeSession: async () => {
    const { token } = get();

    if (token) {
      try {
        await tauriApi.revokeSession({ token });
      } catch (err) {
        console.error('Failed to revoke session:', err);
        // Continue to clear session even if revocation failed
      }
    }

    get().clearSession();
  },

  /**
   * Clear session state (logout without revoking token)
   */
  clearSession: () => {
    set({
      token: null,
      expiresAt: null,
      usbPath: null,
      error: null,
    });
  },

  /**
   * Check if the current session is valid (not expired)
   */
  isSessionValid: () => {
    const { token, expiresAt } = get();

    if (!token || !expiresAt) {
      return false;
    }

    // Check if token is expired (with 1 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expiresAt <= now + 60;

    if (isExpired) {
      get().clearSession();
      return false;
    }

    return true;
  },

  /**
   * Get the current session token if valid
   */
  getToken: () => {
    const { token } = get();
    const isValid = get().isSessionValid();

    return isValid ? token : null;
  },
}));
