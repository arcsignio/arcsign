/**
 * Main application component
 * Feature: User Dashboard for Wallet Management
 * Updated: 2025-10-25 - App-level authentication integration
 * Updated: 2026-01-14 - WalletConnect v2 integration
 */

import { useState, useEffect } from 'react';
import { Dashboard } from '@/pages/Dashboard';
import { AppUnlock } from '@/components/AppUnlock';
import { AppPasswordProvider, useAppPassword } from '@/contexts/AppPasswordContext';
import { WalletConnectProvider, useWalletConnect } from '@/contexts/WalletConnectContext';
import { PairingModal } from '@/components/WalletConnect/PairingModal';
import { SessionApprovalDialog } from '@/components/WalletConnect/SessionApprovalDialog';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useSessionStore } from '@/stores/sessionStore';
import tauriApi, { type AppError, type AppConfig } from '@/services/tauri-api';

function AppContent() {
  const { isUnlocked, unlock } = useAppPassword();
  const sessionToken = useSessionStore((state) => state.sessionToken);
  const walletConnect = useWalletConnect();
  const [usbPath, setUsbPath] = useState<string | null>(null);
  const [loadingUsb, setLoadingUsb] = useState(true);
  const [usbError, setUsbError] = useState<string | null>(null);
  // TODO: Get current address from wallet context when available
  const currentAddress = '0x0000000000000000000000000000000000000000'; // Placeholder

  // Detect USB on mount
  useEffect(() => {
    const detectUsbDrive = async () => {
      setLoadingUsb(true);
      setUsbError(null);

      try {
        const devices = await tauriApi.detectUsb();
        if (devices.length === 0) {
          setUsbError('No USB drive detected. Please insert a USB drive and restart the application.');
          return;
        }

        // Use first USB device
        setUsbPath(devices[0].path);
      } catch (err) {
        const error = err as AppError;
        setUsbError(`Failed to detect USB: ${error.message}`);
      } finally {
        setLoadingUsb(false);
      }
    };

    detectUsbDrive();
  }, []);

  // Initialize WalletConnect after unlock
  useEffect(() => {
    if (isUnlocked && !walletConnect.initialized && !walletConnect.initializing) {
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

      if (!projectId || projectId === 'replace_with_your_project_id') {
        console.warn('[App] WalletConnect Project ID not configured');
        return;
      }

      console.log('[App] Initializing WalletConnect...');
      walletConnect.init({
        projectId,
        metadata: {
          name: 'ArcSign',
          description: 'HD Wallet with USB-Only Storage',
          url: 'https://arcsign.io',
          icons: ['https://arcsign.io/icon.png'],
        },
      }).catch(err => {
        console.error('[App] WalletConnect initialization failed:', err);
      });
    }
  }, [isUnlocked, walletConnect]);

  // Recover WalletConnect sessions after unlock
  useEffect(() => {
    if (isUnlocked && walletConnect.initialized && sessionToken && usbPath) {
      console.log('[App] Recovering WalletConnect sessions...');
      walletConnect.recoverSessions(sessionToken, usbPath).catch(err => {
        console.error('[App] Session recovery failed:', err);
      });
    }
  }, [isUnlocked, walletConnect.initialized, sessionToken, usbPath]);

  const handleUnlockSuccess = async (appConfig: AppConfig, password: string) => {
    if (!usbPath) {
      setUsbError('USB path not available');
      return;
    }

    try {
      await unlock(password, appConfig, usbPath);
    } catch (error) {
      setUsbError('Failed to create session. Please try again.');
      console.error('Failed to unlock:', error);
    }
  };

  // Handle session approval (needs wallet address)
  const handleApproveSession = async () => {
    // TODO: Get actual wallet address from wallet state
    // For now, we'll need to integrate with wallet selection
    if (!currentAddress) {
      console.error('[App] No wallet address available for session approval');
      return;
    }

    await walletConnect.approveSession(currentAddress);
  };

  // Loading USB detection
  if (loadingUsb) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="lg" message="Detecting USB drive..." />
      </div>
    );
  }

  // USB error
  if (usbError || !usbPath) {
    return (
      <div className="app-error">
        <div className="error-container">
          <h1>⚠️ USB Drive Required</h1>
          <p>{usbError || 'No USB drive detected'}</p>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        </div>

        <style>{`
          .app-error {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f3f4f6;
            padding: 20px;
          }

          .error-container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            max-width: 500px;
          }

          .error-container h1 {
            margin: 0 0 16px;
            font-size: 28px;
            color: #1a1a1a;
          }

          .error-container p {
            margin: 0 0 24px;
            color: #666;
            line-height: 1.6;
          }

          .retry-button {
            padding: 12px 32px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
          }

          .retry-button:hover {
            background: #2563eb;
          }
        `}</style>
      </div>
    );
  }

  // Show authentication gate if not unlocked
  if (!isUnlocked) {
    return <AppUnlock usbPath={usbPath} onUnlockSuccess={handleUnlockSuccess} />;
  }

  // Show dashboard after authentication
  return (
    <div className="app">
      <Dashboard />

      {/* WalletConnect Modals */}
      <PairingModal
        isOpen={walletConnect.showPairingModal}
        onClose={walletConnect.closePairingModal}
        onPair={walletConnect.pair}
      />

      <SessionApprovalDialog
        isOpen={walletConnect.sessionProposal !== null}
        proposal={walletConnect.sessionProposal}
        onApprove={handleApproveSession}
        onReject={walletConnect.rejectSession}
      />

      <style>{`
        .app-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
}

function App() {
  return (
    <AppPasswordProvider>
      <WalletConnectProvider>
        <AppContent />
      </WalletConnectProvider>
    </AppPasswordProvider>
  );
}

export default App;
