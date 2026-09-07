/**
 * Signing History Component
 *
 * Displays history of signed/rejected transactions from developer mode.
 *
 * Created: 2026-02-04
 */

import { useTranslation } from 'react-i18next';
import styles from "./SigningHistory.module.css";
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
      <div className={styles.emptyHistory}>
        <div className={styles.emptyIcon}>📜</div>
        <h2>{t('developer.noHistory', 'No Signing History')}</h2>
        <p>{t('developer.noHistoryDesc', 'Your signed and rejected transactions will appear here.')}</p>
      </div>
    );
  }

  return (
    <div className={styles.signingHistory}>
      <h2>📜 {t('developer.signingHistory', 'Signing History')}</h2>

      <div className={styles.historyList}>
        {history.map((item) => (
          <div key={item.id} className={`${styles.historyItem} ${item.status}`}>
            <div className={styles.historyHeader}>
              <div className={styles.historyType}>
                {item.status === 'approved' && '✓'}
                {item.status === 'rejected' && '✗'}
                <span>{item.description || item.type}</span>
              </div>
              <div className={styles.historyTime}>
                {formatTime(item.timestamp || Date.now())}
              </div>
            </div>

            <div className={styles.historyDetails}>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('developer.requestDetails.network')}:</span>
                <span className={styles.value}>{item.network}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('developer.requestDetails.from')}:</span>
                <span className={`${styles.value} ${styles.mono}`.trim()}>{formatAddress(item.from)}</span>
              </div>
              {item.to && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>{t('developer.requestDetails.to')}:</span>
                  <span className={`${styles.value} ${styles.mono}`.trim()}>{formatAddress(item.to)}</span>
                </div>
              )}
              {item.txHash && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>{t('walletConnect.txHash')}:</span>
                  {(() => {
                    const explorerUrl = getBlockExplorerTxUrl(item.chainId, item.txHash);
                    return explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.txLink} ${styles.value} ${styles.mono} `.trim()}
                      >
                        {formatAddress(item.txHash)} ↗
                      </a>
                    ) : (
                      <span className={`${styles.value} ${styles.mono}`.trim()}>{formatAddress(item.txHash)}</span>
                    );
                  })()}
                </div>
              )}
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('developer.requestDetails.script')}:</span>
                <span className={`${styles.script} ${styles.value} `.trim()}>{item.scriptName || 'Unknown'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
