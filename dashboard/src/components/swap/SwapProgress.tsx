import React from "react";
import styles from "./swap.module.css";
import { useTranslation } from "react-i18next";
import { shortenAddress } from "@/utils/swapFormat";

interface SwapProgressProps {
  mode: "approving" | "signing" | "broadcasting";
  /** Token symbol for mode="approving" heading (t('swap.approving', { symbol })) */
  tokenSymbol?: string;
  /** Network label for the "confirming on X" status (mode="approving" only) */
  networkLabel?: string;
  /** Pre-computed explorer URL for the approval tx (mode="approving" only) */
  approvalTxUrl?: string;
  /** Raw approval tx hash, shown shortened (mode="approving" only) */
  approvalTxHash?: string | null;
}

export const SwapProgress: React.FC<SwapProgressProps> = ({
  mode,
  tokenSymbol,
  networkLabel,
  approvalTxUrl,
  approvalTxHash,
}) => {
  const { t } = useTranslation();

  if (mode === "approving") {
    return (
      <div className={styles.approvingForm}>
        <div className={styles.approvingSpinner} />
        <h3>{t('swap.approving', { symbol: tokenSymbol })}</h3>
        <p className={styles.approvingDescription}>
          {approvalTxHash
            ? t('swap.waitingForConfirmation')
            : t('swap.signingAndBroadcasting')
          }
        </p>

        {approvalTxHash && approvalTxUrl && (
          <div className={styles.approvalTxInfo}>
            <div className={styles.txHashDisplay}>
              <span className={styles.txLabel}>{t('swap.approvalTransaction')}</span>
              <a
                href={approvalTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.txHashLink}
              >
                {shortenAddress(approvalTxHash)} ↗
              </a>
            </div>
            <div className={styles.confirmationStatus}>
              <div className={`${styles.statusIndicator} ${styles.pulsing}`.trim()} />
              <span>{t('swap.confirmingOn', { network: networkLabel })}</span>
            </div>
          </div>
        )}

        <p className={styles.approvingNote}>
          {approvalTxHash
            ? t('swap.typicallyTakes')
            : t('swap.pleaseWait')
          }
        </p>
      </div>
    );
  }

  // mode === "signing" | "broadcasting"
  return (
    <div className={styles.processingForm}>
      <div className={styles.processingSpinner}></div>
      <h3>{mode === "signing" ? t('swap.signingTransaction') : t('swap.broadcastingTransaction')}</h3>
      <p className={styles.processingDescription}>
        {mode === "signing"
          ? t('swap.pleaseWaitSigning')
          : t('swap.submittingToBlockchain')
        }
      </p>
    </div>
  );
};
