/**
 * Provider Settings Component
 * Feature: Provider Registry System - API Key Management
 * Updated: 2026-01-23 - Migrated to session tokens (zero password storage)
 */

import React, { useState, useEffect, useCallback } from 'react';
import styles from "./ProviderSettings.module.css";
import { useTranslation } from 'react-i18next';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useSessionStore } from '@/stores/sessionStore';
import { PasswordInput } from '@/components/PasswordInput';
import {
  setProviderConfig,
  listProviderConfigs,
  deleteProviderConfig,
  PROVIDER_TYPES,
  type ProviderListItem,
} from '@/api/provider';

interface ProviderSettingsProps {
  // Props are optional - we get usbPath from store
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = () => {
  const { t } = useTranslation();
  const { usbPath } = useDashboardStore();
  const { getToken } = useSessionStore();

  // State
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for adding new provider
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    providerType: PROVIDER_TYPES.ALCHEMY as string,
    apiKey: '',
  });

  // Load providers on mount
  const loadProviders = useCallback(async () => {
    if (!usbPath) {
      setError(t('provider.noUsbPath'));
      return;
    }

    const sessionToken = getToken();
    if (!sessionToken) {
      setError(t('provider.sessionExpired'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await listProviderConfigs(null, usbPath, sessionToken);
      setProviders(result);
    } catch (err) {
      console.error('Failed to load providers:', err);
      setError(err instanceof Error ? err.message : t('provider.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [usbPath, getToken, t]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usbPath) {
      setError(t('provider.noUsbPath'));
      return;
    }

    const sessionToken = getToken();
    if (!sessionToken) {
      setError(t('provider.sessionExpired'));
      return;
    }

    if (!formData.apiKey.trim()) {
      setError(t('provider.apiKeyRequired'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Use "global" as chainId since API keys work across all supported chains
      await setProviderConfig({
        providerType: formData.providerType,
        apiKey: formData.apiKey,
        chainId: 'global',
        networkId: 'mainnet',
        priority: 100,
        enabled: true,
        usbPath,
        sessionToken,
      });

      setSuccess(t('provider.saveSuccess'));
      setShowAddForm(false);
      setFormData({
        providerType: PROVIDER_TYPES.ALCHEMY as string,
        apiKey: '',
      });

      // Reload providers list
      await loadProviders();
    } catch (err) {
      console.error('Failed to save provider:', err);
      setError(err instanceof Error ? err.message : t('provider.saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete provider
  const handleDelete = async (chainId: string, providerType: string) => {
    if (!usbPath) {
      setError(t('provider.noUsbPath'));
      return;
    }

    const sessionToken = getToken();
    if (!sessionToken) {
      setError(t('provider.sessionExpired'));
      return;
    }

    if (!confirm(t('provider.confirmDelete'))) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteProviderConfig(chainId, providerType, usbPath, sessionToken);
      setSuccess(t('provider.deleteSuccess'));
      await loadProviders();
    } catch (err) {
      console.error('Failed to delete provider:', err);
      setError(err instanceof Error ? err.message : t('provider.deleteError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.providerSettings}>
      {/* Capabilities comparison: free vs key-gated */}
      <div
        style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          background: "var(--brand-faint)",
          border: "1px solid var(--brand-pale)",
          borderRadius: "10px",
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--brand-press)", marginBottom: "0.25rem" }}>
          {t("provider.capabilities.title")}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--brand)", marginBottom: "0.75rem" }}>
          {t("provider.capabilities.subtitle")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#15803d" }}>
              ✅ {t("provider.capabilities.freeHeading")}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#334155" }}>
              {t("provider.capabilities.free")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0369a1" }}>
              🔑 {t("provider.capabilities.alchemyHeading")}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#334155" }}>
              {t("provider.capabilities.alchemy")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0369a1" }}>
              🔑 {t("provider.capabilities.noderealHeading")}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#334155" }}>
              {t("provider.capabilities.nodereal")}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.header}>
        <h2>{t('provider.title')}</h2>
        <button
          className={styles.addButton}
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={isLoading}
        >
          {showAddForm ? t('provider.cancel') : t('provider.addProvider')}
        </button>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className={`${styles.errorMessage} ${styles.message} `.trim()}>
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className={`${styles.successMessage} ${styles.message} `.trim()}>
          <p>{success}</p>
        </div>
      )}

      {/* Add provider form */}
      {showAddForm && (
        <form className={styles.addForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>{t('provider.providerType')}</label>
            <select
              value={formData.providerType}
              onChange={(e) => setFormData({ ...formData, providerType: e.target.value })}
              disabled={isLoading}
            >
              {Object.entries(PROVIDER_TYPES).map(([key, value]) => (
                <option key={key} value={value}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>{t('provider.apiKey')}</label>
            <PasswordInput
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={t('provider.apiKeyPlaceholder')}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? t('provider.saving') : t('provider.save')}
          </button>
        </form>
      )}

      {/* Provider list */}
      <div className={styles.providerList}>
        <h3>{t('provider.configuredProviders')}</h3>

        {isLoading && providers.length === 0 ? (
          <p className={styles.loading}>{t('provider.loading')}</p>
        ) : providers.length === 0 ? (
          <p className={styles.empty}>{t('provider.noProviders')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('provider.providerType')}</th>
                <th>{t('provider.status')}</th>
                <th>{t('provider.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={`${provider.chainId}-${provider.providerType}`}>
                  <td>{provider.providerType.toUpperCase()}</td>
                  <td>
                    {provider.hasApiKey ? (
                      <span className={`${styles.enabled} ${styles.status} `.trim()}>
                        {t('provider.configured')} 🔑
                      </span>
                    ) : (
                      <span className={`${styles.disabled} ${styles.status} `.trim()}>
                        {t('provider.missing')}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDelete(provider.chainId, provider.providerType)}
                      disabled={isLoading}
                    >
                      {t('provider.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Help text */}
      <div className={styles.helpText}>
        <h4>{t('provider.helpTitle')}</h4>
        <p>{t('provider.helpDescription')}</p>

        <div className={styles.providerInfoList}>
          <div className={styles.providerInfoItem}>
            <div className={styles.providerInfoHeader}>
              <strong>Alchemy</strong>
              <a href="https://dashboard.alchemy.com" target="_blank" rel="noopener noreferrer">
                dashboard.alchemy.com
              </a>
            </div>
            <p className={styles.providerInfoDesc}>{t('provider.alchemyInfo')}</p>
            <p className={styles.providerInfoChains}>{t('provider.alchemyChains')}</p>
          </div>

          <div className={styles.providerInfoItem}>
            <div className={styles.providerInfoHeader}>
              <strong>NodeReal</strong>
              <a href="https://dashboard.nodereal.io" target="_blank" rel="noopener noreferrer">
                dashboard.nodereal.io
              </a>
            </div>
            <p className={styles.providerInfoDesc}>{t('provider.noderealInfo')}</p>
            <p className={styles.providerInfoChains}>{t('provider.noderealChains')}</p>
          </div>

          {/* 1inch - Temporarily disabled, will be enabled in future release
          <div className={styles.providerInfoItem}>
            <div className={styles.providerInfoHeader}>
              <strong>1inch</strong>
              <a href="https://portal.1inch.dev" target="_blank" rel="noopener noreferrer">
                portal.1inch.dev
              </a>
            </div>
            <p className={styles.providerInfoDesc}>{t('provider.oneinchInfo')}</p>
            <p className={styles.providerInfoChains}>{t('provider.oneinchChains')}</p>
          </div>
          */}

        </div>
      </div>
    </div>
  );
};
