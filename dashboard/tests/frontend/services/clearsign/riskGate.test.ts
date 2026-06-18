import { describe, it, expect } from 'vitest';
import { isHighRiskSign } from '@/services/clearsign/riskGate';
import type { SecurityReport } from '@/services/tauri-api';

const base = (over: Partial<SecurityReport>): SecurityReport => ({
  proRequired: false,
  warnings: [],
  riskLevel: 'safe',
  ...over,
});

describe('isHighRiskSign', () => {
  it('returns false when security is undefined (check did not run / failed)', () => {
    expect(isHighRiskSign(undefined)).toBe(false);
  });

  it('returns false when proRequired (Free user) even with a blacklist match', () => {
    expect(
      isHighRiskSign(base({
        proRequired: true,
        riskLevel: 'danger',
        blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
      })),
    ).toBe(false);
  });

  it('returns true when a blacklist match is present', () => {
    expect(
      isHighRiskSign(base({
        blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
      })),
    ).toBe(true);
  });

  it('returns true when riskLevel is danger', () => {
    expect(isHighRiskSign(base({ riskLevel: 'danger' }))).toBe(true);
  });

  it('returns false when riskLevel is warning and no blacklist match', () => {
    expect(isHighRiskSign(base({ riskLevel: 'warning' }))).toBe(false);
  });

  it('returns false when riskLevel is safe', () => {
    expect(isHighRiskSign(base({ riskLevel: 'safe' }))).toBe(false);
  });
});
