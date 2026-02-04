/**
 * Session Settings Component
 *
 * Allows developers to configure auto-signing sessions for testnets.
 *
 * Created: 2026-02-04
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DevSession } from '@/types/developer';

interface SessionSettingsProps {
  session: DevSession | null;
  onToggle: (enabled: boolean) => Promise<void>;
}

export function SessionSettings({ session, onToggle }: SessionSettingsProps) {
  const { t } = useTranslation();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      await onToggle(!session?.enabled);
    } finally {
      setIsToggling(false);
    }
  };

  // Calculate remaining time
  const getRemainingTime = () => {
    if (!session?.expiresAt) return null;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) return '已過期';
    const minutes = Math.floor(remaining / 60000);
    return `${minutes} 分鐘`;
  };

  return (
    <div className="session-settings">
      <h2>⚙️ {t('developer.sessionSettings', 'Session Settings')}</h2>
      <p className="description">
        {t('developer.sessionDesc', 'Enable session mode to auto-sign testnet transactions without entering password each time.')}
      </p>

      {/* Session Status Card */}
      <div className={`session-card ${session?.enabled ? 'active' : ''}`}>
        <div className="session-header">
          <div className="session-status">
            {session?.enabled ? (
              <>
                <span className="status-icon">🔓</span>
                <span className="status-text">{t('developer.sessionActive', 'Session Active')}</span>
              </>
            ) : (
              <>
                <span className="status-icon">🔒</span>
                <span className="status-text">{t('developer.sessionInactive', 'Session Inactive')}</span>
              </>
            )}
          </div>

          <button
            className={`toggle-button ${session?.enabled ? 'deactivate' : 'activate'}`}
            onClick={handleToggle}
            disabled={isToggling}
          >
            {isToggling ? '...' : session?.enabled ? t('developer.endSession', 'End Session') : t('developer.startSession', 'Start Session')}
          </button>
        </div>

        {session?.enabled && (
          <div className="session-info">
            <div className="info-row">
              <span className="label">⏱️ {t('developer.remaining', 'Remaining')}:</span>
              <span className="value">{getRemainingTime()}</span>
            </div>
            <div className="info-row">
              <span className="label">📊 {t('developer.signCount', 'Signatures')}:</span>
              <span className="value">{session.signCount}</span>
            </div>
            <div className="info-row">
              <span className="label">🧪 {t('developer.autoNetworks', 'Auto-sign Networks')}:</span>
              <span className="value networks">
                {session.trustedNetworks.join(', ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Security Rules */}
      <div className="rules-section">
        <h3>🛡️ {t('developer.securityRules', 'Security Rules')}</h3>

        <div className="rules-list">
          <div className="rule">
            <span className="rule-icon">✓</span>
            <div className="rule-content">
              <span className="rule-title">{t('developer.testnetAuto', 'Testnets: Auto-sign')}</span>
              <span className="rule-desc">{t('developer.testnetAutoDesc', 'Sepolia, Goerli, BSC Testnet will auto-sign when session is active')}</span>
            </div>
          </div>

          <div className="rule">
            <span className="rule-icon">⚠️</span>
            <div className="rule-content">
              <span className="rule-title">{t('developer.mainnetConfirm', 'Mainnets: Always Confirm')}</span>
              <span className="rule-desc">{t('developer.mainnetConfirmDesc', 'Ethereum, BSC, Polygon mainnet always require confirmation')}</span>
            </div>
          </div>

          <div className="rule">
            <span className="rule-icon">⏰</span>
            <div className="rule-content">
              <span className="rule-title">{t('developer.sessionTimeout', 'Session Timeout: 30 mins')}</span>
              <span className="rule-desc">{t('developer.sessionTimeoutDesc', 'Sessions automatically expire after 30 minutes of inactivity')}</span>
            </div>
          </div>

          <div className="rule">
            <span className="rule-icon">🔐</span>
            <div className="rule-content">
              <span className="rule-title">{t('developer.manualLock', 'Manual Lock')}</span>
              <span className="rule-desc">{t('developer.manualLockDesc', 'You can end the session manually at any time')}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .session-settings h2 {
          margin: 0 0 8px;
          font-size: 20px;
        }

        .session-settings .description {
          margin: 0 0 24px;
          color: rgba(255, 255, 255, 0.6);
        }

        .session-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 32px;
        }

        .session-card.active {
          border-color: rgba(34, 197, 94, 0.3);
          background: rgba(34, 197, 94, 0.05);
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .session-status {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-icon {
          font-size: 24px;
        }

        .status-text {
          font-size: 18px;
          font-weight: 600;
        }

        .toggle-button {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-button.activate {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .toggle-button.activate:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.3);
        }

        .toggle-button.deactivate {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .toggle-button.deactivate:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.3);
        }

        .toggle-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .session-info {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: grid;
          gap: 12px;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
        }

        .info-row .label {
          color: rgba(255, 255, 255, 0.6);
        }

        .info-row .value {
          color: rgba(255, 255, 255, 0.9);
        }

        .info-row .value.networks {
          font-family: monospace;
          color: #a5f3fc;
        }

        .rules-section h3 {
          margin: 0 0 16px;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.8);
        }

        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rule {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }

        .rule-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .rule-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rule-title {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }

        .rule-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
