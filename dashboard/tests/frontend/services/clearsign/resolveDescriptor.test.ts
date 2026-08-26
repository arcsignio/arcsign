import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  intentFromDescriptor,
  getDescriptorStatus,
  updateDescriptors,
} from '@/services/clearsign/resolveDescriptor';

// tests/setup.ts installs the global @tauri-apps/api/core mock; reuse it.
const mockInvoke = vi.mocked(invoke);

beforeEach(() => mockInvoke.mockReset());

const baseArgs = {
  chainId: 1,
  to: '0xrouter',
  selector: '0xabc',
  decoded: {},
  raw: '0xdeadbeef',
};

describe('intentFromDescriptor', () => {
  it('maps a resolved descriptor into a DecodedIntent', async () => {
    mockInvoke.mockResolvedValue({
      intent: 'Swap',
      owner: 'Uniswap Labs',
      contractName: 'Uniswap v3 Router 2',
      fields: [
        { label: 'Amount to Send', value: '1.5 USDC' },
        { label: 'Beneficiary', value: '0xAbC0...0001' },
      ],
    });

    const got = await intentFromDescriptor(baseArgs);

    expect(got).not.toBeNull();
    expect(got!.abiSource).toBe('erc7730');
    expect(got!.title).toBe('Swap');
    expect(got!.params).toEqual([
      { label: 'Amount to Send', value: '1.5 USDC' },
      { label: 'Beneficiary', value: '0xAbC0...0001' },
    ]);
    expect(got!.descriptorMeta).toEqual({
      owner: 'Uniswap Labs',
      contractName: 'Uniswap v3 Router 2',
    });
    expect(got!.raw).toBe('0xdeadbeef');
  });

  it('carries through risks detected by the existing decoder', async () => {
    mockInvoke.mockResolvedValue({
      intent: 'Approve',
      owner: 'X',
      contractName: 'Y',
      fields: [{ label: 'Spender', value: '0x1' }],
    });

    const got = await intentFromDescriptor({
      ...baseArgs,
      risks: ['unlimited-approval'],
    });

    // A descriptor describes intent; it must not silently drop a risk badge
    // the existing detector raised.
    expect(got!.risks).toEqual(['unlimited-approval']);
  });

  it('returns null when no descriptor matches, so the caller falls back', async () => {
    mockInvoke.mockResolvedValue(null);
    expect(await intentFromDescriptor(baseArgs)).toBeNull();
  });

  it('returns null when the reply has no fields', async () => {
    mockInvoke.mockResolvedValue({ intent: 'Swap', owner: 'X', contractName: 'Y', fields: [] });
    expect(await intentFromDescriptor(baseArgs)).toBeNull();
  });

  it('returns null when the backend call throws, never surfacing an error to signing', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('ffi exploded'));
    expect(await intentFromDescriptor(baseArgs)).toBeNull();
  });

  it('returns null on a malformed reply rather than rendering a partial summary', async () => {
    mockInvoke.mockResolvedValue({ intent: 'Swap', fields: 'not-an-array' });
    expect(await intentFromDescriptor(baseArgs)).toBeNull();
  });
});

describe('getDescriptorStatus', () => {
  it('returns the backend status', async () => {
    mockInvoke.mockResolvedValue({ version: '2026-08-26', count: 229 });
    expect(await getDescriptorStatus('/Volumes/arcsign', 'tok')).toEqual({
      version: '2026-08-26',
      count: 229,
    });
  });

  it('returns null on failure instead of throwing into the settings UI', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('nope'));
    expect(await getDescriptorStatus('/Volumes/arcsign')).toBeNull();
  });
});

describe('updateDescriptors', () => {
  it('propagates failure so the UI can report it', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('NETWORK_ERROR'));
    await expect(updateDescriptors('/Volumes/arcsign', 'tok')).rejects.toThrow('NETWORK_ERROR');
  });
});
