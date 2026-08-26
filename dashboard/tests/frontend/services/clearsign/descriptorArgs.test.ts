import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { encodeFunctionData } from 'viem';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import { uniV3RouterAbi } from '@/services/clearsign/knownAbis';

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

    // Uniswap V3 exactInputSingle(( tokenIn, tokenOut, fee, recipient,
    // amountIn, amountOutMinimum, sqrtPriceLimitX96 )) — a real tuple arg.
    // A descriptor path like "params.amountIn" only resolves if the tuple
    // arrives as a nested object rather than a positional array.
    const data = encodeFunctionData({
      abi: uniV3RouterAbi,
      functionName: 'exactInputSingle',
      args: [{
        tokenIn: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        tokenOut: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        fee: 3000,
        recipient: '0xcccccccccccccccccccccccccccccccccccccccc',
        deadline: 1900000000n,
        amountIn: 1500000n,
        amountOutMinimum: 900n,
        sqrtPriceLimitX96: 0n,
      }],
    });

    await decodeCalldata('eth-mainnet', '0xrouter', data, undefined);
    const call = mockInvoke.mock.calls.find(c => c[0] === 'resolve_descriptor');
    expect(call, 'resolve_descriptor should have been invoked').toBeTruthy();

    const decoded = (call![1] as any).input.decoded;
    const params = decoded.params as Record<string, unknown>;
    expect(params, 'tuple arg must be present under its parameter name').toBeTruthy();
    expect(Array.isArray(params)).toBe(false);
    // Nested field addressable by name, bigint rendered as a decimal string.
    expect(params.amountIn).toBe('1500000');
    expect(params.tokenIn).toMatch(/^0x[aA]{40}$/);
  });
});
