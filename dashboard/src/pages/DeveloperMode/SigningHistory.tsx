/**
 * Signing History Component
 *
 * Displays history of signed/rejected transactions from developer mode.
 *
 * Created: 2026-02-04
 */

import { useTranslation } from 'react-i18next';
import type { DevSignRequest } from '@/types/developer';

interface SigningHistoryProps {
  history: DevSignRequest[];
}

/**
 * Get block explorer transaction URL based on chainId
 */
const getBlockExplorerTxUrl = (chainId: number, txHash: string): string | null => {
  const explorers: Record<number, string> = {
    // Mainnets
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    56: 'https://bscscan.com',
    42161: 'https://arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    43114: 'https://snowtrace.io',
    8453: 'https://basescan.org',
    // Testnets
    11155111: 'https://sepolia.etherscan.io',
    80001: 'https://mumbai.polygonscan.com',
    97: 'https://testnet.bscscan.com',
    421614: 'https://sepolia.arbiscan.io',
    11155420: 'https://sepolia-optimism.etherscan.io',
    43113: 'https://testnet.snowtrace.io',
    84532: 'https://sepolia.basescan.org',
  };

  const baseUrl = explorers[chainId];
  return baseUrl ? `${baseUrl}/tx/${txHash}` : null;
};

export function SigningHistory({ history }: SigningHistoryProps) {
  const { t } = useTranslation();

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format address
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  if (history.length === 0) {
    return (
      <div className="empty-history">
        <div className="empty-icon">📜</div>
        <h2>{t('developer.noHistory', 'No Signing History')}</h2>
        <p>{t('developer.noHistoryDesc', 'Your signed and rejected transactions will appear here.')}</p>

        <style>{`
          .empty-history {
            text-align: center;
            padding: 60px 24px;
          }

          .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
          }

          .empty-history h2 {
            margin: 0 0 8px;
            font-size: 24px;
            color: rgba(255, 255, 255, 0.9);
          }

          .empty-history p {
            margin: 0;
            color: rgba(255, 255, 255, 0.6);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="signing-history">
      <h2>📜 {t('developer.signingHistory', 'Signing History')}</h2>

      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className={`history-item ${item.status}`}>
            <div className="history-header">
              <div className="history-type">
                {item.status === 'approved' && '✓'}
                {item.status === 'rejected' && '✗'}
                <span>{item.description || item.type}</span>
              </div>
              <div className="history-time">
                {formatTime(item.timestamp || Date.now())}
              </div>
            </div>

            <div className="history-details">
              <div className="detail-row">
                <span className="label">Network:</span>
                <span className="value">{item.network}</span>
              </div>
              <div className="detail-row">
                <span className="label">From:</span>
                <span className="value mono">{formatAddress(item.from)}</span>
              </div>
              {item.to && (
                <div className="detail-row">
                  <span className="label">To:</span>
                  <span className="value mono">{formatAddress(item.to)}</span>
                </div>
              )}
              {item.txHash && (
                <div className="detail-row">
                  <span className="label">Tx Hash:</span>
                  {(() => {
                    const explorerUrl = getBlockExplorerTxUrl(item.chainId, item.txHash);
                    return explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="value mono tx-link"
                      >
                        {formatAddress(item.txHash)} ↗
                      </a>
                    ) : (
                      <span className="value mono">{formatAddress(item.txHash)}</span>
                    );
                  })()}
                </div>
              )}
              <div className="detail-row">
                <span className="label">Script:</span>
                <span className="value script">{item.scriptName || 'Unknown'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .signing-history h2 {
          margin: 0 0 20px;
          font-size: 20px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-item {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
        }

        .history-item.approved {
          border-left: 3px solid #22c55e;
        }

        .history-item.rejected {
          border-left: 3px solid #ef4444;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .history-type {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 500;
        }

        .history-item.approved .history-type {
          color: #22c55e;
        }

        .history-item.rejected .history-type {
          color: #ef4444;
        }

        .history-time {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .history-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .detail-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .detail-row .label {
          color: rgba(255, 255, 255, 0.5);
        }

        .detail-row .value {
          color: rgba(255, 255, 255, 0.9);
        }

        .detail-row .value.mono {
          font-family: monospace;
        }

        .detail-row .value.script {
          color: #a5f3fc;
        }

        .tx-link {
          color: #60a5fa;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s;
        }

        .tx-link:hover {
          text-decoration: underline;
          color: #93c5fd;
        }
      `}</style>
    </div>
  );
}
