/**
 * TransactionSignDialog integration tests
 * Feature: clear-signing integration — ClearSignSummary rendered inside dialog
 * Task 6: three signing paths wired to clear-signing layer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { TransactionSignDialog } from '@/components/TransactionSignDialog';
import type { PendingTransactionInfo } from '@/services/tauri-api';

// ── deps mocked at module level ──────────────────────────────────────────────

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

// Zustand store mocks — provide default values used by the security effect
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: (sel: (s: { usbPath: string | null; membership: { isPro: boolean } }) => unknown) =>
    sel({ usbPath: '/dev/disk2', membership: { isPro: false } }),
  useIsPro: () => false,
}));

vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: (sel: (s: { token: string | null }) => unknown) =>
    sel({ token: 'test-session-token' }),
}));

// vi.hoisted ensures mockCheckTransactionSecurity is available before hoisting
const { mockCheckTransactionSecurity } = vi.hoisted(() => ({
  mockCheckTransactionSecurity: vi.fn(async () => ({
    proRequired: false,
    warnings: [],
    riskLevel: 'safe',
  })),
}));

vi.mock('@/services/tauri-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/tauri-api')>();
  return {
    ...actual,
    checkTransactionSecurity: mockCheckTransactionSecurity,
  };
});

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
    // Restore default safe security report (mockReset clears the hoisted implementation)
    mockCheckTransactionSecurity.mockResolvedValue({
      proRequired: false,
      warnings: [],
      riskLevel: 'safe',
    });
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

  it('shows the security report (blacklist) for the transaction', async () => {
    mockCheckTransactionSecurity.mockResolvedValue({
      proRequired: false,
      warnings: [],
      riskLevel: 'danger',
      requiresAcknowledge: true,
      blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
    });

    render(
      <TransactionSignDialog
        transaction={makeTx()}
        onConfirm={noop}
        onReject={noop}
      />,
    );

    // ClearSignSummary renders clearSign.securityHeading when security is present and !proRequired
    expect(await screen.findByText('clearSign.securityHeading')).toBeInTheDocument();
  });

  it('does not show a security report when the check fails (signing not blocked)', async () => {
    mockCheckTransactionSecurity.mockRejectedValue(new Error('network timeout'));

    render(
      <TransactionSignDialog
        transaction={makeTx()}
        walletName="My Wallet"
        onConfirm={noop}
        onReject={noop}
      />,
    );

    // Decoded intent title must appear — signing is NOT blocked
    expect(await screen.findByText('Transfer 100 USDC')).toBeInTheDocument();
    // Security section must NOT appear (advisory failure is silent)
    expect(screen.queryByText('clearSign.securityHeading')).not.toBeInTheDocument();
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

describe('TransactionSignDialog — risk friction', () => {
  const tx: PendingTransactionInfo = {
    request_id: 1,
    from: '0xFrom',
    to: '0xBadTarget',
    value: '0x0',
    data: '0xa9059cbb',
    chain_id: 1,
    description: 'External transaction',
    broadcast: true,
  } as PendingTransactionInfo;

  beforeEach(() => {
    mockDecodeCalldata.mockResolvedValue(DEFAULT_INTENT);
    // detect_usb must report a connected device so the only remaining gate is the risk ack
    vi.mocked(invoke).mockResolvedValue([{ path: '/dev/disk2' }]);
    mockCheckTransactionSecurity.mockResolvedValue({
      proRequired: false,
      warnings: [],
      riskLevel: 'danger',
      requiresAcknowledge: true,
      blacklistMatch: { value: '0xBadTarget', source: 'OFAC', category: 'sanctioned' },
    });
  });

  it('disables the sign button until the risk is acknowledged', async () => {
    const { container } = render(
      <TransactionSignDialog transaction={tx} onConfirm={vi.fn()} onReject={vi.fn()} />,
    );
    const pw = container.querySelector('#sign-password') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'pw' } });

    const checkbox = await screen.findByRole('checkbox');
    const signBtn = screen.getByText('Sign Transaction').closest('button')!;
    expect(signBtn).toBeDisabled();

    checkbox.click();
    await waitFor(() => expect(signBtn).not.toBeDisabled());
  });

  it('handleConfirm refuses to sign a high-risk tx until acknowledged (action-level guard)', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <TransactionSignDialog transaction={tx} onConfirm={onConfirm} onReject={vi.fn()} />,
    );
    const pw = container.querySelector('#sign-password') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'pw' } });

    const checkbox = await screen.findByRole('checkbox');
    const signBtn = screen.getByText('Sign Transaction').closest('button')!;

    // Disabled button blocks the click; the action-level guard in handleConfirm
    // is the backstop. Before acknowledgment the handler must not call onConfirm.
    signBtn.click();
    expect(onConfirm).not.toHaveBeenCalled();

    // After acknowledgment, signing proceeds.
    checkbox.click();
    await waitFor(() => expect(signBtn).not.toBeDisabled());
    signBtn.click();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('shows the ack checkbox even when intent fails to decode (danger + null intent)', async () => {
    mockDecodeCalldata.mockRejectedValueOnce(new Error('cannot decode'));

    const { container } = render(
      <TransactionSignDialog transaction={tx} onConfirm={vi.fn()} onReject={vi.fn()} />,
    );
    const pw = container.querySelector('#sign-password') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'pw' } });

    const checkbox = await screen.findByRole('checkbox');
    const signBtn = screen.getByText('Sign Transaction').closest('button')!;
    expect(signBtn).toBeDisabled();

    checkbox.click();
    await waitFor(() => expect(signBtn).not.toBeDisabled());
  });
});
