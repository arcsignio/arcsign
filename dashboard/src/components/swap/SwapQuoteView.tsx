import React from "react";
import styles from "./swap.module.css";
import { useTranslation } from "react-i18next";
import {
  fromSmallestUnit,
  formatBalance,
  getNativeTokenSymbol,
} from "@/utils/swapFormat";
import type { SwapQuoteResponse } from "@/services/tauri-api";
import type { SendableToken } from "@/components/SendTransaction";
import type { ToToken } from "@/components/swap/types";

export type { ToToken };

interface SwapQuoteViewProps {
  fromToken: SendableToken;
  toToken: ToToken;
  amount: string;
  quote: SwapQuoteResponse | null;
  isLoading: boolean;
  slippage: number;
  /** Whether the current amount is a valid positive number */
  isValidAmount: (value: string) => boolean;
  onAmountChange: (value: string) => void;
  onSetMax: () => void;
  onSetHalf: () => void;
  onSlippageChange: (value: number) => void;
  /** Clicking the fromToken selector — go back to source token selection */
  onSelectFromToken: () => void;
  /** Clicking the toToken selector — go back to destination token selection */
  onSelectToToken: () => void;
  /** Flip from/to tokens (if possible). Fires when user clicks the ↕ button. */
  onSwapTokens: () => void;
  /** Continue to sign/confirm step */
  onContinue: () => void;
}

export const SwapQuoteView: React.FC<SwapQuoteViewProps> = ({
  fromToken,
  toToken,
  amount,
  quote,
  isLoading,
  slippage,
  isValidAmount,
  onAmountChange,
  onSetMax,
  onSetHalf,
  onSlippageChange,
  onSelectFromToken,
  onSelectToToken,
  onSwapTokens,
  onContinue,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.swapInputForm}>
      {/* From Token */}
      <div className={`${styles.swapTokenCard} ${styles.from}`.trim()}>
        <div className={styles.tokenCardHeader}>
          <span className={styles.cardLabel}>{t('swap.youPay')}</span>
          <span className={styles.balanceLabel}>
            {t('swap.balance')}: {formatBalance(fromToken.balance)} {fromToken.tokenSymbol}
          </span>
        </div>
        <div className={styles.tokenCardBody}>
          <input
            type="text"
            placeholder="0.0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className={styles.amountInputLarge}
          />
          <div className={styles.tokenSelector} onClick={onSelectFromToken}>
            <div className={styles.tokenIconSmall}>
              {fromToken.tokenLogo ? (
                <img src={fromToken.tokenLogo} alt={fromToken.tokenSymbol} />
              ) : (
                <span>{fromToken.tokenSymbol.slice(0, 2)}</span>
              )}
            </div>
            <span className={styles.tokenSymbol}>{fromToken.tokenSymbol}</span>
            <span className={styles.dropdownArrow}>▼</span>
          </div>
        </div>
        <div className={styles.tokenCardFooter}>
          <button className={styles.maxButton} onClick={onSetMax}>
            MAX
          </button>
          <button className={styles.halfButton} onClick={onSetHalf}>
            50%
          </button>
        </div>
      </div>

      {/* Swap Direction Indicator */}
      <div className={styles.swapDirection}>
        <button className={styles.swapDirectionBtn} onClick={onSwapTokens}>
          ↕
        </button>
      </div>

      {/* To Token */}
      <div className={`${styles.swapTokenCard} ${styles.to}`.trim()}>
        <div className={styles.tokenCardHeader}>
          <span className={styles.cardLabel}>{t('swap.youReceive')}</span>
        </div>
        <div className={styles.tokenCardBody}>
          <div className={styles.amountDisplay}>
            {isLoading ? (
              <span className={styles.loadingText}>{t('common.loading')}</span>
            ) : quote ? (
              fromSmallestUnit(quote.toAmount, toToken.decimals)
            ) : (
              "0.0"
            )}
          </div>
          <div className={styles.tokenSelector} onClick={onSelectToToken}>
            <div className={styles.tokenIconSmall}>
              {toToken.logoURI ? (
                <img src={toToken.logoURI} alt={toToken.symbol} />
              ) : (
                <span>{toToken.symbol.slice(0, 2)}</span>
              )}
            </div>
            <span className={styles.tokenSymbol}>{toToken.symbol}</span>
            <span className={styles.dropdownArrow}>▼</span>
          </div>
        </div>
        {quote && (
          <div className={styles.tokenCardFooter}>
            <span className={styles.minReceived}>
              {t('swap.min')}: {fromSmallestUnit(quote.toAmountMin, toToken.decimals)} {toToken.symbol}
            </span>
          </div>
        )}
      </div>

      {/* Quote Details */}
      {quote && (
        <div className={styles.quoteDetails}>
          <div className={styles.quoteRow}>
            <span className={styles.quoteLabel}>{t('swap.exchangeRate')}</span>
            <span className={styles.quoteValue}>
              1 {fromToken.tokenSymbol} = {quote.exchangeRate} {toToken.symbol}
            </span>
          </div>
          <div className={styles.quoteRow}>
            <span className={styles.quoteLabel}>{t('swap.priceImpact')}</span>
            <span className={`${styles.quoteValue} ${
              quote.priceImpact !== "N/A" && parseFloat(quote.priceImpact) > 3 ? styles.warning : ""
            }`}>
              {quote.priceImpact === "N/A" || quote.priceImpact === "" || quote.priceImpact === "0"
                ? "N/A"
                : `${quote.priceImpact}%`}
            </span>
          </div>
          <div className={styles.quoteRow}>
            <span className={styles.quoteLabel}>{t('swap.estimatedGas')}</span>
            <span className={styles.quoteValue}>{quote.gasCostETH} {getNativeTokenSymbol(fromToken.network)}</span>
          </div>
          <div className={styles.quoteRow}>
            <span className={styles.quoteLabel}>{t('swap.swapFee')}</span>
            <span className={`${styles.quoteValue} ${quote.feeRate === "0" ? styles.feeFree : ""}`}>
              {quote.feeRate === "0"
                ? t('swap.freeSwap')
                : `${quote.feeRate}%`}
            </span>
          </div>
          <div className={styles.quoteRow}>
            <span className={styles.quoteLabel}>{t('swap.route')}</span>
            <span className={`${styles.quoteValue} ${styles.route}`.trim()}>
              {quote.routeType === "best" && <span className={styles.bestRouteTag}>⚡ </span>}
              {quote.protocols.join(" → ")}
            </span>
          </div>
        </div>
      )}

      {/* Slippage Settings */}
      <div className={styles.slippageSettings}>
        <span className={styles.slippageLabel}>{t('swap.slippageTolerance')}</span>
        <div className={styles.slippageOptions}>
          {[0.5, 1, 3].map(s => (
            <button
              key={s}
              className={`${styles.slippageOption} ${slippage === s ? styles.selected : ""}`}
              onClick={() => onSlippageChange(s)}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <button
        className={styles.primaryButton}
        onClick={onContinue}
        disabled={isLoading || !isValidAmount(amount) || !quote}
      >
        {isLoading ? t('common.loading') : t('swap.reviewSwap')}
      </button>
    </div>
  );
};
