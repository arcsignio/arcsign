/**
 * Wallet Detail View - Asset-first display with multi-chain token balances
 * Feature: Asset management with Alchemy API integration
 */

import { useState } from "react";
import { useAppPassword } from "@/contexts/AppPasswordContext";
import tauriApi, { type AppError } from "@/services/tauri-api";
import type { TokenBalance, TokenBalancesResponse } from "@/types/tokens";
import type { Wallet } from "@/types/wallet";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface WalletDetailProps {
  wallet: Wallet;
  usbPath: string;
  onBack: () => void;
  onViewAddresses?: () => void;
}

export function WalletDetail({
  wallet,
  usbPath,
  onBack,
  onViewAddresses,
}: WalletDetailProps) {
  const { appPassword } = useAppPassword();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true);

  const handleLoadBalances = async () => {
    if (!password || !appPassword) {
      setError("Please enter wallet password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: TokenBalancesResponse = await tauriApi.getTokenBalances({
        walletId: wallet.id,
        password,
        usbPath,
        appPassword,
      });

      setTokens(response.tokens);
      setTotalUsd(response.totalUsd);
      setShowPasswordPrompt(false);
    } catch (err) {
      const error = err as AppError;
      setError(error.message || "Failed to load token balances");
    } finally {
      setIsLoading(false);
    }
  };

  const formatUSD = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num < 0.01) return num.toFixed(8);
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(4);
    return num.toFixed(2);
  };

  // Group tokens by network
  const tokensByNetwork = tokens.reduce((acc, token) => {
    if (!acc[token.networkLabel]) {
      acc[token.networkLabel] = [];
    }
    acc[token.networkLabel].push(token);
    return {};
  }, {} as Record<string, TokenBalance[]>);

  if (showPasswordPrompt) {
    return (
      <div className="wallet-detail">
        <div className="detail-header">
          <button onClick={onBack} className="back-button">
            ← Back to Wallets
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
              🔐
            </div>
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: "700",
                color: "#1f2937",
                marginBottom: "0.5rem",
              }}
            >
              Unlock Your Wallet
            </h3>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "#6b7280",
                lineHeight: "1.5",
              }}
            >
              Enter your password to view token balances and manage assets
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
              <span style={{ fontSize: "1.25rem" }}>⚠️</span>
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
              Wallet Password
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLoadBalances()}
                placeholder="Enter your password"
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
              Press Enter to submit ↵
            </small>
          </div>

          <button
            onClick={handleLoadBalances}
            disabled={isLoading || !password}
            style={{
              width: "100%",
              background:
                isLoading || !password
                  ? "#d1d5db"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "0.875rem 1.5rem",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: isLoading || !password ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow:
                isLoading || !password
                  ? "none"
                  : "0 4px 14px rgba(102, 126, 234, 0.4)",
              transform: isLoading || !password ? "none" : "translateY(0)",
            }}
            onMouseEnter={(e) => {
              if (!isLoading && password) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(102, 126, 234, 0.5)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && password) {
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
                Loading Assets...
              </span>
            ) : (
              "Unlock & View Assets"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-detail">
      <div className="detail-header">
        <button onClick={onBack} className="back-button">
          ← Back to Wallets
        </button>
        <div className="header-content">
          <h2>{wallet.name}</h2>
          <div className="total-value">
            <span className="label">Total Value</span>
            <span className="value">{formatUSD(totalUsd)}</span>
          </div>
        </div>
        {onViewAddresses && (
          <button onClick={onViewAddresses} className="view-addresses-link">
            📋 View Addresses
          </button>
        )}
      </div>

      {isLoading && (
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading token balances...</p>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {!isLoading && tokens.length === 0 && (
        <div className="empty-state">
          <p>No tokens found in this wallet</p>
        </div>
      )}

      {!isLoading && tokens.length > 0 && (
        <div className="tokens-container">
          {Object.entries(tokensByNetwork).map(([network, networkTokens]) => (
            <div key={network} className="network-section">
              <h3 className="network-header">{network}</h3>
              <div className="tokens-list">
                {networkTokens.map((token, idx) => (
                  <div
                    key={`${token.address}-${token.tokenAddress}-${idx}`}
                    className="token-card"
                  >
                    <div className="token-info">
                      {token.tokenLogo && (
                        <img
                          src={token.tokenLogo}
                          alt={token.tokenSymbol}
                          className="token-logo"
                        />
                      )}
                      <div className="token-details">
                        <div className="token-name">{token.tokenSymbol}</div>
                        <div className="token-network">{token.tokenName}</div>
                      </div>
                    </div>
                    <div className="token-balance">
                      <div className="balance-amount">
                        {formatBalance(token.balance)}
                      </div>
                      <div className="balance-usd">
                        {formatUSD(token.usdValue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
