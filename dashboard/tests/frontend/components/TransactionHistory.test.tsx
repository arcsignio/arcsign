import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock tauriApi - must be before component import
vi.mock('@/services/tauri-api', () => ({
  default: {
    getAssetTransfers: vi.fn(),
  },
}));

// Mock useTransactionLabels hook
vi.mock('@/hooks/useTransactionLabels', () => ({
  useTransactionLabels: vi.fn(),
}));

// Mock TransactionLabelModal
vi.mock('@/components/TransactionLabelModal', () => ({
  TransactionLabelModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="label-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

// Mock tokenWhitelist
vi.mock('@/utils/tokenWhitelist', () => ({
  batchCheckTokens: vi.fn(),
}));

// Mock useHasProviderKey hook
vi.mock('@/hooks/useHasProviderKey', () => ({
  useHasProviderKey: vi.fn(),
}));

import tauriApi from '@/services/tauri-api';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { batchCheckTokens } from '@/utils/tokenWhitelist';
import { useHasProviderKey } from '@/hooks/useHasProviderKey';

// Import the component AFTER mocks
import { TransactionHistory } from '@/components/TransactionHistory';

const defaultProps = {
  address: '0xuser123',
  usbPath: '/dev/usb0',
  sessionToken: 'token',
  onBack: vi.fn(),
};

const mockTransfers = {
  transfers: [
    {
      hash: '0xtx1',
      from: '0xuser123',
      to: '0xrecipient',
      value: 1.5,
      asset: 'ETH',
      category: 'external',
      blockNumber: '1000',
      blockTimestamp: '2026-01-15T10:00:00Z',
    },
    {
      hash: '0xtx2',
      from: '0xsender',
      to: '0xuser123',
      value: 100,
      asset: 'USDC',
      category: 'erc20',
      blockNumber: '1001',
      blockTimestamp: '2026-01-16T12:00:00Z',
    },
  ],
};

describe('TransactionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tauriApi.getAssetTransfers as any).mockResolvedValue({ transfers: [] });
    (useTransactionLabels as any).mockReturnValue({
      labels: [],
      labelsMap: new Map(),
      isLoading: false,
      error: null,
      loadLabels: vi.fn(),
      setLabel: vi.fn().mockResolvedValue(true),
      deleteLabel: vi.fn().mockResolvedValue(true),
      getLabelForTx: vi.fn().mockReturnValue(undefined),
    });
    (batchCheckTokens as any).mockResolvedValue(new Map());
    // Default: key present, not loading
    (useHasProviderKey as any).mockReturnValue({
      hasAlchemyKey: true,
      hasNodeRealKey: true,
      isLoading: false,
    });
  });

  it('renders title and back button', () => {
    render(<TransactionHistory {...defaultProps} />);
    // Component uses hardcoded English strings
    expect(screen.getByText(/Back/)).toBeInTheDocument();
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const user = userEvent.setup();
    render(<TransactionHistory {...defaultProps} />);
    await user.click(screen.getByText(/Back/));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('fetches transfers', async () => {
    render(<TransactionHistory {...defaultProps} />);
    await waitFor(() => {
      expect(tauriApi.getAssetTransfers).toHaveBeenCalled();
    });
  });

  it('shows empty state when no transfers', async () => {
    render(<TransactionHistory {...defaultProps} />);
    await waitFor(() => {
      // After i18n: t() returns the key itself in test env
      expect(screen.getByText('transactionHistory.emptyTitle')).toBeInTheDocument();
    });
  });

  it('displays transfers after loading', async () => {
    (tauriApi.getAssetTransfers as any).mockImplementation(
      (params: { network: string }) => {
        if (params.network === 'eth-mainnet') {
          return Promise.resolve(mockTransfers);
        }
        return Promise.resolve({ transfers: [] });
      }
    );

    render(<TransactionHistory {...defaultProps} />);
    await waitFor(() => {
      // Should show the transfer value with asset
      expect(screen.getByText(/1.5000/)).toBeInTheDocument();
    });
  });
});

describe('TransactionHistory empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (tauriApi.getAssetTransfers as any).mockResolvedValue({ transfers: [] });
    (useTransactionLabels as any).mockReturnValue({
      labels: [],
      labelsMap: new Map(),
      isLoading: false,
      error: null,
      loadLabels: vi.fn(),
      setLabel: vi.fn().mockResolvedValue(true),
      deleteLabel: vi.fn().mockResolvedValue(true),
      getLabelForTx: vi.fn().mockReturnValue(undefined),
    });
    (batchCheckTokens as any).mockResolvedValue(new Map());
  });

  it('shows need-key prompt when no Alchemy key and empty', async () => {
    (useHasProviderKey as any).mockReturnValue({
      hasAlchemyKey: false,
      hasNodeRealKey: false,
      isLoading: false,
    });
    render(<TransactionHistory {...defaultProps} />);
    expect(
      await screen.findByText('transactionHistory.needKeyTitle')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('transactionHistory.emptyTitle')
    ).not.toBeInTheDocument();
  });

  it('shows normal empty state when key present and empty', async () => {
    (useHasProviderKey as any).mockReturnValue({
      hasAlchemyKey: true,
      hasNodeRealKey: true,
      isLoading: false,
    });
    render(<TransactionHistory {...defaultProps} />);
    expect(
      await screen.findByText('transactionHistory.emptyTitle')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('transactionHistory.needKeyTitle')
    ).not.toBeInTheDocument();
  });

  it('does not flash empty/need-key text while key status is loading', async () => {
    (useHasProviderKey as any).mockReturnValue({
      hasAlchemyKey: false,
      hasNodeRealKey: false,
      isLoading: true,
    });
    render(<TransactionHistory {...defaultProps} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(
      screen.queryByText('transactionHistory.needKeyTitle')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('transactionHistory.emptyTitle')
    ).not.toBeInTheDocument();
  });
});
