/**
 * Vitest test setup file
 * Configures Testing Library and mocks Tauri API
 * Feature: User Dashboard for Wallet Management
 * Generated: 2025-10-17
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri API
const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockEmit = vi.fn();

// Mock @tauri-apps/api modules
vi.mock('@tauri-apps/api', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  emit: mockEmit,
}));

vi.mock('@tauri-apps/api/clipboard', () => ({
  writeText: vi.fn(),
  readText: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  appWindow: {
    setTitle: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
  },
}));

// Mock @tauri-apps/api/tauri (some components import from here)
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

// Mock @tauri-apps/api/dialog
vi.mock('@tauri-apps/api/dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
  ask: vi.fn(),
  message: vi.fn(),
  confirm: vi.fn(),
}));

// Mock @tauri-apps/api/fs
vi.mock('@tauri-apps/api/fs', () => ({
  writeBinaryFile: vi.fn(),
  readBinaryFile: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
}));

// Mock @tauri-apps/api/updater
vi.mock('@tauri-apps/api/updater', () => ({
  checkUpdate: vi.fn(),
  installUpdate: vi.fn(),
  onUpdaterEvent: vi.fn(),
}));

// Mock @tauri-apps/api/process
vi.mock('@tauri-apps/api/process', () => ({
  relaunch: vi.fn(),
  exit: vi.fn(),
}));

// Mock react-i18next — always return the key for predictable testing
// IMPORTANT: t and i18n must be stable references to prevent infinite loops
// in components that use t in useCallback/useMemo dependencies
const stableT = (key: string, _defaultOrOptions?: unknown) => key;
const stableI18n = { language: 'en', changeLanguage: () => Promise.resolve() };
const stableUseTranslationReturn = { t: stableT, i18n: stableI18n };
vi.mock('react-i18next', () => ({
  useTranslation: () => stableUseTranslationReturn,
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// Global test utilities
global.mockTauriInvoke = mockInvoke;
global.mockTauriListen = mockListen;
global.mockTauriEmit = mockEmit;

// Note: vitest.config.ts has mockReset: true which auto-resets mocks before each test
// vi.clearAllMocks() in beforeEach is NOT needed (would clear call counts we might inspect)
