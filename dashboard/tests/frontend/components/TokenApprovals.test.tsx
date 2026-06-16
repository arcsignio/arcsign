import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokenApprovals } from '@/components/TokenApprovals';

// Mock hooks
vi.mock('@/hooks/useTokenApprovals', () => ({
  useTokenApprovals: vi.fn(),
}));

vi.mock('@/hooks/useMembership', () => ({
  useMembership: vi.fn(),
}));

vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

vi.mock('@/constants/contracts', () => ({
  APPROVE_SELECTOR: '0x095ea7b3',
  ACTIVE_NETWORK: { nftContract: '0xnft' },
}));

vi.mock('@/services/tauri-api', () => ({
  default: {
    buildTransaction: vi.fn(),
    signTransaction: vi.fn(),
    broadcastTransaction: vi.fn(),
  },
}));

import { useTokenApprovals } from '@/hooks/useTokenApprovals';
import { useMembership } from '@/hooks/useMembership';
import tauriApi from '@/services/tauri-api';

const defaultProps = {
  walletId: 'w1',
  password: 'pw',
  usbPath: '/dev/usb0',
  sessionToken: 'token',
  bscAddress: '0xbsc',
};

// Mock data matching ApprovalEntry type exactly
const mockApprovals = [
  {
    network: 'eth-mainnet',
    networkLabel: 'Ethereum',
    tokenAddress: '0xtoken1',
    tokenSymbol: 'USDC',
    tokenName: 'USD Coin',
    spender: '0xspender1abcdef1234567890',
    allowance: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
    isUnlimited: true,
    ownerAddress: '0xuser',
  },
  {
    network: 'polygon-mainnet',
    networkLabel: 'Polygon',
    tokenAddress: '0xtoken2',
    tokenSymbol: 'DAI',
    tokenName: 'Dai Stablecoin',
    spender: '0xspender2abcdef1234567890',
    allowance: '1000000000000000000000',
    isUnlimited: false,
    ownerAddress: '0xuser',
  },
];

function setupMocks(overrides?: {
  approvals?: any[];
  isLoading?: boolean;
  error?: string | null;
  isPro?: boolean;
}) {
  const refreshFn = vi.fn();
  (useTokenApprovals as any).mockReturnValue({
    approvals: overrides?.approvals ?? [],
    isLoading: overrides?.isLoading ?? false,
    error: overrides?.error ?? null,
    refresh: refreshFn,
  });
  (useMembership as any).mockReturnValue({
    status: overrides?.isPro ? { isPro: true, nftCount: 1 } : null,
    isLoading: false,
    error: null,
    isPro: overrides?.isPro ?? false,
    walletLimit: overrides?.isPro ? 10 : 1,
  });
  (tauriApi.buildTransaction as any).mockImplementation(() =>
    Promise.resolve('unsigned-tx-hex')
  );
  (tauriApi.signTransaction as any).mockImplementation(() =>
    Promise.resolve('signed-tx-hex')
  );
  (tauriApi.broadcastTransaction as any).mockImplementation(() =>
    Promise.resolve({ txHash: '0xabc' })
  );
  return { refreshFn };
}

describe('TokenApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('shows loading state', () => {
    setupMocks({ isLoading: true });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows empty state when no approvals', () => {
    setupMocks();
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('tokenApprovals.empty')).toBeInTheDocument();
  });

  it('shows error state', () => {
    setupMocks({ error: 'Failed to fetch' });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText(/Failed to fetch/)).toBeInTheDocument();
  });

  it('displays approvals list', () => {
    setupMocks({ approvals: mockApprovals });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('DAI')).toBeInTheDocument();
    // Unlimited renders via t() so it's the i18n key
    expect(screen.getByText('tokenApprovals.unlimited')).toBeInTheDocument();
  });

  it('shows network badges', () => {
    setupMocks({ approvals: mockApprovals });
    render(<TokenApprovals {...defaultProps} />);
    // Network labels appear in both filter chips and approval cards
    expect(screen.getAllByText('Ethereum').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Polygon').length).toBeGreaterThanOrEqual(1);
  });

  it('has revoke buttons for each approval', () => {
    setupMocks({ approvals: mockApprovals });
    render(<TokenApprovals {...defaultProps} />);
    const revokeButtons = screen.getAllByText('tokenApprovals.revoke');
    expect(revokeButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Pro selectAll button for Pro users', () => {
    setupMocks({ approvals: mockApprovals, isPro: true });
    render(<TokenApprovals {...defaultProps} />);
    // Pro users see checkboxes and selectAll button
    expect(screen.getByText('tokenApprovals.selectAll')).toBeInTheDocument();
  });

  it('shows approval count', () => {
    setupMocks({ approvals: mockApprovals });
    render(<TokenApprovals {...defaultProps} />);
    // Summary bar shows "2 tokenApprovals.activeApprovals"
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  // --- Retry handler ---

  it('calls refresh when retry button is clicked in error state', async () => {
    const user = userEvent.setup();
    const { refreshFn } = setupMocks({ error: 'Connection failed' });

    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText(/Connection failed/)).toBeInTheDocument();

    await user.click(screen.getByText('tokenApprovals.retry'));
    expect(refreshFn).toHaveBeenCalled();
  });

  // --- Refresh button in summary bar ---

  it('calls refresh when refresh button is clicked in summary bar', async () => {
    const user = userEvent.setup();
    const { refreshFn } = setupMocks({ approvals: mockApprovals });

    render(<TokenApprovals {...defaultProps} />);
    await user.click(screen.getByText('tokenApprovals.refresh'));
    // refresh is called on mount + on click
    expect(refreshFn).toHaveBeenCalled();
  });

  // --- Network filter ---

  it('filters approvals by network when a network chip is clicked', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals });

    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('DAI')).toBeInTheDocument();

    // Click Ethereum filter — find the filter button (not the badge in the card)
    const ethTexts = screen.getAllByText('Ethereum');
    const ethFilterBtn = ethTexts.find((el) => el.tagName === 'BUTTON' || el.closest('button')?.textContent === 'Ethereum');
    await user.click(ethFilterBtn!.closest('button') || ethFilterBtn!);

    // Only USDC (Ethereum) should remain
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.queryByText('DAI')).not.toBeInTheDocument();
  });

  it('shows all approvals when "All Networks" chip is clicked after filtering', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals });

    render(<TokenApprovals {...defaultProps} />);

    // Filter to Ethereum
    const ethTexts = screen.getAllByText('Ethereum');
    const ethFilterBtn = ethTexts.find((el) => el.tagName === 'BUTTON' || el.closest('button')?.textContent === 'Ethereum');
    await user.click(ethFilterBtn!.closest('button') || ethFilterBtn!);
    expect(screen.queryByText('DAI')).not.toBeInTheDocument();

    // Click All Networks to reset
    await user.click(screen.getByText('tokenApprovals.allNetworks'));
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('DAI')).toBeInTheDocument();
  });

  // --- Checkbox toggle (Pro only) ---

  it('toggles checkbox selection for Pro users', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals, isPro: true });

    render(<TokenApprovals {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    // Initially unchecked
    expect(checkboxes[0]).not.toBeChecked();

    // Check first
    await user.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();

    // Uncheck first
    await user.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  // --- Select All / Deselect All ---

  it('selects all approvals when selectAll is clicked', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals, isPro: true });

    render(<TokenApprovals {...defaultProps} />);
    await user.click(screen.getByText('tokenApprovals.selectAll'));

    // All checkboxes should be checked
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).toBeChecked());

    // Button text should now be "deselectAll"
    expect(screen.getByText('tokenApprovals.deselectAll')).toBeInTheDocument();
  });

  it('deselects all approvals when deselectAll is clicked', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals, isPro: true });

    render(<TokenApprovals {...defaultProps} />);

    // Select all first
    await user.click(screen.getByText('tokenApprovals.selectAll'));
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).toBeChecked());

    // Deselect all
    await user.click(screen.getByText('tokenApprovals.deselectAll'));
    checkboxes.forEach((cb) => expect(cb).not.toBeChecked());
  });

  // --- Single revoke ---

  it('calls build/sign/broadcast when revoke button is clicked', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { refreshFn } = setupMocks({ approvals: mockApprovals });

    render(<TokenApprovals {...defaultProps} />);
    const revokeButtons = screen.getAllByText('tokenApprovals.revoke');

    await user.click(revokeButtons[0]);

    await waitFor(() => {
      expect(tauriApi.buildTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 'ethereum',
          to: '0xtoken1',
          amount: '0',
        })
      );
      expect(tauriApi.signTransaction).toHaveBeenCalled();
      expect(tauriApi.broadcastTransaction).toHaveBeenCalled();
    });

    // Success message displayed
    await waitFor(() => {
      expect(screen.getByText('tokenApprovals.revokeSuccess')).toBeInTheDocument();
    });

    // Refresh called after delay
    vi.advanceTimersByTime(2500);
    expect(refreshFn).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows error message when single revoke fails', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals });
    (tauriApi.buildTransaction as any).mockImplementation(() =>
      Promise.reject(new Error('Build failed'))
    );

    render(<TokenApprovals {...defaultProps} />);
    const revokeButtons = screen.getAllByText('tokenApprovals.revoke');
    await user.click(revokeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Build failed')).toBeInTheDocument();
    });
  });

  // --- Batch revoke (Pro) ---

  it('performs batch revoke for selected approvals', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { refreshFn } = setupMocks({ approvals: mockApprovals, isPro: true });

    render(<TokenApprovals {...defaultProps} />);

    // Select all
    await user.click(screen.getByText('tokenApprovals.selectAll'));

    // Click batch revoke button
    const batchBtn = screen.getByText(/tokenApprovals.batchRevoke/);
    await user.click(batchBtn);

    await waitFor(() => {
      // Should have called build/sign/broadcast for each approval
      expect(tauriApi.buildTransaction).toHaveBeenCalledTimes(2);
      expect(tauriApi.signTransaction).toHaveBeenCalledTimes(2);
      expect(tauriApi.broadcastTransaction).toHaveBeenCalledTimes(2);
    });

    // Success result message
    await waitFor(() => {
      expect(screen.getByText(/2 tokenApprovals.success/)).toBeInTheDocument();
    });

    vi.advanceTimersByTime(2500);
    expect(refreshFn).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('batch revoke does nothing if not Pro', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals, isPro: false });

    render(<TokenApprovals {...defaultProps} />);
    // No select all button for non-pro users
    expect(screen.queryByText('tokenApprovals.selectAll')).not.toBeInTheDocument();
    // PRO badge/banner shown instead
    expect(screen.getByText('tokenApprovals.batchRevokeProOnly')).toBeInTheDocument();
  });

  it('shows mixed success/failure result in batch revoke', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupMocks({ approvals: mockApprovals, isPro: true });

    // First call succeeds, second fails
    let buildCallCount = 0;
    (tauriApi.buildTransaction as any).mockImplementation(() => {
      buildCallCount++;
      if (buildCallCount === 2) {
        return Promise.reject(new Error('Tx failed'));
      }
      return Promise.resolve('unsigned-tx-hex');
    });

    render(<TokenApprovals {...defaultProps} />);
    await user.click(screen.getByText('tokenApprovals.selectAll'));
    await user.click(screen.getByText(/tokenApprovals.batchRevoke/));

    await waitFor(() => {
      expect(screen.getByText(/1 tokenApprovals.success, 1 tokenApprovals.failed/)).toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  // --- PRO badge for batch feature for non-Pro ---

  it('shows PRO badge banner when non-Pro user has multiple approvals', () => {
    setupMocks({ approvals: mockApprovals, isPro: false });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('tokenApprovals.batchRevokeProOnly')).toBeInTheDocument();
  });

  // --- No checkboxes for non-Pro ---

  it('does not show checkboxes for non-Pro users', () => {
    setupMocks({ approvals: mockApprovals, isPro: false });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // --- Batch revoke button shows selected count ---

  it('shows batch revoke button with count after selecting items', async () => {
    const user = userEvent.setup();
    setupMocks({ approvals: mockApprovals, isPro: true });

    render(<TokenApprovals {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    // Batch revoke button should appear with count (1)
    expect(screen.getByText(/tokenApprovals.batchRevoke.*1/)).toBeInTheDocument();
  });

  // --- Single revoke with unsupported network ---

  it('shows error for unsupported network on single revoke', async () => {
    const user = userEvent.setup();
    const badNetworkApproval = [{
      ...mockApprovals[0],
      network: 'unknown-chain',
      networkLabel: 'Unknown',
    }];
    setupMocks({ approvals: badNetworkApproval });

    render(<TokenApprovals {...defaultProps} />);
    const revokeBtn = screen.getByText('tokenApprovals.revoke');
    await user.click(revokeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Unsupported network/)).toBeInTheDocument();
    });
  });

  // ── Risk enrichment ───────────────────────────────────────────────────────
  it('shows the protocol name for a known spender', () => {
    setupMocks({
      approvals: [{
        ...mockApprovals[0],
        spenderName: 'Uniswap: Universal Router',
        spenderType: 'known:dex',
        riskLevel: 'yellow',
      }],
    });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('Uniswap: Universal Router')).toBeInTheDocument();
  });

  it('falls back to a truncated address for an unknown spender', () => {
    setupMocks({
      approvals: [{
        ...mockApprovals[0],
        spender: '0x000000000000000000000000000000000000beef',
        spenderName: '',
        riskLevel: 'red',
      }],
    });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('0x0000...beef')).toBeInTheDocument();
  });

  it('renders a risk badge per approval', () => {
    setupMocks({
      approvals: [{ ...mockApprovals[0], riskLevel: 'red' }],
    });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('tokenApprovals.risk.red')).toBeInTheDocument();
  });

  it('shows a strong warning for a malicious spender', () => {
    setupMocks({
      approvals: [{ ...mockApprovals[0], isMalicious: true, riskLevel: 'red' }],
    });
    render(<TokenApprovals {...defaultProps} />);
    expect(screen.getByText('tokenApprovals.maliciousWarning')).toBeInTheDocument();
  });

  it('sorts approvals most-dangerous-first (red before green)', () => {
    setupMocks({
      approvals: [
        { ...mockApprovals[0], tokenSymbol: 'GREENTOK', riskLevel: 'green' },
        { ...mockApprovals[1], tokenSymbol: 'REDTOK', riskLevel: 'red' },
      ],
    });
    render(<TokenApprovals {...defaultProps} />);
    const red = screen.getByText('REDTOK');
    const green = screen.getByText('GREENTOK');
    // Red must appear before green in document order.
    expect(red.compareDocumentPosition(green) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
