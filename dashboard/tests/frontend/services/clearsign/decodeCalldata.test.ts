import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodeFunctionData } from 'viem';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import { erc20Abi, erc721Abi, permit2Abi, uniV2RouterAbi, uniV3RouterAbi, oneInchRouterAbi, kyberRouterAbi, aggregatorAbi, MAX_UINT256, MAX_UINT160 } from '@/services/clearsign/knownAbis';
import * as tokenLabel from '@/services/clearsign/tokenLabel';
import * as sourcify from '@/services/clearsign/sourcifyClient';
import { encodeFunctionData as enc } from 'viem';

vi.mock('@/services/clearsign/tokenLabel', () => ({
  resolveTokenLabel: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(tokenLabel.resolveTokenLabel).mockResolvedValue({ symbol: 'USDC', decimals: 6, known: true });
});

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const SPENDER = '0x1111111254EEB25477B68fb85Ed929f73A960582';

describe('decodeCalldata', () => {
  it('decodes ERC-20 transfer into a readable intent', async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [SPENDER, 5_000_000n] });
    const r = await decodeCalldata('eth-mainnet', TOKEN, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title.toLowerCase()).toContain('transfer');
    expect(r.title).toContain('USDC');
    expect(r.risks).not.toContain('unlimited-approval');
  });

  it('flags an unlimited approve', async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [SPENDER, MAX_UINT256] });
    const r = await decodeCalldata('eth-mainnet', TOKEN, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.risks).toContain('unlimited-approval');
  });

  it('flags setApprovalForAll(true) as approve-all-nfts', async () => {
    const data = encodeFunctionData({ abi: erc721Abi, functionName: 'setApprovalForAll', args: [SPENDER, true] });
    const r = await decodeCalldata('eth-mainnet', TOKEN, data, '0x0');
    expect(r.risks).toContain('approve-all-nfts');
  });

  it('returns unreadable for an unknown selector', async () => {
    const r = await decodeCalldata('eth-mainnet', TOKEN, '0xdeadbeef00000000', '0x0');
    expect(r.readable).toBe(false);
    expect(r.raw).toBe('0xdeadbeef00000000');
  });

  it('treats empty data with value as a native transfer (readable)', async () => {
    const r = await decodeCalldata('eth-mainnet', SPENDER, '0x', '0xde0b6b3a7640000');
    expect(r.readable).toBe(true);
    expect(r.title.toLowerCase()).toContain('send');
  });

  it('decodes Permit2 approve with expiration and flags permit-approval', async () => {
    const data = encodeFunctionData({ abi: permit2Abi, functionName: 'approve', args: [TOKEN, SPENDER, MAX_UINT160, 0] });
    const r = await decodeCalldata('eth-mainnet', '0x000000000022D473030F116dDEE9F6B43aC78BA3', data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title.toLowerCase()).toContain('permit2');
    expect(r.risks).toContain('permit-approval');
    expect(r.risks).toContain('unlimited-approval'); // amount = MAX_UINT160
    expect(r.params.some(p => p.label === 'Expiration' && p.value === 'Never')).toBe(true);
  });
});

describe('decodeCalldata — V2 swap', () => {
  const A = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const B = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const RECIP = '0x1111111254EEB25477B68fb85Ed929f73A960582';
  const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

  it('decodes swapExactTokensForTokens into Swap A → B with min received', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 6, known: true })
      .mockResolvedValueOnce({ symbol: 'USDT', decimals: 6, known: true });
    const data = encodeFunctionData({
      abi: uniV2RouterAbi, functionName: 'swapExactTokensForTokens',
      args: [100_000_000n, 98_000_000n, [A, B], RECIP, 9999999999n],
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title.toLowerCase()).toContain('swap');
    expect(r.title).toContain('USDC');
    expect(r.title).toContain('USDT');
    expect(r.params.some(p => /min/i.test(p.label) && p.value.includes('USDT'))).toBe(true);
    expect(r.risks).toEqual([]);
  });

  it('shows the contract address when a token is not in the local list', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: A, decimals: 18, known: false })
      .mockResolvedValueOnce({ symbol: B, decimals: 18, known: false });
    const data = encodeFunctionData({
      abi: uniV2RouterAbi, functionName: 'swapExactTokensForTokens',
      args: [1n, 1n, [A, B], RECIP, 9999999999n],
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title).toContain('0xA0b8');
  });

  it('decodes swapExactTokensForETH (token → native)', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 6, known: true })
      .mockResolvedValueOnce({ symbol: 'WETH', decimals: 18, known: true });
    const data = encodeFunctionData({
      abi: uniV2RouterAbi, functionName: 'swapExactTokensForETH',
      args: [50_000_000n, 20000000000000000n, [A, B], RECIP, 9999999999n],
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title.toLowerCase()).toContain('swap');
  });

  it('decodes swapExactETHForTokens (ETH → token): recipient is args[2], no Amount in row', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'WETH', decimals: 18, known: true })
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 6, known: true });
    const data = encodeFunctionData({
      abi: uniV2RouterAbi, functionName: 'swapExactETHForTokens',
      args: [98_000_000n, [A, B], RECIP, 9999999999n],
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0xde0b6b3a7640000');
    expect(r.readable).toBe(true);
    expect(r.title.toLowerCase()).toContain('swap');
    // Recipient row must be the real recipient (args[2]), NOT the deadline (args[3])
    const recipRow = r.params.find(p => /recipient/i.test(p.label));
    expect(recipRow).toBeDefined();
    expect(recipRow!.value).toContain('0x1111');  // shortAddr(RECIP)
    expect(recipRow!.value).not.toContain('9999'); // not the deadline
    // ETH-in: no "Amount in" row (amountIn is msg.value, omitted)
    expect(r.params.some(p => /amount in/i.test(p.label))).toBe(false);
  });

  it('returns unreadable for a degenerate empty path (no tokens to show)', async () => {
    const data = encodeFunctionData({
      abi: uniV2RouterAbi, functionName: 'swapExactTokensForTokens',
      args: [1n, 1n, [], RECIP, 9999999999n],  // empty path → no from/to token
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0');
    expect(r.readable).toBe(false);  // honest: don't show a swap with a missing side
  });
});

describe('decodeCalldata — V3 swap', () => {
  const A = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const B = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const C = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const RECIP = '0x1111111254EEB25477B68fb85Ed929f73A960582';
  const ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

  // V3 packed path: address(20) + fee(3) + address(20) [+ fee(3)+address(20) per hop].
  // even index = address (strip 0x), odd index = 3-byte fee hex e.g. '0001f4' (500).
  const packPath = (...parts: string[]): `0x${string}` =>
    ('0x' + parts.map((p, i) => (i % 2 === 0 ? p.slice(2) : p)).join('')) as `0x${string}`;

  it('decodes exactInputSingle (single hop)', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 6, known: true })
      .mockResolvedValueOnce({ symbol: 'USDT', decimals: 6, known: true });
    const data = encodeFunctionData({
      abi: uniV3RouterAbi, functionName: 'exactInputSingle',
      args: [{ tokenIn: A, tokenOut: B, fee: 500, recipient: RECIP, deadline: 9999999999n, amountIn: 100_000_000n, amountOutMinimum: 98_000_000n, sqrtPriceLimitX96: 0n }],
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title).toContain('USDC');
    expect(r.title).toContain('USDT');
    expect(r.params.some(p => /min/i.test(p.label))).toBe(true);
  });

  it('decodes exactInput multi-hop — takes first and last token', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 6, known: true })
      .mockResolvedValueOnce({ symbol: 'WETH', decimals: 18, known: true });
    const path = packPath(A, '0001f4', C, '0001f4', B);  // A → C → B
    const data = encodeFunctionData({
      abi: uniV3RouterAbi, functionName: 'exactInput',
      args: [{ path, recipient: RECIP, deadline: 9999999999n, amountIn: 100_000_000n, amountOutMinimum: 1n }],
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title).toContain('USDC');  // first token (A)
    expect(r.title).toContain('WETH');  // last token (B)
  });

  it('returns unreadable when the packed path length is invalid', async () => {
    const badPath = ('0x' + 'ab'.repeat(30)) as `0x${string}`;  // 30 bytes — not 20 + 23*n
    const data = encodeFunctionData({
      abi: uniV3RouterAbi, functionName: 'exactInput',
      args: [{ path: badPath, recipient: RECIP, deadline: 9999999999n, amountIn: 1n, amountOutMinimum: 1n }],
    });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0');
    expect(r.readable).toBe(false);
  });
});

describe('decodeCalldata — aggregator swap (1inch / Kyber)', () => {
  const SRC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const DST = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  const RECIP = '0x1111111254EEB25477B68fb85Ed929f73A960582';
  const EXEC = '0x2222222222222222222222222222222222222222';

  it('decodes 1inch swap desc into Swap src → dst with min return', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 6, known: true })
      .mockResolvedValueOnce({ symbol: 'USDT', decimals: 6, known: true });
    const data = encodeFunctionData({
      abi: oneInchRouterAbi, functionName: 'swap',
      args: [EXEC, { srcToken: SRC, dstToken: DST, srcReceiver: EXEC, dstReceiver: RECIP, amount: 100_000_000n, minReturnAmount: 98_000_000n, flags: 0n }, '0x', '0x'],
    });
    const r = await decodeCalldata('eth-mainnet', EXEC, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title).toContain('USDC');
    expect(r.title).toContain('USDT');
    expect(r.title).toContain('1inch');
    expect(r.params.some(p => /min/i.test(p.label))).toBe(true);
  });

  it('decodes Kyber swap desc into Swap src → dst', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 6, known: true })
      .mockResolvedValueOnce({ symbol: 'USDT', decimals: 6, known: true });
    const data = encodeFunctionData({
      abi: kyberRouterAbi, functionName: 'swap',
      args: [{ callTarget: EXEC, approveTarget: EXEC, targetData: '0x', desc: { srcToken: SRC, dstToken: DST, srcReceivers: [], srcAmounts: [], feeReceivers: [], feeAmounts: [], dstReceiver: RECIP, amount: 100_000_000n, minReturnAmount: 97_000_000n, flags: 0n, permit: '0x' }, clientData: '0x' }],
    });
    const r = await decodeCalldata('eth-mainnet', EXEC, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title).toContain('USDC');
    expect(r.title).toContain('KyberSwap');
  });

  it('returns unreadable when swap args do not match (garbage)', async () => {
    const r = await decodeCalldata('eth-mainnet', EXEC, '0x12aa3caf0000', '0x0');
    expect(r.readable).toBe(false);
  });
});

describe('decodeCalldata — Aggregator swapExactIn (0xedad400c)', () => {
  const IN = '0x55d398326f99059fF775485246999027B3197955';  // USDT (BSC)
  const OUT = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // USDC (BSC)
  const RECIP = '0x1111111254EEB25477B68fb85Ed929f73A960582';
  const ROUTER = '0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc';

  // minimal valid routes (empty nested arrays) — routing detail is noise we ignore
  const emptyRoutes: never[] = [];

  it('decodes swapExactIn into Swap USDT → USDC with Min received, no Amount in', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: 'USDT', decimals: 18, known: true })
      .mockResolvedValueOnce({ symbol: 'USDC', decimals: 18, known: true });
    const data = encodeFunctionData({
      abi: aggregatorAbi, functionName: 'swapExactIn',
      args: [
        0n,
        { inputToken: IN, outputToken: OUT, minOutputAmount: 50_000_000_000_000_000_000n, deadline: 9999999999n },
        [],
        emptyRoutes,
        0n,
        RECIP,
      ],
    });
    const r = await decodeCalldata('bnb', ROUTER, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title.toLowerCase()).toContain('swap');
    expect(r.title).toContain('USDT');
    expect(r.title).toContain('USDC');
    expect(r.title).toContain('Aggregator');
    // Min received present (minOutputAmount, in the OUT token)
    expect(r.params.some(p => /min/i.test(p.label) && p.value.includes('USDC'))).toBe(true);
    // No "Amount in" row — amountIn is spread across routesAmount[], omitted
    expect(r.params.some(p => /amount in/i.test(p.label))).toBe(false);
    // Recipient row present
    expect(r.params.some(p => /recipient/i.test(p.label) && p.value.includes('0x1111'))).toBe(true);
    expect(r.risks).toEqual([]);
  });

  it('shows token addresses when not in the local list (still readable)', async () => {
    vi.mocked(tokenLabel.resolveTokenLabel)
      .mockResolvedValueOnce({ symbol: IN, decimals: 18, known: false })
      .mockResolvedValueOnce({ symbol: OUT, decimals: 18, known: false });
    const data = encodeFunctionData({
      abi: aggregatorAbi, functionName: 'swapExactIn',
      args: [0n, { inputToken: IN, outputToken: OUT, minOutputAmount: 1n, deadline: 9999999999n }, [], [], 0n, RECIP],
    });
    const r = await decodeCalldata('bnb', ROUTER, data, '0x0');
    expect(r.readable).toBe(true);
    expect(r.title).toContain('0x55d3');  // shortened inputToken address
  });
});

describe('decodeCalldata — online ABI fallback (Sourcify)', () => {
  const ROUTER = '0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc';
  const A = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  // a fn with NO buildIntent case (honesty boundary) and not in KNOWN_ABIS:
  const opaqueAbi = [{ type: 'function', name: 'execute', inputs: [{ name: 'commands', type: 'bytes' }, { name: 'inputs', type: 'bytes[]' }], outputs: [], stateMutability: 'payable' }] as const;

  beforeEach(() => {
    vi.mocked(tokenLabel.resolveTokenLabel).mockResolvedValue({ symbol: 'USDC', decimals: 6, known: true });
  });

  it('does NOT call sourcify when the local whitelist matches', async () => {
    const spy = vi.spyOn(sourcify, 'fetchContractAbi');
    const data = enc({ abi: erc20Abi, functionName: 'transfer', args: [A, 1n] });
    const r = await decodeCalldata('eth-mainnet', A, data, '0x0', { onlineEnabled: true });
    expect(r.readable).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does NOT call sourcify when online decoding is disabled (default, no options)', async () => {
    const spy = vi.spyOn(sourcify, 'fetchContractAbi');
    const data = enc({ abi: opaqueAbi, functionName: 'execute', args: ['0x', []] });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0'); // no options → off
    expect(r.readable).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('consults sourcify when whitelist misses + online enabled (honesty boundary keeps it unreadable)', async () => {
    const customAbi = [{ type: 'function', name: 'doSwap', inputs: [{ name: 'x', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }] as const;
    const spy = vi.spyOn(sourcify, 'fetchContractAbi').mockResolvedValue({ abi: customAbi as never, matchLevel: 'full' });
    const data = enc({ abi: customAbi, functionName: 'doSwap', args: [1n] });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0', { onlineEnabled: true });
    expect(spy).toHaveBeenCalledOnce();
    // doSwap has no buildIntent case → honesty boundary → unreadable
    expect(r.readable).toBe(false);
  });

  it('returns unreadable when sourcify returns null (fetch failed/not verified)', async () => {
    vi.spyOn(sourcify, 'fetchContractAbi').mockResolvedValue(null);
    const data = enc({ abi: opaqueAbi, functionName: 'execute', args: ['0x', []] });
    const r = await decodeCalldata('eth-mainnet', ROUTER, data, '0x0', { onlineEnabled: true });
    expect(r.readable).toBe(false);
  });

  it('does not set an online abiSource on a local whitelist hit', async () => {
    const data = enc({ abi: erc20Abi, functionName: 'transfer', args: [A, 1_000_000n] });
    const r = await decodeCalldata('eth-mainnet', A, data, '0x0', { onlineEnabled: true });
    expect(r.readable).toBe(true);
    expect(r.abiSource === undefined || r.abiSource === 'local').toBe(true);
  });
});

describe('decodeCalldata — generic swap detection (fallback)', () => {
  const TIN = '0x55d398326f99059fF775485246999027B3197955';
  const TOUT = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
  const RECIP = '0x1111111254EEB25477B68fb85Ed929f73A960582';
  const CONTRACT = '0x9999999999999999999999999999999999999999';

  beforeEach(() => {
    vi.mocked(tokenLabel.resolveTokenLabel).mockResolvedValue({ symbol: 'USDT', decimals: 18, known: true });
  });

  it('detects a structurally-swap fn from a fetched ABI → "Detected swap"', async () => {
    const swapAbi = [{ type: 'function', name: 'mySwap', inputs: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'minOut', type: 'uint256' }, { name: 'recipient', type: 'address' },
    ], outputs: [], stateMutability: 'nonpayable' }] as const;
    vi.spyOn(sourcify, 'fetchContractAbi').mockResolvedValue({ abi: swapAbi as never, matchLevel: 'full' });
    const data = enc({ abi: swapAbi, functionName: 'mySwap', args: [TIN, TOUT, 100n, 98n, RECIP] });
    const r = await decodeCalldata('eth-mainnet', CONTRACT, data, '0x0', { onlineEnabled: true });
    expect(r.readable).toBe(true);
    expect(r.title).toContain('Detected swap');
  });

  it('does NOT detect a non-swap fn (swapOwner) → unreadable', async () => {
    const ownerAbi = [{ type: 'function', name: 'swapOwner', inputs: [
      { name: 'prevOwner', type: 'address' }, { name: 'oldOwner', type: 'address' }, { name: 'newOwner', type: 'address' },
    ], outputs: [], stateMutability: 'nonpayable' }] as const;
    vi.spyOn(sourcify, 'fetchContractAbi').mockResolvedValue({ abi: ownerAbi as never, matchLevel: 'full' });
    const data = enc({ abi: ownerAbi, functionName: 'swapOwner', args: [TIN, TOUT, RECIP] });
    const r = await decodeCalldata('eth-mainnet', CONTRACT, data, '0x0', { onlineEnabled: true });
    expect(r.readable).toBe(false);
  });
});
