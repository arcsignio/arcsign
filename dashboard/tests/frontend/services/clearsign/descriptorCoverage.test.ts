import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import * as sourcify from '@/services/clearsign/sourcifyClient';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import { encodeFunctionData } from 'viem';

const mockInvoke = vi.mocked(invoke);
beforeEach(() => { mockInvoke.mockReset(); vi.restoreAllMocks(); });

describe('descriptor now reaches contracts outside KNOWN_ABIS', () => {
  it('uses a Sourcify ABI to feed the descriptor even when local decode is unreadable', async () => {
    // A function no KNOWN_ABI covers, and buildIntent has no case for.
    const customAbi = [{ type: 'function', name: 'dagSwapTo',
      inputs: [{ name: 'orderId', type: 'uint256' }, { name: 'receiver', type: 'address' }],
      outputs: [], stateMutability: 'nonpayable' }] as const;

    vi.spyOn(sourcify, 'fetchContractAbi').mockResolvedValue({ abi: customAbi as never, matchLevel: 'full' });
    mockInvoke.mockResolvedValue({
      intent: 'Swap', owner: 'OKX Labs', contractName: 'Router',
      fields: [{ label: 'Order', value: '42' }],
    });

    const data = encodeFunctionData({ abi: customAbi, functionName: 'dagSwapTo',
      args: [42n, '0xcccccccccccccccccccccccccccccccccccccccc'] });

    const r = await decodeCalldata('eth-mainnet', '0xrouter', data, '0x0', { onlineEnabled: true });

    const call = mockInvoke.mock.calls.find(c => c[0] === 'resolve_descriptor');
    expect(call, 'descriptor should be consulted for a non-KNOWN_ABI contract').toBeTruthy();
    expect((call![1] as any).input.decoded).toEqual({ orderId: '42', receiver: expect.any(String) });
    // And the descriptor rescues a transaction the local decoder called unreadable.
    expect(r.readable).toBe(true);
    expect(r.abiSource).toBe('erc7730');
  });
});
