/**
 * Settings page
 * Feature: Settings menu with sub-options
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

interface SettingItem {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
}

const SETTING_ITEMS: SettingItem[] = [
  {
    id: 'membership',
    titleKey: 'settings.membershipTitle',
    descriptionKey: 'settings.membershipDescription',
    icon: '⭐',
  },
  {
    id: 'api-settings',
    titleKey: 'settings.apiSettingsTitle',
    descriptionKey: 'settings.apiSettingsDescription',
    icon: '🔗',
  },
];

// Developer mode - separate from regular settings
const DEVELOPER_ITEM: SettingItem = {
  id: 'developer',
  titleKey: 'settings.developerModeTitle',
  descriptionKey: 'settings.developerModeDescription',
  icon: '🔧',
};

export const Settings: React.FC<SettingsProps> = ({ onBack, onNavigate }) => {
  const { t } = useTranslation();

  return (
    <div className="settings-page">
      <button onClick={onBack} className="back-button">
        ← {t('settings.backToWallets')}
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
            <span className="setting-arrow">→</span>
          </button>
        ))}
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
          <span className="setting-arrow">→</span>
        </button>
      </div>

      {/* About ArcSign */}
      <div className="about-section">
        <div className="about-card">
          <img src="/logo.png" alt="ArcSign" className="about-logo" />
          <div className="about-info">
            <h3 className="about-title">ArcSign</h3>
            <p className="about-version">v1.1.2</p>
            <p className="about-desc">Secure Multi-Chain HD Wallet</p>
          </div>
          <div className="about-links">
            <a href="https://arcsign.io" target="_blank" rel="noopener noreferrer" className="about-link">arcsign.io</a>
            <span className="about-separator">·</span>
            <a href="https://x.com/ArcSignWallet" target="_blank" rel="noopener noreferrer" className="about-link">@ArcSignWallet</a>
          </div>
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
          color: #3b82f6;
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
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
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
          color: #3b82f6;
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
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          border-color: #475569;
        }

        .developer-item .setting-title {
          color: #fff;
        }

        .developer-item .setting-description {
          color: #94a3b8;
        }

        .developer-item .setting-arrow {
          color: #64748b;
        }

        .developer-item:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .developer-item:hover .setting-arrow {
          color: #60a5fa;
        }

        .developer-icon {
          background: rgba(59, 130, 246, 0.2);
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
          color: #3b82f6;
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
      `}</style>
    </div>
  );
};
