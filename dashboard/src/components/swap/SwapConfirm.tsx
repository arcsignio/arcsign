import React from "react";
import styles from "./swap.module.css";
import { useTranslation } from "react-i18next";
import { SignReview } from "@/components/SignReview";
import type { SignReview as SignReviewData } from "@/hooks/useSignReview";
import {
  fromSmallestUnit,
  getNetworkIcon,
  getNativeTokenSymbol,
} from "@/utils/swapFormat";
import type { SwapQuoteResponse } from "@/services/tauri-api";
import type { SendableToken } from "@/components/SendTransaction";
import type { ToToken } from "@/components/swap/types";
import { PasswordInput } from "@/components/PasswordInput";

export type { ToToken };

interface SwapConfirmProps {
  fromToken: SendableToken;
  toToken: ToToken;
  amount: string;
  /** The quote from the built swap tx (swapTx.quote) */
  swapQuote: SwapQuoteResponse;
  /** Whether the route changed between the estimated quote and the built tx quote */
  routeChanged: boolean;
  walletPassword: string;
  isLoading: boolean;
  /** Full pre-signature review: security verdict, consent state, and readability. */
  review: SignReviewData;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
}

export const SwapConfirm: React.FC<SwapConfirmProps> = ({
  fromToken,
  toToken,
  amount,
  swapQuote,
  routeChanged,
  walletPassword,
  isLoading,
  review,
  onPasswordChange,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.passwordForm}>
      <h3>{t('swap.confirmSwap')}</h3>

      {routeChanged && (
        <div className="route-updated-notice" role="alert">
          ⚠️ {t('swap.routeUpdated', {
            provider: swapQuote.dex,
            fee: swapQuote.feeRate === "0" ? t('swap.freeSwap') : `${swapQuote.feeRate}%`,
          })}
        </div>
      )}

      <div className={styles.swapSummary}>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.youPay')}</span>
          <span className={styles.summaryValue}>
            {amount} {fromToken.tokenSymbol}
          </span>
        </div>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.youReceive')}</span>
          <span className={`${styles.summaryValue} ${styles.highlight}`.trim()}>
            ~{fromSmallestUnit(swapQuote.toAmount, toToken.decimals)} {toToken.symbol}
          </span>
        </div>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.network')}</span>
          <span className={styles.summaryValue}>
            {getNetworkIcon(fromToken.network)} {fromToken.networkLabel}
          </span>
        </div>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.exchangeRate')}</span>
          <span className={styles.summaryValue}>
            1 {fromToken.tokenSymbol} ≈ {swapQuote.exchangeRate} {toToken.symbol}
          </span>
        </div>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.priceImpact')}</span>
          <span className={styles.summaryValue} style={{ color: parseFloat(swapQuote.priceImpact || '0') < -1 ? 'var(--danger)' : '#10b981' }}>
            {swapQuote.priceImpact}%
          </span>
        </div>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.estimatedGasFee')}</span>
          <span className={styles.summaryValue}>
            ~{swapQuote.gasCostETH} {getNativeTokenSymbol(fromToken.network)}
          </span>
        </div>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.swapFee')}</span>
          <span className={`${styles.summaryValue} ${swapQuote.feeRate === "0" ? styles.feeFree : ""}`}>
            {swapQuote.feeRate === "0"
              ? t('swap.freeSwap')
              : `${swapQuote.feeRate}%`}
          </span>
        </div>
        <div className={styles.swapSummaryRow}>
          <span className={styles.summaryLabel}>{t('swap.minimumReceived')}</span>
          <span className={styles.summaryValue}>
            {fromSmallestUnit(swapQuote.toAmountMin, toToken.decimals)} {toToken.symbol}
          </span>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>{t('swap.walletPassword')}</label>
        <PasswordInput
          placeholder={t('swap.enterWalletPassword')}
          value={walletPassword}
          onChange={(e) => onPasswordChange(e.target.value)}
          className={styles.passwordInput}
          autoFocus
        />
      </div>

      {/* Full pre-signature review: what it does, what's risky, consent, digest.
          The useSignReview call stays in the PARENT; we receive pre-computed values. */}
      <SignReview review={review} />

      <button
        className={styles.primaryButton}
        onClick={onConfirm}
        disabled={isLoading || !walletPassword || (review.requiresAcknowledge && !review.acknowledged)}
        style={review.requiresAcknowledge ? { background: "var(--danger)", boxShadow: "none" } : undefined}
      >
        {isLoading ? t('swap.processing') : t('swap.confirmSwap')}
      </button>
    </div>
  );
};
