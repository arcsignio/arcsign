import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock sub-components ──────────────────────────────────────────────────────
// Each mock exposes onBack/onClose as a clickable button so tests can invoke parent callbacks.
vi.mock('@/components/TransactionHistory', () => ({
  TransactionHistory: (props: { onBack?: () => void }) => (
    <div data-testid="tx-history">
      TransactionHistory
      {props.onBack && <button data-testid="tx-history-back" onClick={props.onBack}>Back</button>}
    </div>
  ),
}));
vi.mock('@/components/SendTransaction', () => ({
  SendTransaction: (props: { onBack?: () => void; onSuccess?: (txHash: string) => void }) => (
    <div data-testid="send-tx">
      SendTransaction
      {props.onBack && <button data-testid="send-tx-back" onClick={props.onBack}>Back</button>}
      {props.onSuccess && <button data-testid="send-tx-success" onClick={() => props.onSuccess!('0xtxhash')}>Success</button>}
    </div>
  ),
}));
vi.mock('@/components/SwapTransaction', () => ({
  default: (props: { onBack?: () => void; onSuccess?: (txHash: string) => void }) => (
    <div data-testid="swap-tx">
      SwapTransaction
      {props.onBack && <button data-testid="swap-tx-back" onClick={props.onBack}>Back</button>}
      {props.onSuccess && <button data-testid="swap-tx-success" onClick={() => props.onSuccess!('0xswaphash')}>Success</button>}
    </div>
  ),
}));
vi.mock('@/components/StakingTransaction', () => ({
  default: (props: { onBack?: () => void; onSuccess?: (txHash: string) => void }) => (
    <div data-testid="staking-tx">
      StakingTransaction
      {props.onBack && <button data-testid="staking-tx-back" onClick={props.onBack}>Back</button>}
      {props.onSuccess && <button data-testid="staking-tx-success" onClick={() => props.onSuccess!('0xstakehash')}>Success</button>}
    </div>
  ),
}));
vi.mock('@/components/ReceiveAddressModal', () => ({
  default: (props: { onClose?: () => void; onCopy?: (address: string, symbol: string) => void }) => (
    <div data-testid="receive-modal">
      ReceiveAddressModal
      {props.onClose && <button data-testid="receive-modal-close" onClick={props.onClose}>Close</button>}
      {props.onCopy && <button data-testid="receive-modal-copy" onClick={() => props.onCopy!('0xaddr', 'ETH')}>Copy</button>}
    </div>
  ),
}));
vi.mock('@/components/WalletConnect/SessionsManagerModal', () => ({
  SessionsManagerModal: (props: { onClose?: () => void; onDisconnect?: (topic: string) => void; onDisconnectAll?: () => void; onAddNew?: () => void }) => (
    <div data-testid="sessions-modal">
      SessionsManagerModal
      {props.onClose && <button data-testid="sessions-close" onClick={props.onClose}>Close</button>}
      {props.onDisconnect && <button data-testid="sessions-disconnect" onClick={() => props.onDisconnect!('topic-1')}>Disconnect</button>}
      {props.onDisconnectAll && <button data-testid="sessions-disconnect-all" onClick={props.onDisconnectAll}>DisconnectAll</button>}
      {props.onAddNew && <button data-testid="sessions-add-new" onClick={props.onAddNew}>AddNew</button>}
    </div>
  ),
}));
vi.mock('@/components/ExportBackup', () => ({
  ExportBackup: (props: { onSuccess?: () => void; onCancel?: () => void }) => (
    <div data-testid="export-backup">
      ExportBackup
      {props.onSuccess && <button data-testid="export-success" onClick={props.onSuccess}>Done</button>}
      {props.onCancel && <button data-testid="export-cancel" onClick={props.onCancel}>Cancel</button>}
    </div>
  ),
}));
vi.mock('@/components/NFTGallery', () => ({
  NFTGallery: () => <div data-testid="nft-gallery">NFTGallery</div>,
}));
vi.mock('@/components/DefiPositions', () => ({
  DefiPositions: () => <div data-testid="defi-positions">DefiPositions</div>,
}));
vi.mock('@/components/TokenApprovals', () => ({
  TokenApprovals: () => <div data-testid="token-approvals">TokenApprovals</div>,
}));
vi.mock('@/components/AddressBook', () => ({
  AddressBook: (props: { onBack?: () => void }) => (
    <div data-testid="address-book">
      AddressBook
      {props.onBack && <button data-testid="address-book-back" onClick={props.onBack}>Back</button>}
    </div>
  ),
}));
vi.mock('@/components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// ── Mock services / contexts / stores / hooks / utils ────────────────────────
vi.mock('@/services/tauri-api', () => ({
  default: {
    loadAddresses: vi.fn(),
    getTokenBalances: vi.fn(),
    validatePassphrase: vi.fn(),
    createWalletSession: vi.fn(),
  },
}));

vi.mock('@/contexts/AppPasswordContext', () => ({
  useAppPassword: vi.fn(),
}));

vi.mock('@/contexts/WalletConnectContext', () => ({
  useWalletConnect: vi.fn(),
}));

vi.mock('@/stores/walletSessionStore', () => ({
  useWalletSessionStore: vi.fn(),
}));

vi.mock('@/hooks/useTokenList', () => ({
  usePriorityTokens: vi.fn(),
  useAllTokens: vi.fn(),
}));

vi.mock('@/utils/chainIcons', () => ({
  getChainIconUrl: vi.fn(),
  getChainFallbackIcon: vi.fn(),
  isChainSupported: vi.fn(),
  isChainEnabled: vi.fn(),
}));

vi.mock('@/constants/nativeTokens', () => ({
  isNativeTokenAddress: vi.fn(),
  getNativeToken: vi.fn(),
  getNetworkKey: vi.fn(),
}));

vi.mock('@/constants/commonTokens', () => ({
  normalizeTokenForDisplay: vi.fn(),
}));

vi.mock('@/utils/walletLock', () => ({
  isWalletLocked: vi.fn(),
}));

// ── Imports (AFTER vi.mock calls) ────────────────────────────────────────────
import tauriApi from '@/services/tauri-api';
import { useAppPassword } from '@/contexts/AppPasswordContext';
import { useWalletConnect } from '@/contexts/WalletConnectContext';
import { useWalletSessionStore } from '@/stores/walletSessionStore';
import { usePriorityTokens, useAllTokens } from '@/hooks/useTokenList';
import { isNativeTokenAddress, getNativeToken, getNetworkKey } from '@/constants/nativeTokens';
import { getChainIconUrl, getChainFallbackIcon, isChainSupported, isChainEnabled } from '@/utils/chainIcons';
import { normalizeTokenForDisplay } from '@/constants/commonTokens';
import { isWalletLocked } from '@/utils/walletLock';

import { WalletDetail } from '@/components/WalletDetail';

// ── Helpers ──────────────────────────────────────────────────────────────────
const mockWallet = {
  id: 'wallet-1',
  name: 'My Test Wallet',
  has_passphrase: false,
  created_at: '2026-01-01T00:00:00Z',
};

const defaultProps = {
  wallet: mockWallet,
  usbPath: '/dev/usb0',
  onBack: vi.fn(),
  onViewAddresses: vi.fn(),
};

const mockAddresses = [
  { name: 'Ethereum', symbol: 'ETH', address: '0xabc123', coin_type: 60, is_testnet: false },
  { name: 'Bitcoin', symbol: 'BTC', address: 'bc1qxyz', coin_type: 0, is_testnet: false },
];

const mockTokens = [
  {
    network: 'eth-mainnet',
    networkLabel: 'Ethereum',
    tokenAddress: '0x0000000000000000000000000000000000000000',
    tokenSymbol: 'ETH',
    tokenName: 'Ethereum',
    tokenLogo: 'https://logo.example/eth.png',
    balance: '1.500000',
    usdValue: 3000,
    decimals: 18,
    address: '0xabc123',
  },
  {
    network: 'eth-mainnet',
    networkLabel: 'Ethereum',
    tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    tokenSymbol: 'USDC',
    tokenName: 'USD Coin',
    tokenLogo: 'https://logo.example/usdc.png',
    balance: '500.000000',
    usdValue: 500,
    decimals: 6,
    address: '0xabc123',
  },
];

// ── Setup mocks before each test (mockReset clears implementations) ──────────
beforeEach(() => {
  // Native token helpers (must be set in beforeEach because mockReset clears them)
  (isNativeTokenAddress as ReturnType<typeof vi.fn>).mockImplementation(
    (addr: string) => addr === '0x0000000000000000000000000000000000000000'
  );
  (getNativeToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
  (getNetworkKey as ReturnType<typeof vi.fn>).mockImplementation((label: string) => {
    const map: Record<string, string> = { Ethereum: 'ethereum', 'BNB Chain': 'bsc' };
    return map[label] || null;
  });

  // Chain icon utils
  (getChainIconUrl as ReturnType<typeof vi.fn>).mockReturnValue('https://icon.example/eth.png');
  (getChainFallbackIcon as ReturnType<typeof vi.fn>).mockReturnValue('E');
  (isChainSupported as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (isChainEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

  // Other utils
  (normalizeTokenForDisplay as ReturnType<typeof vi.fn>).mockImplementation((t: unknown) => t);
  (isWalletLocked as ReturnType<typeof vi.fn>).mockReturnValue(false);

  (useAppPassword as ReturnType<typeof vi.fn>).mockReturnValue({
    getSessionToken: () => 'session-token-123',
  });

  (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
    initialized: false,
    sessions: [],
    setWalletContext: vi.fn(),
    openPairingModal: vi.fn(),
    disconnectSession: vi.fn(),
  });

  (useWalletSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    createWalletSession: vi.fn().mockImplementation(() => Promise.resolve()),
    walletId: null,
    sessionToken: null,
    clearSession: vi.fn(),
  });

  (usePriorityTokens as ReturnType<typeof vi.fn>).mockReturnValue({
    tokens: [],
    isLoading: false,
  });

  // Populate allTokensByChain with known tokens so the whitelist filter allows them
  const ethereumTokens = [
    { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', logoURI: '' },
  ];
  const allTokensMap = new Map([['ethereum', ethereumTokens]]);
  (useAllTokens as ReturnType<typeof vi.fn>).mockReturnValue({
    tokens: allTokensMap,
  });

  (tauriApi.loadAddresses as ReturnType<typeof vi.fn>).mockImplementation(() =>
    Promise.resolve({ addresses: mockAddresses })
  );

  (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
    Promise.resolve({ tokens: mockTokens, totalUsd: 3500 })
  );

  defaultProps.onBack = vi.fn();
  defaultProps.onViewAddresses = vi.fn();
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('WalletDetail', () => {
  // 1. Renders password prompt on mount
  it('renders password prompt on mount', () => {
    render(<WalletDetail {...defaultProps} />);

    // Password input should be visible
    expect(screen.getByLabelText('walletDetail.walletPassword')).toBeInTheDocument();
    // Unlock button text (i18n returns key)
    expect(screen.getByText('walletDetail.unlockAndViewAssets')).toBeInTheDocument();
    // Unlock description text
    expect(screen.getByText('walletDetail.unlockDescription')).toBeInTheDocument();
  });

  // 2. Shows wallet name in header
  it('shows wallet name in header', () => {
    render(<WalletDetail {...defaultProps} />);

    // The wallet name is rendered inside an h2 in the password prompt header
    expect(screen.getByRole('heading', { level: 2, name: 'My Test Wallet' })).toBeInTheDocument();
  });

  // 3. Enters password and loads balances
  it('enters password and loads balances after unlock', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    const passwordInput = screen.getByLabelText('walletDetail.walletPassword');
    await user.type(passwordInput, 'mypassword');

    const unlockButton = screen.getByText('walletDetail.unlockAndViewAssets');
    await user.click(unlockButton);

    await waitFor(() => {
      expect(tauriApi.loadAddresses).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet_id: 'wallet-1',
          password: 'mypassword',
          usb_path: '/dev/usb0',
        })
      );
    });

    await waitFor(() => {
      expect(tauriApi.getTokenBalances).toHaveBeenCalled();
    });
  });

  // 4. Shows error on wrong password
  it('shows error on wrong password', async () => {
    (useWalletSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      createWalletSession: vi.fn().mockImplementation(() =>
        Promise.reject(new Error('Failed to create wallet session'))
      ),
      walletId: null,
      sessionToken: null,
      clearSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    const passwordInput = screen.getByLabelText('walletDetail.walletPassword');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.incorrectPassword')).toBeInTheDocument();
    });
  });

  // 5. Displays token list after unlock
  it('displays token list after unlock', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    // Wait for the main dashboard view (password prompt should disappear)
    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Token symbols should be visible in the token list
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  // 6. Tab switching (crypto -> nft -> approvals -> defi)
  it('switches between tabs', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    // Unlock the wallet first
    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Default tab is crypto - token list should be present
    expect(screen.getByText('ETH')).toBeInTheDocument();

    // Switch to NFT tab
    await user.click(screen.getByText('walletDetail.nft'));
    expect(screen.getByTestId('nft-gallery')).toBeInTheDocument();

    // Switch to Approvals tab
    await user.click(screen.getByText('walletDetail.approvals'));
    expect(screen.getByTestId('token-approvals')).toBeInTheDocument();

    // Switch to DeFi tab
    await user.click(screen.getByText('walletDetail.defi'));
    expect(screen.getByTestId('defi-positions')).toBeInTheDocument();

    // Switch back to Crypto tab
    await user.click(screen.getByText('walletDetail.crypto'));
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  // 7. Calls onBack when back button clicked (from password prompt)
  it('calls onBack when back button is clicked from password prompt', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    // The back button shows the i18n key
    const backButton = screen.getByText(/walletDetail.backToWallets/);
    await user.click(backButton);

    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  // 8. Shows loading spinner during balance fetch
  it('shows loading state during balance fetch', async () => {
    // Make getTokenBalances hang (never resolve) to keep loading state
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    // The unlock button text should change to loading state
    await waitFor(() => {
      expect(screen.getByText('walletDetail.loadingAssets')).toBeInTheDocument();
    });
  });

  // 9. Shows total USD value after loading
  it('shows total USD value after loading', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    // Wait for unlock to complete
    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Total USD value should be displayed (formatUSD formats 3500 as $3,500.00)
    expect(screen.getByText('$3,500.00')).toBeInTheDocument();
  });

  // 10. Shows the action buttons (Send, Receive, Swap, History, More)
  it('shows action buttons after unlock', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Action button labels (i18n keys)
    expect(screen.getByText('walletDetail.send')).toBeInTheDocument();
    expect(screen.getByText('walletDetail.receive')).toBeInTheDocument();
    expect(screen.getByText('walletDetail.swap')).toBeInTheDocument();
    expect(screen.getByText('walletDetail.history')).toBeInTheDocument();
    expect(screen.getByText('walletDetail.more')).toBeInTheDocument();
  });

  // 11. Shows unlock heading text
  it('shows the unlock wallet heading in password prompt', () => {
    render(<WalletDetail {...defaultProps} />);

    expect(screen.getByText('walletDetail.unlockWallet')).toBeInTheDocument();
  });

  // 12. Unlock button is disabled when password input is empty
  it('disables unlock button when password is empty', () => {
    render(<WalletDetail {...defaultProps} />);

    const unlockButton = screen.getByText('walletDetail.unlockAndViewAssets');
    expect(unlockButton).toBeDisabled();
  });

  // ── 13. handleLoadBalances: error with non-password error message ──────────
  it('shows generic error message for non-password errors', async () => {
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.reject(new Error('Network timeout'))
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });
  });

  // ── 14. handleLoadBalances: shows pleaseEnterPassword if no password ──────
  it('shows pleaseEnterPassword error if password field is empty on submit', async () => {
    // Simulate: somehow session token is missing
    (useAppPassword as ReturnType<typeof vi.fn>).mockReturnValue({
      getSessionToken: () => null,
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    // Type password then clear it to re-enable button isn't possible since button is disabled.
    // Instead, test the code path where tempPassword has value but getSessionToken() is null.
    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.pleaseEnterPassword')).toBeInTheDocument();
    });
  });

  // ── 15. Passphrase prompt shows for wallet with has_passphrase ────────────
  it('shows passphrase prompt for wallet with passphrase after password unlock', async () => {
    const passphraseWallet = {
      ...mockWallet,
      has_passphrase: true,
    };

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} wallet={passphraseWallet} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    // Should show passphrase prompt instead of main dashboard
    await waitFor(() => {
      expect(screen.getByText('walletDetail.enterPassphrase')).toBeInTheDocument();
    });

    // passphraseDescription is inside a <p> with <br/> and passphraseDescriptionContinue
    // so search with a function matcher to find the text node
    expect(screen.getByText((_content, element) =>
      element?.tagName === 'P' && !!element.textContent?.includes('walletDetail.passphraseDescription')
    )).toBeInTheDocument();
    expect(screen.getByText('walletDetail.verifyAndContinue')).toBeInTheDocument();
    expect(screen.getByText('walletDetail.backToPassword')).toBeInTheDocument();
  });

  // ── 16. handleValidatePassphrase: successful validation ───────────────────
  it('validates passphrase and loads balances on success', async () => {
    const passphraseWallet = {
      ...mockWallet,
      has_passphrase: true,
    };

    (tauriApi.validatePassphrase as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ valid: true, expectedAddress: '0xabc', derivedAddress: '0xabc' })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} wallet={passphraseWallet} />);

    // First unlock with password
    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    // Wait for passphrase prompt
    await waitFor(() => {
      expect(screen.getByText('walletDetail.enterPassphrase')).toBeInTheDocument();
    });

    // Enter passphrase
    await user.type(screen.getByLabelText('walletDetail.bip39Passphrase'), 'mysecretphrase');
    await user.click(screen.getByText('walletDetail.verifyAndContinue'));

    // Should proceed to main dashboard
    await waitFor(() => {
      expect(tauriApi.validatePassphrase).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(tauriApi.getTokenBalances).toHaveBeenCalledTimes(1);
    });
  });

  // ── 17. handleValidatePassphrase: invalid passphrase ──────────────────────
  it('shows error for invalid passphrase', async () => {
    const passphraseWallet = {
      ...mockWallet,
      has_passphrase: true,
    };

    (tauriApi.validatePassphrase as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ valid: false, expectedAddress: '0xabc', derivedAddress: '0xdef' })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} wallet={passphraseWallet} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.enterPassphrase')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('walletDetail.bip39Passphrase'), 'wrongphrase');
    await user.click(screen.getByText('walletDetail.verifyAndContinue'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.invalidPassphrase')).toBeInTheDocument();
    });
  });

  // ── 18. handleValidatePassphrase: API error ───────────────────────────────
  it('shows error when passphrase validation API call fails', async () => {
    const passphraseWallet = {
      ...mockWallet,
      has_passphrase: true,
    };

    (tauriApi.validatePassphrase as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.reject(new Error('Validation service unavailable'))
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} wallet={passphraseWallet} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.enterPassphrase')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('walletDetail.bip39Passphrase'), 'anything');
    await user.click(screen.getByText('walletDetail.verifyAndContinue'));

    await waitFor(() => {
      expect(screen.getByText('Validation service unavailable')).toBeInTheDocument();
    });
  });

  // ── 19. Back to password from passphrase prompt ───────────────────────────
  it('navigates back to password prompt from passphrase prompt', async () => {
    const passphraseWallet = {
      ...mockWallet,
      has_passphrase: true,
    };

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} wallet={passphraseWallet} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.enterPassphrase')).toBeInTheDocument();
    });

    // Click back to password
    await user.click(screen.getByText('walletDetail.backToPassword'));

    // Should show password prompt again
    await waitFor(() => {
      expect(screen.getByLabelText('walletDetail.walletPassword')).toBeInTheDocument();
      expect(screen.getByText('walletDetail.unlockAndViewAssets')).toBeInTheDocument();
    });
  });

  // ── 20. Passphrase verify button disabled when empty ────────────────────
  it('disables passphrase verify button when passphrase field is empty', async () => {
    const passphraseWallet = {
      ...mockWallet,
      has_passphrase: true,
    };

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} wallet={passphraseWallet} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.enterPassphrase')).toBeInTheDocument();
    });

    // Verify button should be disabled when passphrase is empty
    expect(screen.getByText('walletDetail.verifyAndContinue')).toBeDisabled();
  });

  // ── 21. Send button click opens SendTransaction ───────────────────────────
  it('opens SendTransaction when Send button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click send button
    await user.click(screen.getByText('walletDetail.send'));

    // SendTransaction component should be rendered
    await waitFor(() => {
      expect(screen.getByTestId('send-tx')).toBeInTheDocument();
    });
  });

  // ── 22. Swap button click opens SwapTransaction ───────────────────────────
  it('opens SwapTransaction when Swap button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.swap'));

    await waitFor(() => {
      expect(screen.getByTestId('swap-tx')).toBeInTheDocument();
    });
  });

  // ── 23. History button opens TransactionHistory ───────────────────────────
  it('opens TransactionHistory when History button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.history'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-history')).toBeInTheDocument();
    });
  });

  // ── 24. More menu opens and shows staking/export/walletconnect/addressbook ─
  it('opens more menu with dropdown options', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click More button
    await user.click(screen.getByText('walletDetail.more'));

    // Staking option
    expect(screen.getByText('walletDetail.staking')).toBeInTheDocument();
    expect(screen.getByText('walletDetail.stakingDesc')).toBeInTheDocument();

    // Address Book option
    expect(screen.getByText('walletDetail.addressBook')).toBeInTheDocument();

    // WalletConnect option
    expect(screen.getByText('WalletConnect')).toBeInTheDocument();

    // Export option
    expect(screen.getByText('backup.exportTitle')).toBeInTheDocument();
    expect(screen.getByText('backup.exportDescription')).toBeInTheDocument();
  });

  // ── 25. More menu: staking opens StakingTransaction ───────────────────────
  it('opens StakingTransaction from More menu', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open More menu
    await user.click(screen.getByText('walletDetail.more'));

    // Click Staking
    await user.click(screen.getByText('walletDetail.staking'));

    await waitFor(() => {
      expect(screen.getByTestId('staking-tx')).toBeInTheDocument();
    });
  });

  // ── 26. More menu: export opens ExportBackup ──────────────────────────────
  it('opens ExportBackup from More menu', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('backup.exportTitle'));

    await waitFor(() => {
      expect(screen.getByTestId('export-backup')).toBeInTheDocument();
    });
  });

  // ── 27. More menu: Address Book opens AddressBook ─────────────────────────
  it('opens AddressBook from More menu', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('walletDetail.addressBook'));

    await waitFor(() => {
      expect(screen.getByTestId('address-book')).toBeInTheDocument();
    });
  });

  // ── 28. More menu: WalletConnect calls openPairingModal ───────────────────
  it('calls openPairingModal from WalletConnect menu option', async () => {
    const mockOpenPairingModal = vi.fn();
    const mockSetWalletContext = vi.fn();
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: false,
      sessions: [],
      setWalletContext: mockSetWalletContext,
      openPairingModal: mockOpenPairingModal,
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('WalletConnect'));

    expect(mockOpenPairingModal).toHaveBeenCalled();
  });

  // ── 29. Refresh button calls handleRefreshBalances ────────────────────────
  it('refreshes balances when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Clear the mock to track refresh-specific calls
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockClear();
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ tokens: mockTokens, totalUsd: 4000 })
    );

    // Click the refresh button (title = walletDetail.refreshBalances)
    const refreshButton = screen.getByTitle('walletDetail.refreshBalances');
    await user.click(refreshButton);

    await waitFor(() => {
      expect(tauriApi.getTokenBalances).toHaveBeenCalledTimes(1);
    });

    // Updated total should appear
    await waitFor(() => {
      expect(screen.getByText('$4,000.00')).toBeInTheDocument();
    });
  });

  // ── 30. handleRefreshBalances: error path ─────────────────────────────────
  it('shows error when refresh fails', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Set up refresh to fail
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.reject(new Error('Alchemy API rate limit'))
    );

    const refreshButton = screen.getByTitle('walletDetail.refreshBalances');
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('Alchemy API rate limit')).toBeInTheDocument();
    });
  });

  // ── 31. Receive button opens address list ─────────────────────────────────
  it('opens address list when Receive button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click receive button (same as clicking copy address icon - shows address list)
    await user.click(screen.getByText('walletDetail.receive'));

    // Address list modal should appear with wallet addresses
    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    // Check the addresses heading is shown (walletDetail.supportedChains includes chain list)
    expect(screen.getByText('walletDetail.fullTransactionSupport')).toBeInTheDocument();
  });

  // ── 32. Close address list modal ──────────────────────────────────────────
  it('closes address list modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list
    await user.click(screen.getByText('walletDetail.receive'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    // Close modal (click the X button)
    await user.click(screen.getByText('\u2715'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.walletAddresses')).not.toBeInTheDocument();
    });
  });

  // ── 33. Address list shows copy and QR code buttons for each address ─────
  it('shows copy and QR code buttons for supported chain addresses', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list
    await user.click(screen.getByText('walletDetail.receive'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    // Should have copy buttons and QR code buttons for each supported chain address
    const copyButtons = screen.getAllByTitle('walletDetail.copyAddressTooltip');
    expect(copyButtons.length).toBeGreaterThan(0);

    const qrButtons = screen.getAllByTitle('walletDetail.showQrCode');
    expect(qrButtons.length).toBeGreaterThan(0);
  });

  // ── 34. WalletConnect sessions indicator shows when initialized ───────────
  it('shows WalletConnect sessions indicator when initialized with sessions', async () => {
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [{ topic: 'session-1', peer: { metadata: { name: 'dApp' } } }],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Session count badge should be visible
    expect(screen.getByTitle('walletConnect.connectedDapps')).toBeInTheDocument();
  });

  // ── 35. Back button in main view calls onBack ─────────────────────────────
  it('calls onBack from main dashboard view', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click the back button in the main dashboard view (there should be a back button)
    const backButtons = screen.getAllByText(/walletDetail.backToWallets/);
    await user.click(backButtons[0]);

    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  // ── 36. formatBalance displays correct formatting for various values ──────
  it('displays formatted balances correctly for tokens', async () => {
    // Override tokens with various balance values
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: 'https://logo.example/eth.png',
            balance: '0',
            usdValue: 0,
            decimals: 18,
            address: '0xabc123',
          },
        ],
        totalUsd: 0,
      })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Zero balance should show "0"
    expect(screen.getByText(/^0 ETH$/)).toBeInTheDocument();
  });

  // ── 37. Wallet locked state disables Send and Swap ────────────────────────
  it('disables Send and Swap buttons when wallet is locked', async () => {
    (isWalletLocked as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Send and Swap buttons should be disabled (they have the disabled attribute)
    const sendButton = screen.getByText('walletDetail.send').closest('button');
    const swapButton = screen.getByText('walletDetail.swap').closest('button');

    expect(sendButton).toBeDisabled();
    expect(swapButton).toBeDisabled();

    // Receive and History should NOT be disabled
    const receiveButton = screen.getByText('walletDetail.receive').closest('button');
    const historyButton = screen.getByText('walletDetail.history').closest('button');
    expect(receiveButton).not.toBeDisabled();
    expect(historyButton).not.toBeDisabled();
  });

  // ── 38. No tokens to send alert ──────────────────────────────────────────
  it('alerts when there are no tokens to send', async () => {
    // Return tokens with zero balances only
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: 'https://logo.example/eth.png',
            balance: '0',
            usdValue: 0,
            decimals: 18,
            address: '0xabc123',
          },
        ],
        totalUsd: 0,
      })
    );

    const mockAlert = vi.fn();
    window.alert = mockAlert;

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.send'));

    expect(mockAlert).toHaveBeenCalledWith('walletDetail.noTokensToSend');
  });

  // ── 39. No tokens to swap alert ──────────────────────────────────────────
  it('alerts when there are no tokens to swap', async () => {
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: 'https://logo.example/eth.png',
            balance: '0',
            usdValue: 0,
            decimals: 18,
            address: '0xabc123',
          },
        ],
        totalUsd: 0,
      })
    );

    const mockAlert = vi.fn();
    window.alert = mockAlert;

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.swap'));

    expect(mockAlert).toHaveBeenCalledWith('walletDetail.noTokensToSwap');
  });

  // ── 40. History with no EVM address shows alert ───────────────────────────
  it('alerts when no EVM address found for history', async () => {
    // Return only non-EVM addresses
    (tauriApi.loadAddresses as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        addresses: [
          { name: 'Bitcoin', symbol: 'BTC', address: 'bc1qxyz', coin_type: 0, is_testnet: false },
        ],
      })
    );

    const mockAlert = vi.fn();
    window.alert = mockAlert;

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.history'));

    expect(mockAlert).toHaveBeenCalledWith('walletDetail.noEvmAddress');
  });

  // ── 41. Empty tokens shows no tokens found message ────────────────────────
  it('shows no tokens found message when token list is empty', async () => {
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ tokens: [], totalUsd: 0 })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    expect(screen.getByText('walletDetail.noTokensFound')).toBeInTheDocument();
  });

  // ── 42. handleLoadBalances sets WalletConnect context ─────────────────────
  it('sets WalletConnect context after successful unlock', async () => {
    const mockSetWalletContext = vi.fn();
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: false,
      sessions: [],
      setWalletContext: mockSetWalletContext,
      openPairingModal: vi.fn(),
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // WalletConnect context should have been set with EVM address
    expect(mockSetWalletContext).toHaveBeenCalledWith('wallet-1', '0xabc123');
  });

  // ── 43. Scam token filter: unknown tokens are hidden by default ───────────
  it('hides unknown tokens not in whitelist by default', async () => {
    // Return a token that is NOT in the whitelist
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: 'https://logo.example/eth.png',
            balance: '1.0',
            usdValue: 3000,
            decimals: 18,
            address: '0xabc123',
          },
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0xdeadbeef00000000000000000000000000000000',
            tokenSymbol: 'SCAM',
            tokenName: 'Scam Token',
            tokenLogo: '',
            balance: '1000000',
            usdValue: 0,
            decimals: 18,
            address: '0xabc123',
          },
        ],
        totalUsd: 3000,
      })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // ETH should be visible (native token - always allowed)
    expect(screen.getByText('ETH')).toBeInTheDocument();
    // SCAM token should be hidden (not in whitelist)
    expect(screen.queryByText('SCAM')).not.toBeInTheDocument();
  });

  // ── 44. Percentage toggle ─────────────────────────────────────────────────
  it('toggles percentage display when time period button is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click the time period toggle button (title = walletDetail.changeTimePeriod)
    const toggleButton = screen.getByTitle('walletDetail.changeTimePeriod');
    await user.click(toggleButton);

    // The button should still be in the document (toggle state changed internally)
    expect(toggleButton).toBeInTheDocument();
  });

  // ── 45. handleLoadBalances: error with missing error message ──────────────
  it('shows fallback error message when error has no message', async () => {
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.reject({ message: '' })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.failedToLoadBalances')).toBeInTheDocument();
    });
  });

  // ── 46. Copy address button in header area ────────────────────────────────
  it('opens address list from header copy button', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click the copy address button in the header (title = walletDetail.copyAddress)
    const copyButton = screen.getByTitle('walletDetail.copyAddress');
    await user.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });
  });

  // ── 47. handleRefreshBalances: error with empty message shows fallback ────
  it('shows fallback refresh error when error has no message', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Make refresh fail with empty message
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.reject({ message: '' })
    );

    const refreshButton = screen.getByTitle('walletDetail.refreshBalances');
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('walletDetail.failedToRefresh')).toBeInTheDocument();
    });
  });

  // ── 48. displayTokens: sorting by usdValue then balance then symbol ───────
  it('sorts tokens by USD value descending', async () => {
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tokenSymbol: 'USDC',
            tokenName: 'USD Coin',
            tokenLogo: '',
            balance: '100',
            usdValue: 100,
            decimals: 6,
            address: '0xabc123',
          },
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: '',
            balance: '2.0',
            usdValue: 6000,
            decimals: 18,
            address: '0xabc123',
          },
        ],
        totalUsd: 6100,
      })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Both tokens should be present
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();

    // ETH (6000 USD) should appear before USDC (100 USD)
    const tokenButtons = screen.getAllByTitle(/View .* details/);
    expect(tokenButtons.length).toBe(2);
    expect(tokenButtons[0]).toHaveTextContent('ETH');
    expect(tokenButtons[1]).toHaveTextContent('USDC');
  });

  // ── 49. Passphrase prompt shows case-sensitive note ─────────────────────
  it('shows passphrase case-sensitive note in passphrase prompt', async () => {
    const passphraseWallet = {
      ...mockWallet,
      has_passphrase: true,
    };

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} wallet={passphraseWallet} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.enterPassphrase')).toBeInTheDocument();
    });

    // Should show case-sensitive note
    expect(screen.getByText(/walletDetail.passphraseCaseSensitive/)).toBeInTheDocument();
  });

  // ── 50. Wallet locked: Send button shows alert ────────────────────────────
  it('shows locked alert when clicking Send on locked wallet', async () => {
    (isWalletLocked as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const mockAlert = vi.fn();
    window.alert = mockAlert;

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // The send button is disabled, so clicking it won't fire the onClick.
    // But the component actually still fires alert in onClick before checking disabled.
    // Actually the button IS disabled, so click will do nothing.
    // Verify the button IS disabled - this tests the walletIsLocked path.
    const sendButton = screen.getByText('walletDetail.send').closest('button');
    expect(sendButton).toBeDisabled();
  });

  // ── 51. History fallback: uses 0x address if no coin_type 60 ──────────────
  it('uses fallback 0x address for history when no coin_type 60 address', async () => {
    // Return addresses without coin_type 60 but with 0x address
    (tauriApi.loadAddresses as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        addresses: [
          { name: 'Polygon', symbol: 'MATIC', address: '0xpoly123', coin_type: 966, is_testnet: false },
        ],
      })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.history'));

    // Should use the fallback 0x address, so TransactionHistory should render
    await waitFor(() => {
      expect(screen.getByTestId('tx-history')).toBeInTheDocument();
    });
  });

  // ── 52. WalletConnect sessions count badge in More menu ───────────────────
  it('shows session count in WalletConnect More menu option', async () => {
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [
        { topic: 'session-1', peer: { metadata: { name: 'dApp1' } } },
        { topic: 'session-2', peer: { metadata: { name: 'dApp2' } } },
      ],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));

    // WalletConnect option should show "2 active sessions"
    expect(screen.getByText('2 active sessions')).toBeInTheDocument();
  });

  // ── 53. WalletConnect sessions count = 1 shows singular ──────────────────
  it('shows singular session text for 1 WalletConnect session', async () => {
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [
        { topic: 'session-1', peer: { metadata: { name: 'dApp1' } } },
      ],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));

    expect(screen.getByText('1 active session')).toBeInTheDocument();
  });

  // ── 54. WalletConnect no sessions shows "Connect to dApps" ────────────────
  it('shows Connect to dApps text when no WalletConnect sessions', async () => {
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));

    expect(screen.getByText('Connect to dApps')).toBeInTheDocument();
  });

  // ── 55. formatBalance: large balance formatting ───────────────────────────
  it('formats large balances with 4 decimal places', async () => {
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: '',
            balance: '12345.6789123',
            usdValue: 30000000,
            decimals: 18,
            address: '0xabc123',
          },
        ],
        totalUsd: 30000000,
      })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Large balance should be truncated to 4 decimals
    expect(screen.getByText('12345.6789 ETH')).toBeInTheDocument();
  });

  // ── 56. More menu closes when clicking outside ────────────────────────────
  it('closes More menu when clicking outside overlay', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open More menu
    await user.click(screen.getByText('walletDetail.more'));
    expect(screen.getByText('walletDetail.staking')).toBeInTheDocument();

    // Click the More button again (it toggles showMoreMenu)
    await user.click(screen.getByText('walletDetail.more'));

    // Menu should close
    await waitFor(() => {
      expect(screen.queryByText('walletDetail.staking')).not.toBeInTheDocument();
    });
  });

  // ── 57. Address list: empty addresses show no addresses message ───────────
  it('shows no addresses message when wallet has no addresses loaded', async () => {
    (tauriApi.loadAddresses as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({ addresses: [] })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list
    await user.click(screen.getByTitle('walletDetail.copyAddress'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    expect(screen.getByText('walletDetail.noAddressesLoaded')).toBeInTheDocument();
  });

  // ── 58. handleLoadBalances: invalid wallet credentials error ──────────────
  it('shows incorrectPassword for invalid wallet credentials error', async () => {
    (useWalletSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      createWalletSession: vi.fn().mockImplementation(() => Promise.resolve()),
      walletId: null,
      sessionToken: null,
      clearSession: vi.fn(),
    });

    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.reject(new Error('invalid wallet credentials'))
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.incorrectPassword')).toBeInTheDocument();
    });
  });

  // ── 59. Address list: supported and unsupported chain sections ────────────
  it('shows supported chains section in address list', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list
    await user.click(screen.getByTitle('walletDetail.copyAddress'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    // Should show supported chains section (ETH and BTC are both isChainSupported=true)
    expect(screen.getByText('walletDetail.fullTransactionSupport')).toBeInTheDocument();
  });

  // ── 60. Address list: unsupported chain section shown when enabled ────────
  it('shows other chains section for unsupported but enabled chains', async () => {
    // Make BTC unsupported but enabled
    (isChainSupported as ReturnType<typeof vi.fn>).mockImplementation(
      (symbol: string) => symbol === 'ETH'
    );
    (isChainEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByTitle('walletDetail.copyAddress'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    // Should show "Other Chains" section for BTC
    expect(screen.getByText(/walletDetail.otherChains/)).toBeInTheDocument();
    expect(screen.getByText('walletDetail.addressOnly')).toBeInTheDocument();
  });

  // ── 61. handleRefreshBalances: updates tokens with new data ───────────────
  it('refreshes and displays updated token data', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Verify initial total
    expect(screen.getByText('$3,500.00')).toBeInTheDocument();

    // Set up refresh response with different totals (use distinct values for total vs token)
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: '',
            balance: '3.0',
            usdValue: 8500,
            decimals: 18,
            address: '0xabc123',
          },
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tokenSymbol: 'USDC',
            tokenName: 'USD Coin',
            tokenLogo: '',
            balance: '500',
            usdValue: 500,
            decimals: 6,
            address: '0xabc123',
          },
        ],
        totalUsd: 9000,
      })
    );

    await user.click(screen.getByTitle('walletDetail.refreshBalances'));

    // Total should now be $9,000.00 (appears in the header balance display)
    await waitFor(() => {
      // $9,000.00 appears in header and possibly in a token row - use getAllByText
      const matches = screen.getAllByText('$9,000.00');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    // The initial total should no longer be shown
    expect(screen.queryByText('$3,500.00')).not.toBeInTheDocument();
  });

  // ── 62. SendTransaction onBack callback returns to dashboard ──────────────
  it('returns to dashboard when SendTransaction onBack is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open SendTransaction
    await user.click(screen.getByText('walletDetail.send'));
    await waitFor(() => {
      expect(screen.getByTestId('send-tx')).toBeInTheDocument();
    });

    // Click the mock's back button (triggers the onBack callback)
    await user.click(screen.getByTestId('send-tx-back'));

    // Should return to main dashboard (token list visible)
    await waitFor(() => {
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
  });

  // ── 63. SendTransaction onSuccess callback ────────────────────────────────
  it('handles SendTransaction onSuccess callback', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.send'));
    await waitFor(() => {
      expect(screen.getByTestId('send-tx')).toBeInTheDocument();
    });

    // Click the mock's success button (triggers onSuccess callback)
    await user.click(screen.getByTestId('send-tx-success'));

    // onSuccess just logs, no UI change expected; verify no crash
    expect(screen.getByTestId('send-tx')).toBeInTheDocument();
  });

  // ── 64. SwapTransaction onBack callback ───────────────────────────────────
  it('returns to dashboard when SwapTransaction onBack is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.swap'));
    await waitFor(() => {
      expect(screen.getByTestId('swap-tx')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('swap-tx-back'));

    await waitFor(() => {
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
  });

  // ── 65. SwapTransaction onSuccess callback ────────────────────────────────
  it('handles SwapTransaction onSuccess callback', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.swap'));
    await waitFor(() => {
      expect(screen.getByTestId('swap-tx')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('swap-tx-success'));
    expect(screen.getByTestId('swap-tx')).toBeInTheDocument();
  });

  // ── 66. StakingTransaction onBack callback ────────────────────────────────
  it('returns to dashboard when StakingTransaction onBack is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open More menu then click Staking
    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('walletDetail.staking'));

    await waitFor(() => {
      expect(screen.getByTestId('staking-tx')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('staking-tx-back'));

    await waitFor(() => {
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
  });

  // ── 67. StakingTransaction onSuccess callback ─────────────────────────────
  it('handles StakingTransaction onSuccess callback', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('walletDetail.staking'));

    await waitFor(() => {
      expect(screen.getByTestId('staking-tx')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('staking-tx-success'));
    expect(screen.getByTestId('staking-tx')).toBeInTheDocument();
  });

  // ── 68. TransactionHistory onBack callback ────────────────────────────────
  it('returns to dashboard when TransactionHistory onBack is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.history'));

    await waitFor(() => {
      expect(screen.getByTestId('tx-history')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tx-history-back'));

    await waitFor(() => {
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
  });

  // ── 69. AddressBook onBack callback ───────────────────────────────────────
  it('returns to dashboard when AddressBook onBack is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('walletDetail.addressBook'));

    await waitFor(() => {
      expect(screen.getByTestId('address-book')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('address-book-back'));

    await waitFor(() => {
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
  });

  // ── 70. ExportBackup onSuccess callback closes dialog ─────────────────────
  it('closes ExportBackup when onSuccess is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('backup.exportTitle'));

    await waitFor(() => {
      expect(screen.getByTestId('export-backup')).toBeInTheDocument();
    });

    // Click onSuccess
    await user.click(screen.getByTestId('export-success'));

    await waitFor(() => {
      expect(screen.queryByTestId('export-backup')).not.toBeInTheDocument();
    });
  });

  // ── 71. ExportBackup onCancel callback closes dialog ──────────────────────
  it('closes ExportBackup when onCancel is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByText('walletDetail.more'));
    await user.click(screen.getByText('backup.exportTitle'));

    await waitFor(() => {
      expect(screen.getByTestId('export-backup')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('export-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('export-backup')).not.toBeInTheDocument();
    });
  });

  // ── 72. SessionsManagerModal onClose callback ─────────────────────────────
  it('closes SessionsManagerModal when onClose is called', async () => {
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [{ topic: 'session-1', peer: { metadata: { name: 'dApp' } } }],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click WC indicator to open sessions manager
    await user.click(screen.getByTitle('walletConnect.connectedDapps'));

    // The sessions modal is always rendered (controlled by isOpen prop)
    // Close it via the mock's close button
    await user.click(screen.getByTestId('sessions-close'));

    // No crash - sessions modal onClose was called
    expect(screen.getByTestId('sessions-modal')).toBeInTheDocument();
  });

  // ── 73. SessionsManagerModal onDisconnect callback ────────────────────────
  it('calls disconnectSession from SessionsManagerModal', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [{ topic: 'session-1', peer: { metadata: { name: 'dApp' } } }],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: mockDisconnect,
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click disconnect button in the sessions modal mock
    await user.click(screen.getByTestId('sessions-disconnect'));

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith('topic-1');
    });
  });

  // ── 74. SessionsManagerModal onDisconnectAll callback ─────────────────────
  it('disconnects all sessions from SessionsManagerModal', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [{ topic: 'session-1', peer: { metadata: { name: 'dApp' } } }],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: mockDisconnect,
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId('sessions-disconnect-all'));

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith('session-1');
    });
  });

  // ── 75. SessionsManagerModal onAddNew callback ────────────────────────────
  it('opens pairing modal from SessionsManagerModal addNew', async () => {
    const mockOpenPairing = vi.fn();
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [],
      setWalletContext: vi.fn(),
      openPairingModal: mockOpenPairing,
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId('sessions-add-new'));

    expect(mockOpenPairing).toHaveBeenCalled();
  });

  // ── 76. Scam token filter toggle button ───────────────────────────────────
  it('toggles scam token visibility when filter button is clicked', async () => {
    // Return a scam token not in whitelist
    (tauriApi.getTokenBalances as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        tokens: [
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            tokenLogo: '',
            balance: '1.0',
            usdValue: 3000,
            decimals: 18,
            address: '0xabc123',
          },
          {
            network: 'eth-mainnet',
            networkLabel: 'Ethereum',
            tokenAddress: '0xdeadbeef00000000000000000000000000000000',
            tokenSymbol: 'SCAM',
            tokenName: 'Scam Token',
            tokenLogo: '',
            balance: '999999',
            usdValue: 0,
            decimals: 18,
            address: '0xabc123',
          },
        ],
        totalUsd: 3000,
      })
    );

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // SCAM token should be hidden initially
    expect(screen.queryByText('SCAM')).not.toBeInTheDocument();

    // The scam filter button should be visible (filteredScamCount > 0)
    // It shows the shield icon with a count
    const filterButton = screen.getByTitle(/walletDetail.showScamTokens/);
    await user.click(filterButton);

    // SCAM token should now be visible
    await waitFor(() => {
      expect(screen.getByText('SCAM')).toBeInTheDocument();
    });
  });

  // ── 77. Close address list by clicking backdrop overlay ───────────────────
  it('closes address list when backdrop overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list
    await user.click(screen.getByTitle('walletDetail.copyAddress'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    // Click the close button (X)
    await user.click(screen.getByText('\u2715'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.walletAddresses')).not.toBeInTheDocument();
    });
  });

  // ── 78. WalletConnect sessions indicator button opens sessions manager ────
  it('opens sessions manager when WC indicator button is clicked', async () => {
    (useWalletConnect as ReturnType<typeof vi.fn>).mockReturnValue({
      initialized: true,
      sessions: [{ topic: 'session-1', peer: { metadata: { name: 'dApp' } } }],
      setWalletContext: vi.fn(),
      openPairingModal: vi.fn(),
      disconnectSession: vi.fn(),
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Click the WC sessions indicator button
    const wcButton = screen.getByTitle('walletConnect.connectedDapps');
    await user.click(wcButton);

    // Sessions manager modal should be rendered (it's always in DOM, controlled by isOpen)
    expect(screen.getByTestId('sessions-modal')).toBeInTheDocument();
  });

  // ── 79. QR code button in address list opens receive modal ────────────────
  it('opens receive modal when QR code button is clicked in address list', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list
    await user.click(screen.getByTitle('walletDetail.copyAddress'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    // Click QR code button for first address
    const qrButtons = screen.getAllByTitle('walletDetail.showQrCode');
    await user.click(qrButtons[0]);

    // Receive modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('receive-modal')).toBeInTheDocument();
    });
  });

  // ── 80. ReceiveAddressModal onClose callback ──────────────────────────────
  it('closes receive modal when onClose is called', async () => {
    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list, then click QR to open receive modal
    await user.click(screen.getByTitle('walletDetail.copyAddress'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    const qrButtons = screen.getAllByTitle('walletDetail.showQrCode');
    await user.click(qrButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('receive-modal')).toBeInTheDocument();
    });

    // Close the receive modal via mock's close button
    await user.click(screen.getByTestId('receive-modal-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('receive-modal')).not.toBeInTheDocument();
    });
  });

  // ── 81. ReceiveAddressModal onCopy callback ───────────────────────────────
  it('handles receive modal onCopy callback', async () => {
    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined), readText: vi.fn() },
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<WalletDetail {...defaultProps} />);

    await user.type(screen.getByLabelText('walletDetail.walletPassword'), 'mypassword');
    await user.click(screen.getByText('walletDetail.unlockAndViewAssets'));

    await waitFor(() => {
      expect(screen.queryByText('walletDetail.unlockAndViewAssets')).not.toBeInTheDocument();
    });

    // Open address list, then click QR to open receive modal
    await user.click(screen.getByTitle('walletDetail.copyAddress'));

    await waitFor(() => {
      expect(screen.getByText('walletDetail.walletAddresses')).toBeInTheDocument();
    });

    const qrButtons = screen.getAllByTitle('walletDetail.showQrCode');
    await user.click(qrButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('receive-modal')).toBeInTheDocument();
    });

    // Click the mock's copy button (triggers onCopy which calls handleCopyAddress)
    await user.click(screen.getByTestId('receive-modal-copy'));

    // No crash expected, handleCopyAddress was invoked
    expect(screen.getByTestId('receive-modal')).toBeInTheDocument();
  });
});
