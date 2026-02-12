/**
 * Pending Requests Component
 *
 * Displays signing requests from Hardhat/Foundry scripts.
 * Supports both transaction signing and message signing (EIP-191, EIP-712).
 *
 * Created: 2026-02-04
 * Updated: 2026-02-06 - Added message signing support
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DevSignRequest, DevSession, DevMessageSignRequest } from '@/types/developer';

interface PendingRequestsProps {
  requests: DevSignRequest[];
  messageRequests: DevMessageSignRequest[];
  onApprove: (requestId: string, password: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
  onApproveMessage: (requestId: number, password: string) => Promise<void>;
  onRejectMessage: (requestId: number) => Promise<void>;
  session: DevSession | null;
}

// Network display info (keys must match getNetworkName in index.tsx)
const NETWORK_INFO: Record<string, { name: string; color: string; isTestnet: boolean }> = {
  'ethereum': { name: 'Ethereum Mainnet', color: '#627EEA', isTestnet: false },
  'sepolia': { name: 'Sepolia Testnet', color: '#CFB5F0', isTestnet: true },
  'goerli': { name: 'Goerli Testnet', color: '#F6C343', isTestnet: true },
  'bsc': { name: 'BSC Mainnet', color: '#F3BA2F', isTestnet: false },
  'bsc-testnet': { name: 'BSC Testnet', color: '#F3BA2F', isTestnet: true },
  'polygon': { name: 'Polygon', color: '#8247E5', isTestnet: false },
  'mumbai': { name: 'Mumbai Testnet', color: '#8247E5', isTestnet: true },
  'arbitrum': { name: 'Arbitrum One', color: '#28A0F0', isTestnet: false },
  'optimism': { name: 'Optimism', color: '#FF0420', isTestnet: false },
  'base': { name: 'Base', color: '#0052FF', isTestnet: false },
};

export function PendingRequests({
  requests,
  messageRequests,
  onApprove,
  onReject,
  onApproveMessage,
  onRejectMessage,
  session,
}: PendingRequestsProps) {
  const { t } = useTranslation();
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [selectedMessageRequest, setSelectedMessageRequest] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async (requestId: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      await onApprove(requestId, password);
      setPassword('');
      setSelectedRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign transaction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setIsProcessing(true);
    try {
      await onReject(requestId);
      setSelectedRequest(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveMessage = async (requestId: number) => {
    setIsProcessing(true);
    setError(null);

    try {
      await onApproveMessage(requestId, password);
      setPassword('');
      setSelectedMessageRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign message');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectMessage = async (requestId: number) => {
    setIsProcessing(true);
    try {
      await onRejectMessage(requestId);
      setSelectedMessageRequest(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  // Parse hex string to BigInt
  const parseHex = (hex: string | undefined): bigint => {
    if (!hex || hex === '' || hex === '0x' || hex === '0x0') return BigInt(0);
    if (hex.startsWith('0x')) {
      return BigInt(hex);
    }
    // Try parsing as decimal string
    return BigInt(hex);
  };

  // Format gas limit (number with commas)
  const formatGasLimit = (gas: string | undefined): string => {
    if (!gas) return 'N/A';
    const value = parseHex(gas);
    return value.toLocaleString();
  };

  // Format gas price (to Gwei)
  const formatGasPrice = (price: string | undefined): string => {
    if (!price) return 'N/A';
    const value = parseHex(price);
    const gwei = Number(value) / 1e9;
    return `${gwei.toFixed(2)} Gwei`;
  };

  // Format value (to ETH/BNB)
  const formatValue = (value: string | undefined, network: string): string => {
    if (!value || value === '0x0' || value === '0') return '0';
    const wei = parseHex(value);
    const eth = Number(wei) / 1e18;
    const symbol = network.includes('bsc') ? 'BNB' : 'ETH';
    return `${eth.toFixed(6)} ${symbol}`;
  };

  // Estimate total cost (gas * gasPrice)
  const formatEstimatedCost = (request: DevSignRequest): string => {
    const gas = parseHex(request.gas);
    const gasPrice = parseHex(request.maxFeePerGas || request.gasPrice);
    if (gas === BigInt(0) || gasPrice === BigInt(0)) return 'N/A';
    const costWei = gas * gasPrice;
    const costEth = Number(costWei) / 1e18;
    const symbol = request.network.includes('bsc') ? 'BNB' : 'ETH';
    return `~${costEth.toFixed(6)} ${symbol}`;
  };

  const totalRequests = requests.length + messageRequests.length;

  if (totalRequests === 0) {
    return (
      <div className="empty-requests">
        <div className="empty-icon">📋</div>
        <h2>{t('developer.noRequests', 'No Pending Requests')}</h2>
        <p>{t('developer.noRequestsDesc', 'When you run a Hardhat script, signing requests will appear here.')}</p>

        <div className="usage-hint">
          <h3>💡 {t('developer.quickStart', 'Quick Start')}</h3>
          <pre>{`// hardhat.config.ts
import "@arcsign/hardhat-plugin";

export default {
  networks: {
    mainnet: {
      url: process.env.RPC_URL,
      accounts: "arcsign", // ← Use ArcSign
    },
  },
};`}</pre>
        </div>

        <style>{`
          .empty-requests {
            text-align: center;
            padding: 60px 24px;
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
          }

          .empty-requests h2 {
            margin: 0 0 8px;
            font-size: 24px;
            color: rgba(255, 255, 255, 0.9);
          }

          .empty-requests p {
            margin: 0 0 32px;
            color: rgba(255, 255, 255, 0.6);
          }

          .usage-hint {
            max-width: 500px;
            margin: 0 auto;
            text-align: left;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            padding: 20px;
          }

          .usage-hint h3 {
            margin: 0 0 12px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
          }

          .usage-hint pre {
            margin: 0;
            padding: 16px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 8px;
            font-size: 12px;
            color: #a5f3fc;
            overflow-x: auto;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="pending-requests">
      <h2>
        📋 {t('developer.pendingRequests', 'Pending Requests')}
        <span className="count">({totalRequests})</span>
      </h2>

      <div className="requests-list">
        {/* Message Signing Requests */}
        {messageRequests.map((request) => {
          const isSelected = selectedMessageRequest === request.requestId;

          return (
            <div
              key={`msg-${request.requestId}`}
              className={`request-card message-request ${isSelected ? 'expanded' : ''}`}
            >
              {/* Request Header */}
              <div
                className="request-header"
                onClick={() => setSelectedMessageRequest(isSelected ? null : request.requestId)}
              >
                <div className="request-type">
                  {request.signType === 'personal_sign' ? '✍️' : '📋'}
                  <span>{request.description}</span>
                </div>
                <div
                  className="network-badge"
                  style={{
                    backgroundColor: request.signType === 'personal_sign' ? '#8B5CF630' : '#F5920030',
                    color: request.signType === 'personal_sign' ? '#8B5CF6' : '#F59200',
                  }}
                >
                  {request.signType === 'personal_sign' ? '🔐 EIP-191' : '📝 EIP-712'}
                </div>
              </div>

              {/* Request Summary */}
              <div className="request-summary">
                <div className="summary-row full-width">
                  <span className="label">Address:</span>
                  <span className="value mono">{formatAddress(request.address)}</span>
                </div>
                {request.scriptName && (
                  <div className="summary-row full-width">
                    <span className="label">Script:</span>
                    <span className="value script">{request.scriptName}</span>
                  </div>
                )}
              </div>

              {/* Expanded Details */}
              {isSelected && (
                <div className="request-details">
                  {/* Message Content for personal_sign */}
                  {request.signType === 'personal_sign' && (
                    <div className="message-section">
                      <h4>📝 {t('developer.messageToSign', 'Message to Sign')}</h4>
                      {request.messageReadable ? (
                        <div className="message-content readable">
                          {request.messageReadable}
                        </div>
                      ) : (
                        <pre className="raw-data">{request.message || '0x'}</pre>
                      )}
                    </div>
                  )}

                  {/* Typed Data for EIP-712 */}
                  {request.signType === 'typed_data' && request.typedData && (
                    <div className="typed-data-section">
                      <h4>📋 {t('developer.typedData', 'Typed Data (EIP-712)')}</h4>

                      {/* Domain Info */}
                      {request.typedData.domain && (
                        <div className="domain-info">
                          <span className="domain-label">Domain:</span>
                          <span className="domain-value">
                            {request.typedData.domain.name || 'Unknown'}
                            {request.typedData.domain.version && ` v${request.typedData.domain.version}`}
                          </span>
                        </div>
                      )}

                      {/* Primary Type */}
                      {request.typedData.primaryType && (
                        <div className="primary-type">
                          <span className="method-name">{request.typedData.primaryType}</span>
                        </div>
                      )}

                      {/* Message Data */}
                      <pre className="params">
                        {JSON.stringify(request.typedData.message, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {error && selectedMessageRequest === request.requestId && (
                    <div className="error-message">
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Password Input */}
                  <div className="password-section">
                    <label>{t('developer.enterPassword', 'Enter wallet password to sign')}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Wallet password"
                      disabled={isProcessing}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="action-buttons">
                    <button
                      className="reject-button"
                      onClick={() => handleRejectMessage(request.requestId)}
                      disabled={isProcessing}
                    >
                      ✗ {t('common.reject', 'Reject')}
                    </button>
                    <button
                      className="approve-button"
                      onClick={() => handleApproveMessage(request.requestId)}
                      disabled={isProcessing || !password}
                    >
                      {isProcessing ? '⏳' : '✓'} {t('common.sign', 'Sign')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Transaction Requests */}
        {requests.map((request) => {
          const networkInfo = NETWORK_INFO[request.network] || {
            name: request.network,
            color: '#888',
            isTestnet: false,
          };
          const isSelected = selectedRequest === request.id;
          const canAutoSign = session?.enabled && networkInfo.isTestnet;

          return (
            <div
              key={request.id}
              className={`request-card ${isSelected ? 'expanded' : ''}`}
            >
              {/* Request Header */}
              <div className="request-header" onClick={() => setSelectedRequest(isSelected ? null : request.id)}>
                <div className="request-type">
                  {request.type === 'deploy' && '🚀'}
                  {request.type === 'call' && '📝'}
                  {request.type === 'sign' && '✍️'}
                  <span>{request.description || request.type}</span>
                </div>
                <div
                  className="network-badge"
                  style={{ backgroundColor: networkInfo.color + '30', color: networkInfo.color }}
                >
                  {networkInfo.isTestnet && '🧪'} {networkInfo.name}
                </div>
              </div>

              {/* Request Summary */}
              <div className="request-summary">
                <div className="summary-row">
                  <span className="label">From:</span>
                  <span className="value mono">{formatAddress(request.from)}</span>
                </div>
                {request.to && (
                  <div className="summary-row">
                    <span className="label">To:</span>
                    <span className="value mono">{formatAddress(request.to)}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="label">Value:</span>
                  <span className="value">{formatValue(request.value, request.network)}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Nonce:</span>
                  <span className="value">{request.nonce !== undefined ? request.nonce : 'N/A'}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Gas Limit:</span>
                  <span className="value">{formatGasLimit(request.gas)}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Gas Price:</span>
                  <span className="value">{formatGasPrice(request.maxFeePerGas || request.gasPrice)}</span>
                </div>
                <div className="summary-row full-width">
                  <span className="label">Est. Cost:</span>
                  <span className="value cost">{formatEstimatedCost(request)}</span>
                </div>
              </div>

              {/* Expanded Details */}
              {isSelected && (
                <div className="request-details">
                  {/* Calldata */}
                  {request.decodedCalldata && (
                    <div className="calldata-section">
                      <h4>📦 {t('developer.methodCall', 'Method Call')}</h4>
                      <div className="method-name">{request.decodedCalldata.method}</div>
                      {request.decodedCalldata.params && (
                        <pre className="params">{JSON.stringify(request.decodedCalldata.params, null, 2)}</pre>
                      )}
                    </div>
                  )}

                  {/* Raw Data */}
                  <div className="raw-data-section">
                    <h4>🔢 {t('developer.rawData', 'Raw Data')}</h4>
                    <pre className="raw-data">{request.data || '0x'}</pre>
                  </div>

                  {/* Error */}
                  {error && selectedRequest === request.id && (
                    <div className="error-message">
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Password Input (if not auto-signing) */}
                  {!canAutoSign && (
                    <div className="password-section">
                      <label>{t('developer.enterPassword', 'Enter wallet password to sign')}</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Wallet password"
                        disabled={isProcessing}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="action-buttons">
                    <button
                      className="reject-button"
                      onClick={() => handleReject(request.id)}
                      disabled={isProcessing}
                    >
                      ✗ {t('common.reject', 'Reject')}
                    </button>
                    <button
                      className="approve-button"
                      onClick={() => handleApprove(request.id)}
                      disabled={isProcessing || (!canAutoSign && !password)}
                    >
                      {isProcessing ? '⏳' : '✓'} {t('common.approve', 'Approve')}
                    </button>
                  </div>

                  {canAutoSign && (
                    <div className="auto-sign-notice">
                      ℹ️ {t('developer.autoSignEnabled', 'Auto-sign enabled for testnet')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .pending-requests h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 20px;
          font-size: 20px;
        }

        .pending-requests h2 .count {
          color: rgba(255, 255, 255, 0.5);
          font-weight: 400;
        }

        .requests-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .request-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .request-card.message-request {
          border-left: 3px solid #8B5CF6;
        }

        .request-card:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }

        .request-card.expanded {
          border-color: rgba(59, 130, 246, 0.5);
        }

        .request-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          cursor: pointer;
        }

        .request-type {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 500;
        }

        .network-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }

        .request-summary {
          padding: 0 20px 16px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 16px;
        }

        .summary-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .summary-row .label {
          color: rgba(255, 255, 255, 0.5);
          min-width: 70px;
        }

        .summary-row .value {
          color: rgba(255, 255, 255, 0.9);
        }

        .summary-row .value.mono {
          font-family: monospace;
        }

        .summary-row .value.script {
          color: #a5f3fc;
        }

        .summary-row .value.cost {
          color: #fbbf24;
          font-weight: 500;
        }

        .summary-row.full-width {
          grid-column: span 2;
        }

        .request-details {
          padding: 20px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .calldata-section,
        .raw-data-section,
        .message-section,
        .typed-data-section {
          margin-bottom: 16px;
        }

        .request-details h4 {
          margin: 0 0 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .method-name {
          display: inline-block;
          padding: 4px 12px;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 4px;
          color: #22c55e;
          font-family: monospace;
          margin-bottom: 8px;
        }

        .params,
        .raw-data {
          margin: 0;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          font-size: 12px;
          color: #a5f3fc;
          overflow-x: auto;
          max-height: 150px;
        }

        .message-content {
          padding: 16px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.9);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .message-content.readable {
          border-left: 3px solid #22c55e;
        }

        .domain-info {
          margin-bottom: 8px;
          font-size: 13px;
        }

        .domain-label {
          color: rgba(255, 255, 255, 0.5);
          margin-right: 8px;
        }

        .domain-value {
          color: rgba(255, 255, 255, 0.9);
        }

        .primary-type {
          margin-bottom: 12px;
        }

        .error-message {
          padding: 12px;
          background: rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          color: #fca5a5;
          margin-bottom: 16px;
        }

        .password-section {
          margin-bottom: 16px;
        }

        .password-section label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .password-section input {
          width: 100%;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
        }

        .password-section input:focus {
          outline: none;
          border-color: #2dd4bf;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .reject-button,
        .approve-button {
          flex: 1;
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .reject-button {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .reject-button:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.3);
        }

        .approve-button {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .approve-button:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.3);
        }

        .approve-button:disabled,
        .reject-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auto-sign-notice {
          margin-top: 12px;
          padding: 8px 12px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
