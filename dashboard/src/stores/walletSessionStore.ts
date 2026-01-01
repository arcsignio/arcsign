/**
 * Wallet Session Management Store
 *
 * Manages wallet session tokens for individual wallets.
 * Similar to app session store, but for wallet-level operations.
 *
 * Security Benefits:
 * - Frontend never stores wallet passwords
 * - Tokens have explicit expiration (15 minutes)
 * - Backend can revoke tokens
 * - Multiple wallets can have separate sessions
 */

import { create } from 'zustand';
import tauriApi from '@/services/tauri-api';

interface WalletSessionState {
  // Map of walletId -> session token
  tokens: Map<string, string>;

  // Map of walletId -> expiration timestamp (Unix seconds)
  expirations: Map<string, number>;

  // Map of walletId -> USB path
  usbPaths: Map<string, string>;

  // Loading state during authentication
  isAuthenticating: boolean;

  // Error message from last operation
  error: string | null;

  // Actions
  createWalletSession: (walletId: string, password: string, usbPath: string) => Promise<void>;
  validateWalletSession: (walletId: string) => Promise<boolean>;
  revokeWalletSession: (walletId: string) => Promise<void>;
  clearWalletSession: (walletId: string) => void;
  isWalletSessionValid: (walletId: string) => boolean;
  getWalletToken: (walletId: string) => string | null;
  revokeAllSessions: () => Promise<void>;
}

export const useWalletSessionStore = create<WalletSessionState>((set, get) => ({
  tokens: new Map(),
  expirations: new Map(),
  usbPaths: new Map(),
  isAuthenticating: false,
  error: null,

  /**
   * Create a new wallet session token by validating wallet password
   */
  createWalletSession: async (walletId: string, password: string, usbPath: string) => {
    set({ isAuthenticating: true, error: null });

    try {
      const response = await tauriApi.createWalletSession({
        walletId,
        password,
        usbPath,
      });

      const newTokens = new Map(get().tokens);
      const newExpirations = new Map(get().expirations);
      const newUsbPaths = new Map(get().usbPaths);

      newTokens.set(walletId, response.token);
      newExpirations.set(walletId, response.expiresAt);
      newUsbPaths.set(walletId, response.usbPath);

      set({
        tokens: newTokens,
        expirations: newExpirations,
        usbPaths: newUsbPaths,
        isAuthenticating: false,
        error: null,
      });

      console.log(`🔐 [WalletSession] Session created for wallet ${walletId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create wallet session';
      set({
        isAuthenticating: false,
        error: errorMessage,
      });
      throw new Error(errorMessage);
    }
  },

  /**
   * Validate the session token for a specific wallet
   */
  validateWalletSession: async (walletId: string) => {
    const { tokens } = get();
    const token = tokens.get(walletId);

    if (!token) {
      return false;
    }

    try {
      const response = await tauriApi.validateWalletSession({ token });

      if (response.valid) {
        // Update expiration time in case it changed
        const newExpirations = new Map(get().expirations);
        newExpirations.set(walletId, response.expiresAt);
        set({ expirations: newExpirations });
        return true;
      } else {
        // Token is invalid, clear session
        get().clearWalletSession(walletId);
        return false;
      }
    } catch (err) {
      // Validation failed, clear session
      get().clearWalletSession(walletId);
      return false;
    }
  },

  /**
   * Revoke the session token for a specific wallet
   */
  revokeWalletSession: async (walletId: string) => {
    const { tokens } = get();
    const token = tokens.get(walletId);

    if (token) {
      try {
        await tauriApi.revokeWalletSession({ token });
        console.log(`🔐 [WalletSession] Session revoked for wallet ${walletId}`);
      } catch (err) {
        console.error(`Failed to revoke wallet session for ${walletId}:`, err);
        // Continue to clear session even if revocation failed
      }
    }

    get().clearWalletSession(walletId);
  },

  /**
   * Clear session state for a specific wallet (logout without revoking token)
   */
  clearWalletSession: (walletId: string) => {
    const newTokens = new Map(get().tokens);
    const newExpirations = new Map(get().expirations);
    const newUsbPaths = new Map(get().usbPaths);

    newTokens.delete(walletId);
    newExpirations.delete(walletId);
    newUsbPaths.delete(walletId);

    set({
      tokens: newTokens,
      expirations: newExpirations,
      usbPaths: newUsbPaths,
      error: null,
    });
  },

  /**
   * Check if the session for a specific wallet is valid (not expired)
   */
  isWalletSessionValid: (walletId: string) => {
    const { tokens, expirations } = get();
    const token = tokens.get(walletId);
    const expiresAt = expirations.get(walletId);

    if (!token || !expiresAt) {
      return false;
    }

    // Check if token is expired (with 1 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const isExpired = expiresAt <= now + 60;

    if (isExpired) {
      get().clearWalletSession(walletId);
      return false;
    }

    return true;
  },

  /**
   * Get the session token for a specific wallet if valid
   */
  getWalletToken: (walletId: string) => {
    const isValid = get().isWalletSessionValid(walletId);
    if (!isValid) {
      return null;
    }

    return get().tokens.get(walletId) || null;
  },

  /**
   * Revoke all wallet sessions (e.g., on app logout)
   */
  revokeAllSessions: async () => {
    const { tokens } = get();
    const walletIds = Array.from(tokens.keys());

    // Revoke all sessions in parallel
    await Promise.all(
      walletIds.map(walletId => get().revokeWalletSession(walletId))
    );

    console.log('🔐 [WalletSession] All wallet sessions revoked');
  },
}));
