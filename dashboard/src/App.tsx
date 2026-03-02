/**
 * Main application component
 * Feature: User Dashboard for Wallet Management
 * Updated: 2025-10-25 - App-level authentication integration
 * Updated: 2026-01-14 - WalletConnect v2 integration
 */

import { useState, useEffect, useCallback } from 'react';
import { Dashboard } from '@/pages/Dashboard';
import { AppUnlock } from '@/components/AppUnlock';
import { AppPasswordProvider, useAppPassword } from '@/contexts/AppPasswordContext';
import { WalletConnectProvider, useWalletConnect } from '@/contexts/WalletConnectContext';
import { PairingModal } from '@/components/WalletConnect/PairingModal';
import { SessionApprovalDialog } from '@/components/WalletConnect/SessionApprovalDialog';
import { SignRequestDialog } from '@/components/WalletConnect/SignRequestDialog';
import { SignatureToastContainer } from '@/components/WalletConnect/SignatureToast';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { OnboardingFlow } from '@/components/Onboarding';
import { useShouldShowOnboarding, useOnboardingStore } from '@/stores/onboardingStore';
import tauriApi, { type AppError, type AppConfig } from '@/services/tauri-api';

function AppContent() {
  const { isUnlocked, unlock, getSessionToken } = useAppPassword();
  const walletConnect = useWalletConnect();
  const shouldShowOnboarding = useShouldShowOnboarding();
  const [usbPath, setUsbPath] = useState<string | null>(null);
  const [loadingUsb, setLoadingUsb] = useState(true);
  const [usbError, setUsbError] = useState<string | null>(null);

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

  // Recover WalletConnect sessions after initialization (run once)
  useEffect(() => {
    if (isUnlocked && walletConnect.initialized && usbPath) {
      const sessionToken = getSessionToken();
      if (sessionToken) {
        console.log('[App] Recovering WalletConnect sessions...');
        walletConnect.recoverSessions(sessionToken, usbPath).catch(err => {
          console.error('[App] Session recovery failed:', err);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, walletConnect.initialized, usbPath]);

  // Security: Disconnect WalletConnect sessions when app session expires
  // This prevents dApps from continuing to interact with the wallet after logout
  useEffect(() => {
    // When user locks the app (isUnlocked becomes false)
    if (!isUnlocked && walletConnect.initialized && walletConnect.sessions.length > 0) {
      console.log('[App] Session locked - disconnecting WalletConnect sessions for security');
      walletConnect.disconnectAllSessions().catch(err => {
        console.error('[App] Failed to disconnect WalletConnect sessions:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked]);

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

  // Handle session approval
  const handleApproveSession = async () => {
    // Address is stored in WalletConnectContext when opening pairing modal
    await walletConnect.approveSession();
  };

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(() => {
    useOnboardingStore.getState().completeOnboarding();
  }, []);

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
          <img src="/logo.png" alt="ArcSign" className="error-logo" />
          <h1>USB Drive Required</h1>
          <p>{usbError || 'No USB drive detected. Please connect a USB drive to get started.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry Detection
          </button>
        </div>

        <style>{`
          .app-error {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0a1c32 0%, #0f2b46 40%, #134e5e 100%);
            padding: 20px;
          }

          .error-container {
            text-align: center;
            background: white;
            padding: 48px 40px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-width: 480px;
          }

          .error-logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            margin-bottom: 20px;
            opacity: 0.6;
          }

          .error-container h1 {
            margin: 0 0 12px;
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
          }

          .error-container p {
            margin: 0 0 28px;
            color: #666;
            line-height: 1.6;
            font-size: 15px;
          }

          .retry-button {
            padding: 12px 32px;
            background: linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .retry-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(45, 212, 191, 0.4);
          }
        `}</style>
      </div>
    );
  }

  // Show authentication gate if not unlocked
  if (!isUnlocked) {
    return <AppUnlock usbPath={usbPath} onUnlockSuccess={handleUnlockSuccess} />;
  }

  // Show onboarding for first-time users or when triggered from Settings
  if (shouldShowOnboarding) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} usbPath={usbPath} />;
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

      {/* WalletConnect Sign Request Dialog (Phase 2) */}
      <SignRequestDialog
        isOpen={walletConnect.showSignDialog}
        request={walletConnect.signRequest}
        onApprove={walletConnect.approveSignRequest}
        onReject={walletConnect.rejectSignRequest}
      />

      {/* Signature Result Notifications */}
      <SignatureToastContainer
        notifications={walletConnect.signatureNotifications}
        onDismiss={walletConnect.dismissNotification}
      />

      <style>{`
        .app-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a1c32 0%, #0f2b46 40%, #134e5e 100%);
        }
        .app-loading p {
          color: rgba(255, 255, 255, 0.7) !important;
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
