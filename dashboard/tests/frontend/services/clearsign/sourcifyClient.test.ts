import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchContractAbi, _clearAbiCache } from '@/services/clearsign/sourcifyClient';

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
