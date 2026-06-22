import { describe, it, expect } from 'vitest';
import type { AbiFunction } from 'viem';
import { detectSwapFromAbi } from '@/services/clearsign/detectSwap';

const TIN = '0x55d398326f99059fF775485246999027B3197955';
const TOUT = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const RECIP = '0x1111111254EEB25477B68fb85Ed929f73A960582';

const fn = (name: string, inputs: { name: string; type: string }[]): AbiFunction =>
  ({ type: 'function', name, inputs, outputs: [], stateMutability: 'nonpayable' } as AbiFunction);

describe('detectSwapFromAbi — positive (high confidence)', () => {
  it('detects a flat swap(tokenIn, tokenOut, amountIn, minOut, recipient)', () => {
    const abi = fn('swap', [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'minOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ]);
    const s = detectSwapFromAbi('swap', abi, [TIN, TOUT, 100n, 98n, RECIP]);
    expect(s).not.toBeNull();
    expect(s!.fromToken).toBe(TIN);
    expect(s!.toToken).toBe(TOUT);
    expect(s!.minAmountOut).toBe(98n);
    expect(s!.amountIn).toBe(100n);
    expect(s!.recipient).toBe(RECIP);
    expect(s!.venue).toBe('Detected swap');
  });

  it('detects synonym variants (srcToken/dstToken/minReturnAmount)', () => {
    const abi = fn('exchange', [
      { name: 'srcToken', type: 'address' }, { name: 'dstToken', type: 'address' },
      { name: 'minReturnAmount', type: 'uint256' }, { name: 'dstReceiver', type: 'address' },
    ]);
    const s = detectSwapFromAbi('exchange', abi, [TIN, TOUT, 97n, RECIP]);
    expect(s).not.toBeNull();
    expect(s!.fromToken).toBe(TIN);
    expect(s!.toToken).toBe(TOUT);
    expect(s!.minAmountOut).toBe(97n);
    expect(s!.amountIn).toBeUndefined();
  });

  it('detects a swap with no recipient synonym → recipient is "" (not fabricated)', () => {
    const abi = fn('swap', [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'minOut', type: 'uint256' },
    ]);
    const s = detectSwapFromAbi('swap', abi, [TIN, TOUT, 98n]);
    expect(s).not.toBeNull();
    expect(s!.recipient).toBe('');
  });

  it('detects fields nested one level inside a struct (tuple)', () => {
    const abi = {
      type: 'function', name: 'swap', outputs: [], stateMutability: 'nonpayable',
      inputs: [{ name: 'desc', type: 'tuple', components: [
        { name: 'inputToken', type: 'address' }, { name: 'outputToken', type: 'address' },
        { name: 'minOutputAmount', type: 'uint256' }, { name: 'recipient', type: 'address' },
      ] }],
    } as unknown as AbiFunction;
    const s = detectSwapFromAbi('swap', abi, [{ inputToken: TIN, outputToken: TOUT, minOutputAmount: 50n, recipient: RECIP }]);
    expect(s).not.toBeNull();
    expect(s!.fromToken).toBe(TIN);
    expect(s!.toToken).toBe(TOUT);
    expect(s!.minAmountOut).toBe(50n);
  });
});

describe('detectSwapFromAbi — misdetection defense (must return null)', () => {
  it('transfer(to, amount) → null', () => {
    expect(detectSwapFromAbi('transfer', fn('transfer', [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }]), [RECIP, 1n])).toBeNull();
  });
  it('approve(spender, amount) → null', () => {
    expect(detectSwapFromAbi('approve', fn('approve', [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }]), [RECIP, 1n])).toBeNull();
  });
  it('multicall(bytes[]) → null', () => {
    expect(detectSwapFromAbi('multicall', fn('multicall', [{ name: 'data', type: 'bytes[]' }]), [[]])).toBeNull();
  });
  it('swapOwner(prev, old, new) → null (name has swap but no minOut)', () => {
    expect(detectSwapFromAbi('swapOwner', fn('swapOwner', [
      { name: 'prevOwner', type: 'address' }, { name: 'oldOwner', type: 'address' }, { name: 'newOwner', type: 'address' },
    ]), [TIN, TOUT, RECIP])).toBeNull();
  });
  it('bridge(token, amount, chainId) → null (name lacks swap)', () => {
    expect(detectSwapFromAbi('bridge', fn('bridge', [
      { name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'chainId', type: 'uint256' },
    ]), [TIN, 1n, 56n])).toBeNull();
  });
  it('has tokenIn/tokenOut/minOut but name lacks swap → null (condition 1)', () => {
    expect(detectSwapFromAbi('route', fn('route', [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'minOut', type: 'uint256' },
    ]), [TIN, TOUT, 1n])).toBeNull();
  });
  it('name has swap + two tokens but no minOut → null (condition 3)', () => {
    expect(detectSwapFromAbi('swap', fn('swap', [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'recipient', type: 'address' },
    ]), [TIN, TOUT, RECIP])).toBeNull();
  });
  it('fromToken synonym present but type is not address → null', () => {
    expect(detectSwapFromAbi('swap', fn('swap', [
      { name: 'tokenIn', type: 'uint256' }, { name: 'tokenOut', type: 'address' }, { name: 'minOut', type: 'uint256' },
    ]), [1n, TOUT, 1n])).toBeNull();
  });
  it('ambiguous: two fromToken synonyms (tokenIn + srcToken) → null', () => {
    expect(detectSwapFromAbi('swap', fn('swap', [
      { name: 'tokenIn', type: 'address' }, { name: 'srcToken', type: 'address' },
      { name: 'tokenOut', type: 'address' }, { name: 'minOut', type: 'uint256' },
    ]), [TIN, TIN, TOUT, 1n])).toBeNull();
  });
  it('ambiguous: two minOut synonyms (minOut + minReturn) → null', () => {
    expect(detectSwapFromAbi('swap', fn('swap', [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'minOut', type: 'uint256' }, { name: 'minReturn', type: 'uint256' },
    ]), [TIN, TOUT, 1n, 1n])).toBeNull();
  });
});
