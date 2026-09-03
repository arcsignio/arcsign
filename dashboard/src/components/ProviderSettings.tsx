/**
 * Provider Settings Component
 * Feature: Provider Registry System - API Key Management
 * Updated: 2026-01-23 - Migrated to session tokens (zero password storage)
 */

import React, { useState, useEffect, useCallback } from 'react';
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
    <div className="provider-settings">
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

      <div className="header">
        <h2>{t('provider.title')}</h2>
        <button
          className="add-button"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={isLoading}
        >
          {showAddForm ? t('provider.cancel') : t('provider.addProvider')}
        </button>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="message error-message">
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="message success-message">
          <p>{success}</p>
        </div>
      )}

      {/* Add provider form */}
      {showAddForm && (
        <form className="add-form" onSubmit={handleSubmit}>
          <div className="form-group">
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

          <div className="form-group">
            <label>{t('provider.apiKey')}</label>
            <PasswordInput
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={t('provider.apiKeyPlaceholder')}
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? t('provider.saving') : t('provider.save')}
          </button>
        </form>
      )}

      {/* Provider list */}
      <div className="provider-list">
        <h3>{t('provider.configuredProviders')}</h3>

        {isLoading && providers.length === 0 ? (
          <p className="loading">{t('provider.loading')}</p>
        ) : providers.length === 0 ? (
          <p className="empty">{t('provider.noProviders')}</p>
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
                      <span className="status enabled">
                        {t('provider.configured')} 🔑
                      </span>
                    ) : (
                      <span className="status disabled">
                        {t('provider.missing')}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="delete-button"
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
      <div className="help-text">
        <h4>{t('provider.helpTitle')}</h4>
        <p>{t('provider.helpDescription')}</p>

        <div className="provider-info-list">
          <div className="provider-info-item">
            <div className="provider-info-header">
              <strong>Alchemy</strong>
              <a href="https://dashboard.alchemy.com" target="_blank" rel="noopener noreferrer">
                dashboard.alchemy.com
              </a>
            </div>
            <p className="provider-info-desc">{t('provider.alchemyInfo')}</p>
            <p className="provider-info-chains">{t('provider.alchemyChains')}</p>
          </div>

          <div className="provider-info-item">
            <div className="provider-info-header">
              <strong>NodeReal</strong>
              <a href="https://dashboard.nodereal.io" target="_blank" rel="noopener noreferrer">
                dashboard.nodereal.io
              </a>
            </div>
            <p className="provider-info-desc">{t('provider.noderealInfo')}</p>
            <p className="provider-info-chains">{t('provider.noderealChains')}</p>
          </div>

          {/* 1inch - Temporarily disabled, will be enabled in future release
          <div className="provider-info-item">
            <div className="provider-info-header">
              <strong>1inch</strong>
              <a href="https://portal.1inch.dev" target="_blank" rel="noopener noreferrer">
                portal.1inch.dev
              </a>
            </div>
            <p className="provider-info-desc">{t('provider.oneinchInfo')}</p>
            <p className="provider-info-chains">{t('provider.oneinchChains')}</p>
          </div>
          */}

        </div>
      </div>

      <style>{`
        .provider-settings {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }

        .provider-settings .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .provider-settings .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .provider-settings .add-button {
          padding: 10px 20px;
          background: var(--brand-accent);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .provider-settings .add-button:hover {
          background: var(--brand);
        }

        .provider-settings .add-button:disabled {
          background: var(--text-tertiary);
          cursor: not-allowed;
        }

        .provider-settings .message {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .provider-settings .message p {
          margin: 0;
          font-size: 14px;
        }

        .provider-settings .error-message {
          background: var(--danger-pale);
          border: 1px solid var(--danger-border);
          color: var(--danger);
        }

        .provider-settings .success-message {
          background: var(--success-pale);
          border: 1px solid var(--success-border);
          color: var(--success);
        }

        .provider-settings .add-form {
          background: white;
          border: 1px solid var(--border-default);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .provider-settings .form-group {
          margin-bottom: 16px;
        }

        .provider-settings .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .provider-settings .form-group input,
        .provider-settings .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-input);
          border-radius: 8px;
          font-size: 14px;
          color: var(--text-primary);
          background: white;
          transition: border-color 0.2s;
        }

        .provider-settings .form-group input:focus,
        .provider-settings .form-group select:focus {
          outline: none;
          border-color: var(--brand-accent);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .provider-settings .form-group input:disabled,
        .provider-settings .form-group select:disabled {
          background: var(--surface-strong);
          cursor: not-allowed;
        }

        .provider-settings .form-group small {
          display: block;
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .provider-settings .form-group.checkbox label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .provider-settings .form-group.checkbox input {
          width: auto;
        }

        .provider-settings .submit-button {
          width: 100%;
          padding: 12px;
          background: var(--brand-accent);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .provider-settings .submit-button:hover {
          background: var(--brand);
        }

        .provider-settings .submit-button:disabled {
          background: var(--text-tertiary);
          cursor: not-allowed;
        }

        .provider-settings .provider-list {
          background: white;
          border: 1px solid var(--border-default);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .provider-settings .provider-list h3 {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .provider-settings .provider-list .loading,
        .provider-settings .provider-list .empty {
          color: var(--text-secondary);
          font-size: 14px;
          text-align: center;
          padding: 20px;
        }

        .provider-settings table {
          width: 100%;
          border-collapse: collapse;
        }

        .provider-settings table th,
        .provider-settings table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid var(--border-default);
        }

        .provider-settings table th {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .provider-settings table td {
          font-size: 14px;
          color: var(--text-primary);
        }

        .provider-settings table tr:last-child td {
          border-bottom: none;
        }

        .provider-settings .status {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .provider-settings .status.enabled {
          background: var(--success-pale);
          color: var(--success);
        }

        .provider-settings .status.disabled {
          background: var(--surface-strong);
          color: var(--text-secondary);
        }

        .provider-settings .has-key {
          margin-left: 8px;
        }

        .provider-settings .delete-button {
          padding: 6px 12px;
          background: var(--danger-pale);
          color: var(--danger);
          border: 1px solid var(--danger-border);
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .provider-settings .delete-button:hover {
          background: var(--danger-pale);
          border-color: #f87171;
        }

        .provider-settings .delete-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .provider-settings .help-text {
          background: var(--surface-sunken);
          border: 1px solid var(--border-default);
          border-radius: 12px;
          padding: 20px;
        }

        .provider-settings .help-text h4 {
          margin: 0 0 8px;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .provider-settings .help-text p {
          margin: 0 0 12px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .provider-settings .help-text ul {
          margin: 0;
          padding-left: 20px;
        }

        .provider-settings .help-text li {
          font-size: 14px;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .provider-settings .help-text a {
          color: var(--brand-accent);
          text-decoration: none;
        }

        .provider-settings .help-text a:hover {
          text-decoration: underline;
        }

        .provider-settings .provider-info-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 16px;
        }

        .provider-settings .provider-info-item {
          background: white;
          border: 1px solid var(--border-default);
          border-radius: 8px;
          padding: 16px;
        }

        .provider-settings .provider-info-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .provider-settings .provider-info-header strong {
          font-size: 15px;
          color: var(--text-primary);
        }

        .provider-settings .provider-info-header a {
          font-size: 13px;
        }

        .provider-settings .provider-info-desc {
          margin: 0 0 4px;
          font-size: 14px;
          color: var(--text-primary);
        }

        .provider-settings .provider-info-chains {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
          font-style: italic;
        }
      `}</style>
    </div>
  );
};
