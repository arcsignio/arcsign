import React from "react";
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
    <div className="swap-input-form">
      {/* From Token */}
      <div className="swap-token-card from">
        <div className="token-card-header">
          <span className="card-label">{t('swap.youPay')}</span>
          <span className="balance-label">
            {t('swap.balance')}: {formatBalance(fromToken.balance)} {fromToken.tokenSymbol}
          </span>
        </div>
        <div className="token-card-body">
          <input
            type="text"
            placeholder="0.0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="amount-input-large"
          />
          <div className="token-selector" onClick={onSelectFromToken}>
            <div className="token-icon-small">
              {fromToken.tokenLogo ? (
                <img src={fromToken.tokenLogo} alt={fromToken.tokenSymbol} />
              ) : (
                <span>{fromToken.tokenSymbol.slice(0, 2)}</span>
              )}
            </div>
            <span className="token-symbol">{fromToken.tokenSymbol}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
        </div>
        <div className="token-card-footer">
          <button className="max-button" onClick={onSetMax}>
            MAX
          </button>
          <button className="half-button" onClick={onSetHalf}>
            50%
          </button>
        </div>
      </div>

      {/* Swap Direction Indicator */}
      <div className="swap-direction">
        <button className="swap-direction-btn" onClick={onSwapTokens}>
          ↕
        </button>
      </div>

      {/* To Token */}
      <div className="swap-token-card to">
        <div className="token-card-header">
          <span className="card-label">{t('swap.youReceive')}</span>
        </div>
        <div className="token-card-body">
          <div className="amount-display">
            {isLoading ? (
              <span className="loading-text">{t('common.loading')}</span>
            ) : quote ? (
              fromSmallestUnit(quote.toAmount, toToken.decimals)
            ) : (
              "0.0"
            )}
          </div>
          <div className="token-selector" onClick={onSelectToToken}>
            <div className="token-icon-small">
              {toToken.logoURI ? (
                <img src={toToken.logoURI} alt={toToken.symbol} />
              ) : (
                <span>{toToken.symbol.slice(0, 2)}</span>
              )}
            </div>
            <span className="token-symbol">{toToken.symbol}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
        </div>
        {quote && (
          <div className="token-card-footer">
            <span className="min-received">
              {t('swap.min')}: {fromSmallestUnit(quote.toAmountMin, toToken.decimals)} {toToken.symbol}
            </span>
          </div>
        )}
      </div>

      {/* Quote Details */}
      {quote && (
        <div className="quote-details">
          <div className="quote-row">
            <span className="quote-label">{t('swap.exchangeRate')}</span>
            <span className="quote-value">
              1 {fromToken.tokenSymbol} = {quote.exchangeRate} {toToken.symbol}
            </span>
          </div>
          <div className="quote-row">
            <span className="quote-label">{t('swap.priceImpact')}</span>
            <span className={`quote-value ${
              quote.priceImpact !== "N/A" && parseFloat(quote.priceImpact) > 3 ? "warning" : ""
            }`}>
              {quote.priceImpact === "N/A" || quote.priceImpact === "" || quote.priceImpact === "0"
                ? "N/A"
                : `${quote.priceImpact}%`}
            </span>
          </div>
          <div className="quote-row">
            <span className="quote-label">{t('swap.estimatedGas')}</span>
            <span className="quote-value">{quote.gasCostETH} {getNativeTokenSymbol(fromToken.network)}</span>
          </div>
          <div className="quote-row">
            <span className="quote-label">{t('swap.swapFee')}</span>
            <span className={`quote-value ${quote.feeRate === "0" ? "fee-free" : ""}`}>
              {quote.feeRate === "0"
                ? t('swap.freeSwap')
                : `${quote.feeRate}%`}
            </span>
          </div>
          <div className="quote-row">
            <span className="quote-label">{t('swap.route')}</span>
            <span className="quote-value route">
              {quote.routeType === "best" && <span className="best-route-tag">⚡ </span>}
              {quote.protocols.join(" → ")}
            </span>
          </div>
        </div>
      )}

      {/* Slippage Settings */}
      <div className="slippage-settings">
        <span className="slippage-label">{t('swap.slippageTolerance')}</span>
        <div className="slippage-options">
          {[0.5, 1, 3].map(s => (
            <button
              key={s}
              className={`slippage-option ${slippage === s ? "selected" : ""}`}
              onClick={() => onSlippageChange(s)}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <button
        className="primary-button"
        onClick={onContinue}
        disabled={isLoading || !isValidAmount(amount) || !quote}
      >
        {isLoading ? t('common.loading') : t('swap.reviewSwap')}
      </button>
    </div>
  );
};
