/**
 * WalletCreate component tests
 * Feature: User Dashboard for Wallet Management
 * Tests: form rendering, validation, USB detection, wallet creation, error handling
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
  },
}));

// Mock dashboardStore — mock the hooks WalletCreate uses
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(),
  useWalletLimitInfo: vi.fn(),
}));

// Mock sessionStore
vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

import tauriApi from '@/services/tauri-api';
import { useDashboardStore, useWalletLimitInfo } from '@/stores/dashboardStore';
import { useSessionStore } from '@/stores/sessionStore';
import { passwordSchema, walletCreateSchema } from '@/validation/password';

const mockAddWallet = vi.fn();

describe('WalletCreate Component', () => {
  const onCancel = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
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
    (tauriApi.detectUsb as any).mockImplementation(() =>
      Promise.resolve([
        { path: '/dev/usb0', name: 'USB Drive', is_writable: true, available_space: 1073741824 },
      ])
    );
  });

  it('renders the wallet creation form with all fields', async () => {
    render(<WalletCreate onCancel={onCancel} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    // Check form fields are present
    expect(screen.getByLabelText(/security\.password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/security\.confirmPassword/)).toBeInTheDocument();
    expect(screen.getByLabelText(/wallet\.walletName/)).toBeInTheDocument();
    expect(screen.getByLabelText(/security\.bip39Passphrase/)).toBeInTheDocument();
    expect(screen.getByLabelText(/mnemonic\.wordCount/)).toBeInTheDocument();
  });

  it('shows USB detecting state initially', () => {
    (tauriApi.detectUsb as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    render(<WalletCreate />);

    expect(screen.getByText('usb.detecting')).toBeInTheDocument();
  });

  it('shows error when no USB devices found', async () => {
    (tauriApi.detectUsb as any).mockImplementation(() => Promise.resolve([]));

    render(<WalletCreate />);

    await waitFor(() => {
      expect(screen.getByText('usb.noUsbDetected')).toBeInTheDocument();
    });
  });

  it('auto-selects USB path when only one device detected', async () => {
    render(<WalletCreate onCancel={onCancel} />);

    await waitFor(() => {
      const select = screen.getByLabelText(/usb\.usbDrive/) as HTMLSelectElement;
      expect(select.value).toBe('/dev/usb0');
    });
  });

  it('renders mnemonic length selector with 24 as default', async () => {
    render(<WalletCreate />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    const select = screen.getByLabelText(/mnemonic\.wordCount/) as HTMLSelectElement;
    expect(select.value).toBe('24');

    // Both options present
    expect(screen.getByText('mnemonic.24words')).toBeInTheDocument();
    expect(screen.getByText('mnemonic.12words')).toBeInTheDocument();
  });

  it('disables submit button when form is initially empty (invalid)', async () => {
    render(<WalletCreate />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /wallet\.createWallet/ });
    expect(submitButton).toBeDisabled();
  });

  it('shows cancel button when onCancel is provided', async () => {
    render(<WalletCreate onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('does not show cancel button when onCancel is not provided', async () => {
    render(<WalletCreate />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('common.cancel')).not.toBeInTheDocument();
  });

  it('calls onCancel immediately when cancel clicked with no dirty form', async () => {
    const user = userEvent.setup();
    render(<WalletCreate onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('displays wallet limit info', async () => {
    render(<WalletCreate />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    expect(screen.getByText('wallet.walletsCount')).toBeInTheDocument();
  });

  it('displays security notice section', async () => {
    render(<WalletCreate />);

    await waitFor(() => {
      expect(screen.queryByText('usb.detecting')).not.toBeInTheDocument();
    });

    expect(screen.getByText('security.securityNotice:')).toBeInTheDocument();
    expect(screen.getByText('security.walletEncrypted')).toBeInTheDocument();
    expect(screen.getByText('security.mnemonicNotice')).toBeInTheDocument();
    expect(screen.getByText('security.mnemonicWarning')).toBeInTheDocument();
  });

  it('handles USB detection errors gracefully', async () => {
    (tauriApi.detectUsb as any).mockImplementation(() =>
      Promise.reject({ message: 'USB error' })
    );

    render(<WalletCreate />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('USB error')).toBeInTheDocument();
    });
  });
});

describe('WalletCreate - Zod Validation Schema', () => {
  it('validates password minimum length via the schema', () => {
    const result = passwordSchema.safeParse('short');
    expect(result.success).toBe(false);
  });

  it('validates password requires uppercase', () => {
    const result = passwordSchema.safeParse('alllowercase123');
    expect(result.success).toBe(false);
  });

  it('validates password requires lowercase', () => {
    const result = passwordSchema.safeParse('ALLUPPERCASE123');
    expect(result.success).toBe(false);
  });

  it('validates password requires number', () => {
    const result = passwordSchema.safeParse('AllLettersNoNum');
    expect(result.success).toBe(false);
  });

  it('accepts a valid strong password', () => {
    const result = passwordSchema.safeParse('StrongPassword123');
    expect(result.success).toBe(true);
  });

  it('validates walletCreateSchema requires USB path', () => {
    const result = walletCreateSchema.safeParse({
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
      usbPath: '',
      mnemonicLength: 24,
    });
    expect(result.success).toBe(false);
  });

  it('validates walletCreateSchema checks password match', () => {
    const result = walletCreateSchema.safeParse({
      password: 'StrongPassword123',
      confirmPassword: 'DifferentPassword123',
      usbPath: '/dev/usb0',
      mnemonicLength: 24,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid walletCreateSchema input', () => {
    const result = walletCreateSchema.safeParse({
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
      usbPath: '/dev/usb0',
      mnemonicLength: 24,
      walletName: 'My Wallet',
    });
    expect(result.success).toBe(true);
  });
});
