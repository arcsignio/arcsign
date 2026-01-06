/**
 * App password context for global authentication state
 * Feature: App-level password protection with session tokens
 *
 * Security Update: Now uses session tokens instead of storing passwords
 *
 * Provides:
 * - Authentication state (via session store)
 * - App config (loaded after unlock)
 * - Lock/unlock methods
 */

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import type { AppConfig } from '@/services/tauri-api';

interface AppPasswordContextType {
  // Authentication state
  isUnlocked: boolean;
  appConfig: AppConfig | null;
  usbPath: string | null;

  // Actions
  unlock: (password: string, config: AppConfig, usbPath: string) => Promise<void>;
  lock: () => Promise<void>;

  // Get session token (for operations that need authentication)
  getSessionToken: () => string | null;

  // Legacy: App password for operations that still require it
  // TODO: Migrate all APIs to use session tokens instead
  appPassword: string | null;
}

const AppPasswordContext = createContext<AppPasswordContextType | undefined>(undefined);

export function AppPasswordProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [usbPath, setUsbPath] = useState<string | null>(null);
  // Legacy: Store password for APIs that still need it
  // TODO: Remove this when all APIs migrate to session tokens
  const [appPassword, setAppPassword] = useState<string | null>(null);

  const sessionStore = useSessionStore();

  // Check if we have a valid session on mount
  useEffect(() => {
    if (sessionStore.isSessionValid()) {
      setIsUnlocked(true);
      setUsbPath(sessionStore.usbPath);
    }
  }, []);

  const unlock = async (password: string, config: AppConfig, currentUsbPath: string) => {
    try {
      // Create session token (this validates the password)
      await sessionStore.createSession(currentUsbPath, password);

      // Password is valid and token created, unlock the app
      setAppConfig(config);
      setUsbPath(currentUsbPath);
      setIsUnlocked(true);
      // Legacy: Store password for APIs that still need it
      setAppPassword(password);

      console.log('🔐 [AppPasswordContext] Session created successfully');
    } catch (error) {
      console.error('🔴 [AppPasswordContext] Failed to create session:', error);
      throw error;
    }
  };

  const lock = async () => {
    // Revoke session token
    await sessionStore.revokeSession();

    // Clear sensitive data
    setAppConfig(null);
    setUsbPath(null);
    setIsUnlocked(false);
    setAppPassword(null);

    console.log('🔐 [AppPasswordContext] Session revoked and app locked');
  };

  const getSessionToken = () => {
    return sessionStore.getToken();
  };

  return (
    <AppPasswordContext.Provider
      value={{
        isUnlocked,
        appConfig,
        usbPath,
        unlock,
        lock,
        getSessionToken,
        appPassword,
      }}
    >
      {children}
    </AppPasswordContext.Provider>
  );
}

export function useAppPassword() {
  const context = useContext(AppPasswordContext);
  if (context === undefined) {
    throw new Error('useAppPassword must be used within AppPasswordProvider');
  }
  return context;
}
