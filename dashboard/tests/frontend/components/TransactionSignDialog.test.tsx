/**
 * TransactionSignDialog integration tests
 * Feature: clear-signing integration — ClearSignSummary rendered inside dialog
 * Task 6: three signing paths wired to clear-signing layer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TransactionSignDialog } from '@/components/TransactionSignDialog';
import type { PendingTransactionInfo } from '@/services/tauri-api';

// ── deps mocked at module level ──────────────────────────────────────────────

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

// vi.hoisted ensures the mock fn reference is available before vi.mock hoisting
const { mockDecodeCalldata } = vi.hoisted(() => ({
  mockDecodeCalldata: vi.fn(async () => ({
    readable: true,
    title: 'Transfer 100 USDC',
    params: [{ label: 'To', value: '0xabcd...1234' }],
    risks: [] as string[],
    raw: '0xa9059cbb',
  })),
}));

vi.mock('@/services/clearsign/decodeCalldata', () => ({
  decodeCalldata: mockDecodeCalldata,
}));

// ClearSignSummary renders the title text — use real component so the
// actual render path is exercised. It only needs react-i18next (mocked above).
vi.mock('@/services/clearsign/tokenLabel', () => ({
  resolveTokenLabel: vi.fn(async () => ({ symbol: 'USDC', decimals: 6, known: true })),
}));

// Default resolved intent — re-applied in beforeEach (mockReset: true clears implementations)
const DEFAULT_INTENT = {
  readable: true,
  title: 'Transfer 100 USDC',
  params: [{ label: 'To', value: '0xabcd...1234' }],
  risks: [] as string[],
  raw: '0xa9059cbb',
};

// ── fixtures ─────────────────────────────────────────────────────────────────

const makeTx = (overrides: Partial<PendingTransactionInfo> = {}): PendingTransactionInfo => ({
  request_id: 1,
  from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  to:   '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  data: '0xa9059cbb000000000000000000000000cccc0000000000000000000000000000000000000000000000000000000000000064',
  value: '0x0',
  chain_id: 1,
  description: 'ERC-20 transfer',
  broadcast: false,
  ...overrides,
});

const noop = async () => {};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('TransactionSignDialog — clear-signing integration', () => {
  beforeEach(() => {
    // mockReset: true in vitest.config clears implementations — restore defaults here
    mockDecodeCalldata.mockResolvedValue(DEFAULT_INTENT);
  });

  it('renders nothing when transaction is null', () => {
    const { container } = render(
      <TransactionSignDialog
        transaction={null}
        onConfirm={noop}
        onReject={noop}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows decoded title from ClearSignSummary when intent resolves', async () => {
    render(
      <TransactionSignDialog
        transaction={makeTx()}
        walletName="My Wallet"
        onConfirm={noop}
        onReject={noop}
      />,
    );

    // Dialog heading always visible immediately
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Transaction')).toBeInTheDocument();

    // decodeCalldata is async — title appears after the effect resolves
    expect(await screen.findByText('Transfer 100 USDC')).toBeInTheDocument();
  });

  it('shows the To address in the dialog detail rows', async () => {
    render(
      <TransactionSignDialog
        transaction={makeTx()}
        onConfirm={noop}
        onReject={noop}
      />,
    );
    // Shortened address 0xbbbb...bbbb
    // Use waitFor so the async effect settles cleanly inside act
    await waitFor(() => expect(screen.getByText(/0xbbbb/)).toBeInTheDocument());
  });

  it('does not render ClearSignSummary when decodeCalldata rejects', async () => {
    mockDecodeCalldata.mockRejectedValue(new Error('network err'));

    render(
      <TransactionSignDialog
        transaction={makeTx()}
        onConfirm={noop}
        onReject={noop}
      />,
    );

    // Heading always present
    expect(screen.getByText('Confirm Transaction')).toBeInTheDocument();
    // summary title must NOT appear — give React a tick to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Transfer 100 USDC')).not.toBeInTheDocument();
  });
});
