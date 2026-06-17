import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkTransactionSecurity } from '@/services/tauri-api';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('checkTransactionSecurity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the SecurityReport from the backend', async () => {
    (invoke as any).mockResolvedValue({ proRequired: false, warnings: [], riskLevel: 'safe' });
    const r = await checkTransactionSecurity({ from: '0x1', to: '0x2', chainId: '1', usbPath: '/usb', sessionToken: 't', isPro: true });
    expect(r.riskLevel).toBe('safe');
    expect(invoke).toHaveBeenCalledWith('check_transaction_security', expect.objectContaining({ to: '0x2', isPro: true }));
  });

  it('throws a parsed error on failure (caller treats as no report)', async () => {
    (invoke as any).mockRejectedValue('INTERNAL_ERROR: boom');
    await expect(checkTransactionSecurity({ from: '0x1', to: '0x2', chainId: '1', usbPath: '/usb', sessionToken: 't', isPro: true })).rejects.toBeTruthy();
  });
});
