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
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({
  usbPath,
}) => {
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password and authentication state
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    providerType: PROVIDER_TYPES.ALCHEMY,
    apiKey: '',
    priority: 100,
    enabled: true,
  });

  const handleUnlock = async () => {
    if (!password) {
      setUnlockError('Please enter a password');
      return;
    }

    setLoading(true);
    setUnlockError(null);
    try {
      // Try to load providers with this password
      const result = await listProviderConfigs(null, password, usbPath);
      setProviders(result);
      setIsUnlocked(true);
      setSuccess('Provider settings unlocked successfully');
    } catch (err) {
      setUnlockError(`Failed to unlock: ${err}`);
      setPassword(''); // Clear invalid password
    } finally {
      setLoading(false);
    }
  };

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
      // We'll use a placeholder chainId since it will be determined at runtime
      // when the provider is actually used for a specific blockchain operation
      await setProviderConfig({
        providerType: formData.providerType,
        chainId: 'global', // Placeholder - will be specified when provider is used
        networkId: undefined,
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

  // Show password prompt if not unlocked
  if (!isUnlocked) {
    return (
      <div className="provider-settings">
        <div className="unlock-prompt">
          <h2>API Provider Settings</h2>
          <p className="description">
            Configure blockchain API providers (Alchemy, Infura, QuickNode) to enable balance queries,
            fee estimation, and transaction broadcasting.
          </p>
          <p className="security-note">
            Your API keys are encrypted with AES-256-GCM and stored on your USB drive.
            Enter a password to unlock provider settings.
          </p>

          {unlockError && (
            <div className="alert alert-error">{unlockError}</div>
          )}

          <div className="unlock-form">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUnlock();
                  }
                }}
                placeholder="Enter your encryption password"
                disabled={loading}
                autoFocus
              />
              <small className="form-hint">
                Use any password to create new provider settings, or use your existing password to access saved providers.
              </small>
            </div>

            <button
              onClick={handleUnlock}
              className="btn-primary"
              disabled={loading || !password}
            >
              {loading ? 'Unlocking...' : 'Unlock Settings'}
            </button>
          </div>
        </div>

        <style>{`
          .unlock-prompt {
            max-width: 500px;
            margin: 40px auto;
            padding: 32px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          .unlock-prompt h2 {
            margin-top: 0;
            margin-bottom: 16px;
            font-size: 24px;
            font-weight: 600;
            color: #1a1a1a;
          }

          .description {
            margin-bottom: 16px;
            color: #666;
            line-height: 1.6;
          }

          .security-note {
            margin-bottom: 24px;
            padding: 12px 16px;
            background: #f0f9ff;
            border-left: 4px solid #3b82f6;
            border-radius: 4px;
            color: #1e40af;
            font-size: 14px;
            line-height: 1.5;
          }

          .unlock-form {
            margin-top: 24px;
          }
        `}</style>
      </div>
    );
  }

  // Show provider management interface after unlock
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

        .api-key-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .api-key-badge.has-key {
          background: #d4edda;
          color: #155724;
        }

        .api-key-badge.no-key {
          background: #fff3cd;
          color: #856404;
        }

        .provider-name {
          font-weight: 500;
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
