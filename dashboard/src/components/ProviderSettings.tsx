/**
 * Provider Settings Component
 * Feature: Provider Registry System - API Key Management
 */

import React, { useState, useEffect } from 'react';
import {
  setProviderConfig,
  listProviderConfigs,
  deleteProviderConfig,
  PROVIDER_TYPES,
  CHAIN_IDS,
  NETWORK_IDS,
  type ProviderListItem,
} from '../api/provider';

interface ProviderSettingsProps {
  usbPath: string;
  password: string;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({
  usbPath,
  password,
}) => {
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    providerType: PROVIDER_TYPES.ALCHEMY,
    chainId: CHAIN_IDS.ETHEREUM,
    networkId: 'mainnet',
    apiKey: '',
    priority: 100,
    enabled: true,
  });

  // Load providers on mount
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listProviderConfigs(null, password, usbPath);
      setProviders(result);
    } catch (err) {
      setError(`Failed to load providers: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await setProviderConfig({
        providerType: formData.providerType,
        chainId: formData.chainId,
        networkId: formData.networkId,
        apiKey: formData.apiKey,
        priority: formData.priority,
        enabled: formData.enabled,
        password,
        usbPath,
      });

      setSuccess(`Provider ${formData.providerType} added successfully!`);
      setShowAddForm(false);
      setFormData({
        providerType: PROVIDER_TYPES.ALCHEMY,
        chainId: CHAIN_IDS.ETHEREUM,
        networkId: 'mainnet',
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

  const handleDeleteProvider = async (chainId: string, providerType: string) => {
    if (!confirm(`Are you sure you want to delete ${providerType} for ${chainId}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await deleteProviderConfig(chainId, providerType, password, usbPath);
      setSuccess(`Provider ${providerType} deleted successfully!`);
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
          {showAddForm ? 'Cancel' : 'Add Provider'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showAddForm && (
        <form onSubmit={handleAddProvider} className="add-provider-form">
          <h3>Add New Provider</h3>

          <div className="form-group">
            <label htmlFor="providerType">Provider Type</label>
            <select
              id="providerType"
              value={formData.providerType}
              onChange={(e) =>
                setFormData({ ...formData, providerType: e.target.value })
              }
              required
            >
              <option value={PROVIDER_TYPES.ALCHEMY}>Alchemy</option>
              <option value={PROVIDER_TYPES.INFURA}>Infura (Coming Soon)</option>
              <option value={PROVIDER_TYPES.QUICKNODE}>
                QuickNode (Coming Soon)
              </option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="chainId">Blockchain</label>
            <select
              id="chainId"
              value={formData.chainId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  chainId: e.target.value,
                  networkId: 'mainnet',
                })
              }
              required
            >
              <option value={CHAIN_IDS.ETHEREUM}>Ethereum</option>
              <option value={CHAIN_IDS.POLYGON}>Polygon</option>
              <option value={CHAIN_IDS.ARBITRUM}>Arbitrum</option>
              <option value={CHAIN_IDS.OPTIMISM}>Optimism</option>
              <option value={CHAIN_IDS.BASE}>Base</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="networkId">Network</label>
            <select
              id="networkId"
              value={formData.networkId}
              onChange={(e) =>
                setFormData({ ...formData, networkId: e.target.value })
              }
              required
            >
              {NETWORK_IDS[formData.chainId as keyof typeof NETWORK_IDS]?.map(
                (network) => (
                  <option key={network} value={network}>
                    {network.charAt(0).toUpperCase() + network.slice(1)}
                  </option>
                )
              )}
            </select>
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
              required
            />
            <small className="form-hint">
              Your API key will be encrypted and stored on your USB drive
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
              min="0"
              max="999"
              required
            />
            <small className="form-hint">
              Higher priority providers are used first (0-999)
            </small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) =>
                  setFormData({ ...formData, enabled: e.target.checked })
                }
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Provider'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowAddForm(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="providers-list">
        <h3>Configured Providers</h3>
        {loading && providers.length === 0 ? (
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
                <th>Chain</th>
                <th>Network</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr
                  key={`${provider.chainId}-${provider.providerType}`}
                  className={provider.enabled ? '' : 'disabled'}
                >
                  <td>{provider.providerType}</td>
                  <td>{provider.chainId}</td>
                  <td>{provider.networkId || 'mainnet'}</td>
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
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .alert-error {
          background-color: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }

        .alert-success {
          background-color: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }

        .add-provider-form {
          background: #f8f9fa;
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .add-provider-form h3 {
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 18px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-hint {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #666;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
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
          transition: opacity 0.2s;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn-primary:hover,
        .btn-secondary:hover,
        .btn-danger:hover {
          opacity: 0.9;
        }

        .btn-primary:disabled,
        .btn-secondary:disabled,
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .providers-list {
          margin-top: 32px;
        }

        .providers-list h3 {
          margin-bottom: 16px;
          font-size: 18px;
        }

        .providers-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .providers-table th,
        .providers-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .providers-table th {
          background: #f8f9fa;
          font-weight: 600;
          font-size: 14px;
        }

        .providers-table tbody tr.disabled {
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
          background: #d4edda;
          color: #155724;
        }

        .status-inactive {
          background: #f8d7da;
          color: #721c24;
        }

        .loading,
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #666;
        }
      `}</style>
    </div>
  );
};
