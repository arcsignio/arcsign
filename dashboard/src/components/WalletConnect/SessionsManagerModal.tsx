/**
 * WalletConnect Sessions Manager Modal
 * Feature: Display and manage connected dApps
 * Updated: 2026-01-15
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionTypes } from '@walletconnect/types';

interface SessionsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionTypes.Struct[];
  onDisconnect: (topic: string) => Promise<void>;
  onDisconnectAll: () => Promise<void>;
  onAddNew: () => void;
}

// Helper to format time ago
function timeAgo(timestamp: number, t: (key: string) => string): string {
  const now = Date.now();
  const diff = now - timestamp * 1000; // timestamp is in seconds

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) {
    return t('walletConnect.daysAgo').replace('{n}', String(days));
  } else if (hours > 0) {
    return t('walletConnect.hoursAgo').replace('{n}', String(hours));
  } else if (minutes > 0) {
    return t('walletConnect.minutesAgo').replace('{n}', String(minutes));
  } else {
    return t('walletConnect.justNow');
  }
}

// Helper to get chain names
function getChainNames(session: SessionTypes.Struct): string[] {
  const chainMap: Record<string, string> = {
    'eip155:1': 'ETH',
    'eip155:56': 'BSC',
    'eip155:137': 'Polygon',
    'eip155:42161': 'Arbitrum',
    'eip155:10': 'Optimism',
    'eip155:8453': 'Base',
  };

  const chains = session.namespaces?.eip155?.chains || [];
  return chains.map(chain => chainMap[chain] || chain);
}

// Helper to check if session is expiring soon (< 24 hours)
function isExpiringSoon(session: SessionTypes.Struct): boolean {
  const now = Date.now() / 1000;
  const hoursLeft = (session.expiry - now) / 3600;
  return hoursLeft < 24 && hoursLeft > 0;
}

export const SessionsManagerModal: React.FC<SessionsManagerModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onDisconnect,
  onDisconnectAll,
  onAddNew,
}) => {
  const { t } = useTranslation();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [disconnectingAll, setDisconnectingAll] = useState(false);
  const [confirmDisconnectAll, setConfirmDisconnectAll] = useState(false);

  if (!isOpen) return null;

  const handleDisconnect = async (topic: string) => {
    setDisconnecting(topic);
    try {
      await onDisconnect(topic);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleDisconnectAll = async () => {
    if (!confirmDisconnectAll) {
      setConfirmDisconnectAll(true);
      return;
    }

    setDisconnectingAll(true);
    try {
      await onDisconnectAll();
      setConfirmDisconnectAll(false);
    } catch (err) {
      console.error('Failed to disconnect all:', err);
    } finally {
      setDisconnectingAll(false);
    }
  };

  return (
    <div className="sessions-modal-overlay" onClick={onClose}>
      <div className="sessions-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sessions-modal-header">
          <h2>{t('walletConnect.connectedDapps')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Content */}
        <div className="sessions-modal-content">
          {sessions.length === 0 ? (
            <div className="no-sessions">
              <div className="no-sessions-icon">🔗</div>
              <p>{t('walletConnect.noConnections')}</p>
              <p className="no-sessions-hint">{t('walletConnect.noConnectionsHint')}</p>
            </div>
          ) : (
            <div className="sessions-list">
              {sessions.map(session => {
                const metadata = session.peer?.metadata;
                const chainNames = getChainNames(session);
                const expiringSoon = isExpiringSoon(session);

                return (
                  <div key={session.topic} className="session-item">
                    <div className="session-icon">
                      {metadata?.icons?.[0] ? (
                        <img
                          src={metadata.icons[0]}
                          alt={metadata.name || 'dApp'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="default-icon">🌐</span>
                      )}
                    </div>

                    <div className="session-info">
                      <div className="session-name">
                        {metadata?.name || t('walletConnect.unknownDapp')}
                        <span className={`status-dot ${expiringSoon ? 'expiring' : 'active'}`}>●</span>
                      </div>
                      <div className="session-url">
                        {metadata?.url?.replace(/^https?:\/\//, '') || '-'}
                      </div>
                      <div className="session-details">
                        <span className="chains">{chainNames.join(', ') || '-'}</span>
                        <span className="separator">·</span>
                        <span className="time">
                          {/* Use session creation time - approximate from expiry */}
                          {timeAgo(session.expiry - 604800, t)}
                        </span>
                      </div>
                    </div>

                    <button
                      className="disconnect-btn"
                      onClick={() => handleDisconnect(session.topic)}
                      disabled={disconnecting === session.topic}
                    >
                      {disconnecting === session.topic
                        ? t('walletConnect.disconnecting')
                        : t('walletConnect.disconnect')
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sessions-modal-footer">
          <button className="add-btn" onClick={onAddNew}>
            + {t('walletConnect.addConnection')}
          </button>

          {sessions.length > 0 && (
            <button
              className={`disconnect-all-btn ${confirmDisconnectAll ? 'confirm' : ''}`}
              onClick={handleDisconnectAll}
              disabled={disconnectingAll}
            >
              {disconnectingAll
                ? t('walletConnect.disconnecting')
                : confirmDisconnectAll
                  ? t('walletConnect.confirmDisconnectAll')
                  : t('walletConnect.disconnectAll')
              }
            </button>
          )}
        </div>
      </div>

      <style>{`
        .sessions-modal-overlay {
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
          padding: 20px;
        }

        .sessions-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 420px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .sessions-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sessions-modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #64748b;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #1e293b;
        }

        .sessions-modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }

        .no-sessions {
          text-align: center;
          padding: 40px 20px;
        }

        .no-sessions-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .no-sessions p {
          margin: 0;
          color: #64748b;
        }

        .no-sessions-hint {
          font-size: 14px;
          margin-top: 8px !important;
        }

        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .session-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }

        .session-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid #e5e7eb;
        }

        .session-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .default-icon {
          font-size: 24px;
        }

        .session-info {
          flex: 1;
          min-width: 0;
        }

        .session-name {
          font-weight: 600;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          font-size: 8px;
        }

        .status-dot.active {
          color: #22c55e;
        }

        .status-dot.expiring {
          color: #eab308;
        }

        .session-url {
          font-size: 13px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .session-details {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .session-details .separator {
          margin: 0 6px;
        }

        .disconnect-btn {
          padding: 8px 12px;
          background: #fee2e2;
          color: #dc2626;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }

        .disconnect-btn:hover:not(:disabled) {
          background: #fecaca;
        }

        .disconnect-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .sessions-modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e5e7eb;
        }

        .add-btn {
          flex: 1;
          padding: 12px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .add-btn:hover {
          background: #2563eb;
        }

        .disconnect-all-btn {
          padding: 12px 16px;
          background: #f1f5f9;
          color: #64748b;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .disconnect-all-btn:hover:not(:disabled) {
          background: #fee2e2;
          color: #dc2626;
        }

        .disconnect-all-btn.confirm {
          background: #dc2626;
          color: white;
        }

        .disconnect-all-btn.confirm:hover:not(:disabled) {
          background: #b91c1c;
        }

        .disconnect-all-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
