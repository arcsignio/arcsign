/**
 * Settings page
 * Feature: Settings menu with sub-options
 */

import React from 'react';

interface SettingsProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

interface SettingItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const SETTING_ITEMS: SettingItem[] = [
  {
    id: 'api-settings',
    title: 'API Provider Settings',
    description: 'Configure blockchain API providers (Alchemy, Infura, QuickNode)',
    icon: '🔗',
  },
  // Future settings can be added here
  // {
  //   id: 'security',
  //   title: 'Security Settings',
  //   description: 'Manage security preferences and auto-lock timeout',
  //   icon: '🔒',
  // },
];

export const Settings: React.FC<SettingsProps> = ({ onBack, onNavigate }) => {
  return (
    <div className="settings-page">
      <button onClick={onBack} className="back-button">
        ← Back to Wallets
      </button>

      <header className="settings-header">
        <h1>Settings</h1>
        <p className="settings-description">
          Manage your application settings and preferences
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
              <h3 className="setting-title">{item.title}</h3>
              <p className="setting-description">{item.description}</p>
            </div>
            <span className="setting-arrow">→</span>
          </button>
        ))}
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
      `}</style>
    </div>
  );
};
