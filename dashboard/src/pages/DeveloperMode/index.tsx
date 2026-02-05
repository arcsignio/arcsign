/**
 * Developer Mode Page
 *
 * Provides a dedicated interface for smart contract developers to:
 * - View and approve signing requests from Hardhat/Foundry scripts
 * - Manage developer sessions for auto-signing
 * - View signing history
 *
 * This page is completely separate from the regular user interface.
 *
 * Flow:
 * 1. Enter Developer Mode → Show wallet list
 * 2. Select wallet → Enter password
 * 3. After authentication → Show tabs (requests/history/settings)
 *
 * Created: 2026-02-04
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PendingRequests } from './PendingRequests';
// import { SessionSettings } from './SessionSettings'; // Hidden for now - will be added later
import { SigningHistory } from './SigningHistory';
import tauriApi from '@/services/tauri-api';
import type { DevSignRequest, DevSession } from '@/types/developer';
import type { Wallet } from '@/types/wallet';

type Tab = 'requests' | 'history'; // 'settings' hidden for now
type ViewState = 'wallet-selection' | 'main';  // Removed password-entry - password entered when signing

// Helper to get network key from chain ID (must match NETWORK_INFO keys in PendingRequests.tsx)
function getNetworkName(chainId: number): string {
  const networks: Record<number, string> = {
    1: 'ethereum',
    5: 'goerli',
    11155111: 'sepolia',
    56: 'bsc',
    97: 'bsc-testnet',
    137: 'polygon',
    80001: 'mumbai',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
  };
  return networks[chainId] || `chain-${chainId}`;
}

interface DeveloperModeProps {
  onBack: () => void;
  usbPath: string;
}

export function DeveloperMode({ onBack, usbPath }: DeveloperModeProps) {
  const { t } = useTranslation();

  // View state management
  const [viewState, setViewState] = useState<ViewState>('wallet-selection');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  // Note: No password or session state - password is entered when signing, session created on-demand
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Main interface state
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [pendingRequests, setPendingRequests] = useState<DevSignRequest[]>([]);
  const [signingHistory, setSigningHistory] = useState<DevSignRequest[]>([]);
  const [session, _setSession] = useState<DevSession | null>(null); // setSession hidden - will be used when Session Settings is enabled
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Load wallets on mount
  useEffect(() => {
    const loadWallets = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const walletList = await tauriApi.listWallets(usbPath);
        setWallets(walletList);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load wallets';
        setError(errorMessage);
        console.error('Failed to load wallets:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadWallets();
  }, [usbPath]);

  // Poll for pending requests from Hardhat/Foundry scripts (only when in main view)
  useEffect(() => {
    if (viewState !== 'main') return;

    const pollRequests = async () => {
      try {
        const pending = await tauriApi.getPendingTransaction();
        if (pending) {
          // Convert to DevSignRequest format
          const request: DevSignRequest = {
            id: String(pending.request_id),
            type: pending.to ? 'call' : 'deploy',
            from: pending.from,
            to: pending.to || undefined,
            data: pending.data || undefined,
            value: pending.value || undefined,
            gas: pending.gas || undefined,
            gasPrice: pending.gas_price || undefined,
            maxFeePerGas: pending.max_fee_per_gas || undefined,
            maxPriorityFeePerGas: pending.max_priority_fee_per_gas || undefined,
            nonce: pending.nonce,
            network: getNetworkName(pending.chain_id),
            chainId: pending.chain_id,
            description: pending.description,
            status: 'pending',
            timestamp: Date.now(),
          };

          // Add to pending requests if not already there
          setPendingRequests(prev => {
            const exists = prev.some(r => r.id === request.id);
            if (!exists) {
              return [...prev, request];
            }
            return prev;
          });
        }
        setIsConnected(true);
        setConnectionError(null);
      } catch (err) {
        console.debug('Dev mode polling error:', err);
        // Don't set error on every poll failure
      }
    };

    const interval = setInterval(pollRequests, 500);
    pollRequests(); // Initial poll

    return () => clearInterval(interval);
  }, [viewState]);

  // Handle wallet selection - go directly to main view (no password needed here)
  const handleSelectWallet = async (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setError(null);

    // Load persisted signing history from USB
    try {
      const history = await tauriApi.loadDevSigningHistory({
        usbPath,
        walletId: wallet.id,
      });
      // Convert to DevSignRequest format
      const devRequests: DevSignRequest[] = history.map(entry => ({
        id: entry.id,
        type: entry.type as 'deploy' | 'call' | 'sign',
        description: entry.description,
        from: entry.from,
        to: entry.to,
        network: entry.network,
        chainId: entry.chainId,
        status: entry.status as 'approved' | 'rejected',
        timestamp: entry.timestamp,
        txHash: entry.txHash,
        value: entry.value,
      }));
      setSigningHistory(devRequests);
      console.log(`📜 Loaded ${devRequests.length} history entries for wallet ${wallet.id}`);
    } catch (err) {
      console.warn('Failed to load signing history:', err);
      // Non-fatal - continue with empty history
      setSigningHistory([]);
    }

    setViewState('main');  // Go directly to main view
  };

  // Handle back to wallet selection (currently unused, but kept for potential future use)
  const _handleBackToWalletSelection = () => {
    setSelectedWallet(null);
    setError(null);
    setViewState('wallet-selection');
  };
  void _handleBackToWalletSelection; // Suppress unused variable warning

  // Handle approve request - uses devModeSign (bypasses buildTransaction, uses Hardhat params directly)
  const handleApprove = useCallback(async (requestId: string, inputPassword: string) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (!request || !selectedWallet) {
      throw new Error('Missing request or wallet');
    }

    if (!inputPassword) {
      throw new Error('Password is required');
    }

    try {
      // Use devModeSign - takes Hardhat params directly, no session/buildTransaction needed
      // Hardhat already provides: from, to, data, value, gas, gasPrice/EIP-1559, chainId, nonce
      const signResult = await tauriApi.devModeSign({
        walletId: selectedWallet.id,
        password: inputPassword,
        usbPath,
        from: request.from,
        to: request.to || '',
        data: request.data || '0x',
        value: request.value || '0x0',
        gas: request.gas || '0x5208', // 21000 default
        gasPrice: request.gasPrice,
        maxFeePerGas: request.maxFeePerGas,
        maxPriorityFeePerGas: request.maxPriorityFeePerGas,
        chainId: request.chainId,
        nonce: request.nonce || 0,
      });

      // Respond to the WebSocket with the signed transaction
      await tauriApi.respondToTransaction({
        requestId: Number(requestId),
        success: true,
        signedTx: signResult.serializedTx,
        txHash: signResult.txHash,
      });

      // Move to history
      const historyEntry = { ...request, status: 'approved' as const, txHash: signResult.txHash, timestamp: Date.now() };
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setSigningHistory(prev => [...prev, historyEntry]);

      // Persist to USB
      try {
        await tauriApi.appendDevSigningHistory({
          usbPath,
          walletId: selectedWallet.id,
          entry: {
            id: historyEntry.id,
            type: historyEntry.type,
            description: historyEntry.description,
            from: historyEntry.from,
            to: historyEntry.to,
            network: historyEntry.network,
            chainId: historyEntry.chainId,
            status: 'approved',
            timestamp: historyEntry.timestamp,
            txHash: historyEntry.txHash,
            value: historyEntry.value,
          },
        });
        console.log('📜 Saved approved entry to history');
      } catch (err) {
        console.warn('Failed to persist signing history:', err);
        // Non-fatal - history still in memory for current session
      }
    } catch (err) {
      console.error('Failed to approve request:', err);

      // Respond with error
      await tauriApi.respondToTransaction({
        requestId: Number(requestId),
        success: false,
        error: err instanceof Error ? err.message : 'Signing failed',
      });

      throw err;
    }
    // Note: inputPassword is cleared by the PendingRequests component after this function returns
  }, [pendingRequests, selectedWallet, usbPath]);

  // Handle reject request
  const handleReject = useCallback(async (requestId: string) => {
    try {
      // Respond to WebSocket with rejection
      await tauriApi.respondToTransaction({
        requestId: Number(requestId),
        success: false,
        error: 'Transaction rejected by user',
      });

      const request = pendingRequests.find(r => r.id === requestId);
      if (request && selectedWallet) {
        const historyEntry = { ...request, status: 'rejected' as const, timestamp: Date.now() };
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        setSigningHistory(prev => [...prev, historyEntry]);

        // Persist to USB
        try {
          await tauriApi.appendDevSigningHistory({
            usbPath,
            walletId: selectedWallet.id,
            entry: {
              id: historyEntry.id,
              type: historyEntry.type,
              description: historyEntry.description,
              from: historyEntry.from,
              to: historyEntry.to,
              network: historyEntry.network,
              chainId: historyEntry.chainId,
              status: 'rejected',
              timestamp: historyEntry.timestamp,
              value: historyEntry.value,
            },
          });
          console.log('📜 Saved rejected entry to history');
        } catch (err) {
          console.warn('Failed to persist signing history:', err);
        }
      }
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  }, [pendingRequests, selectedWallet, usbPath]);

  // Handle session toggle - hidden for now, will be added later
  // const handleSessionToggle = useCallback(async (enabled: boolean) => {
  //   if (enabled && selectedWallet) {
  //     setSession({
  //       enabled: true,
  //       walletId: selectedWallet.id,
  //       createdAt: Date.now(),
  //       expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  //       trustedNetworks: ['sepolia', 'goerli', 'bsc-testnet'],
  //       signCount: 0,
  //     });
  //   } else {
  //     setSession(null);
  //   }
  // }, [selectedWallet]);

  // Handle exit developer mode
  const handleExit = () => {
    // No session to revoke - sessions are created on-demand when signing
    onBack();
  };

  // Render wallet selection view
  if (viewState === 'wallet-selection') {
    return (
      <div className="developer-mode">
        <header className="dev-header">
          <div className="dev-header-left">
            <button onClick={onBack} className="back-button">
              ← {t('actions.back')}
            </button>
            <h1>🔧 {t('developer.title', 'Developer Mode')}</h1>
          </div>
        </header>

        <main className="dev-content">
          <div className="wallet-selection">
            <h2>{t('developer.selectWallet', 'Select Wallet')}</h2>
            <p className="wallet-selection-description">
              {t('developer.selectWalletDescription', 'Choose a wallet to use for signing developer transactions.')}
            </p>

            {isLoading && (
              <div className="loading-state">
                <div className="spinner" />
                <span>{t('common.loading', 'Loading...')}</span>
              </div>
            )}

            {error && (
              <div className="error-banner">
                ⚠️ {error}
              </div>
            )}

            {!isLoading && wallets.length === 0 && (
              <div className="empty-state">
                <p>{t('developer.noWallets', 'No wallets found. Please create a wallet first.')}</p>
                <button onClick={onBack} className="primary-button">
                  {t('actions.back')}
                </button>
              </div>
            )}

            {!isLoading && wallets.length > 0 && (
              <div className="wallet-list">
                {wallets.map(wallet => (
                  <button
                    key={wallet.id}
                    className="wallet-item"
                    onClick={() => handleSelectWallet(wallet)}
                  >
                    <div className="wallet-icon">👛</div>
                    <div className="wallet-info">
                      <span className="wallet-name">{wallet.name}</span>
                      <span className="wallet-id">{wallet.id.substring(0, 8)}...</span>
                    </div>
                    <div className="wallet-arrow">→</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>

        <style>{walletSelectionStyles}</style>
      </div>
    );
  }

  // Render main developer mode interface
  return (
    <div className="developer-mode">
      {/* Header */}
      <header className="dev-header">
        <div className="dev-header-left">
          <button onClick={handleExit} className="back-button">
            ← {t('actions.back')}
          </button>
          <h1>🔧 {t('developer.title', 'Developer Mode')}</h1>
        </div>
        <div className="dev-header-center">
          <div className="active-wallet-badge">
            <span className="wallet-icon-small">👛</span>
            <span className="wallet-name-small">{selectedWallet?.name}</span>
          </div>
        </div>
        <div className="dev-header-right">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'}
            {isConnected ? t('developer.connected', 'Connected') : t('developer.disconnected', 'Disconnected')}
          </div>
        </div>
      </header>

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="error-banner">
          ⚠️ {connectionError}
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="dev-tabs">
        <button
          className={`dev-tab ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          📋 {t('developer.pendingRequests', 'Pending Requests')}
          {pendingRequests.length > 0 && (
            <span className="badge">{pendingRequests.length}</span>
          )}
        </button>
        <button
          className={`dev-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 {t('developer.history', 'History')}
        </button>
        {/* Session Settings tab - hidden for now, will be added later */}
      </nav>

      {/* Tab Content */}
      <main className="dev-content">
        {activeTab === 'requests' && (
          <PendingRequests
            requests={pendingRequests}
            onApprove={handleApprove}
            onReject={handleReject}
            session={session}
          />
        )}
        {activeTab === 'history' && (
          <SigningHistory history={signingHistory} />
        )}
        {/* Session Settings content - hidden for now */}
      </main>

      <style>{`
        .developer-mode {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #fff;
        }

        .dev-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dev-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .dev-header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .back-button {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
        }

        .connection-status.connected {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .connection-status.disconnected {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .error-banner {
          padding: 12px 24px;
          background: rgba(239, 68, 68, 0.2);
          border-bottom: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .dev-tabs {
          display: flex;
          gap: 4px;
          padding: 16px 24px;
          background: rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .dev-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .dev-tab:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .dev-tab.active {
          background: rgba(59, 130, 246, 0.3);
          color: #fff;
        }

        .dev-tab .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: #ef4444;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .dev-content {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dev-header-center {
          flex: 1;
          display: flex;
          justify-content: center;
        }

        .active-wallet-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 20px;
          font-size: 14px;
        }

        .wallet-icon-small {
          font-size: 16px;
        }

        .wallet-name-small {
          color: #93c5fd;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

// Styles for wallet selection view
const walletSelectionStyles = `
  .developer-mode {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
  }

  .dev-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .dev-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .dev-header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  .back-button {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .dev-content {
    padding: 24px;
    max-width: 600px;
    margin: 0 auto;
  }

  .wallet-selection {
    text-align: center;
  }

  .wallet-selection h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
  }

  .wallet-selection-description {
    margin: 0 0 32px 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px 0;
    color: rgba(255, 255, 255, 0.6);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-banner {
    padding: 12px 16px;
    margin-bottom: 16px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    text-align: left;
  }

  .empty-state {
    padding: 48px 0;
    text-align: center;
  }

  .empty-state p {
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 24px;
  }

  .primary-button {
    padding: 12px 24px;
    background: #3b82f6;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .primary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wallet-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .wallet-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .wallet-item:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(59, 130, 246, 0.5);
  }

  .wallet-icon {
    font-size: 32px;
  }

  .wallet-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .wallet-name {
    font-size: 16px;
    font-weight: 500;
    color: #fff;
  }

  .wallet-id {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-family: monospace;
  }

  .wallet-arrow {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.4);
  }
`;
