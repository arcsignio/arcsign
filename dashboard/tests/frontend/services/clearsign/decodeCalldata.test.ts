import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodeFunctionData } from 'viem';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import { erc20Abi, erc721Abi, permit2Abi, uniV2RouterAbi, MAX_UINT256, MAX_UINT160 } from '@/services/clearsign/knownAbis';
import * as tokenLabel from '@/services/clearsign/tokenLabel';

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
});
