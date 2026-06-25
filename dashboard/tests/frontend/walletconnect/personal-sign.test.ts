/**
 * personal_sign handler — security gate wiring.
 *
 * Mirrors the eth_sendTransaction / eth_signTypedData_v4 handlers: BEFORE
 * showing the sign dialog the handler calls the backend security check
 * (`checkMessageSecurity`), attaches the returned SecurityReport to the
 * `requestSignature` dialog request as `.security`, and passes the user's
 * `acknowledged` decision back into the `sign_message` invoke as
 * `acknowledgedRisk`.
 *
 * These are SECURITY-GATE assertions — the real gate is in the Go backend, but
 * this plumbing is what lets the dialog surface risk and lets the user's
 * informed consent reach the backend. Regressing any of it silently breaks the
 * personal_sign gate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the backend security check (tauri-api). Default: high-risk report.
vi.mock('@/services/tauri-api', () => ({
  checkMessageSecurity: vi.fn(),
}));

// Mock the Tauri invoke used for the actual sign_message call.
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { personalSignHandler } from '@/services/walletconnect/methods/personal-sign';
import { checkMessageSecurity } from '@/services/tauri-api';
import { invoke } from '@tauri-apps/api/core';
import type { WCRequest, HandlerContext, SignatureResult } from '@/services/walletconnect/request-handler';
import type { SessionTypes } from '@walletconnect/types';

const ADDRESS = '0x1111111111111111111111111111111111111111';
// "Sign in to dApp" as 0x-hex (WC personal_sign passes the message in hex).
const RAW_MESSAGE = '0x5369676e20696e20746f206441707000';

function makeRequest(): WCRequest {
  return {
    id: 42,
    topic: 'topic-1',
    params: {
      request: {
        method: 'personal_sign',
        params: [RAW_MESSAGE, ADDRESS],
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

describe('personal_sign security gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkMessageSecurity as any).mockResolvedValue({
      proRequired: false,
      warnings: [],
      riskLevel: 'danger',
      requiresAcknowledge: true,
    });
    // sign_message invoke returns a signature payload.
    (invoke as any).mockResolvedValue({ signature: '0xsig', messageHash: '0xhash', signedBy: ADDRESS });
  });

  it('calls checkMessageSecurity with the message BEFORE signing', async () => {
    const { context } = makeContext();
    await personalSignHandler(makeRequest(), SESSION, context);

    expect(checkMessageSecurity).toHaveBeenCalledTimes(1);
    const arg = (checkMessageSecurity as any).mock.calls[0][0];
    expect(typeof arg).toBe('string');
    // Same string passed to sign_message's `message` field.
    expect(arg).toBe(RAW_MESSAGE);

    // Security check happens before the sign invoke.
    const secOrder = (checkMessageSecurity as any).mock.invocationCallOrder[0];
    const signOrder = (invoke as any).mock.invocationCallOrder[0];
    expect(secOrder).toBeLessThan(signOrder);
  });

  it('attaches the SecurityReport to the dialog request (.security)', async () => {
    const { context, requestSignature } = makeContext();
    await personalSignHandler(makeRequest(), SESSION, context);

    expect(requestSignature).toHaveBeenCalledTimes(1);
    const dialogReq = requestSignature.mock.calls[0][0];
    expect(dialogReq.security).toBeDefined();
    expect(dialogReq.security.requiresAcknowledge).toBe(true);
    expect(dialogReq.security.riskLevel).toBe('danger');
  });

  it('passes the user acknowledged decision back as acknowledgedRisk', async () => {
    const { context } = makeContext();
    await personalSignHandler(makeRequest(), SESSION, context);

    expect(invoke).toHaveBeenCalledWith(
      'sign_message',
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
    await personalSignHandler(makeRequest(), SESSION, context);

    expect(invoke).toHaveBeenCalledWith(
      'sign_message',
      expect.objectContaining({
        input: expect.objectContaining({ acknowledgedRisk: false }),
      }),
    );
  });

  it('does NOT block signing when the security check throws (advisory only)', async () => {
    (checkMessageSecurity as any).mockRejectedValue(new Error('backend down'));
    const { context, requestSignature } = makeContext();

    const res = await personalSignHandler(makeRequest(), SESSION, context);

    // Dialog still shown (with undefined security), sign still attempted.
    expect(requestSignature).toHaveBeenCalledTimes(1);
    expect(requestSignature.mock.calls[0][0].security).toBeUndefined();
    expect(invoke).toHaveBeenCalledWith('sign_message', expect.anything());
    expect(res.result).toBe('0xsig');
  });
});
