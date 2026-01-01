/**
 * Membership Settings Page
 * Feature: ArcSign Pro NFT Membership System
 *
 * Allows users to:
 * 1. View aggregated membership status across ALL BSC addresses
 * 2. See NFT breakdown by address
 * 3. Mint Pro NFT directly (integrated, no WebSocket needed)
 *
 * Wallet limit formula: 3 + (totalNftCount * 3)
 * - Free (0 NFT): 3 wallets
 * - 1 NFT: 6 wallets
 * - 2 NFTs: 9 wallets, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDashboardStore, useMembershipStatus } from '@/stores/dashboardStore';
import tauriApi, {
  type BuildTransactionResponse,
  type SignTransactionResponse,
  type QueryTransactionStatusResponse,
  type AggregatedMembershipStatus,
  type DeviceMembershipStatus,
} from '@/services/tauri-api';

interface MembershipSettingsProps {
  onBack: () => void;
  usbPath: string;
}

interface BscAddress {
  walletId: string;
  walletName: string;
  address: string;
  hasPassphrase?: boolean;
}

// Contract addresses - same as mint-page config
const IS_TESTNET = true; // TODO: Set to false for mainnet
const TESTNET_CONTRACT = '0x401b0D7D9Ae46fDF75d92d8F218b1F15Dd2DFEc1';
const TESTNET_USDT = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd';
const MAINNET_CONTRACT = '0x0000000000000000000000000000000000000000';
const MAINNET_USDT = '0x55d398326f99059fF775485246999027B3197955';
const CONTRACT_ADDRESS = IS_TESTNET ? TESTNET_CONTRACT : MAINNET_CONTRACT;
const USDT_ADDRESS = IS_TESTNET ? TESTNET_USDT : MAINNET_USDT;
const BLOCK_EXPLORER_URL = IS_TESTNET ? 'https://testnet.bscscan.com' : 'https://bscscan.com';
const CHAIN_ID = IS_TESTNET ? 'bnb-testnet' : 'bnb';
// Membership price in USDT (18 decimals)
// Testnet: 5 USDT = '5000000000000000000' (for testing with limited testnet USDT)
// Mainnet: 30 USDT = '30000000000000000000'
const MEMBERSHIP_PRICE = IS_TESTNET ? '5000000000000000000' : '30000000000000000000';

// ERC-20 approve function selector
const APPROVE_SELECTOR = '0x095ea7b3';
// NFT mint function selector
const MINT_SELECTOR = '0x1249c58b';

type MintStep = 'idle' | 'approve' | 'approving' | 'waiting_confirmation' | 'mint' | 'minting' | 'success' | 'error';

// Convert technical error messages to user-friendly messages
const formatUserFriendlyError = (errorMessage: string): string => {
  const lowerMsg = errorMessage.toLowerCase();

  // Check for common contract revert reasons
  if (lowerMsg.includes('transfer amount exceeds balance') ||
      lowerMsg.includes('bep20: transfer amount exceeds balance')) {
    return 'Insufficient USDT balance. Please ensure you have at least 5 USDT (testnet) or 30 USDT (mainnet) in your wallet.';
  }

  if (lowerMsg.includes('transfer amount exceeds allowance') ||
      lowerMsg.includes('bep20: transfer amount exceeds allowance')) {
    return 'USDT allowance not set. Please approve USDT spending first.';
  }

  if (lowerMsg.includes('insufficient balance') || lowerMsg.includes('insufficient funds')) {
    return 'Insufficient balance. Please check your USDT and BNB balance.';
  }

  if (lowerMsg.includes('insufficient allowance')) {
    return 'USDT approval required. Please approve the contract to spend your USDT.';
  }

  if (lowerMsg.includes('gas required exceeds')) {
    return 'Transaction requires more gas than allowed. Please try again.';
  }

  if (lowerMsg.includes('nonce too low')) {
    return 'Transaction nonce conflict. Please wait a moment and try again.';
  }

  // Return a cleaned up version of the original message
  // Try to extract the most useful part
  const revertMatch = errorMessage.match(/Transaction will fail:\s*(.+?)(?:\s*\(|$)/i);
  if (revertMatch && revertMatch[1]) {
    return revertMatch[1].trim();
  }

  // If it's a very long message, truncate it
  if (errorMessage.length > 150) {
    return errorMessage.substring(0, 147) + '...';
  }

  return errorMessage;
};

export const MembershipSettings: React.FC<MembershipSettingsProps> = ({ onBack, usbPath }) => {
  const [bscAddresses, setBscAddresses] = useState<BscAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Device membership state
  const [deviceStatus, setDeviceStatus] = useState<DeviceMembershipStatus | null>(null);
  const [isLoadingDevice, setIsLoadingDevice] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [copiedDeviceHash, setCopiedDeviceHash] = useState(false);
  // Device unlock state - password input for unlocking device info
  const [isDeviceLocked, setIsDeviceLocked] = useState(true);
  const [showDevicePasswordDialog, setShowDevicePasswordDialog] = useState(false);
  const [devicePassword, setDevicePassword] = useState('');

  // App password for mint transactions (cleared after use)
  const [mintAppPassword, setMintAppPassword] = useState('');
  const [showMintAppPasswordDialog, setShowMintAppPasswordDialog] = useState(false);

  // Mint state - for minting from a selected address
  const [mintStep, setMintStep] = useState<MintStep>('idle');
  const [mintError, setMintError] = useState<string | null>(null);
  const [walletPassword, setWalletPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'mint' | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const [confirmationProgress, setConfirmationProgress] = useState<string>('');
  // Selected address for minting (temporary, not persisted)
  const [selectedMintAddress, setSelectedMintAddress] = useState<string | null>(null);

  const membership = useMembershipStatus();
  const { wallets, setMembership } = useDashboardStore();

  // Get selected wallet info for minting
  const getSelectedWallet = useCallback(() => {
    if (!selectedMintAddress) return null;
    return bscAddresses.find(addr => addr.address === selectedMintAddress) || null;
  }, [selectedMintAddress, bscAddresses]);

  // Load all BSC addresses and check membership on mount
  // Device info is NOT loaded automatically - requires explicit unlock
  useEffect(() => {
    loadBscAddressesAndCheckMembership();
  }, [wallets]);

  const loadBscAddressesAndCheckMembership = async () => {
    setIsLoading(true);
    setError(null);
    const addresses: BscAddress[] = [];

    try {
      // Extract all BSC addresses from all wallets
      for (const wallet of wallets) {
        if (wallet.addresses) {
          const bscAddr = wallet.addresses.find(
            (addr) => addr.symbol === 'BNB' || addr.symbol === 'BSC'
          );

          if (bscAddr) {
            addresses.push({
              walletId: wallet.id,
              walletName: wallet.name,
              address: bscAddr.address,
            });
          }
        }
      }

      setBscAddresses(addresses);

      // Auto-check membership across ALL addresses
      if (addresses.length > 0) {
        await checkAllMemberships(addresses.map(a => a.address));
      }
    } catch (err) {
      console.error('Failed to load BSC addresses:', err);
      setError('Failed to load wallet addresses');
    } finally {
      setIsLoading(false);
    }
  };

  // Check membership across ALL BSC addresses
  const checkAllMemberships = async (addresses: string[]) => {
    setIsChecking(true);
    setError(null);

    try {
      const result: AggregatedMembershipStatus = await tauriApi.checkAllMemberships(addresses);

      setMembership({
        isPro: result.isPro,
        nftCount: result.totalNftCount,
        daysRemaining: result.daysRemaining,
        walletLimit: result.walletLimit,
        addressNftCounts: result.addressNftCounts,
      });

      if (result.isPro) {
        setSuccessMessage(`Pro membership verified! Total NFTs: ${result.totalNftCount}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check membership';
      setError(errorMessage);
    } finally {
      setIsChecking(false);
    }
  };

  const handleRefresh = () => {
    if (bscAddresses.length > 0) {
      checkAllMemberships(bscAddresses.map(a => a.address));
    }
    // Device info refresh requires re-unlocking (for security)
  };

  // Load device membership status from USB storage - requires password
  const loadDeviceMembershipStatus = async (password: string) => {
    setIsLoadingDevice(true);
    setDeviceError(null);

    try {
      const status = await tauriApi.getDeviceMembershipStatus({
        usbPath,
        appPassword: password,
      });
      setDeviceStatus(status);
      setIsDeviceLocked(false);
      console.log('Device membership status loaded:', status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load device status';
      // Check if it's a password error
      if (errorMessage.toLowerCase().includes('password') ||
          errorMessage.toLowerCase().includes('decrypt') ||
          errorMessage.toLowerCase().includes('invalid')) {
        setDeviceError('Incorrect password. Please try again.');
      } else {
        setDeviceError(errorMessage);
      }
      console.error('Failed to load device membership:', err);
    } finally {
      setIsLoadingDevice(false);
    }
  };

  // Handle device unlock button click
  const handleUnlockDevice = () => {
    setDevicePassword('');
    setDeviceError(null);
    setShowDevicePasswordDialog(true);
  };

  // Execute device unlock with password
  const executeDeviceUnlock = async () => {
    if (!devicePassword) return;

    setShowDevicePasswordDialog(false);
    await loadDeviceMembershipStatus(devicePassword);
    // Clear password from memory immediately after use
    setDevicePassword('');
  };

  // Cancel device password dialog
  const cancelDevicePasswordDialog = () => {
    setShowDevicePasswordDialog(false);
    setDevicePassword('');
  };

  // Lock device info (clear from memory)
  const handleLockDevice = () => {
    setDeviceStatus(null);
    setIsDeviceLocked(true);
    setDeviceError(null);
  };

  // Copy device hash to clipboard
  const copyDeviceHash = async () => {
    if (!deviceStatus?.deviceIdHash) return;

    try {
      await navigator.clipboard.writeText(deviceStatus.deviceIdHash);
      setCopiedDeviceHash(true);
      setTimeout(() => setCopiedDeviceHash(false), 2000);
    } catch (err) {
      console.error('Failed to copy device hash:', err);
    }
  };

  // Encode ERC-20 approve(address, uint256) call data
  const encodeApproveData = (spender: string, amount: string): string => {
    // approve(address,uint256) function selector: 0x095ea7b3
    // address is padded to 32 bytes
    // amount is padded to 32 bytes
    const spenderPadded = spender.slice(2).toLowerCase().padStart(64, '0');
    // Convert amount to hex and pad to 32 bytes
    const amountHex = BigInt(amount).toString(16).padStart(64, '0');
    return `${APPROVE_SELECTOR}${spenderPadded}${amountHex}`;
  };

  // Encode NFT mint() call data (no arguments)
  const encodeMintData = (): string => {
    return MINT_SELECTOR;
  };

  // Wait for transaction confirmation with polling
  const waitForConfirmation = async (
    txHash: string,
    maxAttempts: number = 60,
    intervalMs: number = 3000
  ): Promise<{ confirmed: boolean; error?: string }> => {
    console.log(`Waiting for transaction confirmation: ${txHash}`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setConfirmationProgress(`Waiting for confirmation... (${attempt}/${maxAttempts})`);

        const status: QueryTransactionStatusResponse = await tauriApi.queryTransactionStatus({
          chainId: CHAIN_ID,
          txHash: txHash,
          usbPath,
          appPassword: mintAppPassword,
        });

        console.log(`Attempt ${attempt}: Transaction status:`, status);

        if (status.status === 'confirmed') {
          console.log('Transaction confirmed!', status);
          return { confirmed: true };
        }

        if (status.status === 'failed') {
          console.log('Transaction failed!', status);
          return { confirmed: false, error: 'Transaction failed on chain' };
        }

        // Transaction still pending, wait and retry
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (err) {
        console.error(`Attempt ${attempt}: Error checking status:`, err);
        // Continue polling even if individual query fails
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    return { confirmed: false, error: 'Transaction confirmation timeout (3 minutes)' };
  };

  // Build, sign, and broadcast a transaction
  const executeTransaction = async (
    to: string,
    data: string,
    description: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    const selectedWallet = getSelectedWallet();
    if (!selectedWallet || !selectedMintAddress) {
      return { success: false, error: 'No wallet selected for minting' };
    }

    try {
      console.log(`Building ${description} transaction...`);

      // Step 1: Build transaction
      const buildResult: BuildTransactionResponse = await tauriApi.buildTransaction({
        chainId: CHAIN_ID,
        from: selectedMintAddress,
        to: to,
        amount: '0', // No native token value for ERC-20 calls
        data: data,
        usbPath,
        appPassword: mintAppPassword,
      });

      console.log('Build result:', buildResult);

      // Step 2: Sign transaction
      console.log(`Signing ${description} transaction...`);
      const signResult: SignTransactionResponse = await tauriApi.signTransaction({
        chainId: CHAIN_ID,
        walletId: selectedWallet.walletId,
        password: walletPassword,
        passphrase: '', // TODO: Support passphrase if wallet uses it
        fromAddress: selectedMintAddress,
        unsignedTx: buildResult,
        usbPath,
        appPassword: mintAppPassword,
      });

      console.log('Sign result:', signResult);

      // Step 3: Broadcast transaction
      console.log(`Broadcasting ${description} transaction...`);
      const broadcastResult = await tauriApi.broadcastTransaction({
        chainId: CHAIN_ID,
        signedTx: signResult,
        usbPath,
        appPassword: mintAppPassword,
      });

      console.log('Broadcast result:', broadcastResult);
      return { success: true, txHash: broadcastResult.txHash };
    } catch (err) {
      console.error(`${description} transaction failed:`, err);
      // Handle different error formats: Error instance, AppError object, or string
      let errorMessage: string;
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        // AppError from tauri-api: { code, message, details }
        errorMessage = (err as { message: string }).message;
      } else {
        errorMessage = String(err);
      }
      // Convert technical error messages to user-friendly messages
      errorMessage = formatUserFriendlyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Start the upgrade/mint process - requires selecting an address first
  // First step: request app password for transaction operations
  const handleUpgrade = (address: string) => {
    setSelectedMintAddress(address);
    setMintAppPassword('');
    setShowMintAppPasswordDialog(true);
    setMintError(null);
    setTxHash(null);
  };

  // Execute after app password is provided
  const proceedWithMint = () => {
    if (!mintAppPassword) return;
    setShowMintAppPasswordDialog(false);
    setMintStep('approve');
  };

  // Cancel app password dialog for mint
  const cancelMintAppPasswordDialog = () => {
    setShowMintAppPasswordDialog(false);
    setSelectedMintAddress(null);
    setMintAppPassword('');
  };

  // Request wallet password for a specific action
  const requestPassword = (action: 'approve' | 'mint') => {
    setPendingAction(action);
    setWalletPassword('');
    setShowPasswordDialog(true);
  };

  // Cancel wallet password dialog
  const cancelPasswordDialog = () => {
    setShowPasswordDialog(false);
    setPendingAction(null);
    setWalletPassword('');
  };

  // Execute the pending action with password
  const executeWithPassword = async () => {
    if (!walletPassword || !pendingAction) return;

    setShowPasswordDialog(false);

    if (pendingAction === 'approve') {
      await handleApprove();
    } else if (pendingAction === 'mint') {
      await handleMint();
    }

    // Clear password from memory
    setWalletPassword('');
    setPendingAction(null);
  };

  // Execute USDT approve transaction
  const handleApprove = async () => {
    setMintStep('approving');
    setMintError(null);
    setConfirmationProgress('');

    const data = encodeApproveData(CONTRACT_ADDRESS, MEMBERSHIP_PRICE);
    const result = await executeTransaction(USDT_ADDRESS, data, 'USDT Approve');

    if (result.success && result.txHash) {
      // Store the approve tx hash for reference
      setApproveTxHash(result.txHash);

      // Wait for transaction confirmation
      setMintStep('waiting_confirmation');
      const confirmation = await waitForConfirmation(result.txHash);

      if (confirmation.confirmed) {
        console.log('Approve transaction confirmed, proceeding to mint step');
        setConfirmationProgress('');
        setMintStep('mint');
      } else {
        setMintError(confirmation.error || 'Approval transaction not confirmed');
        setMintStep('error');
      }
    } else {
      setMintError(result.error || 'Approval failed');
      setMintStep('error');
    }
  };

  // Execute NFT mint transaction
  const handleMint = async () => {
    setMintStep('minting');
    setMintError(null);

    const data = encodeMintData();
    const result = await executeTransaction(CONTRACT_ADDRESS, data, 'NFT Mint');

    if (result.success) {
      setTxHash(result.txHash || null);
      setMintStep('success');
      // Refresh membership status after successful mint
      if (bscAddresses.length > 0) {
        setTimeout(() => checkAllMemberships(bscAddresses.map(a => a.address)), 2000);
      }
    } else {
      setMintError(result.error || 'Mint failed');
      setMintStep('error');
    }
  };

  // Cancel/reset the mint process
  const cancelMint = () => {
    setMintStep('idle');
    setMintError(null);
    setTxHash(null);
    setApproveTxHash(null);
    setConfirmationProgress('');
    setWalletPassword('');
    setPendingAction(null);
    setShowPasswordDialog(false);
    // Clear app password from memory
    setMintAppPassword('');
    setSelectedMintAddress(null);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="membership-settings">
      <button onClick={onBack} className="back-button">
        ← Back to Settings
      </button>

      <header className="page-header">
        <h1>Membership</h1>
        <p className="page-description">
          Your Pro membership is calculated from NFTs across all your BSC addresses.
          Each NFT adds 5 wallets to your limit.
        </p>
      </header>

      {/* Error/Success Messages */}
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Current Status */}
      <section className="status-section">
        <div className="status-header">
          <h2>Current Status</h2>
          <button
            onClick={handleRefresh}
            disabled={isChecking || bscAddresses.length === 0}
            className="refresh-btn"
          >
            {isChecking ? '...' : '↻ Refresh'}
          </button>
        </div>

        <div className={`status-card ${membership.isPro ? 'pro' : 'free'}`}>
          <div className="status-badge">
            {membership.isPro ? '⭐ Pro Member' : 'Free Tier'}
          </div>

          <div className="status-details">
            <div className="detail-row">
              <span className="label">Total NFTs Owned</span>
              <span className="value">{membership.nftCount}</span>
            </div>
            <div className="detail-row">
              <span className="label">Wallet Limit</span>
              <span className="value">{membership.walletLimit} wallets</span>
            </div>
            <div className="detail-row">
              <span className="label">Current Usage</span>
              <span className="value">{wallets.length} / {membership.walletLimit}</span>
            </div>
            {membership.isPro && (
              <div className="detail-row">
                <span className="label">Status</span>
                <span className="value status-active">Active</span>
              </div>
            )}
          </div>

          {/* NFT breakdown by address */}
          {membership.addressNftCounts && membership.addressNftCounts.length > 0 && (
            <div className="nft-breakdown">
              <h4>NFT Breakdown by Address</h4>
              {membership.addressNftCounts.map((item) => (
                <div key={item.address} className="breakdown-row">
                  <span className="breakdown-address">{formatAddress(item.address)}</span>
                  <span className="breakdown-count">{item.nftCount} NFT{item.nftCount !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Show upgrade options if not Pro */}
          {!membership.isPro && mintStep === 'idle' && bscAddresses.length > 0 && (
            <div className="upgrade-section">
              <p className="upgrade-hint">Select an address to mint a Pro NFT:</p>
              <div className="mint-address-list">
                {bscAddresses.map((item) => (
                  <button
                    key={item.address}
                    className="mint-address-btn"
                    onClick={() => handleUpgrade(item.address)}
                  >
                    <span className="wallet-name">{item.walletName}</span>
                    <span className="address">{formatAddress(item.address)}</span>
                    <span className="mint-label">Mint NFT →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mint Flow UI */}
          {mintStep !== 'idle' && mintStep !== 'success' && (
            <div className="mint-flow">
              {/* Step indicators */}
              <div className="mint-steps">
                <div className={`mint-step ${mintStep === 'approve' || mintStep === 'approving' || mintStep === 'waiting_confirmation' ? 'active' : ''} ${mintStep === 'mint' || mintStep === 'minting' ? 'completed' : ''}`}>
                  <span className="step-number">1</span>
                  <span className="step-label">Approve USDT</span>
                </div>
                <div className="step-connector" />
                <div className={`mint-step ${mintStep === 'mint' || mintStep === 'minting' ? 'active' : ''}`}>
                  <span className="step-number">2</span>
                  <span className="step-label">Mint NFT</span>
                </div>
              </div>

              {/* Approve Step */}
              {mintStep === 'approve' && (
                <div className="mint-action">
                  <p className="mint-description">
                    First, approve the contract to spend 30 USDT on your behalf.
                  </p>
                  <button onClick={() => requestPassword('approve')} className="mint-btn">
                    Approve 30 USDT
                  </button>
                  <button onClick={cancelMint} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              )}

              {/* Approving Step */}
              {mintStep === 'approving' && (
                <div className="mint-action">
                  <div className="mint-spinner" />
                  <p className="mint-status">Approving USDT...</p>
                  <p className="mint-hint">Please wait while the transaction is being processed.</p>
                </div>
              )}

              {/* Waiting for Confirmation Step */}
              {mintStep === 'waiting_confirmation' && (
                <div className="mint-action">
                  <div className="mint-spinner" />
                  <p className="mint-status">Waiting for Confirmation...</p>
                  <p className="mint-hint">{confirmationProgress || 'Please wait for blockchain confirmation.'}</p>
                  {approveTxHash && (
                    <a
                      href={`${BLOCK_EXPLORER_URL}/tx/${approveTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link-small"
                    >
                      View Transaction →
                    </a>
                  )}
                </div>
              )}

              {/* Mint Step */}
              {mintStep === 'mint' && (
                <div className="mint-action">
                  <p className="mint-description">
                    USDT approved! Now mint your Pro NFT.
                  </p>
                  <button onClick={() => requestPassword('mint')} className="mint-btn primary">
                    Mint Pro NFT
                  </button>
                  <button onClick={cancelMint} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              )}

              {/* Minting Step */}
              {mintStep === 'minting' && (
                <div className="mint-action">
                  <div className="mint-spinner" />
                  <p className="mint-status">Minting NFT...</p>
                  <p className="mint-hint">Please wait while the transaction is being processed.</p>
                </div>
              )}

              {/* Error Step */}
              {mintStep === 'error' && (
                <div className="mint-action error">
                  <p className="mint-error">{mintError}</p>
                  <button onClick={cancelMint} className="mint-btn">
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success State */}
          {mintStep === 'success' && (
            <div className="mint-success">
              <div className="success-icon">✓</div>
              <h3>Welcome to Pro!</h3>
              <p>Your membership is now active for 1 year.</p>
              {txHash && (
                <a
                  href={`${BLOCK_EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  View Transaction →
                </a>
              )}
              <button onClick={cancelMint} className="mint-btn done">
                Done
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Password Dialog */}
      {showPasswordDialog && (
        <div className="password-overlay">
          <div className="password-dialog">
            <h3>Enter Wallet Password</h3>
            <p className="wallet-name-hint">
              Wallet: <strong>{getSelectedWallet()?.walletName || 'Unknown'}</strong>
            </p>
            <p className="password-hint">
              {pendingAction === 'approve'
                ? 'Your password is required to sign the USDT approval transaction.'
                : 'Your password is required to sign the NFT mint transaction.'
              }
            </p>
            <input
              type="password"
              value={walletPassword}
              onChange={(e) => setWalletPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeWithPassword()}
              placeholder="Wallet password"
              autoFocus
              className="password-input"
            />
            <div className="password-actions">
              <button onClick={cancelPasswordDialog} className="cancel-btn">
                Cancel
              </button>
              <button
                onClick={executeWithPassword}
                disabled={!walletPassword}
                className="confirm-btn"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Password Dialog for Mint */}
      {showMintAppPasswordDialog && (
        <div className="password-overlay">
          <div className="password-dialog">
            <h3>Enter App Password</h3>
            <p className="wallet-name-hint">
              Minting from: <strong>{getSelectedWallet()?.walletName || 'Unknown'}</strong>
            </p>
            <p className="password-hint">
              Your app password is required to perform transaction operations.
            </p>
            <input
              type="password"
              value={mintAppPassword}
              onChange={(e) => setMintAppPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && proceedWithMint()}
              placeholder="App password"
              autoFocus
              className="password-input"
            />
            <div className="password-actions">
              <button onClick={cancelMintAppPasswordDialog} className="cancel-btn">
                Cancel
              </button>
              <button
                onClick={proceedWithMint}
                disabled={!mintAppPassword}
                className="confirm-btn"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Information Section */}
      <section className="device-section">
        <h2>Device Information</h2>
        <p className="section-description">
          Your USB device has a unique ID that can be bound to NFT memberships for hardware-level security.
        </p>

        {isLoadingDevice ? (
          <div className="device-card">
            <div className="loading">Loading device information...</div>
          </div>
        ) : isDeviceLocked ? (
          /* Locked State - Show unlock button */
          <div className="device-card locked">
            <div className="locked-content">
              <div className="lock-icon">🔒</div>
              <p className="locked-message">Device information is locked</p>
              <p className="locked-hint">Enter your app password to view device details and membership bindings.</p>
              {deviceError && (
                <p className="device-error">{deviceError}</p>
              )}
              <button onClick={handleUnlockDevice} className="unlock-btn">
                Unlock with Password
              </button>
            </div>
          </div>
        ) : deviceStatus ? (
          /* Unlocked State - Show device info */
          <div className="device-card">
            <div className="device-header">
              <span className="unlocked-badge">🔓 Unlocked</span>
              <button onClick={handleLockDevice} className="lock-btn" title="Lock device info">
                Lock
              </button>
            </div>

            <div className="device-detail-row">
              <span className="device-label">Device ID</span>
              <span className="device-value mono">{deviceStatus.deviceId}</span>
            </div>

            <div className="device-detail-row">
              <span className="device-label">Device Hash (for contract binding)</span>
              <div className="device-hash-container">
                <span className="device-value mono hash">{deviceStatus.deviceIdHash}</span>
                <button
                  onClick={copyDeviceHash}
                  className="copy-btn"
                  title="Copy device hash"
                >
                  {copiedDeviceHash ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>
            </div>

            <div className="device-detail-row">
              <span className="device-label">Wallet Limit (USB-based)</span>
              <span className="device-value">{deviceStatus.walletLimit} wallets</span>
            </div>

            <div className="device-detail-row">
              <span className="device-label">Current Wallets</span>
              <span className="device-value">{deviceStatus.walletCount} / {deviceStatus.walletLimit}</span>
            </div>

            <div className="device-detail-row">
              <span className="device-label">Can Create More</span>
              <span className={`device-value ${deviceStatus.canCreateWallet ? 'success' : 'warning'}`}>
                {deviceStatus.canCreateWallet ? '✓ Yes' : '✗ Limit reached'}
              </span>
            </div>

            {/* NFT Bindings */}
            {deviceStatus.memberships && deviceStatus.memberships.length > 0 && (
              <div className="device-bindings">
                <h4>NFT Bindings on This Device</h4>
                {deviceStatus.memberships.map((binding, index) => (
                  <div key={index} className={`binding-row ${binding.isValid ? 'valid' : 'invalid'}`}>
                    <div className="binding-info">
                      <span className="binding-label">Token #{binding.nftTokenId}</span>
                      <span className="binding-chain">{binding.chainId}</span>
                      <span className={`binding-status ${binding.isValid ? 'valid' : 'invalid'}`}>
                        {binding.isValid ? '✓ Valid' : '✗ Invalid'}
                      </span>
                    </div>
                    <div className="binding-address mono">{formatAddress(binding.boundAddress)}</div>
                  </div>
                ))}
              </div>
            )}

            {deviceStatus.memberships.length === 0 && membership.isPro && (
              <div className="binding-hint">
                <p>💡 <strong>Tip:</strong> You own Pro NFTs but haven't bound them to this device yet.</p>
                <p>Binding NFTs to your USB device adds hardware-level security and prevents multi-device sharing.</p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Device Password Dialog */}
      {showDevicePasswordDialog && (
        <div className="password-overlay">
          <div className="password-dialog">
            <h3>Unlock Device Information</h3>
            <p className="password-hint">
              Enter your app password to view device details and membership bindings.
            </p>
            <input
              type="password"
              value={devicePassword}
              onChange={(e) => setDevicePassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && executeDeviceUnlock()}
              placeholder="App password"
              autoFocus
              className="password-input"
            />
            <div className="password-actions">
              <button onClick={cancelDevicePasswordDialog} className="cancel-btn">
                Cancel
              </button>
              <button
                onClick={executeDeviceUnlock}
                disabled={!devicePassword}
                className="confirm-btn"
              >
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Your BSC Addresses */}
      {isLoading ? (
        <section className="address-section">
          <div className="loading">Loading addresses...</div>
        </section>
      ) : bscAddresses.length === 0 ? (
        <section className="address-section">
          <div className="no-addresses">
            <p>No BSC addresses found.</p>
            <p className="hint">Create a wallet first to get your BSC address.</p>
          </div>
        </section>
      ) : null}

      {/* Pro Benefits */}
      <section className="benefits-section">
        <h2>Pro Benefits</h2>
        <ul className="benefits-list">
          <li>
            <span className="check">✓</span>
            Unlimited wallet creation
          </li>
          <li>
            <span className="check">✓</span>
            Priority support
          </li>
          <li>
            <span className="check">✓</span>
            Early access to new features
          </li>
          <li>
            <span className="check">✓</span>
            Earn points for future airdrops
          </li>
        </ul>
      </section>

      <style>{`
        .membership-settings {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .back-button {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 0;
          margin-bottom: 16px;
        }

        .back-button:hover {
          text-decoration: underline;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .page-header h1 {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 600;
          color: #111827;
        }

        .page-description {
          margin: 0;
          color: #6b7280;
          font-size: 16px;
        }

        .error-message {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          margin-bottom: 16px;
        }

        .success-message {
          padding: 12px 16px;
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          color: #166534;
          margin-bottom: 16px;
        }

        section {
          margin-bottom: 32px;
        }

        section h2 {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .section-description {
          margin: 0 0 16px;
          color: #6b7280;
          font-size: 14px;
        }

        /* Status Section */
        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .refresh-btn {
          background: none;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
        }

        .refresh-btn:hover:not(:disabled) {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status-card {
          padding: 24px;
          background: #f9fafb;
          border-radius: 12px;
          border: 2px solid #e5e7eb;
        }

        .status-card.pro {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-color: #f0b90b;
        }

        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .status-card.free .status-badge {
          background: #e5e7eb;
          color: #374151;
        }

        .status-card.pro .status-badge {
          background: #f0b90b;
          color: #000;
        }

        .status-details {
          margin-bottom: 16px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          color: #6b7280;
        }

        .detail-row .value {
          font-weight: 500;
          color: #111827;
        }

        .status-active {
          color: #10b981 !important;
        }

        /* NFT Breakdown */
        .nft-breakdown {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.1);
        }

        .nft-breakdown h4 {
          margin: 0 0 12px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 13px;
        }

        .breakdown-address {
          font-family: monospace;
          color: #6b7280;
        }

        .breakdown-count {
          font-weight: 500;
          color: #f0b90b;
        }

        /* Upgrade Section */
        .upgrade-section {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.1);
        }

        .upgrade-hint {
          margin: 0 0 12px;
          font-size: 14px;
          color: #374151;
        }

        .mint-address-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .mint-address-btn {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.2s;
        }

        .mint-address-btn:hover {
          border-color: #f0b90b;
          background: #fffbeb;
        }

        .mint-address-btn .wallet-name {
          font-weight: 600;
          color: #111827;
        }

        .mint-address-btn .address {
          font-family: monospace;
          font-size: 12px;
          color: #6b7280;
        }

        .mint-address-btn .mint-label {
          color: #f0b90b;
          font-weight: 500;
          font-size: 13px;
        }

        .no-address-hint {
          color: #6b7280;
          font-style: italic;
          margin: 16px 0;
        }

        .upgrade-btn {
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, #f0b90b 0%, #f8d12f 100%);
          color: #000;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 16px;
        }

        .upgrade-btn:hover {
          opacity: 0.9;
        }

        /* Address List */
        .address-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .address-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.2s;
        }

        .address-item:hover {
          border-color: #3b82f6;
        }

        .address-item.selected {
          border-color: #f0b90b;
          background: #fffbeb;
        }

        .address-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .wallet-name {
          font-weight: 600;
          color: #111827;
        }

        .address {
          font-family: monospace;
          font-size: 14px;
          color: #6b7280;
        }

        .selected-indicator {
          color: #f0b90b;
          font-weight: 600;
        }

        .loading, .no-addresses {
          padding: 24px;
          text-align: center;
          background: #f9fafb;
          border-radius: 10px;
          color: #6b7280;
        }

        .no-addresses .hint {
          font-size: 14px;
          margin-top: 8px;
        }

        /* Benefits */
        .benefits-section {
          padding: 20px;
          background: #f0fdf4;
          border-radius: 12px;
          border: 1px solid #86efac;
        }

        .benefits-section h2 {
          color: #166534;
        }

        .benefits-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .benefits-list li {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          color: #166534;
        }

        .benefits-list .check {
          color: #22c55e;
          font-weight: bold;
        }

        /* Mint Flow Styles */
        .mint-flow {
          margin-top: 20px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }

        .mint-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .mint-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .step-number {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #e5e7eb;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }

        .mint-step.active .step-number {
          background: #f0b90b;
          color: #000;
        }

        .mint-step.completed .step-number {
          background: #22c55e;
          color: #fff;
        }

        .step-label {
          font-size: 13px;
          color: #6b7280;
        }

        .mint-step.active .step-label {
          color: #111827;
          font-weight: 500;
        }

        .step-connector {
          width: 60px;
          height: 2px;
          background: #e5e7eb;
        }

        .mint-action {
          text-align: center;
        }

        .mint-description {
          margin: 0 0 16px;
          color: #374151;
        }

        .mint-btn {
          padding: 12px 24px;
          background: #f0b90b;
          color: #000;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-right: 12px;
          transition: all 0.2s;
        }

        .mint-btn:hover {
          background: #d4a00a;
          transform: translateY(-1px);
        }

        .mint-btn.primary {
          background: linear-gradient(135deg, #f0b90b 0%, #f8d12f 100%);
        }

        .mint-btn.done {
          background: #22c55e;
          color: #fff;
          margin-top: 16px;
        }

        .cancel-btn {
          padding: 12px 24px;
          background: transparent;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .mint-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #f0b90b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .mint-status {
          margin: 0 0 8px;
          font-weight: 500;
          color: #111827;
        }

        .mint-hint {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .mint-action.error {
          padding: 16px;
          background: #fef2f2;
          border-radius: 8px;
        }

        .mint-error {
          margin: 0 0 16px;
          color: #dc2626;
        }

        /* Mint Success */
        .mint-success {
          margin-top: 20px;
          padding: 24px;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border-radius: 12px;
          border: 1px solid #86efac;
          text-align: center;
        }

        .mint-success .success-icon {
          width: 48px;
          height: 48px;
          background: #22c55e;
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin: 0 auto 16px;
        }

        .mint-success h3 {
          margin: 0 0 8px;
          color: #166534;
        }

        .mint-success p {
          margin: 0;
          color: #15803d;
        }

        .mint-success .tx-link {
          display: inline-block;
          margin-top: 16px;
          color: #166534;
          text-decoration: none;
          font-weight: 500;
        }

        .mint-success .tx-link:hover {
          text-decoration: underline;
        }

        .tx-link-small {
          display: inline-block;
          margin-top: 12px;
          color: #3b82f6;
          text-decoration: none;
          font-size: 13px;
        }

        .tx-link-small:hover {
          text-decoration: underline;
        }

        /* Password Dialog Overlay */
        .password-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .password-dialog {
          background: #fff;
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
        }

        .password-dialog h3 {
          margin: 0 0 8px;
          font-size: 20px;
          color: #111827;
        }

        .wallet-name-hint {
          margin: 0 0 12px;
          padding: 8px 12px;
          background: #f3f4f6;
          border-radius: 6px;
          font-size: 14px;
          color: #374151;
        }

        .wallet-name-hint strong {
          color: #111827;
        }

        .password-hint {
          margin: 0 0 20px;
          font-size: 14px;
          color: #6b7280;
        }

        .password-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 16px;
          margin-bottom: 20px;
          transition: border-color 0.2s;
        }

        .password-input:focus {
          outline: none;
          border-color: #f0b90b;
        }

        .password-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .confirm-btn {
          padding: 12px 24px;
          background: #f0b90b;
          color: #000;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .confirm-btn:hover:not(:disabled) {
          background: #d4a00a;
        }

        .confirm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Device Information Section */
        .device-section {
          margin-bottom: 32px;
        }

        .device-card {
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          border: 2px solid #e5e7eb;
        }

        .device-card.error {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .device-card.locked {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .locked-content {
          text-align: center;
          padding: 24px 16px;
        }

        .lock-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .locked-message {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 600;
          color: #374151;
        }

        .locked-hint {
          margin: 0 0 20px;
          font-size: 14px;
          color: #6b7280;
        }

        .unlock-btn {
          padding: 12px 24px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .unlock-btn:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .device-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .unlocked-badge {
          font-size: 14px;
          color: #10b981;
          font-weight: 500;
        }

        .lock-btn {
          padding: 6px 12px;
          background: transparent;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .lock-btn:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .device-error {
          color: #dc2626;
          margin: 12px 0;
          padding: 10px 16px;
          background: #fef2f2;
          border-radius: 6px;
          font-size: 14px;
        }

        .retry-btn {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .retry-btn:hover {
          background: #2563eb;
        }

        .device-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .device-detail-row:last-child {
          border-bottom: none;
        }

        .device-label {
          font-weight: 500;
          color: #6b7280;
          font-size: 14px;
        }

        .device-value {
          font-weight: 500;
          color: #111827;
        }

        .device-value.mono {
          font-family: monospace;
          font-size: 13px;
        }

        .device-value.success {
          color: #10b981;
        }

        .device-value.warning {
          color: #f59e0b;
        }

        .device-hash-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .device-value.hash {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .copy-btn {
          padding: 6px 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .copy-btn:hover {
          background: #2563eb;
        }

        /* Device Bindings */
        .device-bindings {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.1);
        }

        .device-bindings h4 {
          margin: 0 0 12px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .binding-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: white;
          border-radius: 8px;
          margin-bottom: 8px;
          border: 2px solid #e5e7eb;
        }

        .binding-row.valid {
          border-color: #86efac;
          background: #f0fdf4;
        }

        .binding-row.invalid {
          border-color: #fecaca;
          background: #fef2f2;
        }

        .binding-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .binding-label {
          font-weight: 600;
          color: #111827;
        }

        .binding-chain {
          font-size: 12px;
          padding: 2px 8px;
          background: #e0e7ff;
          color: #3730a3;
          border-radius: 10px;
          font-weight: 500;
        }

        .binding-status {
          font-size: 12px;
          font-weight: 600;
        }

        .binding-status.valid {
          color: #10b981;
        }

        .binding-status.invalid {
          color: #dc2626;
        }

        .binding-address {
          font-family: monospace;
          font-size: 12px;
          color: #6b7280;
        }

        .binding-hint {
          margin-top: 16px;
          padding: 16px;
          background: #fffbeb;
          border-radius: 10px;
          border: 1px solid #fde68a;
        }

        .binding-hint p {
          margin: 0 0 8px;
          font-size: 14px;
          color: #92400e;
        }

        .binding-hint p:last-child {
          margin-bottom: 0;
        }

        .binding-hint strong {
          color: #78350f;
        }
      `}</style>
    </div>
  );
};

export default MembershipSettings;
