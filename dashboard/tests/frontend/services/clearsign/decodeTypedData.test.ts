import { describe, it, expect } from 'vitest';
import { decodeTypedData } from '@/services/clearsign/decodeTypedData';

const permit2Typed = {
  domain: { name: 'Permit2', chainId: 1, verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
  primaryType: 'PermitSingle',
  types: { PermitSingle: [{ name: 'spender', type: 'address' }] },
  message: {
    details: { token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', amount: '1461501637330902918203684832716283019655932542975', expiration: '1700000000' },
    spender: '0x1111111254EEB25477B68fb85Ed929f73A960582',
  },
};

describe('decodeTypedData', () => {
  it('flags a Permit2 typed-data signature as a permit approval', () => {
    const r = decodeTypedData(permit2Typed);
    expect(r.readable).toBe(true);
    expect(r.risks).toContain('permit-approval');
    expect(r.title.toLowerCase()).toContain('permit');
  });

  it('shows the domain + primaryType for a generic typed-data', () => {
    const r = decodeTypedData({ domain: { name: 'SeaPort' }, primaryType: 'OrderComponents', types: {}, message: { offerer: '0xabc' } });
    expect(r.readable).toBe(true);
    expect(r.params.some(p => p.value.includes('SeaPort'))).toBe(true);
  });

  it('returns unreadable for a malformed typed-data', () => {
    const r = decodeTypedData({} as any);
    expect(r.readable).toBe(false);
  });
});
