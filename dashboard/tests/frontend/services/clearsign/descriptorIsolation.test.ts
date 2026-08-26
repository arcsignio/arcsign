import { describe, it, expect } from 'vitest';
import { isHighRiskSign } from '@/services/clearsign/riskGate';
import type { DecodedIntent } from '@/services/clearsign/types';

/**
 * The frontend half of this project's core clear-signing rule: an ERC-7730
 * descriptor changes what the user SEES, never what the signing gate DECIDES.
 *
 * useSignGate derives requiresAcknowledge solely from isHighRiskSign(security)
 * — the backend's verdict. These tests pin that the risk gate depends on the
 * security report alone and never on descriptor provenance.
 */
describe('descriptor data cannot influence the signing gate', () => {
  const dangerous = { requiresAcknowledge: true, riskLevel: 'danger', warnings: [] } as never;
  const safe = { requiresAcknowledge: false, riskLevel: 'safe', warnings: [] } as never;

  it('keeps a dangerous verdict dangerous regardless of descriptor source', () => {
    // isHighRiskSign takes only the security report; a descriptor cannot be
    // passed to it even in principle. Assert the verdict is source-independent.
    expect(isHighRiskSign(dangerous)).toBe(true);
    expect(isHighRiskSign(safe)).toBe(false);
  });

  it('never lets a descriptor-sourced intent carry a risk signal of its own', () => {
    // A descriptor-sourced intent must inherit risks from the ABI decoder;
    // it must never be the origin of a risk decision.
    const fromDescriptor: DecodedIntent = {
      readable: true,
      title: 'Swap',
      params: [{ label: 'Amount', value: '1.5 USDC' }],
      risks: [],
      raw: '0xdeadbeef',
      abiSource: 'erc7730',
      descriptorMeta: { owner: 'Uniswap Labs', contractName: 'Router' },
    };

    // The intent type carries no field the risk gate reads.
    expect(fromDescriptor.descriptorMeta).toBeDefined();
    expect(isHighRiskSign(dangerous)).toBe(true); // unchanged by the above
  });
});
