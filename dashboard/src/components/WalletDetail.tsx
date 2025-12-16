/**
 * Wallet Detail View - Asset-first display with multi-chain token balances
 * Feature: Asset management with Alchemy API integration + CoinGecko Token Lists
 */

import { useState, useMemo } from "react";
import { useAppPassword } from "@/contexts/AppPasswordContext";
import tauriApi, { type AppError } from "@/services/tauri-api";
import type { TokenBalance, TokenBalancesResponse } from "@/types/tokens";
import type { Wallet } from "@/types/wallet";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { normalizeTokenForDisplay } from "@/constants/commonTokens";
import {
  getNativeToken,
  isNativeTokenAddress,
  getNetworkKey,
} from "@/constants/nativeTokens";
import { usePriorityTokens } from "@/hooks/useTokenList";

type TabType = "crypto" | "defi" | "nft" | "approvals";

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
  const [activeTab, setActiveTab] = useState<TabType>("crypto");
  const [showPercentage, setShowPercentage] = useState(true);

  // Load priority tokens from CoinGecko token lists
  const { tokens: priorityTokens, isLoading: isLoadingPriority } =
    usePriorityTokens();

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

  // Merge user tokens with priority tokens from CoinGecko lists
  const displayTokens = useMemo(() => {
    const tokenMap = new Map<string, TokenBalance>();

    // Add all user tokens first (these have actual balances)
    tokens.forEach((token) => {
      // Check if this is a native token and enrich with metadata
      const networkKey = getNetworkKey(token.networkLabel);
      
      // Debug: Log native token detection
      if (isNativeTokenAddress(token.tokenAddress)) {
        console.log("🔍 Native token detected:", {
          symbol: token.tokenSymbol,
          networkLabel: token.networkLabel,
          networkKey,
          address: token.tokenAddress,
        });
      }
      
      if (networkKey && isNativeTokenAddress(token.tokenAddress)) {
        const nativeToken = getNativeToken(networkKey);
        if (nativeToken) {
          console.log("✅ Enriching native token:", {
            before: { symbol: token.tokenSymbol, logo: token.tokenLogo },
            after: { symbol: nativeToken.symbol, logo: nativeToken.logoURI },
          });
          // Enrich native token with proper metadata
          token.tokenLogo = nativeToken.logoURI;
          token.tokenName = nativeToken.name;
          token.tokenSymbol = nativeToken.symbol;
        } else {
          console.log("⚠️ No native token metadata found for:", networkKey);
        }
      }

      const key = `${token.network}-${
        token.tokenSymbol
      }-${token.tokenAddress.toLowerCase()}`;
      tokenMap.set(key, token);
    });

    // Add priority tokens from CoinGecko lists if they don't exist
    if (!isLoadingPriority) {
      priorityTokens.forEach((priorityToken) => {
        const key = `chain-${priorityToken.chainId}-${
          priorityToken.symbol
        }-${priorityToken.address.toLowerCase()}`;

        // Only add if not already in map (user doesn't have this token)
        if (!tokenMap.has(key)) {
          const displayToken = normalizeTokenForDisplay(priorityToken);
          tokenMap.set(key, displayToken);
        }
      });
    }

    return Array.from(tokenMap.values()).sort((a, b) => {
      // Sort by value (highest first), then by symbol
      if (b.usdValue !== a.usdValue) {
        return b.usdValue - a.usdValue;
      }
      return a.tokenSymbol.localeCompare(b.tokenSymbol);
    });
  }, [tokens, priorityTokens, isLoadingPriority]);

  // Group tokens by network
  const tokensByNetwork = displayTokens.reduce((acc, token) => {
    if (!acc[token.networkLabel]) {
      acc[token.networkLabel] = [];
    }
    acc[token.networkLabel].push(token);
    return acc;
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
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0e17",
        color: "white",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header with Account Info */}
      <div
        style={{
          background: "linear-gradient(180deg, #1a1f2e 0%, #0a0e17 100%)",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            color: "#8b92a7",
            fontSize: "0.875rem",
            cursor: "pointer",
            padding: "0.5rem 0",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          ← Back to Wallets
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
            }}
          >
            💼
          </div>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.25rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  margin: 0,
                }}
              >
                {wallet.name}
              </h3>
              <button
                title="Switch Wallet"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8b92a7",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  padding: "0.25rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#8b92a7";
                }}
              >
                ▼
              </button>
            </div>
            <div
              style={{
                fontSize: "0.8125rem",
                color: "#8b92a7",
              }}
            >
              Wallet 01
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem" }}>
            <button
              title="Copy Address"
              style={{
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "0.5rem",
                cursor: "pointer",
                color: "white",
                fontSize: "1rem",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              📋
            </button>
            <button
              title="Refresh Balances"
              style={{
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "0.5rem",
                cursor: "pointer",
                color: "white",
                fontSize: "1rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              🔄
            </button>
            <button
              title="Network Settings"
              style={{
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "0.5rem",
                cursor: "pointer",
                color: "white",
                fontSize: "1rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              🌐
            </button>
          </div>
        </div>

        {/* Balance Display */}
        <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              marginBottom: "0.5rem",
              letterSpacing: "-0.02em",
            }}
          >
            {formatUSD(totalUsd)}
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: showPercentage ? "#34c759" : "#8b92a7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <span>{formatUSD(0)} (0.00%)</span>
            <button
              title="Change Time Period"
              onClick={() => setShowPercentage(!showPercentage)}
              style={{
                background: "transparent",
                border: "none",
                color: "#8b92a7",
                cursor: "pointer",
                padding: "0.25rem",
                fontSize: "0.875rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#8b92a7";
              }}
            >
              1D ▼
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          {[
            {
              icon: "↑",
              label: "Send",
              tooltip: "Send tokens to another address",
            },
            {
              icon: "↓",
              label: "Receive",
              tooltip: "Receive tokens to your wallet",
            },
            { icon: "🔄", label: "Swap", tooltip: "Exchange tokens instantly" },
            {
              icon: "📜",
              label: "History",
              tooltip: "View transaction history",
            },
            { icon: "⋯", label: "More", tooltip: "More options and settings" },
          ].map((action) => (
            <button
              key={action.label}
              title={action.tooltip}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "1rem 0.5rem",
                cursor: "pointer",
                color: "white",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.125rem",
                }}
              >
                {action.icon}
              </div>
              <span style={{ fontSize: "0.75rem", color: "#b8bcc8" }}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "2rem",
          padding: "0 1.5rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          marginBottom: "1rem",
        }}
      >
        {[
          { id: "crypto" as TabType, label: "Crypto" },
          { id: "defi" as TabType, label: "DeFi" },
          { id: "nft" as TabType, label: "NFT" },
          { id: "approvals" as TabType, label: "Approvals" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "transparent",
              border: "none",
              color: activeTab === tab.id ? "white" : "#8b92a7",
              fontSize: "0.9375rem",
              fontWeight: activeTab === tab.id ? "600" : "400",
              padding: "1rem 0",
              cursor: "pointer",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid white"
                  : "2px solid transparent",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Token List */}
      {activeTab === "crypto" && (
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <LoadingSpinner />
              <p style={{ marginTop: "1rem", color: "#8b92a7" }}>
                Loading assets...
              </p>
            </div>
          ) : displayTokens.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "#8b92a7",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
              <p>No tokens found in this wallet</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {displayTokens.map((token, idx) => (
                <button
                  key={`${token.network}-${token.tokenSymbol}-${idx}`}
                  title={`View ${token.tokenSymbol} details`}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "12px",
                    padding: "1rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    transition: "all 0.2s",
                    color: "white",
                    textAlign: "left",
                    opacity: token.usdValue === 0 ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.03)";
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.opacity =
                      token.usdValue === 0 ? "0.6" : "1";
                  }}
                >
                  {/* Token Icon */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "#1a1f2e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <img
                      src={token.tokenLogo}
                      alt={token.tokenSymbol}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        // Fallback to gradient background with first letter
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          parent.style.background =
                            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                          parent.innerHTML = `<span style="color: white; font-weight: 600; font-size: 1rem;">${token.tokenSymbol.charAt(
                            0
                          )}</span>`;
                        }
                      }}
                    />
                  </div>

                  {/* Token Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "1rem",
                          fontWeight: "600",
                        }}
                      >
                        {token.tokenSymbol}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          padding: "0.125rem 0.375rem",
                          borderRadius: "0.25rem",
                          background: "rgba(59, 130, 246, 0.1)",
                          color: "#60a5fa",
                          fontWeight: "500",
                        }}
                      >
                        {token.networkLabel}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#8b92a7",
                        marginBottom: "0.125rem",
                      }}
                    >
                      {token.tokenName}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "#6b7280",
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {token.tokenAddress.slice(0, 6)}...
                      {token.tokenAddress.slice(-4)}
                    </div>
                  </div>

                  {/* Token Balance */}
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: "600",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {formatUSD(token.usdValue)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: token.usdValue > 0 ? "#34c759" : "#8b92a7",
                      }}
                    >
                      {formatBalance(token.balance)} {token.tokenSymbol}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DeFi Tab */}
      {activeTab === "defi" && (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1.5rem",
            color: "#8b92a7",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏦</div>
          <p
            style={{
              marginBottom: "0.5rem",
              fontWeight: "600",
              color: "white",
            }}
          >
            DeFi Coming Soon
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            View your DeFi positions, staking, and lending protocols
          </p>
        </div>
      )}

      {/* NFT Tab */}
      {activeTab === "nft" && (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1.5rem",
            color: "#8b92a7",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🖼️</div>
          <p
            style={{
              marginBottom: "0.5rem",
              fontWeight: "600",
              color: "white",
            }}
          >
            NFT Gallery Coming Soon
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            Browse and manage your NFT collection
          </p>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1.5rem",
            color: "#8b92a7",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
          <p
            style={{
              marginBottom: "0.5rem",
              fontWeight: "600",
              color: "white",
            }}
          >
            Token Approvals Coming Soon
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            Review and revoke token approvals for security
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            margin: "1rem 1.5rem",
            padding: "1rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "12px",
            color: "#ef4444",
            fontSize: "0.875rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
