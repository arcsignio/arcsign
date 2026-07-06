/**
 * WalletDetailViews — 子畫面 dispatch
 *
 * 收攏 WalletDetail 裡所有「if (show*) return (<Xxx .../>)」全螢幕早退區塊。
 * 全部為 false 時回 null（代表「顯示資產列表本體」，由主檔 WalletDetail 處理）。
 *
 * 純搬移，不改行為。
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { Wallet } from "@/types/wallet";
import { TransactionHistory } from "@/components/TransactionHistory";
import { SendTransaction, type SendableToken } from "@/components/SendTransaction";
import SwapTransaction from "@/components/SwapTransaction";
import StakingTransaction from "@/components/StakingTransaction";
import { AddressBook } from "@/components/AddressBook";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export interface WalletDetailViewsProps {
  // ── Password prompt ──────────────────────────────────────────────────────
  showPasswordPrompt: boolean;
  wallet: Wallet;
  onBack: () => void;
  error: string | null;
  tempPassword: string;
  setTempPassword: (v: string) => void;
  handleLoadBalances: () => void;
  isLoading: boolean;

  // ── Passphrase prompt ────────────────────────────────────────────────────
  showPassphrasePrompt: boolean;
  passphrase: string;
  setPassphrase: (v: string) => void;
  handleValidatePassphrase: () => void;
  isValidatingPassphrase: boolean;
  setShowPassphrasePrompt: (v: boolean) => void;
  setShowPasswordPrompt: (v: boolean) => void;
  passwordRef: React.MutableRefObject<string>;
  setError: (v: string | null) => void;

  // ── Session token (shared by history / addressbook / send / swap / staking)
  sessionToken: string | null;

  // ── Transaction History ──────────────────────────────────────────────────
  showHistory: boolean;
  historyAddress: string;
  usbPath: string;
  setShowHistory: (v: boolean) => void;
  setHistoryAddress: (v: string) => void;

  // ── Address Book ─────────────────────────────────────────────────────────
  showAddressBook: boolean;
  setShowAddressBook: (v: boolean) => void;

  // ── Send / Swap / Staking (share wallet + validatedPassphrase + tokens) ──
  showSendTransaction: boolean;
  showSwapTransaction: boolean;
  showStakingTransaction: boolean;
  validatedPassphrase: string | null;
  availableTokensForSend: SendableToken[];
  setShowSendTransaction: (v: boolean) => void;
  setShowSwapTransaction: (v: boolean) => void;
  setShowStakingTransaction: (v: boolean) => void;
  handleRefreshBalances: () => void;
}

export function WalletDetailViews(props: WalletDetailViewsProps): JSX.Element | null {
  const { t } = useTranslation();
  const {
    showPasswordPrompt,
    wallet,
    onBack,
    error,
    tempPassword,
    setTempPassword,
    handleLoadBalances,
    isLoading,

    showPassphrasePrompt,
    passphrase,
    setPassphrase,
    handleValidatePassphrase,
    isValidatingPassphrase,
    setShowPassphrasePrompt,
    setShowPasswordPrompt,
    passwordRef,
    setError,

    sessionToken,

    showHistory,
    historyAddress,
    usbPath,
    setShowHistory,
    setHistoryAddress,

    showAddressBook,
    setShowAddressBook,

    showSendTransaction,
    showSwapTransaction,
    showStakingTransaction,
    validatedPassphrase,
    availableTokensForSend,
    setShowSendTransaction,
    setShowSwapTransaction,
    setShowStakingTransaction,
    handleRefreshBalances,
  } = props;

  // ── Password prompt ───────────────────────────────────────────────────────
  if (showPasswordPrompt) {
    return (
      <div className="wallet-detail">
        <div className="detail-header">
          <button onClick={onBack} className="back-button">
            ← {t('walletDetail.backToWallets')}
          </button>
          <h2>{wallet.name}</h2>
        </div>

        <div
          style={{
            maxWidth: "480px",
            margin: "3rem auto",
            background: "white",
            borderRadius: "1rem",
            padding: "2.5rem",
            boxShadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 1.5rem",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                boxShadow: "0 4px 14px rgba(102, 126, 234, 0.4)",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: "700",
                color: "#1f2937",
                marginBottom: "0.5rem",
              }}
            >
              {t('walletDetail.unlockWallet')}
            </h3>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "#6b7280",
                lineHeight: "1.5",
              }}
            >
              {t('walletDetail.unlockDescription')}
            </p>
          </div>

          {error && (
            <div
              style={{
                background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                border: "1px solid #ef4444",
                borderRadius: "0.5rem",
                padding: "1rem",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                animation: "shake 0.4s ease-in-out",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span
                style={{
                  color: "#991b1b",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                {error}
              </span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "0.5rem",
              }}
            >
              {t('walletDetail.walletPassword')}
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "1.125rem",
                  color: "#9ca3af",
                }}
              >
                🔑
              </span>
              <input
                type="password"
                id="password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLoadBalances()}
                placeholder={t('walletDetail.enterPassword')}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem 0.875rem 3rem",
                  border: "2px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#667eea";
                  e.target.style.boxShadow =
                    "0 0 0 3px rgba(102, 126, 234, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <small
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "#9ca3af",
                marginTop: "0.5rem",
                textAlign: "right",
              }}
            >
              {t('walletDetail.pressEnterToSubmit')}
            </small>
          </div>

          <button
            onClick={handleLoadBalances}
            disabled={isLoading || !tempPassword}
            style={{
              width: "100%",
              background:
                isLoading || !tempPassword
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "0.875rem 1.5rem",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: isLoading || !tempPassword ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow:
                isLoading || !tempPassword
                  ? "none"
                  : "0 4px 14px rgba(102, 126, 234, 0.4)",
              transform: isLoading || !tempPassword ? "none" : "translateY(0)",
            }}
            onMouseEnter={(e) => {
              if (!isLoading && tempPassword) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(102, 126, 234, 0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && tempPassword) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 4px 14px rgba(102, 126, 234, 0.4)";
              }
            }}
          >
            {isLoading ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                ></span>
                {t('walletDetail.loadingAssets')}
              </span>
            ) : (
              t('walletDetail.unlockAndViewAssets')
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Passphrase prompt ─────────────────────────────────────────────────────
  if (showPassphrasePrompt) {
    return (
      <div className="wallet-detail">
        <div className="detail-header">
          <button onClick={onBack} className="back-button">
            ← {t('walletDetail.backToWallets')}
          </button>
          <h2>{wallet.name}</h2>
        </div>

        <div
          style={{
            maxWidth: "480px",
            margin: "3rem auto",
            background: "white",
            borderRadius: "1rem",
            padding: "2.5rem",
            boxShadow:
              "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 1.5rem",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                boxShadow: "0 4px 14px rgba(245, 158, 11, 0.4)",
              }}
            >
              🔑
            </div>
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: "700",
                color: "#1f2937",
                marginBottom: "0.5rem",
              }}
            >
              {t('walletDetail.enterPassphrase')}
            </h3>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "#6b7280",
                lineHeight: "1.5",
              }}
            >
              {t('walletDetail.passphraseDescription')}
              <br />
              {t('walletDetail.passphraseDescriptionContinue')}
            </p>
          </div>

          {error && (
            <div
              style={{
                background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                border: "1px solid #ef4444",
                borderRadius: "0.5rem",
                padding: "1rem",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span
                style={{
                  color: "#991b1b",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                {error}
              </span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="passphrase"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "0.5rem",
              }}
            >
              {t('walletDetail.bip39Passphrase')}
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "1.125rem",
                  color: "#9ca3af",
                }}
              >
                🔑
              </span>
              <input
                type="password"
                id="passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleValidatePassphrase()}
                placeholder={t('walletDetail.enterYourPassphrase')}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem 0.875rem 3rem",
                  border: "2px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  transition: "all 0.2s ease",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#f59e0b";
                  e.target.style.boxShadow =
                    "0 0 0 3px rgba(245, 158, 11, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <small
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "#9ca3af",
                marginTop: "0.5rem",
              }}
            >
              {t('walletDetail.passphraseCaseSensitive')}
            </small>
          </div>

          <button
            onClick={handleValidatePassphrase}
            disabled={isValidatingPassphrase || !passphrase}
            style={{
              width: "100%",
              background:
                isValidatingPassphrase || !passphrase
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "white",
              padding: "0.875rem 1.5rem",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: isValidatingPassphrase || !passphrase ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow:
                isValidatingPassphrase || !passphrase
                  ? "none"
                  : "0 4px 14px rgba(245, 158, 11, 0.4)",
            }}
          >
            {isValidatingPassphrase ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                  }}
                ></span>
                {t('walletDetail.validating')}
              </span>
            ) : (
              t('walletDetail.verifyAndContinue')
            )}
          </button>

          <button
            onClick={() => {
              setShowPassphrasePrompt(false);
              setShowPasswordPrompt(true);
              setTempPassword("");
              passwordRef.current = "";
              setPassphrase("");
              setError(null);
            }}
            style={{
              width: "100%",
              marginTop: "1rem",
              background: "transparent",
              color: "#6b7280",
              padding: "0.75rem",
              border: "none",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            {t('walletDetail.backToPassword')}
          </button>
        </div>
      </div>
    );
  }

  // ── Transaction History ───────────────────────────────────────────────────
  if (showHistory && historyAddress && sessionToken) {
    console.log("✅ [WalletDetail] Rendering TransactionHistory component");
    return (
      <TransactionHistory
        address={historyAddress}
        usbPath={usbPath}
        sessionToken={sessionToken}
        onBack={() => {
          setShowHistory(false);
          setHistoryAddress("");
        }}
      />
    );
  }

  // ── Address Book ──────────────────────────────────────────────────────────
  if (showAddressBook && sessionToken) {
    return (
      <AddressBook
        usbPath={usbPath}
        sessionToken={sessionToken}
        onBack={() => setShowAddressBook(false)}
      />
    );
  }

  // ── Send Transaction ──────────────────────────────────────────────────────
  if (showSendTransaction && sessionToken) {
    console.log("💸 [WalletDetail] Rendering SendTransaction component with", availableTokensForSend.length, "tokens");
    return (
      <ErrorBoundary level="component">
        <SendTransaction
          walletId={wallet.id}
          walletHasPassphrase={wallet.has_passphrase}
          walletPassphrase={validatedPassphrase || undefined}
          availableTokens={availableTokensForSend}
          usbPath={usbPath}
          sessionToken={sessionToken}  // ✅ Session token for low-risk operations
          onBack={() => setShowSendTransaction(false)}
          onSuccess={(txHash) => {
            console.log("✅ Transaction submitted:", txHash);
            setShowSendTransaction(false);
            void handleRefreshBalances();
          }}
        />
      </ErrorBoundary>
    );
  }

  // ── Swap Transaction ──────────────────────────────────────────────────────
  if (showSwapTransaction && sessionToken) {
    console.log("🔄 [WalletDetail] Rendering SwapTransaction component with", availableTokensForSend.length, "tokens");
    return (
      <ErrorBoundary level="component">
        <SwapTransaction
          walletId={wallet.id}
          walletHasPassphrase={wallet.has_passphrase}
          walletPassphrase={validatedPassphrase || undefined}
          availableTokens={availableTokensForSend}
          usbPath={usbPath}
          sessionToken={sessionToken}  // ✅ Uses session token
          onBack={() => setShowSwapTransaction(false)}
          onSuccess={(txHash) => {
            console.log("✅ Swap transaction submitted:", txHash);
            // Return to the asset list and refresh balances so the swapped
            // amounts are reflected (mirrors the token-import onAdded pattern).
            setShowSwapTransaction(false);
            void handleRefreshBalances();
          }}
        />
      </ErrorBoundary>
    );
  }

  // ── Staking Transaction ───────────────────────────────────────────────────
  if (showStakingTransaction && sessionToken) {
    console.log("📈 [WalletDetail] Rendering StakingTransaction component with", availableTokensForSend.length, "tokens");
    return (
      <ErrorBoundary level="component">
        <StakingTransaction
          walletId={wallet.id}
          walletHasPassphrase={wallet.has_passphrase}
          walletPassphrase={validatedPassphrase || undefined}
          availableTokens={availableTokensForSend}
          usbPath={usbPath}
          sessionToken={sessionToken}  // ✅ Uses session token
          onBack={() => setShowStakingTransaction(false)}
          onSuccess={(txHash) => {
            console.log("✅ Staking transaction submitted:", txHash);
          }}
        />
      </ErrorBoundary>
    );
  }

  // 全部為 false → 顯示資產列表本體（由主檔 WalletDetail 處理）
  return null;
}
