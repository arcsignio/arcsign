/**
 * SwapTransaction Component
 * Feature: Token Swap via DEX Aggregators (OpenOcean / KyberSwap)
 *
 * Complete swap flow:
 * 1. User selects source token (from balance)
 * 2. User selects destination token
 * 3. User enters amount to swap
 * 4. Get quote from DEX aggregator (show exchange rate, price impact, etc.)
 * 5. If needed, approve token spending
 * 6. User confirms and enters wallet password
 * 7. Sign and broadcast swap transaction
 * 8. Track transaction status
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { TokenPicker } from "@/components/swap/TokenPicker";
import { SwapQuoteView } from "@/components/swap/SwapQuoteView";
import { SwapConfirm } from "@/components/swap/SwapConfirm";
import { ApprovalView } from "@/components/swap/ApprovalView";
import { SwapProgress } from "@/components/swap/SwapProgress";
import { SwapResult } from "@/components/swap/SwapResult";
import { SwapStyles } from "@/components/swap/SwapStyles";
import { useSwapFlow } from "@/hooks/useSwapFlow";
import type { SendableToken } from "./SendTransaction";
import {
  swapRouteChanged,
  getExplorerUrl,
  getNetworkIcon,
} from "@/utils/swapFormat";

// Re-exported for backward-compatible import path (tests import from here).
export { swapRouteChanged };

interface SwapTransactionProps {
  walletId: string;
  walletHasPassphrase?: boolean;
  walletPassphrase?: string;
  availableTokens: SendableToken[];
  usbPath: string;
  sessionToken: string;  // ✅ Changed from appPassword
  onBack: () => void;
  onSuccess?: (txHash: string) => void;
}

export const SwapTransaction: React.FC<SwapTransactionProps> = ({
  walletId,
  walletHasPassphrase: _walletHasPassphrase = false,
  walletPassphrase: preValidatedPassphrase,
  availableTokens,
  usbPath,
  sessionToken,  // ✅ Changed from appPassword
  onBack,
  onSuccess,
}) => {
  void _walletHasPassphrase; // Reserved for future passphrase validation
  const { t } = useTranslation();

  const { state, actions } = useSwapFlow({
    walletId,
    walletPassphrase: preValidatedPassphrase,
    availableTokens,
    usbPath,
    sessionToken,
    onSuccess,
  });

  // Destructure state/actions for use in the render layer below (values and
  // handlers are read from the hook — no behavior lives in this component).
  const {
    fromToken,
    toToken,
    amount,
    slippage,
    walletPassword,
    approvalAmount,
    isUnlimitedApproval,
    currentAllowance,
    approvalTxHash,
    step,
    isLoading,
    error,
    quote,
    swapTx,
    txHash,
    tokenCache,
    tokenCacheKey,
    loadingTokens,
    tokenSearchQuery,
    tokensByNetwork,
    gate,
  } = state;
  const {
    setFromToken,
    setToToken,
    setAmount,
    setSlippage,
    setWalletPassword,
    setApprovalAmount,
    setIsUnlimitedApproval,
    setStep,
    setError,
    setQuote,
    setTokenSearchQuery,
    isValidAmount,
    getDestinationTokens,
    handleSelectFromToken,
    handleSelectToToken,
    handleBuildSwapTx,
    handleApprove,
    handleExecuteApproval,
    handleSignAndBroadcast,
    handleReset,
  } = actions;

  // Get back handler based on current step (uses onBack, a component prop)
  const getBackHandler = () => {
    switch (step) {
      case "selectFrom": return onBack;
      case "selectTo": return () => { setFromToken(null); setStep("selectFrom"); };
      case "input": return () => { setToToken(null); setStep("selectTo"); };
      case "quote": return () => setStep("input");
      case "approve": return () => setStep("input");
      case "approvalPassword": return () => { setWalletPassword(""); setStep("approve"); };
      case "password": return () => setStep("input");
      default: return handleReset;
    }
  };

  return (
    <div className="swap-transaction">
      <header className="swap-header">
        <button onClick={getBackHandler()} className="back-button">
          <span>&larr;</span> {t('actions.back')}
        </button>
        <h2>{t('swap.title')}</h2>
        <div className="header-badges">
          <div className="best-route-badge">
            <span className="best-route-icon">⚡</span>
            <span>{t('swap.bestRoute')}</span>
          </div>
          {fromToken && (
            <div className="chain-badge">
              <span className="chain-icon">{getNetworkIcon(fromToken.network)}</span>
              {fromToken.networkLabel}
            </div>
          )}
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Step 1: Select Source Token */}
      {step === "selectFrom" && (
        <TokenPicker
          mode="from"
          tokensByNetwork={tokensByNetwork}
          onSelectToken={handleSelectFromToken}
          onBack={onBack}
        />
      )}

      {/* Step 2: Select Destination Token */}
      {step === "selectTo" && fromToken && (
        <TokenPicker
          mode="to"
          destinationTokens={getDestinationTokens()}
          searchQuery={tokenSearchQuery}
          loadingTokens={loadingTokens}
          cacheHasTokens={!!tokenCache[tokenCacheKey]}
          fromTokenSymbol={fromToken.tokenSymbol}
          fromTokenNetworkLabel={fromToken.networkLabel}
          onSearch={(q) => setTokenSearchQuery(q)}
          onSelectToken={handleSelectToToken}
        />
      )}

      {/* Step 3: Input Amount */}
      {step === "input" && fromToken && toToken && (
        <SwapQuoteView
          fromToken={fromToken}
          toToken={toToken}
          amount={amount}
          quote={quote}
          isLoading={isLoading}
          slippage={slippage}
          isValidAmount={isValidAmount}
          onAmountChange={(v) => setAmount(v)}
          onSetMax={() => setAmount(fromToken.balance)}
          onSetHalf={() => setAmount(String(parseFloat(fromToken.balance) / 2))}
          onSlippageChange={(s) => setSlippage(s)}
          onSelectFromToken={() => setStep("selectFrom")}
          onSelectToToken={() => setStep("selectTo")}
          onSwapTokens={() => {
            // Swap tokens (if destination has balance)
            const destAsFromToken = availableTokens.find(t =>
              (t.tokenAddress || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee").toLowerCase() === toToken.address.toLowerCase() &&
              t.network === fromToken.network
            );
            if (destAsFromToken) {
              setFromToken(destAsFromToken);
              setToToken({
                address: fromToken.tokenAddress || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                symbol: fromToken.tokenSymbol,
                name: fromToken.tokenName,
                decimals: fromToken.decimals,
                logoURI: fromToken.tokenLogo,
                network: fromToken.network,
              });
              setAmount("");
              setQuote(null);
            }
          }}
          onContinue={handleBuildSwapTx}
        />
      )}

      {/* Approval Step */}
      {step === "approve" && quote && fromToken && (
        <ApprovalView
          mode="approve"
          fromToken={fromToken}
          quote={quote}
          swapTxTo={swapTx?.txData.to}
          currentAllowance={currentAllowance}
          amount={amount}
          approvalAmount={approvalAmount}
          isUnlimitedApproval={isUnlimitedApproval}
          walletPassword={walletPassword}
          isLoading={isLoading}
          error={error}
          onSetUnlimited={(v) => setIsUnlimitedApproval(v)}
          onApprovalAmountChange={(v) => setApprovalAmount(v)}
          onApprove={handleApprove}
          onExecuteApproval={handleExecuteApproval}
          onPasswordChange={(v) => setWalletPassword(v)}
          onCancel={() => setStep("input")}
        />
      )}

      {/* Approval Password Step */}
      {step === "approvalPassword" && fromToken && quote && (
        <ApprovalView
          mode="approvalPassword"
          fromToken={fromToken}
          quote={quote}
          swapTxTo={swapTx?.txData.to}
          currentAllowance={currentAllowance}
          amount={amount}
          approvalAmount={approvalAmount}
          isUnlimitedApproval={isUnlimitedApproval}
          walletPassword={walletPassword}
          isLoading={isLoading}
          error={error}
          onSetUnlimited={(v) => setIsUnlimitedApproval(v)}
          onApprovalAmountChange={(v) => setApprovalAmount(v)}
          onApprove={handleApprove}
          onExecuteApproval={handleExecuteApproval}
          onPasswordChange={(v) => setWalletPassword(v)}
          onCancel={() => { setWalletPassword(""); setStep("approve"); }}
        />
      )}

      {/* Approving Step (in progress) */}
      {step === "approving" && fromToken && (
        <SwapProgress
          mode="approving"
          tokenSymbol={fromToken.tokenSymbol}
          networkLabel={fromToken.networkLabel}
          approvalTxHash={approvalTxHash}
          approvalTxUrl={approvalTxHash ? getExplorerUrl(fromToken.network, approvalTxHash) : undefined}
        />
      )}

      {/* Password Step */}
      {step === "password" && swapTx && fromToken && toToken && (
        <SwapConfirm
          fromToken={fromToken}
          toToken={toToken}
          amount={amount}
          swapQuote={swapTx.quote}
          routeChanged={swapRouteChanged(quote, swapTx.quote)}
          walletPassword={walletPassword}
          isLoading={isLoading}
          requiresAcknowledge={gate.requiresAcknowledge}
          acknowledged={gate.acknowledged}
          onAcknowledgeChange={(checked) => gate.setAcknowledged(checked)}
          onPasswordChange={(v) => setWalletPassword(v)}
          onConfirm={handleSignAndBroadcast}
        />
      )}

      {/* Signing/Broadcasting Steps */}
      {(step === "signing" || step === "broadcasting") && (
        <SwapProgress mode={step} />
      )}

      {/* Success Step */}
      {step === "success" && txHash && fromToken && (
        <SwapResult
          mode="success"
          txHash={txHash}
          txUrl={getExplorerUrl(fromToken.network, txHash)}
          onNewSwap={handleReset}
          onBack={onBack}
          onTryAgain={() => setStep("input")}
          onStartOver={handleReset}
        />
      )}

      {/* Error Step */}
      {step === "error" && (
        <SwapResult
          mode="error"
          error={error}
          onNewSwap={handleReset}
          onBack={onBack}
          onTryAgain={() => setStep("input")}
          onStartOver={handleReset}
        />
      )}

      <SwapStyles />
    </div>
  );
};

export default SwapTransaction;
