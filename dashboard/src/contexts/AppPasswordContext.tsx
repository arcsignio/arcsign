/**
 * App password context for global authentication state
 * Feature: App-level password protection (方案 A)
 *
 * Provides:
 * - App password (for provider settings, app config)
 * - App config (loaded after unlock)
 * - Lock/unlock methods
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import type { AppConfig } from '@/services/tauri-api';

interface AppPasswordContextType {
  // Authentication state
  isUnlocked: boolean;
  appPassword: string | null;
  appConfig: AppConfig | null;

  // Actions
  unlock: (password: string, config: AppConfig) => void;
  lock: () => void;
}

const AppPasswordContext = createContext<AppPasswordContextType | undefined>(undefined);

export function AppPasswordProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [appPassword, setAppPassword] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const unlock = (password: string, config: AppConfig) => {
    setAppPassword(password);
    setAppConfig(config);
    setIsUnlocked(true);
  };

  const lock = () => {
    // Clear sensitive data
    setAppPassword(null);
    setAppConfig(null);
    setIsUnlocked(false);
  };

  return (
    <AppPasswordContext.Provider
      value={{
        isUnlocked,
        appPassword,
        appConfig,
        unlock,
        lock,
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
