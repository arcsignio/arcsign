import React from "react";
import styles from "./swap.module.css";
import { useTranslation } from "react-i18next";
import { shortenAddress } from "@/utils/swapFormat";

interface SwapResultProps {
  mode: "success" | "error";
  /** For mode="success": the transaction hash */
  txHash?: string;
  /** For mode="success": pre-computed explorer URL */
  txUrl?: string;
  /** For mode="error": the error message */
  error?: string | null;
  onNewSwap: () => void;
  onBack: () => void;
  onTryAgain: () => void;
  onStartOver: () => void;
}

export const SwapResult: React.FC<SwapResultProps> = ({
  mode,
  txHash,
  txUrl,
  error,
  onNewSwap,
  onBack,
  onTryAgain,
  onStartOver,
}) => {
  const { t } = useTranslation();

  if (mode === "success") {
    return (
      <div className={styles.successForm}>
        <div className={styles.successIcon}>✓</div>
        <h3>{t('swap.swapSubmitted')}</h3>
        <p className={styles.successDescription}>
          {t('swap.swapSubmittedDescription')}
        </p>

        {txHash && txUrl && (
          <div className={styles.txHashDisplay}>
            <span className={styles.txLabel}>{t('swap.transactionHash')}</span>
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.txHashLink}
            >
              {shortenAddress(txHash)} ↗
            </a>
          </div>
        )}

        <div className={styles.successActions}>
          <button className={styles.primaryButton} onClick={onNewSwap}>
            {t('swap.newSwap')}
          </button>
          <button className={styles.secondaryButton} onClick={onBack}>
            {t('swap.backToWallet')}
          </button>
        </div>
      </div>
    );
  }

  // mode === "error"
  return (
    <div className={styles.errorForm}>
      <div className={styles.errorIconLarge}>✕</div>
      <h3>{t('swap.swapFailed')}</h3>
      <p className={styles.errorDescription}>{error || t('swap.errorOccurred')}</p>

      <div className={styles.errorActions}>
        <button className={styles.primaryButton} onClick={onTryAgain}>
          {t('swap.tryAgain')}
        </button>
        <button className={styles.secondaryButton} onClick={onStartOver}>
          {t('swap.startOver')}
        </button>
      </div>
    </div>
  );
};
