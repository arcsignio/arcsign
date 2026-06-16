/**
 * ProviderSettings component tests
 * Feature: Provider Registry System - API Key Management
 * Tests: capabilities comparison block rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProviderSettings } from '@/components/ProviderSettings';

// Mock @/api/provider
vi.mock('@/api/provider', () => ({
  listProviderConfigs: vi.fn(),
  setProviderConfig: vi.fn(),
  deleteProviderConfig: vi.fn(),
  PROVIDER_TYPES: {
    Alchemy: 'alchemy',
    NodeReal: 'nodereal',
  },
}));

// Mock dashboardStore
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(),
}));

// Mock sessionStore
vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

import { listProviderConfigs } from '@/api/provider';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useSessionStore } from '@/stores/sessionStore';

describe('ProviderSettings Component', () => {
  beforeEach(() => {
    (listProviderConfigs as any).mockResolvedValue([]);
    (useDashboardStore as any).mockReturnValue({
      usbPath: '/dev/usb0',
    });
    (useSessionStore as any).mockReturnValue({
      getToken: () => 'test-session-token',
    });
  });

  it('renders the capabilities comparison (free vs key-gated)', async () => {
    render(<ProviderSettings />);
    // t() returns the key itself (mocked in setup.ts)
    // The heading divs contain emoji + key text, so use getByText with exact:false
    expect(await screen.findByText(/provider\.capabilities\.freeHeading/)).toBeInTheDocument();
    expect(screen.getByText(/provider\.capabilities\.alchemyHeading/)).toBeInTheDocument();
    expect(screen.getByText(/provider\.capabilities\.noderealHeading/)).toBeInTheDocument();
  });

  it('renders the capabilities block title and subtitle', async () => {
    render(<ProviderSettings />);
    expect(await screen.findByText('provider.capabilities.title')).toBeInTheDocument();
    expect(screen.getByText('provider.capabilities.subtitle')).toBeInTheDocument();
  });
});
