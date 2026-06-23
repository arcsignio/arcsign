import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SendTransaction, type SendableToken } from '@/components/SendTransaction';

// Mock dependencies
vi.mock('@/services/tauri-api', () => ({
  default: {
    estimateFee: vi.fn(),
    buildTransaction: vi.fn(),
    signTransaction: vi.fn(),
    broadcastTransaction: vi.fn(),
  },
  // Named export used by useSignGate (security check) — default-safe report so
  // the gate never blocks the existing happy-path flows.
  checkTransactionSecurity: vi.fn(async () => ({
    proRequired: false,
    warnings: [],
    riskLevel: 'safe',
  })),
}));

vi.mock('@/stores/dashboardStore', () => ({
  useIsPro: vi.fn(),
}));

vi.mock('@/utils/walletLock', () => ({
  isWalletLocked: vi.fn(),
}));

vi.mock('@/components/AddressBook', () => ({
  AddressBook: ({ onBack, onSelectAddress }: any) => (
    <div data-testid="address-book-mock">
      <button onClick={onBack}>Close AddressBook</button>
      <button onClick={() => onSelectAddress('0xfromAddressBook000000000000000000000000')}>
        Pick Contact
      </button>
    </div>
  ),
}));

import tauriApi, { checkTransactionSecurity } from '@/services/tauri-api';
import { useIsPro } from '@/stores/dashboardStore';
import { isWalletLocked } from '@/utils/walletLock';

// Test data — addresses must be valid hex (0x + 40 hex chars) to pass isValidAddress
const mockEthToken: SendableToken = {
  network: 'eth-mainnet',
  networkLabel: 'Ethereum',
  tokenAddress: '',
  tokenSymbol: 'ETH',
  tokenName: 'Ethereum',
  tokenLogo: '',
  balance: '1.5',
  usdValue: 2500,
  decimals: 18,
  fromAddress: '0xaaaa000000000000000000000000000000000001',
};

const mockUsdcToken: SendableToken = {
  network: 'eth-mainnet',
  networkLabel: 'Ethereum',
  tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  tokenSymbol: 'USDC',
  tokenName: 'USD Coin',
  tokenLogo: '',
  balance: '500.0',
  usdValue: 500,
  decimals: 6,
  fromAddress: '0xaaaa000000000000000000000000000000000001',
};

const mockPolygonToken: SendableToken = {
  network: 'polygon-mainnet',
  networkLabel: 'Polygon',
  tokenAddress: '',
  tokenSymbol: 'MATIC',
  tokenName: 'Polygon',
  tokenLogo: '',
  balance: '100.0',
  usdValue: 80,
  decimals: 18,
  fromAddress: '0xbbbb000000000000000000000000000000000002',
};

const validRecipient = '0xcccc000000000000000000000000000000000003';

const defaultProps = {
  walletId: 'wallet-1',
  availableTokens: [mockEthToken, mockUsdcToken, mockPolygonToken],
  usbPath: '/dev/usb0',
  sessionToken: 'test-session-token',
  onBack: vi.fn(),
  onSuccess: vi.fn(),
};

const mockBuildResponse = {
  id: 'tx-123',
  chainId: 'ethereum',
  from: '0xaaaa000000000000000000000000000000000001',
  to: '0xcccc000000000000000000000000000000000003',
  amount: '500000000000000000',
  fee: '2100000000000000',
  signingPayload: 'base64payload==',
  humanReadable: '{}',
  buildTimestamp: '2026-03-24T00:00:00Z',
};

const mockSignResponse = {
  txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  signature: 'base64sig==',
  serializedTx: 'base64tx==',
  signedBy: '0xaaaa000000000000000000000000000000000001',
  signTimestamp: '2026-03-24T00:00:01Z',
};

const mockBroadcastResponse = {
  txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  submittedAt: '2026-03-24T00:00:02Z',
  status: 'submitted' as const,
};

describe('SendTransaction', () => {
  beforeEach(() => {
    (useIsPro as any).mockReturnValue(false);
    (isWalletLocked as any).mockReturnValue(false);
    (tauriApi.estimateFee as any).mockImplementation(() => Promise.resolve(null));
    (tauriApi.buildTransaction as any).mockImplementation(() => Promise.resolve(mockBuildResponse));
    (tauriApi.signTransaction as any).mockImplementation(() => Promise.resolve(mockSignResponse));
    (tauriApi.broadcastTransaction as any).mockImplementation(() => Promise.resolve(mockBroadcastResponse));
    // mockReset: true clears the factory implementation — restore a default-safe
    // security report so the useSignGate effect never blocks the happy-path flows.
    (checkTransactionSecurity as any).mockImplementation(async () => ({
      proRequired: false,
      warnings: [],
      riskLevel: 'safe',
    }));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Renders token selection step with available tokens
  // ──────────────────────────────────────────────────────────────────────────
  it('renders token selection step with available tokens', () => {
    render(<SendTransaction {...defaultProps} />);

    expect(screen.getByText('Select Token to Send')).toBeInTheDocument();
    expect(screen.getByText('Choose which asset you want to send')).toBeInTheDocument();

    // Token symbols visible
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('MATIC')).toBeInTheDocument();

    // Network group headers — "Ethereum" appears both as networkLabel and tokenName,
    // so use getAllByText and verify at least the network header is present
    const ethereumElements = screen.getAllByText('Ethereum');
    expect(ethereumElements.length).toBeGreaterThanOrEqual(1);
    // Polygon appears as both networkLabel and tokenName too
    const polygonElements = screen.getAllByText('Polygon');
    expect(polygonElements.length).toBeGreaterThanOrEqual(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Shows empty state when no tokens
  // ──────────────────────────────────────────────────────────────────────────
  it('shows empty state when no tokens', () => {
    render(
      <SendTransaction {...defaultProps} availableTokens={[]} />
    );

    expect(screen.getByText('No tokens with balance available to send')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Clicking a token moves to input step
  // ──────────────────────────────────────────────────────────────────────────
  it('clicking a token moves to input step', async () => {
    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Click the ETH token option (the button contains the token symbol text)
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    expect(ethTokenBtn).toBeDefined();
    await user.click(ethTokenBtn!);

    // Should now be on the input step
    expect(screen.getByText('To Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Input step shows recipient address field and amount field
  // ──────────────────────────────────────────────────────────────────────────
  it('input step shows recipient address field and amount field', async () => {
    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Select ETH token
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    await user.click(ethTokenBtn!);

    // Verify input fields present
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0x...')).toBeInTheDocument();
    expect(screen.getByText('Amount (ETH)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument();
    expect(screen.getByText('MAX')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();

    // Change button to go back to token selection
    expect(screen.getByText('Change')).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Shows review step with transaction details
  // ──────────────────────────────────────────────────────────────────────────
  it('shows review step with transaction details', async () => {
    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Select ETH
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    await user.click(ethTokenBtn!);

    // Fill in recipient and amount
    await user.type(screen.getByPlaceholderText('0x...'), validRecipient);
    await user.type(screen.getByPlaceholderText('0.0'), '0.5');

    // Click Continue to build transaction
    await user.click(screen.getByText('Continue'));

    // Wait for review step to appear
    await waitFor(() => {
      expect(screen.getByText('Review Transaction')).toBeInTheDocument();
    });

    // Review details
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Estimated Fee')).toBeInTheDocument();

    // Action buttons
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Confirm & Sign')).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Shows password prompt on review confirmation
  // ──────────────────────────────────────────────────────────────────────────
  it('shows password prompt on review confirmation', async () => {
    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Navigate: select -> input -> review -> password
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    await user.click(ethTokenBtn!);

    await user.type(screen.getByPlaceholderText('0x...'), validRecipient);
    await user.type(screen.getByPlaceholderText('0.0'), '0.5');
    await user.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Confirm & Sign')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Confirm & Sign'));

    // Password step
    expect(screen.getByText('Enter Wallet Password')).toBeInTheDocument();
    expect(screen.getByText('Your password is required to sign this transaction securely.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter wallet password')).toBeInTheDocument();
    expect(screen.getByText('Sign & Send')).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Calls onBack when back button clicked
  // ──────────────────────────────────────────────────────────────────────────
  it('calls onBack when back button clicked on select step', async () => {
    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // On the select step, clicking Back should call onBack
    const backBtn = screen.getByRole('button', { name: /back/i });
    await user.click(backBtn);

    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: Shows success state with tx hash
  // ──────────────────────────────────────────────────────────────────────────
  it('shows success state with tx hash', async () => {
    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Navigate through the full flow: select -> input -> review -> password -> success
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    await user.click(ethTokenBtn!);

    await user.type(screen.getByPlaceholderText('0x...'), validRecipient);
    await user.type(screen.getByPlaceholderText('0.0'), '0.5');
    await user.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Confirm & Sign')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Confirm & Sign'));

    // Enter password and sign
    await user.type(screen.getByPlaceholderText('Enter wallet password'), 'mypassword');
    await user.click(screen.getByText('Sign & Send'));

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText('Transaction Submitted!')).toBeInTheDocument();
    });

    expect(screen.getByText('Transaction Hash')).toBeInTheDocument();
    expect(screen.getByText('View on Explorer →')).toBeInTheDocument();
    expect(screen.getByText('Send Another')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 9: Shows error state with error message
  // ──────────────────────────────────────────────────────────────────────────
  it('shows error state when broadcast fails', async () => {
    (tauriApi.broadcastTransaction as any).mockImplementation(() =>
      Promise.reject({ message: 'Network congestion — please try again' })
    );

    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Navigate: select -> input -> review -> password -> error
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    await user.click(ethTokenBtn!);

    await user.type(screen.getByPlaceholderText('0x...'), validRecipient);
    await user.type(screen.getByPlaceholderText('0.0'), '0.5');
    await user.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Confirm & Sign')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Confirm & Sign'));

    await user.type(screen.getByPlaceholderText('Enter wallet password'), 'mypassword');
    await user.click(screen.getByText('Sign & Send'));

    // Wait for error step
    await waitFor(() => {
      expect(screen.getByText('Transaction Failed')).toBeInTheDocument();
    });

    // Error message appears in both the error banner and the error-view paragraph
    const errorMessages = screen.getAllByText('Network congestion — please try again');
    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 10: Handles the full send flow (select -> input -> review -> password -> success)
  // ──────────────────────────────────────────────────────────────────────────
  it('handles the full send flow and calls onSuccess with tx hash', async () => {
    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Step 1: Select token
    expect(screen.getByText('Select Token to Send')).toBeInTheDocument();
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    await user.click(ethTokenBtn!);

    // Step 2: Input
    await user.type(screen.getByPlaceholderText('0x...'), validRecipient);
    await user.type(screen.getByPlaceholderText('0.0'), '0.5');
    await user.click(screen.getByText('Continue'));

    // Step 3: Review
    await waitFor(() => {
      expect(screen.getByText('Review Transaction')).toBeInTheDocument();
    });

    // Verify buildTransaction was called
    expect(tauriApi.buildTransaction).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Confirm & Sign'));

    // Step 4: Password
    expect(screen.getByText('Enter Wallet Password')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Enter wallet password'), 'mypassword');
    await user.click(screen.getByText('Sign & Send'));

    // Steps 5 & 6: Signing -> Broadcasting -> Success
    await waitFor(() => {
      expect(screen.getByText('Transaction Submitted!')).toBeInTheDocument();
    });

    // Verify all API calls were made
    expect(tauriApi.signTransaction).toHaveBeenCalledTimes(1);
    expect(tauriApi.broadcastTransaction).toHaveBeenCalledTimes(1);

    // Verify onSuccess callback
    expect(defaultProps.onSuccess).toHaveBeenCalledWith(mockBroadcastResponse.txHash);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 11: Empty state Go Back button calls onBack
  // ──────────────────────────────────────────────────────────────────────────
  it('empty state Go Back button calls onBack', async () => {
    const user = userEvent.setup();
    render(
      <SendTransaction {...defaultProps} availableTokens={[]} />
    );

    await user.click(screen.getByText('Go Back'));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 12: Shows build transaction error in error banner
  // ──────────────────────────────────────────────────────────────────────────
  it('shows build transaction error in error banner', async () => {
    (tauriApi.buildTransaction as any).mockImplementation(() =>
      Promise.reject({ message: 'Insufficient balance for gas' })
    );

    const user = userEvent.setup();
    render(<SendTransaction {...defaultProps} />);

    // Select ETH
    const ethButtons = screen.getAllByRole('button');
    const ethTokenBtn = ethButtons.find(
      (btn) => btn.classList.contains('token-option') && btn.textContent?.includes('ETH')
    );
    await user.click(ethTokenBtn!);

    // Fill valid inputs
    await user.type(screen.getByPlaceholderText('0x...'), validRecipient);
    await user.type(screen.getByPlaceholderText('0.0'), '0.5');
    await user.click(screen.getByText('Continue'));

    // Wait for error to appear in the error banner (not error step — build errors stay on input)
    await waitFor(() => {
      expect(screen.getByText('Insufficient balance for gas')).toBeInTheDocument();
    });
  });
});
