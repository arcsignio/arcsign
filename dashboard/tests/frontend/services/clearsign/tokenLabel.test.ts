import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTokenLabel } from '@/services/clearsign/tokenLabel';
import * as tokenList from '@/services/tokenList';

vi.mock('@/services/tokenList');

describe('resolveTokenLabel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns symbol + decimals when the token is in the local list', async () => {
    (tokenList.findTokenByAddress as any).mockResolvedValue({ symbol: 'USDC', decimals: 6, name: 'USD Coin' });
    const r = await resolveTokenLabel('eth-mainnet', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(r.symbol).toBe('USDC');
    expect(r.decimals).toBe(6);
    expect(r.known).toBe(true);
  });

  it('falls back to the address (no external lookup) when unknown', async () => {
    (tokenList.findTokenByAddress as any).mockResolvedValue(null);
    const r = await resolveTokenLabel('eth-mainnet', '0x000000000000000000000000000000000000dEaD');
    expect(r.known).toBe(false);
    expect(r.symbol).toMatch(/0x0000\.\.\.dEaD/i);
    expect(r.decimals).toBe(18);
  });

  it('does not throw and is unknown when the lookup errors', async () => {
    (tokenList.findTokenByAddress as any).mockRejectedValue(new Error('fs fail'));
    const r = await resolveTokenLabel('eth-mainnet', '0xabc');
    expect(r.known).toBe(false);
  });

  it('resolves the zero-address sentinel to the chain native symbol (BNB on bnb-mainnet)', async () => {
    const r = await resolveTokenLabel('bnb-mainnet', '0x0000000000000000000000000000000000000000');
    expect(r.symbol).toBe('BNB');
    expect(r.decimals).toBe(18);
    expect(r.known).toBe(true);
    // sentinel is resolved locally — never hits the token list
    expect(tokenList.findTokenByAddress).not.toHaveBeenCalled();
  });

  it('resolves the 0xEeee… native sentinel to the chain native symbol (ETH on eth-mainnet)', async () => {
    const r = await resolveTokenLabel('eth-mainnet', '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE');
    expect(r.symbol).toBe('ETH');
    expect(r.known).toBe(true);
    expect(tokenList.findTokenByAddress).not.toHaveBeenCalled();
  });

  it('resolves the native sentinel on every clearsign network id (incl. short arb/opt forms)', async () => {
    const cases: [string, string][] = [
      ['eth-mainnet', 'ETH'], ['polygon-mainnet', 'MATIC'], ['arb-mainnet', 'ETH'],
      ['opt-mainnet', 'ETH'], ['base-mainnet', 'ETH'], ['bnb-mainnet', 'BNB'],
      ['avalanche-mainnet', 'AVAX'],
    ];
    for (const [net, sym] of cases) {
      const r = await resolveTokenLabel(net, '0x0');
      expect(r.symbol, `native symbol for ${net}`).toBe(sym);
      expect(r.known).toBe(true);
    }
  });
});
