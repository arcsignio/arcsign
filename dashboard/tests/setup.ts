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

// Global test utilities
global.mockTauriInvoke = mockInvoke;
global.mockTauriListen = mockListen;
global.mockTauriEmit = mockEmit;

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Suppress console errors in tests (optional)
// Uncomment if you want cleaner test output
// global.console.error = vi.fn();
// global.console.warn = vi.fn();
