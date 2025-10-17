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
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'build/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/index.ts',
      ],
      // Target coverage thresholds per constitution
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
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
