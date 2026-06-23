import { describe, it, expect } from 'vitest';
import { isHighRiskSign } from '@/services/clearsign/riskGate';
import type { SecurityReport } from '@/services/tauri-api';

const base = (over: Partial<SecurityReport>): SecurityReport => ({
  proRequired: false, warnings: [], riskLevel: 'safe', ...over,
});

describe('isHighRiskSign — reads the backend requiresAcknowledge flag', () => {
  it('false when security is undefined', () => {
    expect(isHighRiskSign(undefined)).toBe(false);
  });
  it('true when the backend says requiresAcknowledge', () => {
    expect(isHighRiskSign(base({ requiresAcknowledge: true }))).toBe(true);
  });
  it('false when the backend says requiresAcknowledge is false', () => {
    expect(isHighRiskSign(base({ requiresAcknowledge: false }))).toBe(false);
  });
  it('false when requiresAcknowledge is absent (no danger)', () => {
    expect(isHighRiskSign(base({}))).toBe(false);
  });
});
