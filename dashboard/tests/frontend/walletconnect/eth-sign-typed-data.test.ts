/**
 * eth_signTypedData_v4 handler — security gate wiring.
 *
 * Mirrors the eth_sendTransaction handler: BEFORE showing the sign dialog the
 * handler calls the backend security check (`checkTypedDataSecurity`), attaches
 * the returned SecurityReport to the `requestSignature` dialog request as
 * `.security`, and passes the user's `acknowledged` decision back into the
 * `sign_typed_data` invoke as `acknowledgedRisk`.
 *
 * These are SECURITY-GATE assertions — the real gate is in the Go backend, but
 * this plumbing is what lets the dialog surface risk and lets the user's
 * informed consent reach the backend. Regressing any of it silently breaks the
 * EIP-712 sign gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the backend security check (tauri-api). Default: high-risk report.
vi.mock('@/services/tauri-api', () => ({
  checkTypedDataSecurity: vi.fn(),
}));

// Mock the Tauri invoke used for the actual sign_typed_data call.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// Mock clear-signing decode (advisory display only — keep it simple/deterministic).
vi.mock('@/services/clearsign/decodeTypedData', () => ({
  decodeTypedData: vi.fn(() => ({ readable: true, title: 'Permit', risks: [] })),
}));

import { signTypedDataHandler } from '@/services/walletconnect/methods/eth-sign-typed-data';
import { checkTypedDataSecurity } from '@/services/tauri-api';
import { invoke } from '@tauri-apps/api/core';
import type { WCRequest, HandlerContext, SignatureResult } from '@/services/walletconnect/request-handler';
import type { SessionTypes } from '@walletconnect/types';

const ADDRESS = '0x1111111111111111111111111111111111111111';

const TYPED_DATA = {
  domain: { name: 'USDC', version: '2', chainId: 1, verifyingContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  message: { owner: ADDRESS, spender: '0x2222222222222222222222222222222222222222', value: '1000000' },
};

function makeRequest(): WCRequest {
  return {
    id: 42,
    topic: 'topic-1',
    params: {
      request: {
        method: 'eth_signTypedData_v4',
        params: [ADDRESS, JSON.stringify(TYPED_DATA)],
      },
      chainId: 'eip155:1',
    },
  };
}

// Minimal session stub — getDappMetadata reads peer.metadata defensively.
const SESSION = {
  peer: { metadata: { name: 'Test dApp', url: 'https://dapp.example', icons: [] } },
} as unknown as SessionTypes.Struct;

function makeContext(overrides: Partial<HandlerContext> = {}): {
  context: HandlerContext;
  requestSignature: ReturnType<typeof vi.fn>;
} {
  const requestSignature = vi.fn(
    async (): Promise<SignatureResult> => ({ approved: true, password: 'pw', acknowledged: true }),
  );
  const context: HandlerContext = {
    address: ADDRESS,
    walletId: 'wallet-1',
    usbPath: '/usb',
    passphrase: '',
    sessionToken: 'token-1',
    isPro: true,
    requestSignature: requestSignature as unknown as HandlerContext['requestSignature'],
    getRpcUrl: () => null,
    ...overrides,
  };
  return { context, requestSignature };
}

describe('eth_signTypedData_v4 security gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkTypedDataSecurity as any).mockResolvedValue({
      proRequired: false,
      warnings: [],
      riskLevel: 'danger',
      requiresAcknowledge: true,
    });
    // sign_typed_data invoke returns a signature payload.
    (invoke as any).mockResolvedValue({ signature: '0xsig', messageHash: '0xhash', signedBy: ADDRESS });
  });

  it('calls checkTypedDataSecurity with the typed-data JSON BEFORE signing', async () => {
    const { context } = makeContext();
    await signTypedDataHandler(makeRequest(), SESSION, context);

    expect(checkTypedDataSecurity).toHaveBeenCalledTimes(1);
    const arg = (checkTypedDataSecurity as any).mock.calls[0][0];
    // It is the EIP-712 JSON string (parses back to the same structure).
    expect(typeof arg).toBe('string');
    expect(JSON.parse(arg)).toMatchObject({ primaryType: 'Permit' });

    // Security check happens before the sign invoke.
    const secOrder = (checkTypedDataSecurity as any).mock.invocationCallOrder[0];
    const signOrder = (invoke as any).mock.invocationCallOrder[0];
    expect(secOrder).toBeLessThan(signOrder);
  });

  it('attaches the SecurityReport to the dialog request (.security)', async () => {
    const { context, requestSignature } = makeContext();
    await signTypedDataHandler(makeRequest(), SESSION, context);

    expect(requestSignature).toHaveBeenCalledTimes(1);
    const dialogReq = requestSignature.mock.calls[0][0];
    expect(dialogReq.security).toBeDefined();
    expect(dialogReq.security.requiresAcknowledge).toBe(true);
    expect(dialogReq.security.riskLevel).toBe('danger');
  });

  it('passes the user acknowledged decision back as acknowledgedRisk', async () => {
    const { context } = makeContext();
    await signTypedDataHandler(makeRequest(), SESSION, context);

    expect(invoke).toHaveBeenCalledWith(
      'sign_typed_data',
      expect.objectContaining({
        input: expect.objectContaining({ acknowledgedRisk: true }),
      }),
    );
  });

  it('defaults acknowledgedRisk to false when the user did not acknowledge', async () => {
    const requestSignature = vi.fn(
      async (): Promise<SignatureResult> => ({ approved: true, password: 'pw' }),
    );
    const { context } = makeContext({
      requestSignature: requestSignature as unknown as HandlerContext['requestSignature'],
    });
    await signTypedDataHandler(makeRequest(), SESSION, context);

    expect(invoke).toHaveBeenCalledWith(
      'sign_typed_data',
      expect.objectContaining({
        input: expect.objectContaining({ acknowledgedRisk: false }),
      }),
    );
  });

  it('does NOT block signing when the security check throws (advisory only)', async () => {
    (checkTypedDataSecurity as any).mockRejectedValue(new Error('backend down'));
    const { context, requestSignature } = makeContext();

    const res = await signTypedDataHandler(makeRequest(), SESSION, context);

    // Dialog still shown (with undefined security), sign still attempted.
    expect(requestSignature).toHaveBeenCalledTimes(1);
    expect(requestSignature.mock.calls[0][0].security).toBeUndefined();
    expect(invoke).toHaveBeenCalledWith('sign_typed_data', expect.anything());
    expect(res.result).toBe('0xsig');
  });
});
