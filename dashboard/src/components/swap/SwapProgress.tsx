import React from "react";
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
      <div className="approving-form">
        <div className="approving-spinner" />
        <h3>{t('swap.approving', { symbol: tokenSymbol })}</h3>
        <p className="approving-description">
          {approvalTxHash
            ? t('swap.waitingForConfirmation')
            : t('swap.signingAndBroadcasting')
          }
        </p>

        {approvalTxHash && approvalTxUrl && (
          <div className="approval-tx-info">
            <div className="tx-hash-display">
              <span className="tx-label">{t('swap.approvalTransaction')}</span>
              <a
                href={approvalTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-hash-link"
              >
                {shortenAddress(approvalTxHash)} ↗
              </a>
            </div>
            <div className="confirmation-status">
              <div className="status-indicator pulsing" />
              <span>{t('swap.confirmingOn', { network: networkLabel })}</span>
            </div>
          </div>
        )}

        <p className="approving-note">
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
    <div className="processing-form">
      <div className="processing-spinner"></div>
      <h3>{mode === "signing" ? t('swap.signingTransaction') : t('swap.broadcastingTransaction')}</h3>
      <p className="processing-description">
        {mode === "signing"
          ? t('swap.pleaseWaitSigning')
          : t('swap.submittingToBlockchain')
        }
      </p>
    </div>
  );
};
