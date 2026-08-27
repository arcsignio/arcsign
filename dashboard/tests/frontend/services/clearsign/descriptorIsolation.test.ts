import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { isHighRiskSign } from '@/services/clearsign/riskGate';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import { encodeFunctionData, erc20Abi } from 'viem';

const mockInvoke = vi.mocked(invoke);
beforeEach(() => mockInvoke.mockReset());

/**
 * The frontend half of this project's core clear-signing rule: an ERC-7730
 * descriptor changes what the user SEES, never what the signing gate DECIDES.
 *
 * These tests are behavioural on purpose — a descriptor that actively lies
 * must not be able to suppress a risk badge or a danger verdict.
 */
describe('a hostile descriptor cannot weaken the signing gate', () => {
  const dangerous = { requiresAcknowledge: true, riskLevel: 'danger', warnings: [] } as never;
  const safe = { requiresAcknowledge: false, riskLevel: 'safe', warnings: [] } as never;

  it('keeps the backend danger verdict regardless of any descriptor', () => {
    // isHighRiskSign consumes the backend security report only; there is no
    // parameter through which descriptor data could reach it.
    expect(isHighRiskSign(dangerous)).toBe(true);
    expect(isHighRiskSign(safe)).toBe(false);
  });

  it('preserves unlimited-approval even when the descriptor claims the tx is safe', async () => {
    // A descriptor that describes an unlimited approve as something harmless.
    mockInvoke.mockResolvedValue({
      intent: 'Totally Safe Thing',
      owner: 'Attacker',
      contractName: 'Definitely Not Malicious',
      fields: [{ label: 'Nothing', value: 'to see here' }],
    });

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: ['0x1111111111111111111111111111111111111111', 2n ** 256n - 1n],
    });

    const intent = await decodeCalldata('eth-mainnet', '0xtoken', data, undefined);

    // The descriptor supplied the wording…
    expect(intent.title).toBe('Totally Safe Thing');
    // …but the risk badge comes from our own ABI analysis and survives intact.
    expect(intent.risks).toContain('unlimited-approval');
    // And the raw calldata is always retained for inspection.
    expect(intent.raw).toBe(data);
  });
});

describe('a digest cannot influence the signing gate', () => {
  const dangerousReport = { requiresAcknowledge: true, riskLevel: 'danger', warnings: [] } as never;

  it('leaves the danger verdict unchanged — the gate reads only the backend report', () => {
    // isHighRiskSign takes the security report alone. A digest is display data;
    // there is no parameter through which it could reach this decision.
    expect(isHighRiskSign(dangerousReport)).toBe(true);
  });

  it('keeps risk badges intact on an intent that carries a digest', async () => {
    mockInvoke.mockResolvedValue(null); // no descriptor
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: ['0x1111111111111111111111111111111111111111', 2n ** 256n - 1n],
    });

    const r = await decodeCalldata('eth-mainnet', '0xtoken', data, undefined);

    expect(r.digest?.primary).toBeTruthy();          // digest attached…
    expect(r.risks).toContain('unlimited-approval'); // …and the badge survives
  });

  it('attaches a digest to an unreadable transaction — the fallback case', async () => {
    mockInvoke.mockResolvedValue(null);
    const r = await decodeCalldata('eth-mainnet', '0xunknown', '0xdeadbeefcafe', undefined);
    expect(r.readable).toBe(false);
    expect(r.digest?.primary).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
