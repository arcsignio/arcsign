/**
 * WalletConnect Sessions Manager Modal
 * Feature: Display and manage connected dApps
 * Updated: 2026-01-15
 */

import React, { useState } from 'react';
import styles from "./SessionsManagerModal.module.css";
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
    <div className={styles.sessionsModalOverlay} onClick={onClose}>
      <div className={styles.sessionsModal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.sessionsModalHeader}>
          <h2>{t('walletConnect.connectedDapps')}</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* Content */}
        <div className={styles.sessionsModalContent}>
          {sessions.length === 0 ? (
            <div className={styles.noSessions}>
              <div className={styles.noSessionsIcon}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></div>
              <p>{t('walletConnect.noConnections')}</p>
              <p className={styles.noSessionsHint}>{t('walletConnect.noConnectionsHint')}</p>
            </div>
          ) : (
            <div className={styles.sessionsList}>
              {sessions.map(session => {
                const metadata = session.peer?.metadata;
                const chainNames = getChainNames(session);
                const expiringSoon = isExpiringSoon(session);

                return (
                  <div key={session.topic} className={styles.sessionItem}>
                    <div className={styles.sessionIcon}>
                      {metadata?.icons?.[0] ? (
                        <img
                          src={metadata.icons[0]}
                          alt={metadata.name || 'dApp'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                      )}
                    </div>

                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionName}>
                        {metadata?.name || t('walletConnect.unknownDapp')}
                        <span className={`${styles.statusDot} ${expiringSoon ? styles.expiring : styles.active}`}>●</span>
                      </div>
                      <div className={styles.sessionUrl}>
                        {metadata?.url?.replace(/^https?:\/\//, '') || '-'}
                      </div>
                      <div className={styles.sessionDetails}>
                        <span className="chains">{chainNames.join(', ') || '-'}</span>
                        <span className={styles.separator}>·</span>
                        <span className="time">
                          {/* Use session creation time - approximate from expiry */}
                          {timeAgo(session.expiry - 604800, t)}
                        </span>
                      </div>
                    </div>

                    <button
                      className={styles.disconnectBtn}
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
        <div className={styles.sessionsModalFooter}>
          <button className={styles.addBtn} onClick={onAddNew}>
            + {t('walletConnect.addConnection')}
          </button>

          {sessions.length > 0 && (
            <button
              className={`${styles.disconnectAllBtn} ${confirmDisconnectAll ? styles.confirm : ''}`}
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
    </div>
  );
};
