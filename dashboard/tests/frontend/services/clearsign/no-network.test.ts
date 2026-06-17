import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodeFunctionData } from 'viem';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import { decodeTypedData } from '@/services/clearsign/decodeTypedData';
import { erc20Abi } from '@/services/clearsign/knownAbis';
import * as tokenLabel from '@/services/clearsign/tokenLabel';

// tokenLabel is mocked so this test isolates the decode step — its own
// zero-external-API guarantee comes from reading the local token list.
vi.mock('@/services/clearsign/tokenLabel');

describe('clearsign makes no network calls (privacy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tokenLabel.resolveTokenLabel as any).mockResolvedValue({ symbol: 'USDC', decimals: 6, known: true });
  });

  it('decodeCalldata / decodeTypedData do not call fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('no network allowed'));

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: ['0x1111111254EEB25477B68fb85Ed929f73A960582', 1n],
    });
    await decodeCalldata('eth-mainnet', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', data, '0x0');
    decodeTypedData({ primaryType: 'X', types: {}, message: {}, domain: { name: 'app' } } as any);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
