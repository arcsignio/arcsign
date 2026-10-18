/**
 * OTA Update Dialog
 * Feature: Custom multi-state modal for app updates
 * Renders different UI based on UpdateStatus from useUpdateChecker hook.
 */

import React, { useState, useEffect } from 'react';
import styles from "./UpdateDialog.module.css";
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import type { UpdateState } from '@/hooks/useUpdateChecker';

interface UpdateDialogProps {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
  onSkipVersion: () => void;
  onRetry: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  state,
  onInstall,
  onDismiss,
  onSkipVersion,
  onRetry,
}) => {
  const { t } = useTranslation();
  const [currentVersion, setCurrentVersion] = useState('...');

  useEffect(() => {
    getVersion().then((v) => setCurrentVersion(v)).catch(() => setCurrentVersion('unknown'));
  }, []);

  // Don't render when idle
  if (state.status === 'idle') return null;

  // Whether the dialog can be dismissed (not during download/install)
  const canDismiss = !['downloading', 'installing', 'done'].includes(state.status);

  const handleOverlayClick = () => {
    if (canDismiss) onDismiss();
  };

  const handleRestart = async () => {
    try {
      await relaunch();
    } catch {
      // If relaunch fails, user can try again
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={handleOverlayClick}
        role="dialog"
        aria-labelledby="update-dialog-title"
      >
        <div
          className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
          style={{ minWidth: 360 }}
        >
          {/* Checking */}
          {state.status === 'checking' && (
            <div className={`${styles.updateDialogBody} ${styles.updateCenter}`.trim()}>
              <div className={`${styles.updateIconCircle} ${styles.updateIconTeal}`.trim()}>
                <svg className={styles.updateSpinner} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              </div>
              <p className={styles.updateTitle} id="update-dialog-title">{t('update.checking')}</p>
            </div>
          )}

          {/* Up to date */}
          {state.status === 'up-to-date' && (
            <div className={`${styles.updateDialogBody} ${styles.updateCenter}`.trim()}>
              <div className={`${styles.updateIconCircle} ${styles.updateIconGreen}`.trim()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className={styles.updateTitle} id="update-dialog-title">{t('update.upToDate')}</p>
              <p className={styles.updateDesc}>{t('update.upToDateDesc', { version: currentVersion })}</p>
              <button className={styles.updateBtnSecondary} onClick={onDismiss} style={{ marginTop: 12 }}>
                {t('update.close', 'Close')}
              </button>
            </div>
          )}

          {/* Update Available */}
          {state.status === 'available' && state.manifest && (
            <div className={styles.updateDialogBody}>
              <div className={styles.updateCenter} style={{ marginBottom: 20 }}>
                <div className={`${styles.updateIconCircle} ${styles.updateIconTeal}`.trim()}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </div>
                <p className={styles.updateTitle} id="update-dialog-title">{t('update.available')}</p>
                <p className={styles.updateDesc}>{t('update.newVersion')}</p>
              </div>

              <div className={styles.updateVersionRow}>
                <span className={styles.updateVersionLabel}>{t('update.currentVersion')}</span>
                <span className={styles.updateVersionValue}>v{currentVersion}</span>
              </div>
              <div className={styles.updateVersionRow}>
                <span className={styles.updateVersionLabel}>{t('update.latestVersion')}</span>
                <span className={`${styles.updateVersionValue} ${styles.updateVersionNew}`.trim()}>v{state.manifest.version}</span>
              </div>
              {state.manifest.date && (
                <div className={styles.updateVersionRow}>
                  <span className={styles.updateVersionLabel}>{t('update.releaseDate')}</span>
                  <span className={styles.updateVersionValue}>{formatDate(state.manifest.date)}</span>
                </div>
              )}

              {state.manifest.body && (
                <div className={styles.updateNotesSection}>
                  <p className={styles.updateNotesTitle}>{t('update.releaseNotes')}</p>
                  <div className={styles.updateNotesContent}>
                    {state.manifest.body}
                  </div>
                </div>
              )}

              <div className={styles.updateSkipRow}>
                <button className={styles.updateBtnText} onClick={onSkipVersion}>
                  {t('update.skipVersion')}
                </button>
              </div>

              <div className={styles.updateActions}>
                <button className={styles.updateBtnSecondary} onClick={onDismiss}>
                  {t('update.remindLater')}
                </button>
                <button className={styles.updateBtnPrimary} onClick={onInstall}>
                  {t('update.updateNow')}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Downloading */}
          {state.status === 'downloading' && (
            <div className={`${styles.updateDialogBody} ${styles.updateCenter}`.trim()}>
              <div className={`${styles.updateIconCircle} ${styles.updateIconTeal}`.trim()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </div>
              <p className={styles.updateTitle} id="update-dialog-title">{t('update.downloading')}</p>
              <p className={styles.updateDesc}>{t('update.downloadingDesc')}</p>
              <div className={styles.updateProgressBar}>
                <div className={styles.updateProgressBarInner} />
              </div>
              {state.manifest && (
                <p className={styles.updateDesc} style={{ marginTop: 8, fontSize: 12 }}>
                  v{currentVersion} → v{state.manifest.version}
                </p>
              )}
            </div>
          )}

          {/* Installing */}
          {state.status === 'installing' && (
            <div className={`${styles.updateDialogBody} ${styles.updateCenter}`.trim()}>
              <div className={`${styles.updateIconCircle} ${styles.updateIconTeal}`.trim()}>
                <svg className={styles.updateSpinner} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              </div>
              <p className={styles.updateTitle} id="update-dialog-title">{t('update.installing')}</p>
              <p className={styles.updateDesc}>{t('update.installingDesc')}</p>
            </div>
          )}

          {/* Done */}
          {state.status === 'done' && (
            <div className={`${styles.updateDialogBody} ${styles.updateCenter}`.trim()}>
              <div className={`${styles.updateIconCircle} ${styles.updateIconGreen}`.trim()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className={styles.updateTitle} id="update-dialog-title">{t('update.installed')}</p>
              <p className={styles.updateDesc}>
                {t('update.installedDesc', { version: state.manifest?.version || '' })}
              </p>
              <button className={styles.updateBtnPrimary} onClick={handleRestart} style={{ marginTop: 16 }}>
                {t('update.restartNow')}
              </button>
            </div>
          )}

          {/* Error */}
          {state.status === 'error' && (
            <div className={`${styles.updateDialogBody} ${styles.updateCenter}`.trim()}>
              <div className={`${styles.updateIconCircle} ${styles.updateIconRed}`.trim()}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <p className={styles.updateTitle} id="update-dialog-title">{t('update.error')}</p>
              <p className={styles.updateDesc}>{t('update.errorDesc')}</p>
              {state.error && (
                <p className={styles.updateErrorDetail}>{state.error}</p>
              )}
              <div className={styles.updateActions} style={{ marginTop: 16 }}>
                <button className={styles.updateBtnSecondary} onClick={onDismiss}>
                  {t('update.close', 'Close')}
                </button>
                <button className={styles.updateBtnPrimary} onClick={onRetry}>
                  {t('update.retry')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
