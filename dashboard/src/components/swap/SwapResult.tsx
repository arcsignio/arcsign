import React from "react";
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
      <div className="success-form">
        <div className="success-icon">✓</div>
        <h3>{t('swap.swapSubmitted')}</h3>
        <p className="success-description">
          {t('swap.swapSubmittedDescription')}
        </p>

        {txHash && txUrl && (
          <div className="tx-hash-display">
            <span className="tx-label">{t('swap.transactionHash')}</span>
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-hash-link"
            >
              {shortenAddress(txHash)} ↗
            </a>
          </div>
        )}

        <div className="success-actions">
          <button className="primary-button" onClick={onNewSwap}>
            {t('swap.newSwap')}
          </button>
          <button className="secondary-button" onClick={onBack}>
            {t('swap.backToWallet')}
          </button>
        </div>
      </div>
    );
  }

  // mode === "error"
  return (
    <div className="error-form">
      <div className="error-icon-large">✕</div>
      <h3>{t('swap.swapFailed')}</h3>
      <p className="error-description">{error || t('swap.errorOccurred')}</p>

      <div className="error-actions">
        <button className="primary-button" onClick={onTryAgain}>
          {t('swap.tryAgain')}
        </button>
        <button className="secondary-button" onClick={onStartOver}>
          {t('swap.startOver')}
        </button>
      </div>
    </div>
  );
};
