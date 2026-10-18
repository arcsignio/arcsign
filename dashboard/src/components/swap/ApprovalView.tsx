import React from "react";
import styles from "./swap.module.css";
import { useTranslation } from "react-i18next";
import { fromSmallestUnit, shortenAddress } from "@/utils/swapFormat";
import type { SendableToken } from "@/components/SendTransaction";
import type { SwapQuoteResponse } from "@/services/tauri-api";
import { PasswordInput } from "@/components/PasswordInput";
import { SignReview } from "@/components/SignReview";
import type { SignReview as SignReviewData } from "@/hooks/useSignReview";

interface ApprovalViewProps {
  mode: "approve" | "approvalPassword";
  fromToken: SendableToken;
  quote: SwapQuoteResponse;
  swapTxTo?: string;
  currentAllowance?: string | null;
  amount: string;
  approvalAmount: string;
  isUnlimitedApproval: boolean;
  walletPassword: string;
  isLoading: boolean;
  error: string | null | undefined;
  /**
   * Sign review for the approve() calldata. Only populated once handleApprove
   * has fetched the real to/data (this screen has no calldata to review
   * beforehand — see useSwapFlow.handleApprove). Undefined on the "approve"
   * mode render (amount not yet committed); present on "approvalPassword".
   */
  approvalReview?: SignReviewData;
  onSetUnlimited: (v: boolean) => void;
  onApprovalAmountChange: (v: string) => void;
  onApprove: () => void;
  onExecuteApproval: () => void;
  onPasswordChange: (v: string) => void;
  onCancel: () => void;
}

export const ApprovalView: React.FC<ApprovalViewProps> = ({
  mode,
  fromToken,
  quote,
  swapTxTo,
  currentAllowance,
  amount,
  approvalAmount,
  isUnlimitedApproval,
  walletPassword,
  isLoading,
  error,
  approvalReview,
  onSetUnlimited,
  onApprovalAmountChange,
  onApprove,
  onExecuteApproval,
  onPasswordChange,
  onCancel,
}) => {
  const { t } = useTranslation();

  const spenderAddress = shortenAddress(quote.approvalAddress || swapTxTo || "");

  if (mode === "approve") {
    return (
      <div className={styles.approveForm}>
        <h3>{t('swap.approveTokenSpending')}</h3>
        <p className={styles.approveDescription}>
          {t('swap.approveDescription', { symbol: fromToken.tokenSymbol })}
        </p>

        <div className={styles.approvalDetails}>
          <div className={styles.approvalRow}>
            <span className={styles.approvalLabel}>{t('swap.token')}</span>
            <span className={styles.approvalValue}>{fromToken.tokenSymbol}</span>
          </div>
          <div className={styles.approvalRow}>
            <span className={styles.approvalLabel}>{t('swap.spender')}</span>
            <span className={`${styles.approvalValue} ${styles.address}`.trim()}>{spenderAddress}</span>
          </div>
          {currentAllowance && (
            <div className={styles.approvalRow}>
              <span className={styles.approvalLabel}>{t('swap.currentAllowance')}</span>
              <span className={styles.approvalValue}>
                {fromSmallestUnit(currentAllowance, fromToken.decimals)} {fromToken.tokenSymbol}
              </span>
            </div>
          )}
          <div className={styles.approvalRow}>
            <span className={styles.approvalLabel}>{t('swap.swapAmount')}</span>
            <span className={styles.approvalValue}>{amount} {fromToken.tokenSymbol}</span>
          </div>
        </div>

        {/* Approval Amount Settings */}
        <div className={styles.approvalAmountSection}>
          <div className={styles.approvalTypeToggle}>
            <button
              className={`${styles.toggleButton} ${!isUnlimitedApproval ? styles.active : ''}`}
              onClick={() => onSetUnlimited(false)}
            >
              {t('swap.specificAmount')}
            </button>
            <button
              className={`${styles.toggleButton} ${isUnlimitedApproval ? styles.active : ''}`}
              onClick={() => onSetUnlimited(true)}
            >
              {t('swap.unlimited')}
            </button>
          </div>

          {!isUnlimitedApproval && (
            <div className={styles.formGroup}>
              <label>{t('swap.approvalAmount')}</label>
              <div className={styles.inputWithSuffix}>
                <input
                  type="text"
                  value={approvalAmount}
                  onChange={(e) => onApprovalAmountChange(e.target.value)}
                  placeholder={`e.g., ${amount}`}
                />
                <span className={styles.inputSuffix}>{fromToken.tokenSymbol}</span>
              </div>
              <div className={styles.approvalAmountPresets}>
                <button
                  className={styles.presetButton}
                  onClick={() => onApprovalAmountChange(amount)}
                >
                  {t('swap.swapAmountPreset', { amount })}
                </button>
                <button
                  className={styles.presetButton}
                  onClick={() => {
                    const doubled = (parseFloat(amount) * 2).toString();
                    onApprovalAmountChange(doubled);
                  }}
                >
                  2x ({(parseFloat(amount) * 2).toFixed(6)})
                </button>
              </div>
            </div>
          )}

          {isUnlimitedApproval && (
            <div className={styles.unlimitedWarning}>
              <span className={styles.warningIcon}>&#9888;</span>
              <span>{t('swap.unlimitedWarning', { symbol: fromToken.tokenSymbol })}</span>
            </div>
          )}
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <button className={styles.primaryButton} onClick={onApprove} disabled={isLoading}>
          {isLoading
            ? t('swap.processing')
            : isUnlimitedApproval
              ? t('swap.approveUnlimited', { symbol: fromToken.tokenSymbol })
              : t('swap.approveAmount', { amount: approvalAmount || amount, symbol: fromToken.tokenSymbol })}
        </button>
        <button className={styles.secondaryButton} onClick={onCancel} disabled={isLoading}>
          {t('actions.cancel')}
        </button>
      </div>
    );
  }

  // mode === "approvalPassword"
  return (
    <div className={styles.passwordForm}>
      <h3>{t('swap.enterPasswordToApprove')}</h3>
      <p className={styles.approveDescription}>
        {t('swap.signApprovalDescription', { symbol: fromToken.tokenSymbol })}
      </p>

      <div className={styles.approvalDetails}>
        <div className={styles.approvalRow}>
          <span className={styles.approvalLabel}>{t('swap.token')}</span>
          <span className={styles.approvalValue}>{fromToken.tokenSymbol}</span>
        </div>
        <div className={styles.approvalRow}>
          <span className={styles.approvalLabel}>{t('swap.spender')}</span>
          <span className={`${styles.approvalValue} ${styles.address}`.trim()}>{spenderAddress}</span>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>{t('swap.walletPassword')}</label>
        <PasswordInput
          value={walletPassword}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder={t('swap.enterWalletPassword')}
          disabled={isLoading}
        />
      </div>

      {/* Full pre-signature review: what the approve() call does, what's
          risky, consent, digest. Only rendered once the calldata has been
          fetched (useSwapFlow.handleApprove) — this screen has nothing to
          review before that. */}
      {approvalReview && <SignReview review={approvalReview} />}

      {error && <div className={styles.errorMessage}>{error}</div>}

      <button
        className={styles.primaryButton}
        onClick={onExecuteApproval}
        disabled={
          isLoading ||
          !walletPassword ||
          (approvalReview?.requiresAcknowledge && !approvalReview.acknowledged)
        }
        style={approvalReview?.requiresAcknowledge ? { background: "#dc2626", boxShadow: "none" } : undefined}
      >
        {isLoading ? t('swap.processing') : t('swap.signAndApprove', { symbol: fromToken.tokenSymbol })}
      </button>
      <button
        className={styles.secondaryButton}
        onClick={onCancel}
        disabled={isLoading}
      >
        {t('actions.cancel')}
      </button>
    </div>
  );
};
