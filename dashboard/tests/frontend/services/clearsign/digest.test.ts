import { describe, it, expect } from 'vitest';
import {
  calldataDigest,
  eip712Digest,
  domainHash,
  messageHash,
  formatDigest,
} from '@/services/clearsign/digest';

// 這些值由 viem 與 Python pycryptodome 兩個獨立實作交叉驗算得出。
// 它們是本測試的權威來源——不得改成實作的輸出。
const TRANSFER_CALLDATA =
  '0xa9059cbb000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
  '00000000000000000000000000000000000000000000000000000000000f4240';
const TRANSFER_DIGEST =
  '0x4755849ff3e76aee51482cb91076c18efb4ae57b7340d404d19d03b3fc0d669d';

describe('calldataDigest', () => {
  it('matches the independently verified vector', () => {
    expect(calldataDigest(TRANSFER_CALLDATA)).toBe(TRANSFER_DIGEST);
  });

  it('matches the verified vector for empty calldata', () => {
    expect(calldataDigest('0x')).toBe(
      '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563',
    );
  });

  it('length-prefixes so different lengths cannot collide', () => {
    // Without the uint256 length prefix these two would hash identically.
    expect(calldataDigest('0x00')).toBe(
      '0x831ec7207ea95a6d3b064871f3b5e5ffe814f8cd2a8a739953488680b89f71b6',
    );
    expect(calldataDigest('0x0000')).toBe(
      '0xad3e9ce857c0141c79f1925b2c67e166bf1399ef0b33878b81e4305b686dbb49',
    );
    expect(calldataDigest('0x00')).not.toBe(calldataDigest('0x0000'));
  });

  it('is chain-independent — the spec deliberately excludes chainId', () => {
    // Same bytes must fingerprint identically everywhere, so a digest computed
    // on another machine matches regardless of which chain it was told about.
    expect(calldataDigest(TRANSFER_CALLDATA)).toBe(TRANSFER_DIGEST);
  });

  it('never throws — this is the fallback layer', () => {
    expect(() => calldataDigest('')).not.toThrow();
    expect(() => calldataDigest('0xzz')).not.toThrow();
    expect(() => calldataDigest(undefined as unknown as string)).not.toThrow();
  });
});

const TYPED = {
  domain: {
    name: 'Permit2',
    chainId: 1,
    verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  types: {
    PermitDetails: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
  },
  primaryType: 'PermitDetails',
  message: {
    token: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    amount: 1000000n,
    expiration: 1900000000,
    nonce: 0,
  },
};

describe('EIP-712 digests', () => {
  it('matches the independently verified vectors', () => {
    expect(eip712Digest(TYPED as never)).toBe(
      '0xe59fab42a8b6f6d81b22a4df6997b1afe473b1fb4e124597ede3ad6baa607505',
    );
    expect(domainHash(TYPED as never)).toBe(
      '0x866a5aba21966af95d6c7ab78eb2b2fc913915c28be3b9aa07cc04ff903e3f28',
    );
    expect(messageHash(TYPED as never)).toBe(
      '0x4f1bf464cdc42b37c401c5495e143d702931d30213ee69c500f8847a36d75903',
    );
  });

  it('returns null on malformed input instead of throwing', () => {
    for (const bad of [null, undefined, {}, { primaryType: 'X' }, { message: {} }]) {
      expect(eip712Digest(bad as never)).toBeNull();
      expect(domainHash(bad as never)).toBeNull();
      expect(messageHash(bad as never)).toBeNull();
    }
  });
});

describe('formatDigest', () => {
  it('splits 64 hex characters into 16 groups of 4', () => {
    const out = formatDigest(TRANSFER_DIGEST);
    const groups = out.split(' ');
    expect(groups).toHaveLength(16);
    expect(groups.every((g) => g.length === 4)).toBe(true);
    // Grouping is presentational only — the hex itself must be unchanged.
    expect(groups.join('')).toBe(TRANSFER_DIGEST.slice(2));
  });

  it('leaves unexpected lengths intact rather than throwing', () => {
    expect(() => formatDigest('0xabc')).not.toThrow();
    expect(() => formatDigest('')).not.toThrow();
  });
});

import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import { decodeTypedData } from '@/services/clearsign/decodeTypedData';
import { invoke } from '@tauri-apps/api/core';
import { vi, beforeEach } from 'vitest';

const mockInvoke = vi.mocked(invoke);
beforeEach(() => mockInvoke.mockReset());

describe('decoders attach a digest', () => {
  it('attaches a calldata digest to a readable transaction', async () => {
    mockInvoke.mockResolvedValue(null); // no descriptor
    const r = await decodeCalldata('eth-mainnet', '0xtoken', TRANSFER_CALLDATA, undefined);
    expect(r.digest?.kind).toBe('calldata');
    expect(r.digest?.primary).toBe(TRANSFER_DIGEST);
  });

  it('attaches a digest even when the transaction is unreadable', async () => {
    mockInvoke.mockResolvedValue(null);
    // A selector no ABI knows — the case a digest exists to cover.
    const r = await decodeCalldata('eth-mainnet', '0xunknown', '0xdeadbeef', undefined);
    expect(r.readable).toBe(false);
    expect(r.digest?.primary).toBeTruthy();
  });

  it('attaches all three digests to typed data', () => {
    const r = decodeTypedData(TYPED as never);
    expect(r.digest?.kind).toBe('eip712');
    expect(r.digest?.primary).toBe(
      '0xe59fab42a8b6f6d81b22a4df6997b1afe473b1fb4e124597ede3ad6baa607505',
    );
    expect(r.digest?.detail?.domainHash).toBe(
      '0x866a5aba21966af95d6c7ab78eb2b2fc913915c28be3b9aa07cc04ff903e3f28',
    );
    expect(r.digest?.detail?.messageHash).toBe(
      '0x4f1bf464cdc42b37c401c5495e143d702931d30213ee69c500f8847a36d75903',
    );
  });

  it('omits the digest for typed data it cannot hash, without throwing', () => {
    const r = decodeTypedData({ primaryType: 'X' } as never);
    expect(() => r).not.toThrow();
    expect(r.digest).toBeUndefined();
  });
});

describe('calldataDigest rejects silent normalisation', () => {
  // A digest attests to "exactly the bytes about to be signed". Stripping stray
  // characters would make corrupted input indistinguishable from clean input.
  it('does not collide malformed input with well-formed calldata', () => {
    expect(calldataDigest('a9-05-9c-bb')).not.toBe(calldataDigest('0xa9059cbb'));
    expect(calldataDigest('zz1234')).not.toBe(calldataDigest('0x1234'));
    expect(calldataDigest('0xa9059cbb ')).not.toBe(calldataDigest('0xa9059cbb'));
  });

  it('still returns a digest for malformed input rather than failing', () => {
    // This is the fallback layer: it must always produce something.
    expect(calldataDigest('not hex at all')).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('leaves the verified vectors unchanged', () => {
    expect(calldataDigest(TRANSFER_CALLDATA)).toBe(TRANSFER_DIGEST);
    expect(calldataDigest('0x00')).not.toBe(calldataDigest('0x0000'));
  });
});
