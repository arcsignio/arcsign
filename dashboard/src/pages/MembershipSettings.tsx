/**
 * Membership Settings Page
 * Feature: ArcSign Pro NFT Membership System
 *
 * Allows users to:
 * 1. Select a primary BSC address for membership verification
 * 2. View current membership status (Free/Pro)
 * 3. Check membership validity and expiration
 * 4. Mint Pro NFT directly (integrated, no WebSocket needed)
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useDashboardStore, useMembershipStatus, usePrimaryMembershipAddress } from '@/stores/dashboardStore';
import tauriApi, {
  type BuildTransactionResponse,
  type SignTransactionResponse,
  type QueryTransactionStatusResponse,
} from '@/services/tauri-api';

interface MembershipSettingsProps {
  onBack: () => void;
  usbPath: string;
  appPassword: string;
}

interface BscAddress {
  walletId: string;
  walletName: string;
  address: string;
  hasPassphrase?: boolean;
}

interface MembershipCheckResult {
  isPro: boolean;
  nftCount: number;
  tokenIds: number[];
  expirations: number[];
  daysRemaining: number;
  walletLimit: number | null;
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

export const MembershipSettings: React.FC<MembershipSettingsProps> = ({ onBack, usbPath, appPassword }) => {
  const [bscAddresses, setBscAddresses] = useState<BscAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mint state
  const [mintStep, setMintStep] = useState<MintStep>('idle');
  const [mintError, setMintError] = useState<string | null>(null);
  const [walletPassword, setWalletPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'mint' | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const [confirmationProgress, setConfirmationProgress] = useState<string>('');

  const membership = useMembershipStatus();
  const primaryAddress = usePrimaryMembershipAddress();
  const { wallets, setMembership } = useDashboardStore();

  // Get selected wallet info
  const getSelectedWallet = useCallback(() => {
    if (!primaryAddress) return null;
    return bscAddresses.find(addr => addr.address === primaryAddress) || null;
  }, [primaryAddress, bscAddresses]);

  // Load all BSC addresses from all wallets on mount
  // Addresses are now included in wallet data (public, no password needed)
  useEffect(() => {
    loadBscAddresses();
  }, [wallets]);

  // Auto-check membership when primary address is set
  useEffect(() => {
    if (primaryAddress) {
      checkMembership(primaryAddress);
    }
  }, [primaryAddress]);

  const loadBscAddresses = () => {
    setIsLoading(true);
    setError(null);
    const addresses: BscAddress[] = [];

    try {
      // Addresses are now included in wallet list (public data from AddressBook)
      for (const wallet of wallets) {
        if (wallet.addresses) {
          // Find BSC address (BNB symbol with EVM key type)
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
    } catch (err) {
      console.error('Failed to load BSC addresses:', err);
      setError('Failed to load wallet addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const checkMembership = async (address: string) => {
    setIsChecking(true);
    setError(null);

    try {
      const result = await invoke<MembershipCheckResult>('check_membership', {
        input: { address },
      });

      setMembership({
        isPro: result.isPro,
        membershipAddress: address,
        daysRemaining: result.daysRemaining,
        walletLimit: result.walletLimit,
      });

      if (result.isPro) {
        setSuccessMessage('Pro membership verified!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check membership';
      setError(errorMessage);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSelectAddress = async (address: string) => {
    setMembership({ primaryMembershipAddress: address });
    await checkMembership(address);
  };

  const handleRefresh = () => {
    if (primaryAddress) {
      checkMembership(primaryAddress);
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
          appPassword,
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
    if (!selectedWallet || !primaryAddress) {
      return { success: false, error: 'No wallet selected' };
    }

    try {
      console.log(`Building ${description} transaction...`);

      // Step 1: Build transaction
      const buildResult: BuildTransactionResponse = await tauriApi.buildTransaction({
        chainId: CHAIN_ID,
        from: primaryAddress,
        to: to,
        amount: '0', // No native token value for ERC-20 calls
        data: data,
        usbPath,
        appPassword,
      });

      console.log('Build result:', buildResult);

      // Step 2: Sign transaction
      console.log(`Signing ${description} transaction...`);
      const signResult: SignTransactionResponse = await tauriApi.signTransaction({
        chainId: CHAIN_ID,
        walletId: selectedWallet.walletId,
        password: walletPassword,
        passphrase: '', // TODO: Support passphrase if wallet uses it
        fromAddress: primaryAddress,
        unsignedTx: buildResult,
        usbPath,
        appPassword,
      });

      console.log('Sign result:', signResult);

      // Step 3: Broadcast transaction
      console.log(`Broadcasting ${description} transaction...`);
      const broadcastResult = await tauriApi.broadcastTransaction({
        chainId: CHAIN_ID,
        signedTx: signResult,
        usbPath,
        appPassword,
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

  // Start the upgrade/mint process
  const handleUpgrade = () => {
    if (!primaryAddress) {
      setMintError('Please select a BSC address first');
      return;
    }
    setMintStep('approve');
    setMintError(null);
    setTxHash(null);
  };

  // Request password for a specific action
  const requestPassword = (action: 'approve' | 'mint') => {
    setPendingAction(action);
    setWalletPassword('');
    setShowPasswordDialog(true);
  };

  // Cancel password dialog
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
      if (primaryAddress) {
        setTimeout(() => checkMembership(primaryAddress), 2000);
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
          Select your primary BSC address for Pro membership verification
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
            disabled={isChecking || !primaryAddress}
            className="refresh-btn"
          >
            {isChecking ? '...' : '↻ Refresh'}
          </button>
        </div>

        <div className={`status-card ${membership.isPro ? 'pro' : 'free'}`}>
          <div className="status-badge">
            {membership.isPro ? '⭐ Pro Member' : 'Free Tier'}
          </div>

          {primaryAddress ? (
            <div className="status-details">
              <div className="detail-row">
                <span className="label">Verification Address</span>
                <span className="value">{formatAddress(primaryAddress)}</span>
              </div>
              {membership.isPro ? (
                <>
                  <div className="detail-row">
                    <span className="label">Status</span>
                    <span className="value status-active">Active</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">NFTs Owned</span>
                    <span className="value">{membership.nftCount ?? 1}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Expires in</span>
                    <span className="value">
                      {membership.daysRemaining > 0
                        ? `${membership.daysRemaining} days`
                        : 'Expired'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Wallet Limit</span>
                    <span className="value">{membership.walletLimit ?? 10} wallets</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Current Usage</span>
                    <span className="value">{wallets.length} / {membership.walletLimit ?? 10}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="detail-row">
                    <span className="label">Wallet Limit</span>
                    <span className="value">{membership.walletLimit ?? 5} wallets</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Current Usage</span>
                    <span className="value">{wallets.length} / {membership.walletLimit ?? 5}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="no-address-hint">
              Select a BSC address below to check your membership status
            </p>
          )}

          {!membership.isPro && mintStep === 'idle' && (
            <button onClick={handleUpgrade} className="upgrade-btn" disabled={!primaryAddress}>
              Upgrade to Pro - 30 USDT/year
            </button>
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

      {/* Address Selection */}
      <section className="address-section">
        <h2>Select Primary Address</h2>
        <p className="section-description">
          Choose which BSC address to use for membership verification.
          This should be the address where you minted your Pro NFT.
        </p>

        {isLoading ? (
          <div className="loading">Loading addresses...</div>
        ) : bscAddresses.length === 0 ? (
          <div className="no-addresses">
            <p>No BSC addresses found.</p>
            <p className="hint">Create a wallet first to get your BSC address.</p>
          </div>
        ) : (
          <div className="address-list">
            {bscAddresses.map((item) => (
              <button
                key={item.address}
                className={`address-item ${primaryAddress === item.address ? 'selected' : ''}`}
                onClick={() => handleSelectAddress(item.address)}
              >
                <div className="address-info">
                  <span className="wallet-name">{item.walletName}</span>
                  <span className="address">{formatAddress(item.address)}</span>
                </div>
                {primaryAddress === item.address && (
                  <span className="selected-indicator">✓ Selected</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

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
      `}</style>
    </div>
  );
};

export default MembershipSettings;
