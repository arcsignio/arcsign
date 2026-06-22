/**
 * Settings page
 * Feature: Settings menu with sub-options
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getVersion } from '@tauri-apps/api/app';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useSessionStore } from '@/stores/sessionStore';
import { clearAbiCache } from '@/services/tauri-api';

interface SettingsProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
  onCheckUpdate?: () => Promise<void>;
}

interface SettingItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
}

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);

const IconLink = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
);

const IconWrench = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
);

const IconBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
);

const IconDownload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

const SETTING_ITEMS: SettingItem[] = [
  {
    id: 'membership',
    titleKey: 'settings.membershipTitle',
    descriptionKey: 'settings.membershipDescription',
    icon: <IconShield />,
  },
  {
    id: 'api-settings',
    titleKey: 'settings.apiSettingsTitle',
    descriptionKey: 'settings.apiSettingsDescription',
    icon: <IconLink />,
  },
  {
    id: 'onboarding',
    titleKey: 'settings.onboardingTitle',
    descriptionKey: 'settings.onboardingDescription',
    icon: <IconBook />,
  },
];

// Developer mode - separate from regular settings
const DEVELOPER_ITEM: SettingItem = {
  id: 'developer',
  titleKey: 'settings.developerModeTitle',
  descriptionKey: 'settings.developerModeDescription',
  icon: <IconWrench />,
};

export const Settings: React.FC<SettingsProps> = ({ onBack, onNavigate, onCheckUpdate }) => {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('...');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const isPro = useDashboardStore((s) => s.membership.isPro);
  const onlineDecodingEnabled = useDashboardStore((s) => s.onlineDecodingEnabled);
  const setOnlineDecodingEnabled = useDashboardStore((s) => s.setOnlineDecodingEnabled);
  const usbPath = useDashboardStore((s) => s.usbPath);
  const sessionToken = useSessionStore((state) => state.token);
  const [abiCacheStatus, setAbiCacheStatus] = useState<'idle' | 'done' | 'failed'>('idle');
  const [isClearingAbiCache, setIsClearingAbiCache] = useState(false);

  const handleClearAbiCache = async () => {
    if (!usbPath || !sessionToken || isClearingAbiCache) return;
    setIsClearingAbiCache(true);
    setAbiCacheStatus('idle');
    try {
      await clearAbiCache({ usbPath, sessionToken });
      setAbiCacheStatus('done');
    } catch (err) {
      const message = (err as { message?: string })?.message;
      console.error('Failed to clear ABI cache:', message ?? err);
      setAbiCacheStatus('failed');
    } finally {
      setIsClearingAbiCache(false);
      setTimeout(() => setAbiCacheStatus('idle'), 4000);
    }
  };

  useEffect(() => {
    getVersion().then(v => setAppVersion(v)).catch(() => setAppVersion('unknown'));
  }, []);

  const handleCheckUpdate = async () => {
    if (!onCheckUpdate || isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      await onCheckUpdate();
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className="settings-page">
      <button onClick={onBack} className="back-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        {t('settings.backToWallets')}
      </button>

      <header className="settings-header">
        <h1>{t('settings.settings')}</h1>
        <p className="settings-description">
          {t('settings.settingsDescription')}
        </p>
      </header>

      <div className="settings-menu">
        {SETTING_ITEMS.map((item) => (
          <button
            key={item.id}
            className="setting-item"
            onClick={() => onNavigate(item.id)}
          >
            <span className="setting-icon">{item.icon}</span>
            <div className="setting-content">
              <h3 className="setting-title">{t(item.titleKey)}</h3>
              <p className="setting-description">{t(item.descriptionKey)}</p>
            </div>
            <span className="setting-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          </button>
        ))}
      </div>

      {/* Privacy / Clear-signing preferences */}
      <div className="preferences-section">
        <h2 className="preferences-section-title">{t('settings.advancedTitle', 'Advanced')}</h2>
        <div className="toggle-item">
          <div className="setting-content">
            <h3 className="setting-title">{t('onlineDecoding.label')}</h3>
            <p className="setting-description">{t('onlineDecoding.description')}</p>
            <p className="toggle-privacy-note">{t('onlineDecoding.privacyNote')}</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={onlineDecodingEnabled}
              onChange={(e) => setOnlineDecodingEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="toggle-item">
          <div className="setting-content">
            <h3 className="setting-title">{t('clearAbiCache.label')}</h3>
            <p className="setting-description">{t('clearAbiCache.description')}</p>
            {abiCacheStatus === 'done' && (
              <p className="abi-cache-status abi-cache-status-done">{t('clearAbiCache.done')}</p>
            )}
            {abiCacheStatus === 'failed' && (
              <p className="abi-cache-status abi-cache-status-failed">{t('clearAbiCache.failed')}</p>
            )}
          </div>
          <button
            className="clear-abi-button"
            onClick={handleClearAbiCache}
            disabled={!usbPath || !sessionToken || isClearingAbiCache}
          >
            {t('clearAbiCache.button')}
          </button>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className="backup-section">
        <h2 className="backup-section-title">{t('backup.backupSectionTitle')}</h2>
        <button
          className="setting-item"
          onClick={() => onNavigate('export-backup-select')}
        >
          <span className="setting-icon backup-icon"><IconDownload /></span>
          <div className="setting-content">
            <h3 className="setting-title">{t('backup.exportSettingsTitle')}</h3>
            <p className="setting-description">{t('backup.exportSettingsDescription')}</p>
          </div>
          <span className="setting-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
        <button
          className={`setting-item ${!isPro ? 'setting-item-disabled' : ''}`}
          onClick={() => isPro && onNavigate('export-all-backups')}
          disabled={!isPro}
        >
          <span className="setting-icon backup-icon"><IconDownload /></span>
          <div className="setting-content">
            <h3 className="setting-title">
              {t('backup.exportAllTitle')}
              <span className="pro-badge">PRO</span>
            </h3>
            <p className="setting-description">
              {isPro ? t('backup.exportAllDescription') : t('backup.exportAllProOnly')}
            </p>
          </div>
          <span className="setting-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
      </div>

      {/* Developer Mode - Separate Section */}
      <div className="developer-section">
        <h2 className="developer-section-title">{t('settings.advancedTitle', 'Advanced')}</h2>
        <button
          className="setting-item developer-item"
          onClick={() => onNavigate(DEVELOPER_ITEM.id)}
        >
          <span className="setting-icon developer-icon">{DEVELOPER_ITEM.icon}</span>
          <div className="setting-content">
            <h3 className="setting-title">{t(DEVELOPER_ITEM.titleKey)}</h3>
            <p className="setting-description">{t(DEVELOPER_ITEM.descriptionKey)}</p>
          </div>
          <span className="setting-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
      </div>

      {/* About ArcSign */}
      <div className="about-section">
        <div className="about-card">
          <img src="/logo.png" alt="ArcSign" className="about-logo" />
          <div className="about-info">
            <h3 className="about-title">ArcSign</h3>
            <p className="about-version">v{appVersion}</p>
            <p className="about-desc">Secure Multi-Chain HD Wallet</p>
          </div>
          <div className="about-links">
            <a href="https://arcsign.io" target="_blank" rel="noopener noreferrer" className="about-link">arcsign.io</a>
            <span className="about-separator">·</span>
            <a href="https://x.com/ArcSignWallet" target="_blank" rel="noopener noreferrer" className="about-link">@ArcSignWallet</a>
          </div>
          {onCheckUpdate && (
            <button
              className="check-update-button"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? (
                <>
                  <svg className="check-update-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                  {t('update.checking')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115.35-6.35L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15.35 6.35L3 16"/></svg>
                  {t('update.checkForUpdates')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .settings-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .back-button {
          background: none;
          border: none;
          color: #2dd4bf;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 0;
          margin-bottom: 16px;
        }

        .back-button:hover {
          text-decoration: underline;
        }

        .settings-header {
          margin-bottom: 32px;
        }

        .settings-header h1 {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 600;
          color: #111827;
        }

        .settings-header .settings-description {
          margin: 0;
          color: #6b7280;
          font-size: 16px;
        }

        .settings-menu {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .setting-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          width: 100%;
        }

        .setting-item:hover {
          border-color: #2dd4bf;
          box-shadow: 0 2px 12px rgba(45, 212, 191, 0.1);
        }

        .setting-icon {
          font-size: 24px;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .setting-content {
          flex: 1;
        }

        .setting-title {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .setting-content .setting-description {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .setting-arrow {
          color: #9ca3af;
          font-size: 18px;
          flex-shrink: 0;
        }

        .setting-item:hover .setting-arrow {
          color: #0d9488;
        }

        /* Preferences Section */
        .preferences-section {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .preferences-section-title {
          margin: 0 0 16px;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .toggle-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .toggle-privacy-note {
          margin: 8px 0 0;
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.5;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          inset: 0;
          cursor: pointer;
          background: #d1d5db;
          border-radius: 24px;
          transition: background 0.2s;
        }

        .toggle-slider::before {
          content: "";
          position: absolute;
          height: 18px;
          width: 18px;
          left: 3px;
          top: 3px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
        }

        .toggle-switch input:checked + .toggle-slider {
          background: #2dd4bf;
        }

        .toggle-switch input:checked + .toggle-slider::before {
          transform: translateX(20px);
        }

        .clear-abi-button {
          flex-shrink: 0;
          align-self: center;
          padding: 8px 16px;
          background: transparent;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          color: #0d9488;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .clear-abi-button:hover:not(:disabled) {
          border-color: #2dd4bf;
          background: rgba(45, 212, 191, 0.05);
        }

        .clear-abi-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .abi-cache-status {
          margin: 8px 0 0;
          font-size: 12px;
          font-weight: 500;
        }

        .abi-cache-status-done {
          color: #0d9488;
        }

        .abi-cache-status-failed {
          color: #dc2626;
        }

        /* Backup Section */
        .backup-section {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .backup-section-title {
          margin: 0 0 16px;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .backup-icon {
          background: #e0f2f1;
          color: #0d9488;
        }

        .setting-item-disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .setting-item-disabled:hover {
          border-color: #e5e7eb;
          box-shadow: none;
        }

        .pro-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 6px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 4px;
          vertical-align: middle;
          letter-spacing: 0.05em;
        }

        /* Developer Section */
        .developer-section {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .developer-section-title {
          margin: 0 0 16px;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .developer-item {
          background: white;
          border-color: #e5e7eb;
        }

        .developer-item:hover {
          border-color: #2dd4bf;
          box-shadow: 0 2px 12px rgba(45, 212, 191, 0.1);
        }

        .developer-item:hover .setting-arrow {
          color: #0d9488;
        }

        .developer-icon {
          background: #f3f4f6;
        }

        /* About Section */
        .about-section {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .about-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 32px 20px;
          text-align: center;
        }

        .about-logo {
          width: 56px;
          height: 56px;
          object-fit: contain;
          opacity: 0.9;
        }

        .about-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .about-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }

        .about-version {
          margin: 0;
          font-size: 13px;
          color: #9ca3af;
          font-weight: 500;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .about-desc {
          margin: 4px 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .about-links {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .about-link {
          font-size: 13px;
          color: #2dd4bf;
          text-decoration: none;
          font-weight: 500;
        }

        .about-link:hover {
          text-decoration: underline;
        }

        .about-separator {
          color: #d1d5db;
          font-size: 12px;
        }

        .check-update-button {
          margin-top: 12px;
          padding: 8px 20px;
          background: transparent;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          color: #0d9488;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .check-update-button:hover {
          border-color: #2dd4bf;
          background: rgba(45, 212, 191, 0.05);
        }

        .check-update-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .check-update-spinner {
          animation: check-update-spin 1s linear infinite;
        }

        @keyframes check-update-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
