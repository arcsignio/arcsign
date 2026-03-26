/**
 * WalletImport component tests
 * Feature: User Dashboard for Wallet Management
 * Tests: form rendering, mnemonic validation, import flow, error handling, duplicate detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletImport } from '@/components/WalletImport';

// Mock tauri-api (default export)
vi.mock('@/services/tauri-api', () => ({
  default: {
    importWallet: vi.fn(),
  },
}));

// Mock dashboardStore
vi.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(),
  useWalletLimitInfo: vi.fn(),
}));

import tauriApi from '@/services/tauri-api';
import { useDashboardStore, useWalletLimitInfo } from '@/stores/dashboardStore';
import { mnemonicSchema, walletImportSchema, normalizeMnemonic } from '@/validation/mnemonic';

const mockAddWallet = vi.fn();

const defaultProps = {
  usbPath: '/dev/usb0',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('WalletImport Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
    (useWalletLimitInfo as any).mockReturnValue({
      current: 0,
      limit: 3,
      isPro: false,
      canCreate: true,
    });
  });

  it('renders the import form with all required fields', () => {
    render(<WalletImport {...defaultProps} />);

    // Heading
    expect(screen.getByRole('heading', { name: 'wallet.importWallet' })).toBeInTheDocument();
    // Form fields
    expect(screen.getByLabelText(/mnemonic\.recoveryPhrase/)).toBeInTheDocument();
    expect(screen.getByLabelText(/security\.walletPassword/)).toBeInTheDocument();
    expect(screen.getByLabelText(/security\.confirmPassword/)).toBeInTheDocument();
    expect(screen.getByLabelText(/wallet\.walletName/)).toBeInTheDocument();
  });

  it('renders the BIP39 passphrase checkbox', () => {
    render(<WalletImport {...defaultProps} />);

    const checkbox = screen.getByLabelText('security.useBip39Passphrase');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('shows passphrase input when checkbox is checked', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const checkbox = screen.getByLabelText('security.useBip39Passphrase');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByLabelText('security.passphrase')).toBeInTheDocument();
    });
  });

  it('hides passphrase input when checkbox is unchecked', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    // Check then uncheck
    const checkbox = screen.getByLabelText('security.useBip39Passphrase');
    await user.click(checkbox);
    await waitFor(() => {
      expect(screen.getByLabelText('security.passphrase')).toBeInTheDocument();
    });

    await user.click(checkbox);
    await waitFor(() => {
      expect(screen.queryByLabelText('security.passphrase')).not.toBeInTheDocument();
    });
  });

  it('shows cancel button when onCancel is provided', () => {
    render(<WalletImport {...defaultProps} />);
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
  });

  it('does not show cancel button when onCancel is not provided', () => {
    render(<WalletImport usbPath="/dev/usb0" />);
    expect(screen.queryByText('common.cancel')).not.toBeInTheDocument();
  });

  it('calls onCancel immediately when cancel clicked with empty form', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    await user.click(screen.getByText('common.cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('displays wallet limit info', () => {
    render(<WalletImport {...defaultProps} />);

    // The wallet limit info should be shown (canCreate=true)
    expect(screen.getByText('wallet.walletsCount')).toBeInTheDocument();
  });

  it('shows import button with correct text', () => {
    render(<WalletImport {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: 'wallet.importWallet' });
    expect(submitButton).toBeInTheDocument();
  });

  it('shows the mnemonic hint text', () => {
    render(<WalletImport {...defaultProps} />);
    expect(screen.getByText('mnemonic.enterBip39Hint')).toBeInTheDocument();
  });
});

describe('WalletImport - handleMnemonicChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
    (useWalletLimitInfo as any).mockReturnValue({
      current: 0,
      limit: 3,
      isPro: false,
      canCreate: true,
    });
  });

  it('updates textarea value when user types', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(textarea, 'abandon');

    expect(textarea).toHaveValue('abandon');
  });
});

describe('WalletImport - handleMnemonicBlur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
    (useWalletLimitInfo as any).mockReturnValue({
      current: 0,
      limit: 3,
      isPro: false,
      canCreate: true,
    });
  });

  it('normalizes mnemonic on blur', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    // Manually set value with extra spaces and uppercase
    await user.clear(textarea);
    await user.type(textarea, '  ABANDON   ABANDON  ');
    await user.tab(); // trigger blur

    // After blur, the value should be normalized
    expect(textarea).toHaveValue('abandon abandon');
  });

  it('does not modify empty mnemonic on blur', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.click(textarea);
    await user.tab(); // blur with empty value

    expect(textarea).toHaveValue('');
  });
});

describe('WalletImport - onSubmit (import flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
    (useWalletLimitInfo as any).mockReturnValue({
      current: 0,
      limit: 3,
      isPro: false,
      canCreate: true,
    });
  });

  it('calls tauriApi.importWallet and addWallet on success', async () => {
    const mockWallet = {
      id: 'wallet-1',
      name: 'Test Wallet',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      has_passphrase: false,
      address_count: 54,
    };
    (tauriApi.importWallet as any).mockImplementation(() =>
      Promise.resolve({ wallet: mockWallet, is_duplicate: false })
    );

    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    // Fill the form with valid data
    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(
      textarea,
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );

    const passwordInput = screen.getByPlaceholderText('security.enterStrongPassword');
    await user.type(passwordInput, 'StrongPassword1');

    const confirmInput = screen.getByPlaceholderText('security.reenterPassword');
    await user.type(confirmInput, 'StrongPassword1');

    const nameInput = screen.getByPlaceholderText('wallet.myMainWallet');
    await user.type(nameInput, 'My Wallet');

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'wallet.importWallet' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(tauriApi.importWallet).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAddWallet).toHaveBeenCalledWith(mockWallet);
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it('shows duplicate dialog when response has is_duplicate true', async () => {
    (tauriApi.importWallet as any).mockImplementation(() =>
      Promise.resolve({
        wallet: { id: 'w1', name: 'W', created_at: '', updated_at: '', has_passphrase: false, address_count: 54 },
        is_duplicate: true,
      })
    );

    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(
      textarea,
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );
    await user.type(screen.getByPlaceholderText('security.enterStrongPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('security.reenterPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('wallet.myMainWallet'), 'My Wallet');

    await user.click(screen.getByRole('button', { name: 'wallet.importWallet' }));

    await waitFor(() => {
      expect(screen.getByText('wallet.duplicateWalletTitle')).toBeInTheDocument();
    });
  });

  it('shows error when importWallet throws WALLET_ALREADY_EXISTS', async () => {
    (tauriApi.importWallet as any).mockImplementation(() =>
      Promise.reject({ code: 'WALLET_ALREADY_EXISTS', message: 'Wallet already exists' })
    );

    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(
      textarea,
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );
    await user.type(screen.getByPlaceholderText('security.enterStrongPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('security.reenterPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('wallet.myMainWallet'), 'My Wallet');

    await user.click(screen.getByRole('button', { name: 'wallet.importWallet' }));

    await waitFor(() => {
      expect(screen.getByText('wallet.duplicateWalletTitle')).toBeInTheDocument();
    });
  });

  it('shows generic error on other import failure', async () => {
    (tauriApi.importWallet as any).mockImplementation(() =>
      Promise.reject({ code: 'UNKNOWN', message: 'Something went wrong' })
    );

    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(
      textarea,
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );
    await user.type(screen.getByPlaceholderText('security.enterStrongPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('security.reenterPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('wallet.myMainWallet'), 'My Wallet');

    await user.click(screen.getByRole('button', { name: 'wallet.importWallet' }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('shows upgrade prompt when wallet limit reached', async () => {
    (useWalletLimitInfo as any).mockReturnValue({
      current: 3,
      limit: 3,
      isPro: false,
      canCreate: false,
    });

    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(
      textarea,
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    );
    await user.type(screen.getByPlaceholderText('security.enterStrongPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('security.reenterPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('wallet.myMainWallet'), 'My Wallet');

    await user.click(screen.getByRole('button', { name: 'wallet.importWallet' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // tauriApi.importWallet should NOT have been called
    expect(tauriApi.importWallet).not.toHaveBeenCalled();
  });
});

describe('WalletImport - duplicate dialog actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
    (useWalletLimitInfo as any).mockReturnValue({
      current: 0,
      limit: 3,
      isPro: false,
      canCreate: true,
    });
  });

  it('handleCancelDuplicate closes the duplicate dialog', async () => {
    (tauriApi.importWallet as any).mockImplementation(() =>
      Promise.resolve({
        wallet: { id: 'w1', name: 'W', created_at: '', updated_at: '', has_passphrase: false, address_count: 54 },
        is_duplicate: true,
      })
    );

    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    // Fill form
    await user.type(screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase'),
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    await user.type(screen.getByPlaceholderText('security.enterStrongPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('security.reenterPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('wallet.myMainWallet'), 'My Wallet');
    await user.click(screen.getByRole('button', { name: 'wallet.importWallet' }));

    // Wait for duplicate dialog
    await waitFor(() => {
      expect(screen.getByText('wallet.duplicateWalletTitle')).toBeInTheDocument();
    });

    // Click cancel in the duplicate dialog (there are multiple 'common.cancel' elements)
    const cancelButtons = screen.getAllByText('common.cancel');
    // The last 'common.cancel' button is inside the duplicate dialog
    await user.click(cancelButtons[cancelButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('wallet.duplicateWalletTitle')).not.toBeInTheDocument();
    });
  });

  it('handleOverwriteDuplicate closes dialog and sets error message', async () => {
    (tauriApi.importWallet as any).mockImplementation(() =>
      Promise.resolve({
        wallet: { id: 'w1', name: 'W', created_at: '', updated_at: '', has_passphrase: false, address_count: 54 },
        is_duplicate: true,
      })
    );

    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    // Fill form
    await user.type(screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase'),
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
    await user.type(screen.getByPlaceholderText('security.enterStrongPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('security.reenterPassword'), 'StrongPassword1');
    await user.type(screen.getByPlaceholderText('wallet.myMainWallet'), 'My Wallet');
    await user.click(screen.getByRole('button', { name: 'wallet.importWallet' }));

    await waitFor(() => {
      expect(screen.getByText('wallet.duplicateWalletTitle')).toBeInTheDocument();
    });

    // Click overwrite
    const overwriteButton = screen.getByText('wallet.overwrite');
    await user.click(overwriteButton);

    await waitFor(() => {
      expect(screen.queryByText('wallet.duplicateWalletTitle')).not.toBeInTheDocument();
    });

    // Should show "not implemented" error
    await waitFor(() => {
      expect(screen.getByText('wallet.overwriteNotImplemented')).toBeInTheDocument();
    });
  });
});

describe('WalletImport - cancel with dirty form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
    (useWalletLimitInfo as any).mockReturnValue({
      current: 0,
      limit: 3,
      isPro: false,
      canCreate: true,
    });
  });

  it('shows confirmation dialog when cancelling dirty form', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    // Type into mnemonic to make form dirty
    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(textarea, 'some text');

    // Click cancel
    await user.click(screen.getByText('common.cancel'));

    // Should show the confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('wallet.discardImport')).toBeInTheDocument();
    });
  });

  it('confirmCancel calls onCancel when user confirms', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    // Type into mnemonic to make form dirty
    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(textarea, 'some text');

    // Click cancel
    await user.click(screen.getByText('common.cancel'));

    // Confirm the discard
    await waitFor(() => {
      expect(screen.getByText('wallet.discardChanges')).toBeInTheDocument();
    });
    await user.click(screen.getByText('wallet.discardChanges'));

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('cancelCancelAction closes confirmation and keeps form', async () => {
    const user = userEvent.setup();
    render(<WalletImport {...defaultProps} />);

    // Type into mnemonic to make form dirty
    const textarea = screen.getByPlaceholderText('mnemonic.enterRecoveryPhrase');
    await user.type(textarea, 'some text');

    // Click cancel
    await user.click(screen.getByText('common.cancel'));

    // Dismiss the confirmation by clicking "continue editing"
    await waitFor(() => {
      expect(screen.getByText('wallet.continueEditing')).toBeInTheDocument();
    });
    await user.click(screen.getByText('wallet.continueEditing'));

    // Confirmation dialog should be gone, onCancel should NOT have been called
    await waitFor(() => {
      expect(screen.queryByText('wallet.discardImport')).not.toBeInTheDocument();
    });
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });
});

describe('WalletImport - wallet limit reached UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDashboardStore as any).mockReturnValue({
      addWallet: mockAddWallet,
    });
  });

  it('shows limit reached text and upgrade button when canCreate is false', () => {
    (useWalletLimitInfo as any).mockReturnValue({
      current: 3,
      limit: 3,
      isPro: false,
      canCreate: false,
    });

    render(<WalletImport {...defaultProps} />);

    expect(screen.getByText('wallet.limitReachedCount')).toBeInTheDocument();
    expect(screen.getByText('actions.upgrade')).toBeInTheDocument();
  });

  it('shows different button text for Pro members at limit', () => {
    (useWalletLimitInfo as any).mockReturnValue({
      current: 7,
      limit: 7,
      isPro: true,
      canCreate: false,
    });

    render(<WalletImport {...defaultProps} />);

    expect(screen.getByText('membership.getMoreNfts')).toBeInTheDocument();
  });
});

describe('WalletImport - Mnemonic Validation', () => {
  it('normalizeMnemonic trims and lowercases', () => {
    const result = normalizeMnemonic('  ABANDON   ABANDON   ABOUT  ');
    expect(result).toBe('abandon abandon about');
  });

  it('validates a correct 12-word BIP39 mnemonic', () => {
    const validMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const result = mnemonicSchema.safeParse(validMnemonic);
    expect(result.success).toBe(true);
  });

  it('rejects a mnemonic with wrong word count', () => {
    const result = mnemonicSchema.safeParse('abandon abandon abandon');
    expect(result.success).toBe(false);
  });

  it('rejects a mnemonic with invalid BIP39 words', () => {
    // "xyzfake" is not in the BIP39 wordlist
    const invalidMnemonic =
      'abandon xyzfake abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const result = mnemonicSchema.safeParse(invalidMnemonic);
    expect(result.success).toBe(false);
  });

  it('rejects a mnemonic with invalid checksum', () => {
    // Valid words but invalid checksum
    const badChecksum =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    const result = mnemonicSchema.safeParse(badChecksum);
    expect(result.success).toBe(false);
  });

  it('validates walletImportSchema requires password match', () => {
    const result = walletImportSchema.safeParse({
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      password: 'StrongPassword123',
      confirmPassword: 'DifferentPassword123',
      usePassphrase: false,
      name: 'Test Wallet',
    });
    expect(result.success).toBe(false);
  });

  it('validates walletImportSchema requires wallet name', () => {
    const result = walletImportSchema.safeParse({
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
      usePassphrase: false,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('validates walletImportSchema rejects empty passphrase when enabled', () => {
    const result = walletImportSchema.safeParse({
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      password: 'StrongPassword123',
      confirmPassword: 'StrongPassword123',
      usePassphrase: true,
      passphrase: '',
      name: 'Test Wallet',
    });
    expect(result.success).toBe(false);
  });
});
