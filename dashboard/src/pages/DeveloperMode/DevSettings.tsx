/**
 * Developer Settings Component
 *
 * Allows developers to configure Block Explorer API keys for contract verification.
 * Settings are stored on USB device.
 *
 * Created: 2026-02-05
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DevSettings, ExplorerApiKeys } from '@/services/tauri-api';
import type { Wallet } from '@/types/wallet';

interface DevSettingsProps {
  settings: DevSettings | null;
  wallets: Wallet[];
  onSave: (settings: DevSettings) => Promise<void>;
}

interface ApiKeyConfig {
  key: keyof ExplorerApiKeys;
  label: string;
  networks: string;
  url: string;
}

const API_KEY_CONFIGS: ApiKeyConfig[] = [
  {
    key: 'etherscan',
    label: 'Etherscan',
    networks: 'Ethereum, Sepolia, Goerli',
    url: 'https://etherscan.io/apis',
  },
  {
    key: 'bscscan',
    label: 'BSCScan',
    networks: 'BSC, BSC Testnet',
    url: 'https://bscscan.com/apis',
  },
  {
    key: 'polygonscan',
    label: 'Polygonscan',
    networks: 'Polygon, Mumbai',
    url: 'https://polygonscan.com/apis',
  },
  {
    key: 'arbiscan',
    label: 'Arbiscan',
    networks: 'Arbitrum, Arbitrum Sepolia',
    url: 'https://arbiscan.io/apis',
  },
  {
    key: 'optimism',
    label: 'Optimism Etherscan',
    networks: 'Optimism, Optimism Sepolia',
    url: 'https://optimistic.etherscan.io/apis',
  },
  {
    key: 'basescan',
    label: 'Basescan',
    networks: 'Base, Base Sepolia',
    url: 'https://basescan.org/apis',
  },
  {
    key: 'snowtrace',
    label: 'Snowtrace',
    networks: 'Avalanche, Avalanche Fuji',
    url: 'https://snowtrace.io/apis',
  },
];

export function DevSettings({ settings, wallets, onSave }: DevSettingsProps) {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<ExplorerApiKeys>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [defaultWalletId, setDefaultWalletId] = useState<string>('');
  const [savingWallet, setSavingWallet] = useState(false);
  const [walletSaved, setWalletSaved] = useState(false);

  // Initialize from settings
  useEffect(() => {
    if (settings?.explorerApiKeys) {
      setApiKeys(settings.explorerApiKeys);
    }
    if (settings?.defaultWalletId) {
      setDefaultWalletId(settings.defaultWalletId);
    }
  }, [settings]);

  const handleDefaultWalletChange = async (walletId: string) => {
    setDefaultWalletId(walletId);
    setSavingWallet(true);
    setWalletSaved(false);
    try {
      await onSave({
        version: settings?.version || 1,
        explorerApiKeys: apiKeys,
        defaultWalletId: walletId || undefined,
        updatedAt: Date.now(),
      });
      setWalletSaved(true);
      setTimeout(() => setWalletSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save default wallet:', err);
    } finally {
      setSavingWallet(false);
    }
  };

  const handleKeyChange = (key: keyof ExplorerApiKeys, value: string) => {
    setApiKeys(prev => ({ ...prev, [key]: value || undefined }));
    // Mark as unsaved
    setSavedKeys(prev => ({ ...prev, [key]: false }));
  };

  const handleSaveKey = async (key: keyof ExplorerApiKeys) => {
    setSaving(key);
    try {
      await onSave({
        version: settings?.version || 1,
        explorerApiKeys: apiKeys,
        updatedAt: Date.now(),
      });
      setSavedKeys(prev => ({ ...prev, [key]: true }));
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(null);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="dev-settings">
      <h2>{t('developer.settings', 'Developer Settings')}</h2>

      <div className="settings-section">
        <h3>{t('developer.defaultWallet', 'Default Signing Wallet')}</h3>
        <p className="section-description">
          {t('developer.defaultWalletDesc', 'Auto-select this wallet when entering Developer Mode. Dev transactions from Hardhat will use this wallet automatically.')}
        </p>
        <div className="default-wallet-row">
          <select
            value={defaultWalletId}
            onChange={e => handleDefaultWalletChange(e.target.value)}
            className="wallet-select"
            disabled={savingWallet}
          >
            <option value="">{t('developer.noDefaultWallet', '— Select each time —')}</option>
            {wallets.map(w => (
              <option key={w.id} value={w.id}>
                👛 {w.name} ({w.id.substring(0, 8)}...)
              </option>
            ))}
          </select>
          {savingWallet && <span className="save-status">...</span>}
          {walletSaved && <span className="save-status saved">✓</span>}
        </div>
      </div>

      <div className="settings-section">
        <h3>{t('developer.explorerApiKeys', 'Block Explorer API Keys')}</h3>
        <p className="section-description">
          {t('developer.explorerApiKeysDesc', 'These API keys are used for contract verification (hardhat verify). They do not require private keys - just register on each Block Explorer website to get one.')}
        </p>

        <div className="api-keys-list">
          {API_KEY_CONFIGS.map(config => (
            <div key={config.key} className="api-key-item">
              <div className="api-key-header">
                <div className="api-key-info">
                  <span className="api-key-label">{config.label}</span>
                  <span className="api-key-networks">{config.networks}</span>
                </div>
                <a
                  href={config.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="api-key-link"
                >
                  {t('developer.getApiKey', 'Get API Key')} ↗
                </a>
              </div>

              <div className="api-key-input-row">
                <input
                  type={showKeys[config.key] ? 'text' : 'password'}
                  value={apiKeys[config.key] || ''}
                  onChange={e => handleKeyChange(config.key, e.target.value)}
                  placeholder={t('developer.enterApiKey', 'Enter API key...')}
                  className="api-key-input"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey(config.key)}
                  className="btn-icon"
                  title={showKeys[config.key] ? 'Hide' : 'Show'}
                >
                  {showKeys[config.key] ? '🙈' : '👁'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveKey(config.key)}
                  disabled={saving === config.key}
                  className={`btn-save ${savedKeys[config.key] ? 'saved' : ''}`}
                >
                  {saving === config.key ? '...' : savedKeys[config.key] ? '✓' : t('developer.save', 'Save')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-info">
        <div className="info-icon">💡</div>
        <div className="info-text">
          <p>
            <strong>{t('developer.howToUse', 'How to use:')}</strong>
          </p>
          <p>
            {t('developer.howToUseDesc1', 'After saving your API key, you can use it in your hardhat.config.js:')}
          </p>
          <pre className="code-block">
{`etherscan: {
  apiKey: process.env.ETHERSCAN_API_KEY
}`}
          </pre>
          <p>
            {t('developer.howToUseDesc2', 'Or copy the key and set it as an environment variable.')}
          </p>
        </div>
      </div>

      <style>{`
        .dev-settings {
          padding: 0;
        }

        .dev-settings h2 {
          margin: 0 0 24px;
          font-size: 20px;
        }

        .settings-section {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .settings-section h3 {
          margin: 0 0 8px;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.9);
        }

        .section-description {
          margin: 0 0 20px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
        }

        .api-keys-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .api-key-item {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          padding: 12px;
        }

        .api-key-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .api-key-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .api-key-label {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }

        .api-key-networks {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .api-key-link {
          font-size: 12px;
          color: #60a5fa;
          text-decoration: none;
        }

        .api-key-link:hover {
          text-decoration: underline;
        }

        .api-key-input-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .api-key-input {
          flex: 1;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: white;
          font-family: monospace;
          font-size: 13px;
        }

        .api-key-input:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.3);
        }

        .api-key-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .btn-icon {
          padding: 8px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-save {
          padding: 8px 16px;
          background: #2dd4bf;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          min-width: 60px;
        }

        .btn-save:hover:not(:disabled) {
          background: #0d9488;
        }

        .btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-save.saved {
          background: #22c55e;
        }

        .settings-info {
          display: flex;
          gap: 12px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 12px;
          padding: 16px;
        }

        .info-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .info-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.5;
        }

        .info-text p {
          margin: 0 0 8px;
        }

        .info-text p:last-child {
          margin-bottom: 0;
        }

        .code-block {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 6px;
          padding: 12px;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
          margin: 8px 0;
        }

        .default-wallet-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .wallet-select {
          flex: 1;
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: white;
          font-size: 14px;
          cursor: pointer;
          appearance: auto;
        }

        .wallet-select:focus {
          outline: none;
          border-color: #2dd4bf;
        }

        .wallet-select option {
          background: #1a1a2e;
          color: white;
        }

        .save-status {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .save-status.saved {
          color: #22c55e;
        }
      `}</style>
    </div>
  );
}
