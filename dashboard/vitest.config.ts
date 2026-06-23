/**
 * Vitest configuration for dashboard frontend tests
 * Feature: User Dashboard for Wallet Management
 * Generated: 2025-10-17
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      all: false,
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'build/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/index.ts',
      ],
      // Coverage thresholds — set as a REAL, ENFORCED floor slightly below the
      // current actual coverage (stmts 41.6 / branch 38.3 / funcs 43.2 / lines
      // 42.1, as of 2026-06-23). The point is a ratchet that catches regressions
      // and untested new code, NOT a 70% target to chase by writing low-value UI
      // tests. (vitest 2+ requires these under `coverage.thresholds` — the old
      // flat `coverage.{lines,...}` form was silently ignored, so the previous
      // 70% "gate" never actually enforced.) Raise these as real coverage grows;
      // never set them above current actual, or CI's PR coverage step breaks.
      thresholds: {
        statements: 38,
        branches: 35,
        functions: 40,
        lines: 38,
      },
    },


    // Test globals (optional, enables describe/it/expect without imports)
    globals: true,

    // Test file patterns
    include: [
      'tests/frontend/**/*.{test,spec}.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      'build',
      'src-tauri',
    ],

    // Test timeout (in milliseconds)
    testTimeout: 10000,

    // Mock Tauri API in tests
    mockReset: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/validation': path.resolve(__dirname, './src/validation'),
    },
  },
});
