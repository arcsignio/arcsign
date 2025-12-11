/**
 * Provider Settings Component
 * Feature: Provider Registry System - API Key Management
 * Updated: 2025-10-25 - Integrate with app-level password (方案 A)
 */

import React, { useState, useEffect } from 'react';
import {
  setProviderConfig,
  listProviderConfigs,
  deleteProviderConfig,
  PROVIDER_TYPES,
  type ProviderListItem,
} from '../api/provider';
import { useAppPassword } from '@/contexts/AppPasswordContext';

interface ProviderSettingsProps {
  usbPath: string;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({
  usbPath,
}) => {
  const { appPassword } = useAppPassword();
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    providerType: PROVIDER_TYPES.ALCHEMY as string,
    apiKey: '',
    priority: 100,
    enabled: true,
  });

  // Load providers on mount
  useEffect(() => {
    if (appPassword) {
      loadProviders();
    }
  }, [appPassword]);

  const loadProviders = async () => {
    if (!appPassword) {
      setError('App password not available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listProviderConfigs(null, appPassword, usbPath);
      setProviders(result);
    } catch (err) {
      setError(`Failed to load providers: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appPassword) {
      setError('App password not available');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // We'll use a placeholder chainId since it will be determined at runtime
      // when the provider is actually used for a specific blockchain operation
      await setProviderConfig({
        providerType: formData.providerType,
        chainId: 'global', // Placeholder - will be specified when provider is used
        networkId: undefined,
        apiKey: formData.apiKey,
        priority: formData.priority,
        enabled: formData.enabled,
        password: appPassword,
        usbPath,
      });

      setSuccess(`Provider ${formData.providerType} added successfully!`);
      setShowAddForm(false);
      setFormData({
        providerType: PROVIDER_TYPES.ALCHEMY as string,
        apiKey: '',
        priority: 100,
        enabled: true,
      });
      await loadProviders();
    } catch (err) {
      setError(`Failed to add provider: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProvider = async (
    chainId: string,
    providerType: string
  ) => {
    if (!appPassword) {
      setError('App password not available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteProviderConfig(chainId, providerType, appPassword, usbPath);
      setSuccess(`Provider ${providerType} deleted successfully`);
      await loadProviders();
    } catch (err) {
      setError(`Failed to delete provider: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="provider-settings">
      <div className="header">
        <h2>API Provider Settings</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary"
          disabled={loading}
        >
          {showAddForm ? 'Cancel' : '+ Add Provider'}
        </button>
      </div>

      <p className="description">
        Configure blockchain API providers (Alchemy, Infura, QuickNode) to
        enable balance queries, fee estimation, and transaction broadcasting.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Add Provider Form */}
      {showAddForm && (
        <form onSubmit={handleAddProvider} className="add-form">
          <h3>Add New Provider</h3>

          <div className="form-group">
            <label htmlFor="providerType">Provider Type</label>
            <select
              id="providerType"
              value={formData.providerType}
              onChange={(e) =>
                setFormData({ ...formData, providerType: e.target.value })
              }
              disabled={loading}
              required
            >
              <option value={PROVIDER_TYPES.ALCHEMY}>Alchemy</option>
              <option value={PROVIDER_TYPES.INFURA}>Infura (Coming Soon)</option>
              <option value={PROVIDER_TYPES.QUICKNODE}>
                QuickNode (Coming Soon)
              </option>
            </select>
            <small className="form-hint">
              This API key will be used for all supported blockchains
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input
              type="password"
              id="apiKey"
              value={formData.apiKey}
              onChange={(e) =>
                setFormData({ ...formData, apiKey: e.target.value })
              }
              placeholder="Enter your API key"
              disabled={loading}
              required
            />
            <small className="form-hint">
              Get your API key from the provider's dashboard
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <input
              type="number"
              id="priority"
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: parseInt(e.target.value) })
              }
              min={1}
              max={999}
              disabled={loading}
              required
            />
            <small className="form-hint">
              Lower numbers = higher priority (1 is highest)
            </small>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData({ ...formData, enabled: e.target.checked })
                }
                disabled={loading}
              />
              <span>Enable this provider</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Provider'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Provider List */}
      <div className="providers-section">
        <h3>Configured Providers</h3>
        {loading && !showAddForm ? (
          <div className="loading">Loading providers...</div>
        ) : providers.length === 0 ? (
          <div className="empty-state">
            No providers configured. Add one to get started!
          </div>
        ) : (
          <table className="providers-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Has API Key</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr
                  key={`${provider.chainId}-${provider.providerType}`}
                  className={provider.enabled ? '' : 'disabled'}
                >
                  <td className="provider-name">
                    {provider.providerType.charAt(0).toUpperCase() + provider.providerType.slice(1)}
                  </td>
                  <td>{provider.priority}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        provider.enabled ? 'status-active' : 'status-inactive'
                      }`}
                    >
                      {provider.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <span className={`api-key-badge ${provider.hasApiKey ? 'has-key' : 'no-key'}`}>
                      {provider.hasApiKey ? '✓ Configured' : '✗ Missing'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        handleDeleteProvider(
                          provider.chainId,
                          provider.providerType
                        )
                      }
                      className="btn-danger btn-sm"
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .provider-settings {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .description {
          margin-bottom: 24px;
          color: #666;
          line-height: 1.6;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .alert-error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .alert-success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        .add-form {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }

        .add-form h3 {
          margin: 0 0 20px;
          font-size: 18px;
          font-weight: 600;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-hint {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: #6b7280;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .checkbox-group input[type='checkbox'] {
          width: auto;
          margin-right: 8px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-primary,
        .btn-secondary,
        .btn-danger {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #d1d5db;
        }

        .btn-danger {
          background: #ef4444;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #dc2626;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .providers-section {
          margin-top: 32px;
        }

        .providers-section h3 {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 600;
        }

        .providers-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .providers-table th {
          background: #f9fafb;
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }

        .providers-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 14px;
        }

        .providers-table tr:last-child td {
          border-bottom: none;
        }

        .providers-table tr.disabled {
          opacity: 0.6;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-active {
          background: #d1fae5;
          color: #065f46;
        }

        .status-inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        .api-key-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .api-key-badge.has-key {
          background: #d1fae5;
          color: #065f46;
        }

        .api-key-badge.no-key {
          background: #fef3c7;
          color: #92400e;
        }

        .provider-name {
          font-weight: 500;
        }

        .loading,
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};
