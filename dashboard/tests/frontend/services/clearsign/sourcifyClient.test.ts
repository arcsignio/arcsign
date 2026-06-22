import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchContractAbi, _clearAbiCache } from '@/services/clearsign/sourcifyClient';
import * as api from '@/services/tauri-api';

const ADDR = '0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc';

const META = (name: string) => JSON.stringify({
  output: { abi: [{ type: 'function', name, inputs: [], outputs: [], stateMutability: 'nonpayable' }] },
});
const okResponse = (status: 'full' | 'partial', fnName = 'foo') => ({
  ok: true,
  status: 200,
  json: async () => ({ status, files: [{ name: 'metadata.json', path: 'x/metadata.json', content: META(fnName) }] }),
});

beforeEach(() => {
  _clearAbiCache();
  vi.restoreAllMocks();
});

describe('fetchContractAbi', () => {
  it('returns abi + matchLevel "full" on a full_match response', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(okResponse('full', 'swapExactIn'));
    const r = await fetchContractAbi(56, ADDR);
    expect(r).not.toBeNull();
    expect(r!.matchLevel).toBe('full');
    expect(r!.abi.some((f: any) => f.name === 'swapExactIn')).toBe(true);
  });

  it('returns matchLevel "partial" on a partial_match response', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(okResponse('partial'));
    const r = await fetchContractAbi(1, ADDR);
    expect(r!.matchLevel).toBe('partial');
  });

  it('returns null on a non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await fetchContractAbi(1, ADDR)).toBeNull();
  });

  it('returns null (does not throw) when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('network down'));
    expect(await fetchContractAbi(1, ADDR)).toBeNull();
  });

  it('caches a hit — second call does not fetch again', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(okResponse('full'));
    await fetchContractAbi(56, ADDR);
    await fetchContractAbi(56, ADDR);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('negative-caches a miss — second call does not fetch again', async () => {
    const spy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await fetchContractAbi(1, ADDR);
    await fetchContractAbi(1, ADDR);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('returns null on a 200 response with no metadata.json file', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ status: 'full', files: [{ name: 'Contract.sol', path: 'x', content: '...' }] }),
    });
    expect(await fetchContractAbi(1, ADDR)).toBeNull();
  });

  it('returns null (does not throw) when metadata.json content is malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ status: 'full', files: [{ name: 'metadata.json', path: 'x', content: 'NOT json{' }] }),
    });
    expect(await fetchContractAbi(1, ADDR)).toBeNull();
  });

  it('returns null when output.abi is an empty array', async () => {
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ status: 'full', files: [{ name: 'metadata.json', path: 'x', content: JSON.stringify({ output: { abi: [] } }) }] }),
    });
    expect(await fetchContractAbi(1, ADDR)).toBeNull();
  });
});

describe('fetchContractAbi — USB persistent cache', () => {
  const USB = { usbPath: '/dev/disk2', sessionToken: 'tok' };
  beforeEach(() => { _clearAbiCache(); vi.restoreAllMocks(); });

  it('returns a USB-cache hit without going online', async () => {
    vi.spyOn(api, 'getCachedAbi').mockResolvedValue({ abi: [{ type: 'function', name: 'x', inputs: [], outputs: [] }], matchLevel: 'full', source: 'sourcify', address: ADDR, chainId: 56, fetchedAt: 1 });
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
    const r = await fetchContractAbi(56, ADDR, USB);
    expect(r).not.toBeNull();
    expect(r!.matchLevel).toBe('full');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('on USB miss, fetches online and writes back to USB', async () => {
    vi.spyOn(api, 'getCachedAbi').mockResolvedValue(null);
    const setSpy = vi.spyOn(api, 'setCachedAbi').mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ status: 'full', files: [{ name: 'metadata.json', content: JSON.stringify({ output: { abi: [{ type: 'function', name: 'y', inputs: [], outputs: [] }] } }) }] }),
    });
    const r = await fetchContractAbi(56, ADDR, USB);
    expect(r).not.toBeNull();
    expect(setSpy).toHaveBeenCalledOnce();
    expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 56,
      address: ADDR,
      matchLevel: 'full',
      source: 'sourcify',
      usbPath: USB.usbPath,
      sessionToken: USB.sessionToken,
      fetchedAt: expect.any(Number),
      abi: expect.any(Array),
    }));
  });

  it('USB read failure is graceful → falls through to online', async () => {
    vi.spyOn(api, 'getCachedAbi').mockRejectedValue(new Error('usb gone'));
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ status: 'full', files: [{ name: 'metadata.json', content: JSON.stringify({ output: { abi: [{ type: 'function', name: 'z', inputs: [], outputs: [] }] } }) }] }),
    });
    const r = await fetchContractAbi(56, ADDR, USB);
    expect(r).not.toBeNull();
  });

  it('without USB params, behaves exactly like Plan 1 (no USB calls)', async () => {
    const getSpy = vi.spyOn(api, 'getCachedAbi');
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await fetchContractAbi(56, ADDR);
    expect(getSpy).not.toHaveBeenCalled();
  });
});
