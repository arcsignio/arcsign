/**
 * OTA Update Dialog
 * Feature: Custom multi-state modal for app updates
 * Renders different UI based on UpdateStatus from useUpdateChecker hook.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/api/process';
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
            <div className="update-dialog-body update-center">
              <div className="update-icon-circle update-icon-teal">
                <svg className="update-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              </div>
              <p className="update-title" id="update-dialog-title">{t('update.checking')}</p>
            </div>
          )}

          {/* Up to date */}
          {state.status === 'up-to-date' && (
            <div className="update-dialog-body update-center">
              <div className="update-icon-circle update-icon-green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="update-title" id="update-dialog-title">{t('update.upToDate')}</p>
              <p className="update-desc">{t('update.upToDateDesc', { version: currentVersion })}</p>
              <button className="update-btn-secondary" onClick={onDismiss} style={{ marginTop: 12 }}>
                {t('update.close', 'Close')}
              </button>
            </div>
          )}

          {/* Update Available */}
          {state.status === 'available' && state.manifest && (
            <div className="update-dialog-body">
              <div className="update-center" style={{ marginBottom: 20 }}>
                <div className="update-icon-circle update-icon-teal">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </div>
                <p className="update-title" id="update-dialog-title">{t('update.available')}</p>
                <p className="update-desc">{t('update.newVersion')}</p>
              </div>

              <div className="update-version-row">
                <span className="update-version-label">{t('update.currentVersion')}</span>
                <span className="update-version-value">v{currentVersion}</span>
              </div>
              <div className="update-version-row">
                <span className="update-version-label">{t('update.latestVersion')}</span>
                <span className="update-version-value update-version-new">v{state.manifest.version}</span>
              </div>
              {state.manifest.date && (
                <div className="update-version-row">
                  <span className="update-version-label">{t('update.releaseDate')}</span>
                  <span className="update-version-value">{formatDate(state.manifest.date)}</span>
                </div>
              )}

              {state.manifest.body && (
                <div className="update-notes-section">
                  <p className="update-notes-title">{t('update.releaseNotes')}</p>
                  <div className="update-notes-content">
                    {state.manifest.body}
                  </div>
                </div>
              )}

              <div className="update-skip-row">
                <button className="update-btn-text" onClick={onSkipVersion}>
                  {t('update.skipVersion')}
                </button>
              </div>

              <div className="update-actions">
                <button className="update-btn-secondary" onClick={onDismiss}>
                  {t('update.remindLater')}
                </button>
                <button className="update-btn-primary" onClick={onInstall}>
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
            <div className="update-dialog-body update-center">
              <div className="update-icon-circle update-icon-teal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </div>
              <p className="update-title" id="update-dialog-title">{t('update.downloading')}</p>
              <p className="update-desc">{t('update.downloadingDesc')}</p>
              <div className="update-progress-bar">
                <div className="update-progress-bar-inner" />
              </div>
              {state.manifest && (
                <p className="update-desc" style={{ marginTop: 8, fontSize: 12 }}>
                  v{currentVersion} → v{state.manifest.version}
                </p>
              )}
            </div>
          )}

          {/* Installing */}
          {state.status === 'installing' && (
            <div className="update-dialog-body update-center">
              <div className="update-icon-circle update-icon-teal">
                <svg className="update-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
              </div>
              <p className="update-title" id="update-dialog-title">{t('update.installing')}</p>
              <p className="update-desc">{t('update.installingDesc')}</p>
            </div>
          )}

          {/* Done */}
          {state.status === 'done' && (
            <div className="update-dialog-body update-center">
              <div className="update-icon-circle update-icon-green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="update-title" id="update-dialog-title">{t('update.installed')}</p>
              <p className="update-desc">
                {t('update.installedDesc', { version: state.manifest?.version || '' })}
              </p>
              <button className="update-btn-primary" onClick={handleRestart} style={{ marginTop: 16 }}>
                {t('update.restartNow')}
              </button>
            </div>
          )}

          {/* Error */}
          {state.status === 'error' && (
            <div className="update-dialog-body update-center">
              <div className="update-icon-circle update-icon-red">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <p className="update-title" id="update-dialog-title">{t('update.error')}</p>
              <p className="update-desc">{t('update.errorDesc')}</p>
              {state.error && (
                <p className="update-error-detail">{state.error}</p>
              )}
              <div className="update-actions" style={{ marginTop: 16 }}>
                <button className="update-btn-secondary" onClick={onDismiss}>
                  {t('update.close', 'Close')}
                </button>
                <button className="update-btn-primary" onClick={onRetry}>
                  {t('update.retry')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .update-dialog-body {
          padding: 32px 28px 24px;
        }

        .update-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .update-icon-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }

        .update-icon-teal {
          background: #f0fdfa;
          color: #0d9488;
        }

        .update-icon-green {
          background: #f0fdf4;
          color: #16a34a;
        }

        .update-icon-red {
          background: #fef2f2;
          color: #dc2626;
        }

        .update-title {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .update-desc {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }

        .update-version-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .update-version-label {
          font-size: 14px;
          color: #6b7280;
        }

        .update-version-value {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .update-version-new {
          color: #0d9488;
          background: #f0fdfa;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .update-notes-section {
          margin-top: 16px;
        }

        .update-notes-title {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .update-notes-content {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 13px;
          color: #374151;
          line-height: 1.6;
          max-height: 160px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .update-skip-row {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }

        .update-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          justify-content: flex-end;
        }

        .update-btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: #0d9488;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .update-btn-primary:hover {
          background: #0f766e;
        }

        .update-btn-secondary {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: #fff;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .update-btn-secondary:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .update-btn-text {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
          padding: 4px 8px;
        }

        .update-btn-text:hover {
          color: #374151;
        }

        .update-error-detail {
          margin: 10px 0 0;
          padding: 8px 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          font-size: 12px;
          color: #991b1b;
          font-family: 'SF Mono', 'Fira Code', monospace;
          word-break: break-all;
        }

        /* Indeterminate progress bar */
        .update-progress-bar {
          width: 100%;
          max-width: 280px;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
          margin-top: 20px;
        }

        .update-progress-bar-inner {
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, #2dd4bf, #0d9488);
          border-radius: 3px;
          animation: update-progress-slide 1.5s ease-in-out infinite;
        }

        @keyframes update-progress-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(-100%); }
        }

        /* Spinner animation */
        .update-spinner {
          animation: update-spin 1s linear infinite;
        }

        @keyframes update-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
