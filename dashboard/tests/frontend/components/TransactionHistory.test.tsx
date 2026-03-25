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

import tauriApi from '@/services/tauri-api';
import { useTransactionLabels } from '@/hooks/useTransactionLabels';
import { batchCheckTokens } from '@/utils/tokenWhitelist';

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
      // Component shows "No Transactions Found" as empty state
      expect(screen.getByText('No Transactions Found')).toBeInTheDocument();
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
