/**
 * WalletSelector component tests
 * Feature: User Dashboard for Wallet Management
 * Tests: wallet list rendering, selection, rename, empty state, limit warning
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletSelector } from '@/components/WalletSelector';
import type { Wallet } from '@/types/wallet';

// Mock tauri-api (default export)
vi.mock('@/services/tauri-api', () => ({
  default: {
    renameWallet: vi.fn(),
  },
}));

// Mock dashboardStore
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(),
}));

import tauriApi from '@/services/tauri-api';
import { useDashboardStore } from '@/stores/dashboardStore';

const mockUpdateWallet = vi.fn();

const mockWallets: Wallet[] = [
  {
    id: 'a'.repeat(64),
    name: 'Main Wallet',
    created_at: '2025-10-17T12:00:00Z',
    updated_at: '2025-10-17T12:00:00Z',
    has_passphrase: false,
    address_count: 54,
  },
  {
    id: 'b'.repeat(64),
    name: 'Savings Wallet',
    created_at: '2025-10-16T10:00:00Z',
    updated_at: '2025-10-16T10:00:00Z',
    has_passphrase: true,
    address_count: 54,
  },
  {
    id: 'c'.repeat(64),
    name: 'Trading Wallet',
    created_at: '2025-10-15T08:00:00Z',
    updated_at: '2025-10-15T08:00:00Z',
    has_passphrase: false,
    address_count: 54,
  },
];

describe('WalletSelector Component', () => {
  const onSelect = vi.fn();
  const onRename = vi.fn();
  const usbPath = '/dev/usb0';

  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      updateWallet: mockUpdateWallet,
    });
  });

  it('renders empty state when no wallets provided', () => {
    render(
      <WalletSelector wallets={[]} usbPath={usbPath} onSelect={onSelect} />
    );

    expect(screen.getByText('wallet.noWalletsFound')).toBeInTheDocument();
    expect(screen.getByText('wallet.createOrImportToStart')).toBeInTheDocument();
  });

  it('renders all wallet cards', () => {
    render(
      <WalletSelector wallets={mockWallets} usbPath={usbPath} onSelect={onSelect} />
    );

    expect(screen.getByText('Main Wallet')).toBeInTheDocument();
    expect(screen.getByText('Savings Wallet')).toBeInTheDocument();
    expect(screen.getByText('Trading Wallet')).toBeInTheDocument();
  });

  it('displays wallet metadata (created date, address count)', () => {
    render(
      <WalletSelector wallets={mockWallets} usbPath={usbPath} onSelect={onSelect} />
    );

    // Each wallet card should show created date and address count
    const cards = screen.getAllByTestId('wallet-card');
    expect(cards).toHaveLength(3);

    // Address count
    const addressLabels = screen.getAllByText('wallet.addresses:');
    expect(addressLabels).toHaveLength(3);
  });

  it('shows passphrase indicator for wallets with passphrase', () => {
    render(
      <WalletSelector wallets={mockWallets} usbPath={usbPath} onSelect={onSelect} />
    );

    // Only "Savings Wallet" has has_passphrase: true
    const passphraseIndicators = screen.getAllByText('wallet.protectedWithPassphrase');
    expect(passphraseIndicators).toHaveLength(1);
  });

  it('calls onSelect when a wallet card is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WalletSelector wallets={mockWallets} usbPath={usbPath} onSelect={onSelect} />
    );

    const cards = screen.getAllByTestId('wallet-card');
    await user.click(cards[0]);

    expect(onSelect).toHaveBeenCalledWith('a'.repeat(64));
  });

  it('highlights the selected wallet card', () => {
    render(
      <WalletSelector
        wallets={mockWallets}
        selectedWalletId={'a'.repeat(64)}
        usbPath={usbPath}
        onSelect={onSelect}
      />
    );

    const cards = screen.getAllByTestId('wallet-card');
    expect(cards[0].className).toContain('selected');
    expect(cards[1].className).not.toContain('selected');
  });

  it('shows rename input when rename button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WalletSelector
        wallets={mockWallets}
        usbPath={usbPath}
        onSelect={onSelect}
        onRename={onRename}
      />
    );

    // Click the rename button (aria-label)
    const renameButtons = screen.getAllByLabelText('wallet.rename');
    await user.click(renameButtons[0]);

    // Rename input should appear with the current name
    const input = screen.getByDisplayValue('Main Wallet');
    expect(input).toBeInTheDocument();
  });

  it('submits rename on Enter key', async () => {
    const user = userEvent.setup();
    (tauriApi.renameWallet as any).mockImplementation(() =>
      Promise.resolve({
        name: 'New Name',
        updated_at: '2025-10-18T12:00:00Z',
      })
    );

    render(
      <WalletSelector
        wallets={mockWallets}
        usbPath={usbPath}
        onSelect={onSelect}
        onRename={onRename}
      />
    );

    // Click rename button for first wallet
    const renameButtons = screen.getAllByLabelText('wallet.rename');
    await user.click(renameButtons[0]);

    // Clear the input and type new name
    const input = screen.getByDisplayValue('Main Wallet');
    await user.clear(input);
    await user.type(input, 'New Name{Enter}');

    await waitFor(() => {
      expect(tauriApi.renameWallet).toHaveBeenCalledWith({
        wallet_id: 'a'.repeat(64),
        new_name: 'New Name',
        usb_path: '/dev/usb0',
      });
    });
  });

  it('cancels rename on Escape key', async () => {
    const user = userEvent.setup();
    render(
      <WalletSelector
        wallets={mockWallets}
        usbPath={usbPath}
        onSelect={onSelect}
        onRename={onRename}
      />
    );

    const renameButtons = screen.getAllByLabelText('wallet.rename');
    await user.click(renameButtons[0]);

    const input = screen.getByDisplayValue('Main Wallet');
    await user.type(input, '{Escape}');

    // Input should be gone, wallet name should be back
    expect(screen.queryByDisplayValue('Main Wallet')).not.toBeInTheDocument();
    expect(screen.getByText('Main Wallet')).toBeInTheDocument();
  });

  it('shows wallet limit warning when approaching limit (9 wallets)', () => {
    const nineWallets: Wallet[] = Array.from({ length: 9 }, (_, i) => ({
      id: String(i).repeat(64),
      name: `Wallet ${i + 1}`,
      created_at: '2025-10-17T12:00:00Z',
      updated_at: '2025-10-17T12:00:00Z',
      has_passphrase: false,
      address_count: 54,
    }));

    render(
      <WalletSelector wallets={nineWallets} usbPath={usbPath} onSelect={onSelect} />
    );

    expect(screen.getByText('wallet.approachingLimit')).toBeInTheDocument();
  });

  it('shows max limit reached warning when 10 wallets', () => {
    const tenWallets: Wallet[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i).repeat(64),
      name: `Wallet ${i + 1}`,
      created_at: '2025-10-17T12:00:00Z',
      updated_at: '2025-10-17T12:00:00Z',
      has_passphrase: false,
      address_count: 54,
    }));

    render(
      <WalletSelector wallets={tenWallets} usbPath={usbPath} onSelect={onSelect} />
    );

    expect(screen.getByText('wallet.maxLimitReached')).toBeInTheDocument();
  });

  it('displays truncated wallet ID', () => {
    render(
      <WalletSelector wallets={[mockWallets[0]]} usbPath={usbPath} onSelect={onSelect} />
    );

    // Wallet ID is displayed truncated (first 16 chars + "...")
    const expectedTruncated = 'a'.repeat(16);
    expect(screen.getByText(`ID: ${expectedTruncated}...`)).toBeInTheDocument();
  });
});
