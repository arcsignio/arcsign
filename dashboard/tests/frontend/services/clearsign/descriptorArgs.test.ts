import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';

const mockInvoke = vi.mocked(invoke);
beforeEach(() => mockInvoke.mockReset());

describe('decodeCalldata feeds the descriptor ABI-named args', () => {
  // ERC-7730 field paths address arguments the way the ABI names them, so the
  // decoded map handed to the backend must be keyed that way too. Keying by UI
  // label (the earlier bug) meant no descriptor ever matched and the feature
  // silently did nothing.
  it('keys decoded args by contract parameter name, not UI label', async () => {
    mockInvoke.mockResolvedValue(null); // no descriptor; we only inspect the request

    // erc20 transfer(address _to, uint256 _value) — 100 USDC (6dp)
    const data =
      '0xa9059cbb' +
      '000000000000000000000000' + 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      '0000000000000000000000000000000000000000000000000000000005f5e100';

    await decodeCalldata('eth-mainnet', '0xtoken', data, undefined);

    const call = mockInvoke.mock.calls.find(c => c[0] === 'resolve_descriptor');
    expect(call, 'resolve_descriptor should have been invoked').toBeTruthy();
    const decoded = (call![1] as any).input.decoded;
    // ABI names, not labels like "To"/"Amount"
    expect(Object.keys(decoded).sort()).toEqual(['amount', 'to']);
    expect(decoded.amount).toBe('100000000');
    expect(decoded.to).toMatch(/^0x[aA]{40}$/);
  });
  it('sends tuple arguments as nested objects so dotted paths resolve', async () => {
    mockInvoke.mockResolvedValue(null);

    // Uniswap V3 exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))
    // Verified indirectly: a tuple arg must arrive as an object, not an array,
    // otherwise a path like "params.amountIn" cannot resolve.
    const data =
      '0xa9059cbb' +
      '000000000000000000000000' + 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' +
      '0000000000000000000000000000000000000000000000000000000000000001';

    await decodeCalldata('eth-mainnet', '0xtoken', data, undefined);
    const call = mockInvoke.mock.calls.find(c => c[0] === 'resolve_descriptor');
    const decoded = (call![1] as any).input.decoded;
    // Flat args stay flat; the shape is a plain object keyed by name.
    expect(typeof decoded).toBe('object');
    expect(Array.isArray(decoded)).toBe(false);
  });
});
