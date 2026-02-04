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
import { SessionSettings } from './SessionSettings';
import { SigningHistory } from './SigningHistory';
import tauriApi from '@/services/tauri-api';
import type { DevSignRequest, DevSession } from '@/types/developer';
import type { Wallet } from '@/types/wallet';

type Tab = 'requests' | 'history' | 'settings';
type ViewState = 'wallet-selection' | 'password-entry' | 'main';

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
  const [password, setPassword] = useState('');
  const [walletSessionToken, setWalletSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Main interface state
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [pendingRequests, setPendingRequests] = useState<DevSignRequest[]>([]);
  const [signingHistory, setSigningHistory] = useState<DevSignRequest[]>([]);
  const [session, setSession] = useState<DevSession | null>(null);
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
        // TODO: Implement tauriApi.getDevPendingRequests()
        // const requests = await tauriApi.getDevPendingRequests();
        // setPendingRequests(requests);
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

  // Handle wallet selection
  const handleSelectWallet = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setPassword('');
    setError(null);
    setViewState('password-entry');
  };

  // Handle password submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate password by creating a wallet session
      const sessionResponse = await tauriApi.createWalletSession({
        walletId: selectedWallet.id,
        password,
        usbPath,
      });

      setWalletSessionToken(sessionResponse.token);
      setViewState('main');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid password';
      setError(errorMessage);
      console.error('Password validation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back from password entry
  const handleBackToWalletSelection = () => {
    setSelectedWallet(null);
    setPassword('');
    setError(null);
    setViewState('wallet-selection');
  };

  // Handle approve request
  const handleApprove = useCallback(async (requestId: string, _password: string) => {
    try {
      // TODO: Implement signing logic with walletSessionToken
      // await tauriApi.approveDevSignRequest(requestId, walletSessionToken, usbPath);

      // Move to history
      const request = pendingRequests.find(r => r.id === requestId);
      if (request) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        setSigningHistory(prev => [...prev, { ...request, status: 'approved' }]);
      }
    } catch (err) {
      console.error('Failed to approve request:', err);
      throw err;
    }
  }, [pendingRequests, walletSessionToken]);

  // Handle reject request
  const handleReject = useCallback(async (requestId: string) => {
    try {
      // TODO: Implement rejection logic
      // await tauriApi.rejectDevSignRequest(requestId);

      const request = pendingRequests.find(r => r.id === requestId);
      if (request) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        setSigningHistory(prev => [...prev, { ...request, status: 'rejected' }]);
      }
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  }, [pendingRequests]);

  // Handle session toggle
  const handleSessionToggle = useCallback(async (enabled: boolean) => {
    if (enabled && selectedWallet) {
      setSession({
        enabled: true,
        walletId: selectedWallet.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        trustedNetworks: ['sepolia', 'goerli', 'bsc-testnet'],
        signCount: 0,
      });
    } else {
      setSession(null);
    }
  }, [selectedWallet]);

  // Handle exit developer mode (revoke session)
  const handleExit = async () => {
    if (walletSessionToken) {
      try {
        await tauriApi.revokeWalletSession({ token: walletSessionToken });
      } catch (err) {
        console.error('Failed to revoke wallet session:', err);
      }
    }
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

  // Render password entry view
  if (viewState === 'password-entry') {
    return (
      <div className="developer-mode">
        <header className="dev-header">
          <div className="dev-header-left">
            <button onClick={handleBackToWalletSelection} className="back-button">
              ← {t('actions.back')}
            </button>
            <h1>🔧 {t('developer.title', 'Developer Mode')}</h1>
          </div>
        </header>

        <main className="dev-content">
          <div className="password-entry">
            <div className="selected-wallet-card">
              <div className="wallet-icon">👛</div>
              <div className="wallet-info">
                <span className="wallet-name">{selectedWallet?.name}</span>
                <span className="wallet-id">{selectedWallet?.id.substring(0, 8)}...</span>
              </div>
            </div>

            <h2>{t('developer.enterPassword', 'Enter Wallet Password')}</h2>
            <p className="password-description">
              {t('developer.enterPasswordDescription', 'Enter the password for this wallet to continue.')}
            </p>

            {error && (
              <div className="error-banner">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="password-form">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('developer.passwordPlaceholder', 'Wallet password')}
                className="password-input"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="submit"
                className="primary-button"
                disabled={!password || isLoading}
              >
                {isLoading ? (
                  <span className="button-loading">
                    <span className="spinner small" />
                    {t('common.loading', 'Loading...')}
                  </span>
                ) : (
                  t('developer.unlock', 'Unlock')
                )}
              </button>
            </form>
          </div>
        </main>

        <style>{passwordEntryStyles}</style>
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
        <button
          className={`dev-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ {t('developer.sessionSettings', 'Session Settings')}
        </button>
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
        {activeTab === 'settings' && (
          <SessionSettings
            session={session}
            onToggle={handleSessionToggle}
          />
        )}
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

// Styles for password entry view
const passwordEntryStyles = `
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
    max-width: 400px;
    margin: 0 auto;
  }

  .password-entry {
    text-align: center;
  }

  .selected-wallet-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 20px;
    margin-bottom: 32px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 12px;
  }

  .wallet-icon {
    font-size: 40px;
  }

  .wallet-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
  }

  .wallet-name {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  .wallet-id {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-family: monospace;
  }

  .password-entry h2 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
  }

  .password-description {
    margin: 0 0 24px 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
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

  .password-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .password-input {
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #fff;
    font-size: 16px;
    outline: none;
    transition: all 0.2s;
  }

  .password-input:focus {
    border-color: #3b82f6;
    background: rgba(255, 255, 255, 0.1);
  }

  .password-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .password-input:disabled {
    opacity: 0.5;
  }

  .primary-button {
    padding: 14px 24px;
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

  .button-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #fff;
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
`;
