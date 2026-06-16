import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHasProviderKey } from '@/hooks/useHasProviderKey';
import * as providerApi from '@/api/provider';

vi.mock('@/api/provider');

describe('useHasProviderKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports alchemy + nodereal keys present', async () => {
    (providerApi.listProviderConfigs as any).mockResolvedValue([
      { providerType: 'alchemy', chainId: 'global', enabled: true, hasApiKey: true },
      { providerType: 'nodereal', chainId: 'global', enabled: true, hasApiKey: true },
    ]);
    const { result } = renderHook(() => useHasProviderKey('/usb', 'token'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAlchemyKey).toBe(true);
    expect(result.current.hasNodeRealKey).toBe(true);
  });

  it('reports no keys when none configured', async () => {
    (providerApi.listProviderConfigs as any).mockResolvedValue([]);
    const { result } = renderHook(() => useHasProviderKey('/usb', 'token'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAlchemyKey).toBe(false);
    expect(result.current.hasNodeRealKey).toBe(false);
  });

  it('treats a disabled or keyless entry as no key', async () => {
    (providerApi.listProviderConfigs as any).mockResolvedValue([
      { providerType: 'alchemy', chainId: 'global', enabled: false, hasApiKey: true },
      { providerType: 'nodereal', chainId: 'global', enabled: true, hasApiKey: false },
    ]);
    const { result } = renderHook(() => useHasProviderKey('/usb', 'token'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAlchemyKey).toBe(false);
    expect(result.current.hasNodeRealKey).toBe(false);
  });

  it('does not query without usbPath', async () => {
    const { result } = renderHook(() => useHasProviderKey('', 'token'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(providerApi.listProviderConfigs).not.toHaveBeenCalled();
  });
});
