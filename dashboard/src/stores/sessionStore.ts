/**
 * Session Management Store
 *
 * Manages session tokens for authentication without storing passwords.
 * Tokens are stored in memory only (not sessionStorage/localStorage) for security.
 *
 * Security Architecture:
 * - Frontend never stores passwords (even in memory after initial auth)
 * - Tokens have explicit expiration (24 hours)
 * - Backend can revoke tokens
 * - Backend uses HKDF + Server Pepper to encrypt provider keys
 *   (Token leak alone CANNOT decrypt sensitive data without server pepper)
 *
 * Token Storage Trade-offs (Tauri Desktop App):
 * ✅ Current: Memory-only (Zustand state)
 *    - Pro: Tokens cleared on app close/refresh (better security)
 *    - Pro: XSS in Tauri desktop is much harder than browser (no external scripts)
 *    - Con: User must re-login after app restart (Security > UX)
 *
 * Alternative (NOT implemented):
 * ❌ HttpOnly Cookies: Not applicable in Tauri (desktop app, not web browser)
 * ❌ Tauri Store Plugin: Persists to disk (worse security for session tokens)
 * ❌ localStorage: XSS risk, persists across sessions
 *
 * Conclusion: Memory-only storage is the best option for Tauri desktop apps.
 * User must re-authenticate after app restart - this is a security feature, not a bug.
 */

import { create } from 'zustand';
import tauriApi from '@/services/tauri-api';

/**
 * Security: Redact sensitive token for logging/debugging
 * Shows first 8 chars for identification, rest is masked
 */
function redactToken(token: string | null): string {
  if (!token) return '<no-token>';
  if (token.length <= 8) return '***';
  return `${token.substring(0, 8)}...***`;
}

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
   * Security: Token is stored in memory only, never logged
   */
  createSession: async (usbPath: string, appPassword: string) => {
    set({ isAuthenticating: true, error: null });

    try {
      const response = await tauriApi.createSession({
        usbPath,
        appPassword,
      });

      // Security: Store token in memory (Zustand state)
      // IMPORTANT: Never log the token to console or send to error trackers
      set({
        token: response.token,
        expiresAt: response.expiresAt,
        usbPath: response.usbPath,
        isAuthenticating: false,
        error: null,
      });

      // Security: Log success without exposing token
      console.log('🔐 [SessionStore] Session created successfully (token stored in memory only)');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';

      // Security: Log error without exposing credentials
      console.error('🔴 [SessionStore] Failed to create session:', errorMessage);

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
   * Security: Never logs actual token value
   */
  validateSession: async () => {
    const { token } = get();

    if (!token) {
      console.warn('🔓 [SessionStore] No token to validate');
      return false;
    }

    try {
      const response = await tauriApi.validateSession({ token });

      if (response.valid) {
        // Update expiration time in case it changed
        set({ expiresAt: response.expiresAt });
        console.log(`🔐 [SessionStore] Token validated: ${redactToken(token)}`);
        return true;
      } else {
        // Token is invalid, clear session
        console.warn(`🔓 [SessionStore] Token invalid: ${redactToken(token)}`);
        get().clearSession();
        return false;
      }
    } catch (err) {
      // Validation failed, clear session
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`🔴 [SessionStore] Validation failed for ${redactToken(token)}:`, errorMessage);
      get().clearSession();
      return false;
    }
  },

  /**
   * Revoke the current session token and clear state
   * Security: Clears token from memory and revokes on backend
   */
  revokeSession: async () => {
    const { token } = get();

    if (token) {
      try {
        await tauriApi.revokeSession({ token });
        console.log('🔐 [SessionStore] Session revoked successfully');
      } catch (err) {
        // Security: Log error without exposing token
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('🔴 [SessionStore] Failed to revoke session:', errorMessage);
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
