import { describe, it, expect } from 'vitest';
import { encodeFunctionData, decodeFunctionData } from 'viem';
import { uniV2RouterAbi, KNOWN_ABIS } from '@/services/clearsign/knownAbis';

const A = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const B = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const TO = '0x1111111254EEB25477B68fb85Ed929f73A960582';

describe('uniV2RouterAbi', () => {
  it('round-trips swapExactTokensForTokens', () => {
    const data = encodeFunctionData({
      abi: uniV2RouterAbi,
      functionName: 'swapExactTokensForTokens',
      args: [1_000_000n, 990_000n, [A, B], TO, 9999999999n],
    });
    const { functionName, args } = decodeFunctionData({ abi: uniV2RouterAbi, data });
    expect(functionName).toBe('swapExactTokensForTokens');
    expect((args as readonly unknown[]).length).toBe(5);
  });

  it('is registered in KNOWN_ABIS', () => {
    expect(KNOWN_ABIS).toContain(uniV2RouterAbi);
  });
});
