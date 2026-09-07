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
import styles from "./PendingRequests.module.css";
import { useTranslation } from 'react-i18next';
import { formatAmount, toDecimalString } from '@/utils/formatAmount';
import { getNetworkColor } from '@/utils/chainIcons';
import type { DevSignRequest, DevSession, DevMessageSignRequest } from '@/types/developer';
import { PasswordInput } from '@/components/PasswordInput';

interface PendingRequestsProps {
  requests: DevSignRequest[];
  messageRequests: DevMessageSignRequest[];
  onApprove: (requestId: string, password: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
  onApproveMessage: (requestId: number, password: string) => Promise<void>;
  onRejectMessage: (requestId: number) => Promise<void>;
  session: DevSession | null;
}

// Network display info (keys must match getNetworkName in index.tsx).
//
// Mainnet colours come from chainIcons, which owns chain identity. BSC was
// #F3BA2F here while the wallet screens used #F0B90B — a visible difference
// (ΔE 7.1), not a rounding slip, and the kind of drift four separate copies
// of the same palette produce.
//
// Sepolia and Goerli keep their own values: they are testnet-specific tints
// with no mainnet counterpart to inherit from.
const NETWORK_INFO: Record<string, { name: string; color: string; isTestnet: boolean }> = {
  'ethereum': { name: 'Ethereum Mainnet', color: getNetworkColor('ethereum'), isTestnet: false },
  'sepolia': { name: 'Sepolia Testnet', color: '#CFB5F0', isTestnet: true },
  'goerli': { name: 'Goerli Testnet', color: '#F6C343', isTestnet: true },
  'bsc': { name: 'BSC Mainnet', color: getNetworkColor('bsc'), isTestnet: false },
  'bsc-testnet': { name: 'BSC Testnet', color: getNetworkColor('bsc-testnet'), isTestnet: true },
  'polygon': { name: 'Polygon', color: getNetworkColor('polygon'), isTestnet: false },
  'mumbai': { name: 'Mumbai Testnet', color: getNetworkColor('mumbai'), isTestnet: true },
  'arbitrum': { name: 'Arbitrum One', color: getNetworkColor('arbitrum'), isTestnet: false },
  'optimism': { name: 'Optimism', color: getNetworkColor('optimism'), isTestnet: false },
  'base': { name: 'Base', color: getNetworkColor('base'), isTestnet: false },
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

  // Format gas limit (number with commas). The separator is pinned by the
  // shared formatter; toLocaleString() followed the runtime locale.
  const formatGasLimit = (gas: string | undefined): string => {
    if (!gas) return 'N/A';
    return formatAmount(parseHex(gas).toString());
  };

  // Format gas price (to Gwei). Two decimals rather than the shared six:
  // "200.000000 Gwei" carries nothing "200.00 Gwei" does not. Scaling and
  // presentation are separate, so this is a caller's choice, not an exception.
  const formatGasPrice = (price: string | undefined): string => {
    if (!price) return 'N/A';
    return `${Number(toDecimalString(parseHex(price), 9)).toFixed(2)} Gwei`;
  };

  // Format value (to ETH/BNB)
  const formatValue = (value: string | undefined, network: string): string => {
    if (!value || value === '0x0' || value === '0') return '0';
    const symbol = network.includes('bsc') ? 'BNB' : 'ETH';
    return `${formatAmount(toDecimalString(parseHex(value), 18))} ${symbol}`;
  };

  // Estimate total cost (gas * gasPrice). The multiplication stays in BigInt
  // and so does the scaling — gas × gasPrice routinely exceeds 2^53, and the
  // previous body dropped to Number on the line after multiplying carefully.
  const formatEstimatedCost = (request: DevSignRequest): string => {
    const gas = parseHex(request.gas);
    const gasPrice = parseHex(request.maxFeePerGas || request.gasPrice);
    if (gas === BigInt(0) || gasPrice === BigInt(0)) return 'N/A';
    const symbol = request.network.includes('bsc') ? 'BNB' : 'ETH';
    // showDust: a gas cost is legitimately below the balance dust threshold.
    return `~${formatAmount(toDecimalString(gas * gasPrice, 18), { showDust: true })} ${symbol}`;
  };

  const totalRequests = requests.length + messageRequests.length;

  if (totalRequests === 0) {
    return (
      <div className={styles.emptyRequests}>
        <div className={styles.emptyIcon}>📋</div>
        <h2>{t('developer.noRequests', 'No Pending Requests')}</h2>
        <p>{t('developer.noRequestsDesc', 'When you run a Hardhat script, signing requests will appear here.')}</p>

        <div className={styles.usageHint}>
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
      </div>
    );
  }

  return (
    <div className={styles.pendingRequests}>
      <h2>
        📋 {t('developer.pendingRequests', 'Pending Requests')}
        <span className={styles.count}>({totalRequests})</span>
      </h2>

      <div className={styles.requestsList}>
        {/* Message Signing Requests */}
        {messageRequests.map((request) => {
          const isSelected = selectedMessageRequest === request.requestId;

          return (
            <div
              key={`msg-${request.requestId}`}
              className={`${styles.requestCard} ${styles.messageRequest} ${isSelected ? styles.expanded : ''}`}
            >
              {/* Request Header */}
              <div
                className={styles.requestHeader}
                onClick={() => setSelectedMessageRequest(isSelected ? null : request.requestId)}
              >
                <div className={styles.requestType}>
                  {request.signType === 'personal_sign' ? '✍️' : '📋'}
                  <span>{request.description}</span>
                </div>
                <div
                  className={styles.networkBadge}
                  style={{
                    backgroundColor: request.signType === 'personal_sign' ? '#8B5CF630' : '#F5920030',
                    color: request.signType === 'personal_sign' ? '#8B5CF6' : '#F59200',
                  }}
                >
                  {request.signType === 'personal_sign' ? '🔐 EIP-191' : '📝 EIP-712'}
                </div>
              </div>

              {/* Request Summary */}
              <div className={styles.requestSummary}>
                <div className={`${styles.summaryRow} ${styles.fullWidth}`.trim()}>
                  <span className={styles.label}>{t('developer.requestDetails.address')}:</span>
                  <span className={`${styles.value} ${styles.mono}`.trim()}>{formatAddress(request.address)}</span>
                </div>
                {request.scriptName && (
                  <div className={`${styles.summaryRow} ${styles.fullWidth}`.trim()}>
                    <span className={styles.label}>{t('developer.requestDetails.script')}:</span>
                    <span className={`${styles.script} ${styles.value} `.trim()}>{request.scriptName}</span>
                  </div>
                )}
              </div>

              {/* Expanded Details */}
              {isSelected && (
                <div className={styles.requestDetails}>
                  {/* Message Content for personal_sign */}
                  {request.signType === 'personal_sign' && (
                    <div className={styles.messageSection}>
                      <h4>📝 {t('developer.messageToSign', 'Message to Sign')}</h4>
                      {request.messageReadable ? (
                        <div className={`${styles.messageContent} ${styles.readable}`.trim()}>
                          {request.messageReadable}
                        </div>
                      ) : (
                        <pre className={styles.rawData}>{request.message || '0x'}</pre>
                      )}
                    </div>
                  )}

                  {/* Typed Data for EIP-712 */}
                  {request.signType === 'typed_data' && request.typedData && (
                    <div className={styles.typedDataSection}>
                      <h4>📋 {t('developer.typedData', 'Typed Data (EIP-712)')}</h4>

                      {/* Domain Info */}
                      {request.typedData.domain && (
                        <div className={styles.domainInfo}>
                          <span className={styles.domainLabel}>{t('developer.requestDetails.domain')}:</span>
                          <span className={styles.domainValue}>
                            {request.typedData.domain.name || 'Unknown'}
                            {request.typedData.domain.version && ` v${request.typedData.domain.version}`}
                          </span>
                        </div>
                      )}

                      {/* Primary Type */}
                      {request.typedData.primaryType && (
                        <div className={styles.primaryType}>
                          <span className={styles.methodName}>{request.typedData.primaryType}</span>
                        </div>
                      )}

                      {/* Message Data */}
                      <pre className={styles.params}>
                        {JSON.stringify(request.typedData.message, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {error && selectedMessageRequest === request.requestId && (
                    <div className={styles.errorMessage}>
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Password Input */}
                  <div className={styles.passwordSection}>
                    <label>{t('developer.enterPassword', 'Enter wallet password to sign')}</label>
                    <PasswordInput
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('developer.passwordPlaceholder')}
                      disabled={isProcessing}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className={styles.actionButtons}>
                    <button
                      className={styles.rejectButton}
                      onClick={() => handleRejectMessage(request.requestId)}
                      disabled={isProcessing}
                    >
                      ✗ {t('common.reject', 'Reject')}
                    </button>
                    <button
                      className={styles.approveButton}
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
              className={`${styles.requestCard} ${isSelected ? styles.expanded : ''}`}
            >
              {/* Request Header */}
              <div className={styles.requestHeader} onClick={() => setSelectedRequest(isSelected ? null : request.id)}>
                <div className={styles.requestType}>
                  {request.type === 'deploy' && '🚀'}
                  {request.type === 'call' && '📝'}
                  {request.type === 'sign' && '✍️'}
                  <span>{request.description || request.type}</span>
                </div>
                <div
                  className={styles.networkBadge}
                  style={{ backgroundColor: networkInfo.color + '30', color: networkInfo.color }}
                >
                  {networkInfo.isTestnet && '🧪'} {networkInfo.name}
                </div>
              </div>

              {/* Request Summary */}
              <div className={styles.requestSummary}>
                <div className={styles.summaryRow}>
                  <span className={styles.label}>{t('developer.requestDetails.from')}:</span>
                  <span className={`${styles.value} ${styles.mono}`.trim()}>{formatAddress(request.from)}</span>
                </div>
                {request.to && (
                  <div className={styles.summaryRow}>
                    <span className={styles.label}>{t('developer.requestDetails.to')}:</span>
                    <span className={`${styles.value} ${styles.mono}`.trim()}>{formatAddress(request.to)}</span>
                  </div>
                )}
                <div className={styles.summaryRow}>
                  <span className={styles.label}>{t('developer.requestDetails.value')}:</span>
                  <span className={styles.value}>{formatValue(request.value, request.network)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.label}>{t('developer.requestDetails.nonce')}:</span>
                  <span className={styles.value}>{request.nonce !== undefined ? request.nonce : 'N/A'}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.label}>{t('developer.requestDetails.gasLimit')}:</span>
                  <span className={styles.value}>{formatGasLimit(request.gas)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.label}>{t('developer.requestDetails.gasPrice')}:</span>
                  <span className={styles.value}>{formatGasPrice(request.maxFeePerGas || request.gasPrice)}</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.fullWidth}`.trim()}>
                  <span className={styles.label}>{t('developer.requestDetails.estCost')}:</span>
                  <span className={`${styles.value} ${styles.cost}`.trim()}>{formatEstimatedCost(request)}</span>
                </div>
              </div>

              {/* Expanded Details */}
              {isSelected && (
                <div className={styles.requestDetails}>
                  {/* Calldata */}
                  {request.decodedCalldata && (
                    <div className={styles.calldataSection}>
                      <h4>📦 {t('developer.methodCall', 'Method Call')}</h4>
                      <div className={styles.methodName}>{request.decodedCalldata.method}</div>
                      {request.decodedCalldata.params && (
                        <pre className={styles.params}>{JSON.stringify(request.decodedCalldata.params, null, 2)}</pre>
                      )}
                    </div>
                  )}

                  {/* Raw Data */}
                  <div className={styles.rawDataSection}>
                    <h4>🔢 {t('developer.rawData', 'Raw Data')}</h4>
                    <pre className={styles.rawData}>{request.data || '0x'}</pre>
                  </div>

                  {/* Error */}
                  {error && selectedRequest === request.id && (
                    <div className={styles.errorMessage}>
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Password Input (if not auto-signing) */}
                  {!canAutoSign && (
                    <div className={styles.passwordSection}>
                      <label>{t('developer.enterPassword', 'Enter wallet password to sign')}</label>
                      <PasswordInput
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('developer.passwordPlaceholder')}
                        disabled={isProcessing}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className={styles.actionButtons}>
                    <button
                      className={styles.rejectButton}
                      onClick={() => handleReject(request.id)}
                      disabled={isProcessing}
                    >
                      ✗ {t('common.reject', 'Reject')}
                    </button>
                    <button
                      className={styles.approveButton}
                      onClick={() => handleApprove(request.id)}
                      disabled={isProcessing || (!canAutoSign && !password)}
                    >
                      {isProcessing ? '⏳' : '✓'} {t('common.approve', 'Approve')}
                    </button>
                  </div>

                  {canAutoSign && (
                    <div className={styles.autoSignNotice}>
                      ℹ️ {t('developer.autoSignEnabled', 'Auto-sign enabled for testnet')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
