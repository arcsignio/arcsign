/**
 * Wallet creation flow integration-style test
 * Feature: User Dashboard for Wallet Management
 * Tests the end-to-end wallet creation flow from form to mnemonic display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletCreate } from '@/components/WalletCreate';

// Mock tauri-api (default export)
vi.mock('@/services/tauri-api', () => ({
  default: {
    detectUsb: vi.fn(),
    getDeviceMembershipStatusWithToken: vi.fn(),
    enableScreenshotProtection: vi.fn(),
    disableScreenshotProtection: vi.fn(),
    clearSensitiveMemory: vi.fn(),
  },
}));

// Mock dashboardStore
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(),
  useWalletLimitInfo: vi.fn(),
}));

// Mock sessionStore
vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

import tauriApi from '@/services/tauri-api';
import { invoke } from '@tauri-apps/api/core';
import { useDashboardStore, useWalletLimitInfo } from '@/stores/dashboardStore';
import { useSessionStore } from '@/stores/sessionStore';

const mockAddWallet = vi.fn();

describe('Wallet Creation Flow', () => {
  const onCancel = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set mock implementations after mockReset clears them
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
    (useWalletLimitInfo as any).mockReturnValue({
      current: 0,
      limit: 3,
      isPro: false,
      canCreate: true,
    });
    (useSessionStore as any).mockReturnValue({
      getToken: () => 'test-session-token',
    });
    // Default: one USB device
    (tauriApi.detectUsb as any).mockImplementation(() =>
      Promise.resolve([
        { path: '/dev/usb0', name: 'USB Drive', is_writable: true, available_space: 1073741824 },
      ])
    );
    (tauriApi.getDeviceMembershipStatusWithToken as any).mockImplementation(() =>
      Promise.resolve({
        deviceId: 'device-123',
        deviceIdHash: '0xhash',
        walletLimit: 3,
        walletCount: 0,
        canCreateWallet: true,
        memberships: [],
        lockedWalletIds: [],
      })
    );
    // MnemonicDisplay needs these to return Promises
    (tauriApi.enableScreenshotProtection as any).mockImplementation(() => Promise.resolve());
    (tauriApi.disableScreenshotProtection as any).mockImplementation(() => Promise.resolve());
    (tauriApi.clearSensitiveMemory as any).mockImplementation(() => Promise.resolve());
  });

  it('renders the creation form initially (not mnemonic display)', async () => {
    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'wallet.createWallet' })).toBeInTheDocument();
    expect(screen.getByLabelText(/security\.password/)).toBeInTheDocument();
  });

  it('complete flow: fill form, submit, invoke called with correct params', async () => {
    const user = userEvent.setup();

    // Mock successful wallet creation via invoke
    (invoke as any).mockImplementation(() =>
      Promise.resolve({
        wallet: {
          id: 'wallet-id-123',
          name: 'My Wallet',
          created_at: '2025-10-17T12:00:00Z',
          updated_at: '2025-10-17T12:00:00Z',
          has_passphrase: false,
          address_count: 54,
        },
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      })
    );

    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    // Wait for USB detection
    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    // Fill in password
    const passwordInput = screen.getByLabelText(/security\.password \*/);
    await user.type(passwordInput, 'StrongPassword123');

    // Fill in confirm password
    const confirmInput = screen.getByLabelText(/security\.confirmPassword \*/);
    await user.type(confirmInput, 'StrongPassword123');

    // Fill in wallet name
    const nameInput = screen.getByLabelText(/wallet\.walletName/);
    await user.type(nameInput, 'My Wallet');

    // Wait for form to become valid and submit button to enable
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /wallet\.createWallet/ });
      expect(submitButton).not.toBeDisabled();
    });

    // Submit
    const submitButton = screen.getByRole('button', { name: /wallet\.createWallet/ });
    await user.click(submitButton);

    // Verify invoke was called with correct params
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('create_wallet', expect.objectContaining({
        password: 'StrongPassword123',
        usbPath: '/dev/usb0',
      }));
    });
  });

  it('shows error message when wallet creation fails', async () => {
    const user = userEvent.setup();

    // Mock failed wallet creation
    (invoke as any).mockImplementation(() =>
      Promise.reject({ message: 'USB_NOT_FOUND' })
    );

    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    // Fill valid form data
    await user.type(screen.getByLabelText(/security\.password \*/), 'StrongPassword123');
    await user.type(screen.getByLabelText(/security\.confirmPassword \*/), 'StrongPassword123');
    await user.type(screen.getByLabelText(/wallet\.walletName/), 'Test Wallet');

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /wallet\.createWallet/ });
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /wallet\.createWallet/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('USB_NOT_FOUND')).toBeInTheDocument();
    });
  });

  it('shows upgrade prompt when wallet limit reached', async () => {
    // Override to indicate limit reached
    (useWalletLimitInfo as any).mockReturnValue({
      current: 3,
      limit: 3,
      isPro: false,
      canCreate: false,
    });

    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    // Should show limit reached message
    expect(screen.getByText('wallet.limitReachedCount')).toBeInTheDocument();
  });

  it('cancel flow: dirty form shows confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    // Type something to make form dirty
    await user.type(screen.getByLabelText(/wallet\.walletName/), 'Some name');

    // Click cancel
    await user.click(screen.getByText('common.cancel'));

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('wallet.discardCreation')).toBeInTheDocument();
      expect(screen.getByText('wallet.discardCreationMessage')).toBeInTheDocument();
    });
  });

  it('cancel flow: confirming discard calls onCancel', async () => {
    const user = userEvent.setup();
    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    // Make form dirty
    await user.type(screen.getByLabelText(/wallet\.walletName/), 'Some name');

    // Click cancel
    await user.click(screen.getByText('common.cancel'));

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText('wallet.discardChanges')).toBeInTheDocument();
    });

    // Confirm discard
    await user.click(screen.getByText('wallet.discardChanges'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('cancel flow: clicking continue editing closes dialog', async () => {
    const user = userEvent.setup();
    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    // Make form dirty
    await user.type(screen.getByLabelText(/wallet\.walletName/), 'Some name');

    // Click cancel
    await user.click(screen.getByText('common.cancel'));

    await waitFor(() => {
      expect(screen.getByText('wallet.continueEditing')).toBeInTheDocument();
    });

    // Click continue editing
    await user.click(screen.getByText('wallet.continueEditing'));

    // Dialog should be dismissed, onCancel should NOT have been called
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('submit button disabled when no USB devices', async () => {
    (tauriApi.detectUsb as any).mockImplementation(() => Promise.resolve([]));

    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.getByText('usb.noUsbDetected')).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /wallet\.createWallet/ });
    expect(submitButton).toBeDisabled();
  });

  it('addWallet is called on successful creation', async () => {
    const user = userEvent.setup();

    (invoke as any).mockImplementation(() =>
      Promise.resolve({
        wallet: {
          id: 'new-wallet-id',
          name: 'Created Wallet',
          created_at: '2025-10-17T12:00:00Z',
          updated_at: '2025-10-17T12:00:00Z',
          has_passphrase: false,
          address_count: 54,
        },
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      })
    );

    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/security\.password \*/), 'StrongPassword123');
    await user.type(screen.getByLabelText(/security\.confirmPassword \*/), 'StrongPassword123');

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /wallet\.createWallet/ });
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /wallet\.createWallet/ }));

    await waitFor(() => {
      expect(mockAddWallet).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-wallet-id' })
      );
    });
  });
});
