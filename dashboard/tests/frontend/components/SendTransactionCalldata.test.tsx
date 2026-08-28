import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSignReview } from '@/hooks/useSignReview';
import * as api from '@/services/tauri-api';
import { invoke } from '@tauri-apps/api/core';
import { encodeFunctionData, erc20Abi } from 'viem';

const mockInvoke = vi.mocked(invoke);
beforeEach(() => { mockInvoke.mockReset(); vi.restoreAllMocks(); });

/**
 * Guards the defect where SendTransaction passed `data: ""` regardless of the
 * transaction: an ERC-20 transfer then decoded as a native send and its digest
 * covered empty calldata instead of the bytes actually being signed.
 */
describe('a token transfer reviews its real calldata', () => {
  it('decodes as a transfer and digests the real bytes, not an empty payload', async () => {
    vi.spyOn(api, 'checkTransactionSecurity').mockResolvedValue({
      requiresAcknowledge: false, riskLevel: 'safe', warnings: [],
    } as never);
    mockInvoke.mockResolvedValue(null);

    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: ['0xc998eb0000000000000000000000000000a35530', 10000000000000000000n],
    });

    const { result } = renderHook(() =>
      useSignReview({
        from: '0x2e26cbD533Ac3E98d3B650c7f89406EbB6f2f634',
        to: '0x55d398326f99059fF775485246999027B3197955', // USDT contract
        chainId: '56', value: '0', data: transferData,
        usbPath: '/Volumes/arcsign', sessionToken: 'tok',
      }),
    );

    await waitFor(() => expect(result.current.intent).toBeDefined());

    // The empty-calldata digest — what the screen wrongly showed before.
    const EMPTY_DIGEST =
      '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563';
    expect(result.current.intent?.digest?.primary).not.toBe(EMPTY_DIGEST);
    // And it must read as a token transfer, not a native send.
    expect(result.current.intent?.title).not.toMatch(/native/i);
  });
});
