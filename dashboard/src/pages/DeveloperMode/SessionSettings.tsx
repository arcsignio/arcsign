/**
 * Session Settings Component
 *
 * Allows developers to configure auto-signing sessions for testnets.
 *
 * Created: 2026-02-04
 * Updated: 2026-02-09 - Added password dialog for session creation
 */

import { useState } from 'react';
import styles from "./SessionSettings.module.css";
import { useTranslation } from 'react-i18next';
import type { DevSession } from '@/types/developer';
import { PasswordInput } from "@/components/PasswordInput";

interface SessionSettingsProps {
  session: DevSession | null;
  onStartSession: (password: string) => Promise<void>;
  onEndSession: () => Promise<void>;
}

export function SessionSettings({ session, onStartSession, onEndSession }: SessionSettingsProps) {
  const { t } = useTranslation();
  const [isToggling, setIsToggling] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStartClick = () => {
    setShowPasswordDialog(true);
    setPassword('');
    setError(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsToggling(true);
    setError(null);

    try {
      await onStartSession(password);
      setShowPasswordDialog(false);
      setPassword('');
    } catch (err) {
      console.error('Failed to start session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsToggling(false);
    }
  };

  const handleEndSession = async () => {
    setIsToggling(true);
    try {
      await onEndSession();
    } catch (err) {
      console.error('Failed to end session:', err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCancelDialog = () => {
    setShowPasswordDialog(false);
    setPassword('');
    setError(null);
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
    <div className={styles.sessionSettings}>
      <h2>⚙️ {t('developer.sessionSettings', 'Session Settings')}</h2>
      <p className={styles.description}>
        {t('developer.sessionDesc', 'Enable session mode to auto-sign testnet transactions without entering password each time.')}
      </p>

      {/* Session Status Card */}
      <div className={`${styles.sessionCard} ${session?.enabled ? styles.active : ''}`}>
        <div className={styles.sessionHeader}>
          <div className={styles.sessionStatus}>
            {session?.enabled ? (
              <>
                <span className={styles.statusIcon}>🔓</span>
                <span className={styles.statusText}>{t('developer.sessionActive', 'Session Active')}</span>
              </>
            ) : (
              <>
                <span className={styles.statusIcon}>🔒</span>
                <span className={styles.statusText}>{t('developer.sessionInactive', 'Session Inactive')}</span>
              </>
            )}
          </div>

          {session?.enabled ? (
            <button
              className={`${styles.toggleButton} ${styles.deactivate}`.trim()}
              onClick={handleEndSession}
              disabled={isToggling}
            >
              {isToggling ? '...' : t('developer.endSession', 'End Session')}
            </button>
          ) : (
            <button
              className={`${styles.toggleButton} ${styles.activate}`.trim()}
              onClick={handleStartClick}
              disabled={isToggling}
            >
              {t('developer.startSession', 'Start Session')}
            </button>
          )}
        </div>

        {session?.enabled && (
          <div className={styles.sessionInfo}>
            <div className={styles.infoRow}>
              <span className={styles.label}>⏱️ {t('developer.remaining', 'Remaining')}:</span>
              <span className={styles.value}>{getRemainingTime()}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>📊 {t('developer.signCount', 'Signatures')}:</span>
              <span className={styles.value}>{session.signCount}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>🧪 {t('developer.autoNetworks', 'Auto-sign Networks')}:</span>
              <span className={`${styles.networks} ${styles.value} `.trim()}>
                {session.trustedNetworks.join(', ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Password Dialog */}
      {showPasswordDialog && (
        <div className={styles.passwordDialogOverlay}>
          <div className={styles.passwordDialog}>
            <h3>🔐 {t('developer.enterPassword', 'Enter Wallet Password')}</h3>
            <p>{t('developer.passwordForSession', 'Enter your wallet password to start a 30-minute auto-signing session.')}</p>

            <form onSubmit={handlePasswordSubmit}>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('security.password')}
                autoFocus
                className={styles.passwordInput}
              />

              {error && (
                <div className={styles.errorMessage}>⚠️ {error}</div>
              )}

              <div className={styles.dialogButtons}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleCancelDialog}
                  disabled={isToggling}
                >
                  {t('actions.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isToggling || !password}
                >
                  {isToggling ? '...' : t('developer.startSession', 'Start Session')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Rules */}
      <div className={styles.rulesSection}>
        <h3>🛡️ {t('developer.securityRules', 'Security Rules')}</h3>

        <div className={styles.rulesList}>
          <div className={styles.rule}>
            <span className={styles.ruleIcon}>✓</span>
            <div className={styles.ruleContent}>
              <span className={styles.ruleTitle}>{t('developer.testnetAuto', 'Testnets: Auto-sign')}</span>
              <span className={styles.ruleDesc}>{t('developer.testnetAutoDesc', 'Sepolia, Goerli, BSC Testnet will auto-sign when session is active')}</span>
            </div>
          </div>

          <div className={styles.rule}>
            <span className={styles.ruleIcon}>⚠️</span>
            <div className={styles.ruleContent}>
              <span className={styles.ruleTitle}>{t('developer.mainnetConfirm', 'Mainnets: Always Confirm')}</span>
              <span className={styles.ruleDesc}>{t('developer.mainnetConfirmDesc', 'Ethereum, BSC, Polygon mainnet always require confirmation')}</span>
            </div>
          </div>

          <div className={styles.rule}>
            <span className={styles.ruleIcon}>⏰</span>
            <div className={styles.ruleContent}>
              <span className={styles.ruleTitle}>{t('developer.sessionTimeout', 'Session Timeout: 30 mins')}</span>
              <span className={styles.ruleDesc}>{t('developer.sessionTimeoutDesc', 'Sessions automatically expire after 30 minutes of inactivity')}</span>
            </div>
          </div>

          <div className={styles.rule}>
            <span className={styles.ruleIcon}>🔐</span>
            <div className={styles.ruleContent}>
              <span className={styles.ruleTitle}>{t('developer.manualLock', 'Manual Lock')}</span>
              <span className={styles.ruleDesc}>{t('developer.manualLockDesc', 'You can end the session manually at any time')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
