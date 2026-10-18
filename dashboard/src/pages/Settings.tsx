/**
 * Settings page
 * Feature: Settings menu with sub-options
 */

import React, { useState, useEffect } from 'react';
import styles from "./Settings.module.css";
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
    id: 'api-settings',
    titleKey: 'settings.apiSettingsTitle',
    descriptionKey: 'settings.apiSettingsDescription',
    icon: <IconLink />,
  },
  {
    id: 'descriptors',
    titleKey: 'settings.descriptorsTitle',
    descriptionKey: 'settings.descriptorsDescription',
    icon: <IconBook />,
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
    <div className={styles.settingsPage}>
      <button onClick={onBack} className={styles.backButton}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        {t('settings.backToWallets')}
      </button>

      <header className={styles.settingsHeader}>
        <h1>{t('settings.settings')}</h1>
        <p className={styles.settingsDescription}>
          {t('settings.settingsDescription')}
        </p>
      </header>

      <div className={styles.settingsMenu}>
        {SETTING_ITEMS.map((item) => (
          <button
            key={item.id}
            className={styles.settingItem}
            onClick={() => onNavigate(item.id)}
          >
            <span className={styles.settingIcon}>{item.icon}</span>
            <div className={styles.settingContent}>
              <h3 className={styles.settingTitle}>{t(item.titleKey)}</h3>
              <p className={styles.settingDescription}>{t(item.descriptionKey)}</p>
            </div>
            <span className={styles.settingArrow}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
          </button>
        ))}
      </div>

      {/* Privacy / Clear-signing preferences */}
      <div className={styles.preferencesSection}>
        <h2 className={styles.preferencesSectionTitle}>{t('settings.advancedTitle', 'Advanced')}</h2>
        <div className={styles.toggleItem}>
          <div className={styles.settingContent}>
            <h3 className={styles.settingTitle}>{t('onlineDecoding.label')}</h3>
            <p className={styles.settingDescription}>{t('onlineDecoding.description')}</p>
            <p className={styles.togglePrivacyNote}>{t('onlineDecoding.privacyNote')}</p>
          </div>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={onlineDecodingEnabled}
              onChange={(e) => setOnlineDecodingEnabled(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        <div className={styles.toggleItem}>
          <div className={styles.settingContent}>
            <h3 className={styles.settingTitle}>{t('clearAbiCache.label')}</h3>
            <p className={styles.settingDescription}>{t('clearAbiCache.description')}</p>
            {abiCacheStatus === 'done' && (
              <p className={`${styles.abiCacheStatusDone} ${styles.abiCacheStatus} `.trim()}>{t('clearAbiCache.done')}</p>
            )}
            {abiCacheStatus === 'failed' && (
              <p className={`${styles.abiCacheStatusFailed} ${styles.abiCacheStatus} `.trim()}>{t('clearAbiCache.failed')}</p>
            )}
          </div>
          <button
            className={styles.clearAbiButton}
            onClick={handleClearAbiCache}
            disabled={!usbPath || !sessionToken || isClearingAbiCache}
          >
            {t('clearAbiCache.button')}
          </button>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className={styles.backupSection}>
        <h2 className={styles.backupSectionTitle}>{t('backup.backupSectionTitle')}</h2>
        <button
          className={styles.settingItem}
          onClick={() => onNavigate('export-backup-select')}
        >
          <span className={`${styles.settingIcon} ${styles.backupIcon}`.trim()}><IconDownload /></span>
          <div className={styles.settingContent}>
            <h3 className={styles.settingTitle}>{t('backup.exportSettingsTitle')}</h3>
            <p className={styles.settingDescription}>{t('backup.exportSettingsDescription')}</p>
          </div>
          <span className={styles.settingArrow}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
        <button
          className={styles.settingItem}
          onClick={() => onNavigate('export-all-backups')}
        >
          <span className={`${styles.settingIcon} ${styles.backupIcon}`.trim()}><IconDownload /></span>
          <div className={styles.settingContent}>
            <h3 className={styles.settingTitle}>
              {t('backup.exportAllTitle')}
            </h3>
            <p className={styles.settingDescription}>
              {t('backup.exportAllDescription')}
            </p>
          </div>
          <span className={styles.settingArrow}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
      </div>

      {/* Developer Mode - Separate Section */}
      <div className={styles.developerSection}>
        <h2 className={styles.developerSectionTitle}>{t('settings.advancedTitle', 'Advanced')}</h2>
        <button
          className={`${styles.developerItem} ${styles.settingItem} `.trim()}
          onClick={() => onNavigate(DEVELOPER_ITEM.id)}
        >
          <span className={`${styles.developerIcon} ${styles.settingIcon} `.trim()}>{DEVELOPER_ITEM.icon}</span>
          <div className={styles.settingContent}>
            <h3 className={styles.settingTitle}>{t(DEVELOPER_ITEM.titleKey)}</h3>
            <p className={styles.settingDescription}>{t(DEVELOPER_ITEM.descriptionKey)}</p>
          </div>
          <span className={styles.settingArrow}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
        </button>
      </div>

      {/* About ArcSign */}
      <div className={styles.aboutSection}>
        <div className={styles.aboutCard}>
          <img src="/logo.png" alt="ArcSign" className={styles.aboutLogo} />
          <div className={styles.aboutInfo}>
            <h3 className={styles.aboutTitle}>ArcSign</h3>
            <p className={styles.aboutVersion}>v{appVersion}</p>
            <p className={styles.aboutDesc}>{t('app.tagline')}</p>
          </div>
          <div className={styles.aboutLinks}>
            <a href="https://arcsign.io" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>arcsign.io</a>
            <span className={styles.aboutSeparator}>·</span>
            <a href="https://x.com/ArcSignWallet" target="_blank" rel="noopener noreferrer" className={styles.aboutLink}>@ArcSignWallet</a>
          </div>
          {onCheckUpdate && (
            <button
              className={styles.checkUpdateButton}
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
            >
              {isCheckingUpdate ? (
                <>
                  <svg className={styles.checkUpdateSpinner} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
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
    </div>
  );
};
