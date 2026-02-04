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
 * Created: 2026-02-04
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PendingRequests } from './PendingRequests';
import { SessionSettings } from './SessionSettings';
import { SigningHistory } from './SigningHistory';
// TODO: Import tauriApi when backend methods are implemented
// import tauriApi from '@/services/tauri-api';
import type { DevSignRequest, DevSession } from '@/types/developer';

type Tab = 'requests' | 'history' | 'settings';

interface DeveloperModeProps {
  onBack: () => void;
  usbPath: string;
}

export function DeveloperMode({ onBack, usbPath }: DeveloperModeProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [pendingRequests, setPendingRequests] = useState<DevSignRequest[]>([]);
  const [signingHistory, setSigningHistory] = useState<DevSignRequest[]>([]);
  const [session, setSession] = useState<DevSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Poll for pending requests from Hardhat/Foundry scripts
  useEffect(() => {
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
  }, []);

  // Handle approve request
  const handleApprove = useCallback(async (requestId: string, _password: string) => {
    try {
      // TODO: Implement signing logic
      // await tauriApi.approveDevSignRequest(requestId, _password, usbPath);

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
  }, [pendingRequests, usbPath]);

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
    if (enabled) {
      // TODO: Create session
      setSession({
        enabled: true,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
        trustedNetworks: ['sepolia', 'goerli', 'bsc-testnet'],
        signCount: 0,
      });
    } else {
      setSession(null);
    }
  }, []);

  return (
    <div className="developer-mode">
      {/* Header */}
      <header className="dev-header">
        <div className="dev-header-left">
          <button onClick={onBack} className="back-button">
            ← {t('common.back')}
          </button>
          <h1>🔧 {t('developer.title', 'Developer Mode')}</h1>
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
      `}</style>
    </div>
  );
}
