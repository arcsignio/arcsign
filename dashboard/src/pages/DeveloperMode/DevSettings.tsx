/**
 * Developer Settings Component
 *
 * Allows developers to configure Block Explorer API keys for contract verification.
 * Settings are stored on USB device.
 *
 * Created: 2026-02-05
 */

import { useState, useEffect } from 'react';
import styles from "./DevSettings.module.css";
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
    <div className={styles.devSettings}>
      <h2>{t('developer.settingsTitle', 'Developer Settings')}</h2>

      <div className={styles.settingsSection}>
        <h3>{t('developer.defaultWallet', 'Default Signing Wallet')}</h3>
        <p className={styles.sectionDescription}>
          {t('developer.defaultWalletDesc', 'Auto-select this wallet when entering Developer Mode. Dev transactions from Hardhat will use this wallet automatically.')}
        </p>
        <div className={styles.defaultWalletRow}>
          <select
            value={defaultWalletId}
            onChange={e => handleDefaultWalletChange(e.target.value)}
            className={styles.walletSelect}
            disabled={savingWallet}
          >
            <option value="">{t('developer.noDefaultWallet', '— Select each time —')}</option>
            {wallets.map(w => (
              <option key={w.id} value={w.id}>
                👛 {w.name} ({w.id.substring(0, 8)}...)
              </option>
            ))}
          </select>
          {savingWallet && <span className={styles.saveStatus}>...</span>}
          {walletSaved && <span className={`${styles.saveStatus} ${styles.saved}`.trim()}>✓</span>}
        </div>
      </div>

      <div className={styles.settingsSection}>
        <h3>{t('developer.explorerApiKeys', 'Block Explorer API Keys')}</h3>
        <p className={styles.sectionDescription}>
          {t('developer.explorerApiKeysDesc', 'These API keys are used for contract verification (hardhat verify). They do not require private keys - just register on each Block Explorer website to get one.')}
        </p>

        <div className={styles.apiKeysList}>
          {API_KEY_CONFIGS.map(config => (
            <div key={config.key} className={styles.apiKeyItem}>
              <div className={styles.apiKeyHeader}>
                <div className={styles.apiKeyInfo}>
                  <span className={styles.apiKeyLabel}>{config.label}</span>
                  <span className={styles.apiKeyNetworks}>{config.networks}</span>
                </div>
                <a
                  href={config.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.apiKeyLink}
                >
                  {t('developer.getApiKey', 'Get API Key')} ↗
                </a>
              </div>

              <div className={styles.apiKeyInputRow}>
                <input
                  type={showKeys[config.key] ? 'text' : 'password'}
                  value={apiKeys[config.key] || ''}
                  onChange={e => handleKeyChange(config.key, e.target.value)}
                  placeholder={t('developer.enterApiKey', 'Enter API key...')}
                  className={styles.apiKeyInput}
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey(config.key)}
                  className={styles.btnIcon}
                  title={showKeys[config.key] ? 'Hide' : 'Show'}
                >
                  {showKeys[config.key] ? '🙈' : '👁'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveKey(config.key)}
                  disabled={saving === config.key}
                  className={`${styles.btnSave} ${savedKeys[config.key] ? styles.saved : ''}`}
                >
                  {saving === config.key ? '...' : savedKeys[config.key] ? '✓' : t('developer.save', 'Save')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.settingsInfo}>
        <div className={styles.infoIcon}>💡</div>
        <div className={styles.infoText}>
          <p>
            <strong>{t('developer.howToUse', 'How to use:')}</strong>
          </p>
          <p>
            {t('developer.howToUseDesc1', 'After saving your API key, you can use it in your hardhat.config.js:')}
          </p>
          <pre className={styles.codeBlock}>
{`etherscan: {
  apiKey: process.env.ETHERSCAN_API_KEY
}`}
          </pre>
          <p>
            {t('developer.howToUseDesc2', 'Or copy the key and set it as an environment variable.')}
          </p>
        </div>
      </div>
    </div>
  );
}
