/**
 * Wallet Detail View - Asset-first display with multi-chain token balances
 * Feature: Asset management with Alchemy API integration + CoinGecko Token Lists
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useAppPassword } from "@/contexts/AppPasswordContext";
import { useWalletSessionStore } from "@/stores/walletSessionStore";
import tauriApi, { type AppError } from "@/services/tauri-api";
import type { TokenBalance, TokenBalancesResponse } from "@/types/tokens";
import type { Wallet } from "@/types/wallet";
import type { Address } from "@/types/address";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { normalizeTokenForDisplay } from "@/constants/commonTokens";
import {
  getNativeToken,
  isNativeTokenAddress,
  getNetworkKey,
} from "@/constants/nativeTokens";
import { usePriorityTokens, useAllTokens } from "@/hooks/useTokenList";
import type { ChainKey } from "@/services/tokenList";
import { TransactionHistory } from "@/components/TransactionHistory";
import { SendTransaction, type SendableToken } from "@/components/SendTransaction";
import SwapTransaction from "@/components/SwapTransaction";
import { getChainIconUrl, getChainFallbackIcon, isChainSupported, CHAIN_CATEGORIES } from "@/utils/chainIcons";
import ReceiveAddressModal from "@/components/ReceiveAddressModal";

type TabType = "crypto" | "defi" | "nft" | "approvals";

// Map network labels to Alchemy network IDs (used in History feature)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NETWORK_TO_ALCHEMY: Record<string, string> = {
  Ethereum: "eth-mainnet",
  Polygon: "polygon-mainnet",
  Arbitrum: "arbitrum-mainnet",
  Optimism: "optimism-mainnet",
  Base: "base-mainnet",
  "BNB Chain": "bnb-mainnet",
};
void NETWORK_TO_ALCHEMY; // Suppress unused warning temporarily

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
  onViewAddresses: _onViewAddresses,
}: WalletDetailProps) {
  void _onViewAddresses; // Suppress unused variable warning
  const { appPassword } = useAppPassword();
  const walletSession = useWalletSessionStore();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet session state (replaces password state)
  const [tempPassword, setTempPassword] = useState(""); // Only used during unlock, immediately discarded
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true);
  // Temporary password ref for operations that still require password
  // TODO: Migrate all APIs to use session tokens, then remove this ref
  const passwordRef = useRef<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("crypto");
  const [showPercentage, setShowPercentage] = useState(true);

  // Passphrase validation state (for wallets with BIP39 passphrase)
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [validatedPassphrase, setValidatedPassphrase] = useState<string | null>(null);
  const [isValidatingPassphrase, setIsValidatingPassphrase] = useState(false);

  // Transaction History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyAddress, setHistoryAddress] = useState("");
  const [historyNetwork, setHistoryNetwork] = useState("eth-mainnet");
  // Store wallet addresses from AddressBook (loaded when unlocking wallet)
  const [walletAddresses, setWalletAddresses] = useState<Address[]>([]);
  // Address List modal state (for Copy Address feature)
  const [showAddressList, setShowAddressList] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  // Receive modal state
  const [receiveAddress, setReceiveAddress] = useState<Address | null>(null);
  // Chain icon error state
  const [iconErrors, setIconErrors] = useState<Set<string>>(new Set());

  // Send Transaction state
  const [showSendTransaction, setShowSendTransaction] = useState(false);

  // Swap Transaction state
  const [showSwapTransaction, setShowSwapTransaction] = useState(false);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load priority tokens from CoinGecko token lists
  const { tokens: priorityTokens, isLoading: isLoadingPriority } =
    usePriorityTokens();

  // Load ALL tokens from local token lists for logo lookup (supports BSC, etc.)
  // This loads the complete token lists, not just top N
  const { tokens: allTokensByChain } = useAllTokens();

  // Check if wallet already has a valid session on mount
  useEffect(() => {
    if (walletSession.isWalletSessionValid(wallet.id)) {
      console.log("🔐 [WalletDetail] Valid session found, skipping password prompt");
      setShowPasswordPrompt(false);
      // Auto-load balances if session exists
      handleRefreshBalances();
    }
  }, [wallet.id]);

  const handleLoadBalances = async () => {
    if (!tempPassword || !appPassword) {
      setError("Please enter wallet password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🚀 Starting wallet unlock...", {
        walletId: wallet.id,
        usbPath,
        hasPassword: !!tempPassword,
        hasAppPassword: !!appPassword,
      });

      // Store password in local variable for this function scope
      const passwordForThisUnlock = tempPassword;

      // Create wallet session token (this validates the password)
      console.log("🔐 Creating wallet session token...");
      await walletSession.createWalletSession(wallet.id, passwordForThisUnlock, usbPath);
      console.log("✅ Wallet session created successfully");

      // Store password in ref for operations that still need it
      // TODO: Remove this when all APIs migrate to session tokens
      passwordRef.current = passwordForThisUnlock;

      // Password validated and token created, clear from state immediately
      setTempPassword("");

      // First, load wallet addresses from AddressBook
      // Note: Still using password for this initial unlock, but it's the last time
      console.log("📍 Loading wallet addresses...");
      const addressResponse = await tauriApi.loadAddresses({
        wallet_id: wallet.id,
        password: passwordForThisUnlock,
        usb_path: usbPath,
      });
      console.log("📍 Loaded addresses:", addressResponse.addresses.length);
      setWalletAddresses(addressResponse.addresses);

      // Check if wallet has passphrase - if so, prompt for it before continuing
      if (wallet.has_passphrase && !validatedPassphrase) {
        console.log("🔐 Wallet has passphrase - prompting user for passphrase...");
        setShowPasswordPrompt(false);
        setShowPassphrasePrompt(true);
        setIsLoading(false);
        return; // Exit here - user will enter passphrase and call handleValidatePassphrase
      }

      // Then load token balances
      // In dev mode, also include testnet balances (Sepolia)
      const includeTestnets = import.meta.env.DEV;
      console.log("🚀 Starting getTokenBalances request...", { includeTestnets });
      const response: TokenBalancesResponse = await tauriApi.getTokenBalances({
        walletId: wallet.id,
        password: passwordForThisUnlock, // Using local variable
        usbPath,
        appPassword,
        includeTestnets,
      });

      console.log("📡 Alchemy API Response (RAW):", response);
      console.log("📊 Response Details:", {
        totalTokens: response?.tokens?.length || 0,
        totalUsd: response?.totalUsd || 0,
        tokensIsArray: Array.isArray(response?.tokens),
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
      });

      // Log each token in detail
      if (response?.tokens && Array.isArray(response.tokens)) {
        if (response.tokens.length === 0) {
          console.warn("⚠️ No tokens returned from Alchemy API");
        }
        response.tokens.forEach((token, idx) => {
          console.log(`🪙 Token ${idx + 1}:`, {
            symbol: token.tokenSymbol,
            name: token.tokenName,
            network: token.network,
            networkLabel: token.networkLabel,
            address: token.tokenAddress,
            balance: token.balance,
            usdValue: token.usdValue,
            logo: token.tokenLogo,
          });
        });

        // Pre-process: Enrich native tokens with metadata before setting state
        // This ensures native tokens have proper symbol/name even if Alchemy returns empty
        response.tokens.forEach((token) => {
          const networkKey = getNetworkKey(token.networkLabel || token.network);
          if (networkKey && isNativeTokenAddress(token.tokenAddress)) {
            const nativeToken = getNativeToken(networkKey);
            if (nativeToken && !token.tokenSymbol) {
              console.log(`🔧 Pre-enriching native token for ${networkKey}:`, {
                before: { symbol: token.tokenSymbol, name: token.tokenName },
                after: { symbol: nativeToken.symbol, name: nativeToken.name },
              });
              token.tokenSymbol = nativeToken.symbol;
              token.tokenName = nativeToken.name;
              token.tokenLogo = nativeToken.logoURI;
            }
          }
        });
      } else {
        console.error("❌ Invalid tokens data:", response?.tokens);
      }

      setTokens(response.tokens);
      setTotalUsd(response.totalUsd);
      setShowPasswordPrompt(false);
    } catch (err) {
      const error = err as AppError;
      setError(error.message || "Failed to load token balances");
      console.error("❌ Failed to load token balances:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle passphrase validation for wallets with BIP39 passphrase
  const handleValidatePassphrase = async () => {
    if (!passphrase || !appPassword) {
      setError("Please enter your BIP39 passphrase");
      return;
    }

    setIsValidatingPassphrase(true);
    setError(null);

    try {
      console.log("🔐 Validating passphrase for wallet:", wallet.id);
      const result = await tauriApi.validatePassphrase({
        walletId: wallet.id,
        password: passwordRef.current,
        passphrase,
        usbPath,
      });

      console.log("🔐 Passphrase validation result:", result);

      if (result.valid) {
        console.log("✅ Passphrase is valid! Derived address matches stored address.");
        setValidatedPassphrase(passphrase);
        setShowPassphrasePrompt(false);

        // Now continue with loading token balances
        setIsLoading(true);
        const includeTestnets = import.meta.env.DEV;
        console.log("🚀 Continuing with getTokenBalances...", { includeTestnets });
        const response: TokenBalancesResponse = await tauriApi.getTokenBalances({
          walletId: wallet.id,
          password: passwordRef.current,
          usbPath,
          appPassword,
          includeTestnets,
        });

        console.log("📡 Alchemy API Response (RAW):", response);

        // Pre-process tokens (same as in handleLoadBalances)
        if (response?.tokens && Array.isArray(response.tokens)) {
          response.tokens.forEach((token) => {
            const networkKey = getNetworkKey(token.networkLabel || token.network);
            if (networkKey && isNativeTokenAddress(token.tokenAddress)) {
              const nativeToken = getNativeToken(networkKey);
              if (nativeToken && !token.tokenSymbol) {
                token.tokenSymbol = nativeToken.symbol;
                token.tokenName = nativeToken.name;
                token.tokenLogo = nativeToken.logoURI;
              }
            }
          });
        }

        setTokens(response.tokens);
        setTotalUsd(response.totalUsd);
      } else {
        console.log("❌ Passphrase is invalid!");
        console.log("   Expected address:", result.expectedAddress);
        console.log("   Derived address:", result.derivedAddress);
        setError("Invalid passphrase. The derived address does not match your wallet address.");
      }
    } catch (err) {
      const error = err as AppError;
      setError(error.message || "Failed to validate passphrase");
      console.error("❌ Failed to validate passphrase:", error);
    } finally {
      setIsValidatingPassphrase(false);
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

    // Truncate instead of rounding (floor to N decimal places)
    const truncate = (n: number, decimals: number): string => {
      const factor = Math.pow(10, decimals);
      return (Math.floor(n * factor) / factor).toFixed(decimals);
    };

    if (num < 0.000001) return truncate(num, 10);
    if (num < 0.01) return truncate(num, 8);
    if (num < 1000) return truncate(num, 6);
    return truncate(num, 4);
  };

  // Refresh token balances
  const handleRefreshBalances = async () => {
    if (!passwordRef.current || !appPassword) {
      console.warn("Cannot refresh: missing password or appPassword");
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      console.log("🔄 Refreshing token balances...");
      const includeTestnets = import.meta.env.DEV;
      const response: TokenBalancesResponse = await tauriApi.getTokenBalances({
        walletId: wallet.id,
        password: passwordRef.current,
        usbPath,
        appPassword,
        includeTestnets,
      });

      console.log("📡 Refresh complete:", response.tokens.length, "tokens");

      // Pre-process tokens with native token metadata
      if (response?.tokens && Array.isArray(response.tokens)) {
        response.tokens.forEach((token) => {
          const networkKey = getNetworkKey(token.networkLabel || token.network);
          if (networkKey && isNativeTokenAddress(token.tokenAddress)) {
            const nativeToken = getNativeToken(networkKey);
            if (nativeToken && !token.tokenSymbol) {
              token.tokenSymbol = nativeToken.symbol;
              token.tokenName = nativeToken.name;
              token.tokenLogo = nativeToken.logoURI;
            }
          }
        });
      }

      setTokens(response.tokens);
      setTotalUsd(response.totalUsd);
    } catch (err) {
      const error = err as AppError;
      setError(error.message || "Failed to refresh token balances");
      console.error("❌ Failed to refresh token balances:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  // Merge user tokens with priority tokens from CoinGecko lists
  const displayTokens = useMemo(() => {
    const tokenMap = new Map<string, TokenBalance>();

    console.log("🔄 Processing tokens:", tokens.length, "tokens");
    console.log(
      "🔍 Sepolia tokens in input:",
      tokens.filter((t) => t.network.includes("sepolia"))
    );

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

      // PRIORITY: Use local token-list logo over Alchemy's response
      // Only fallback to Alchemy's logo if local token-list doesn't have it
      if (token.tokenAddress && allTokensByChain.size > 0) {
        // Map networkLabel to chain key
        const chainKeyMap: Record<string, ChainKey> = {
          "Ethereum": "ethereum",
          "BNB Chain": "bsc",
          "Polygon": "polygon",
          "Arbitrum": "arbitrum",
          "Optimism": "optimism",
          "Base": "base",
        };
        const chainKey = chainKeyMap[token.networkLabel];
        if (chainKey) {
          const chainTokens = allTokensByChain.get(chainKey);
          if (chainTokens) {
            const matchedToken = chainTokens.find(
              (t) => t.address.toLowerCase() === token.tokenAddress.toLowerCase()
            );
            if (matchedToken?.logoURI) {
              // Always use local token-list logo (priority over Alchemy)
              token.tokenLogo = matchedToken.logoURI;
            }
          }
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

    const result = Array.from(tokenMap.values()).sort((a, b) => {
      // Sort by value (highest first)
      if (b.usdValue !== a.usdValue) {
        return b.usdValue - a.usdValue;
      }
      // When value is same, sort by balance (highest first)
      const balanceA = parseFloat(a.balance) || 0;
      const balanceB = parseFloat(b.balance) || 0;
      if (balanceB !== balanceA) {
        return balanceB - balanceA;
      }
      // Finally sort by symbol
      return a.tokenSymbol.localeCompare(b.tokenSymbol);
    });

    console.log("📊 Final displayTokens:", result.length, "tokens");
    console.log(
      "🔍 Sepolia in final result:",
      result.filter((t) => t.network.includes("sepolia"))
    );

    return result;
  }, [tokens, priorityTokens, isLoadingPriority, allTokensByChain]);

  // Group tokens by network (prepared for future use in network grouping view)
  const _tokensByNetwork = displayTokens.reduce((acc, token) => {
    if (!acc[token.networkLabel]) {
      acc[token.networkLabel] = [];
    }
    acc[token.networkLabel].push(token);
    return acc;
  }, {} as Record<string, TokenBalance[]>);
  void _tokensByNetwork; // Suppress unused variable warning

  // Convert tokens to SendableToken format for SendTransaction
  // IMPORTANT: This must be before any conditional returns to follow React Hooks rules
  const availableTokensForSend = useMemo((): SendableToken[] => {
    // Filter tokens with balance > 0
    const tokensWithBalance = tokens.filter((t) => {
      const balance = parseFloat(t.balance);
      return balance > 0;
    });

    // Convert to SendableToken format
    return tokensWithBalance.map((token) => ({
      network: token.network,
      networkLabel: token.networkLabel,
      tokenAddress: token.tokenAddress || "",
      tokenSymbol: token.tokenSymbol,
      tokenName: token.tokenName,
      tokenLogo: token.tokenLogo,
      balance: token.balance,
      usdValue: token.usdValue,
      decimals: token.decimals,
      fromAddress: token.address, // The wallet address for this token's network
    }));
  }, [tokens]);

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
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
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

  // Show passphrase prompt for wallets with BIP39 passphrase
  if (showPassphrasePrompt) {
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
              Enter Passphrase
            </h3>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "#6b7280",
                lineHeight: "1.5",
              }}
            >
              This wallet uses a BIP39 passphrase (25th word).
              <br />
              Please enter it to continue.
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
              htmlFor="passphrase"
              style={{
                display: "block",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "0.5rem",
              }}
            >
              BIP39 Passphrase
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
                placeholder="Enter your passphrase"
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
              The passphrase is case-sensitive and used during wallet creation.
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
                Validating...
              </span>
            ) : (
              "Verify & Continue"
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
            ← Back to password
          </button>
        </div>
      </div>
    );
  }

  // Show Transaction History view
  console.log("🔍 [WalletDetail] Checking showHistory condition:", {
    showHistory,
    historyAddress,
    hasAppPassword: !!appPassword,
    shouldShowHistory: showHistory && historyAddress && appPassword,
  });

  if (showHistory && historyAddress && appPassword) {
    console.log("✅ [WalletDetail] Rendering TransactionHistory component");
    return (
      <TransactionHistory
        address={historyAddress}
        network={historyNetwork}
        password={appPassword}
        usbPath={usbPath}
        onBack={() => setShowHistory(false)}
      />
    );
  }

  // Show Send Transaction view
  if (showSendTransaction && appPassword) {
    console.log("💸 [WalletDetail] Rendering SendTransaction component with", availableTokensForSend.length, "tokens");
    return (
      <SendTransaction
        walletId={wallet.id}
        walletHasPassphrase={wallet.has_passphrase}
        walletPassphrase={validatedPassphrase || undefined}
        availableTokens={availableTokensForSend}
        usbPath={usbPath}
        appPassword={appPassword}
        onBack={() => setShowSendTransaction(false)}
        onSuccess={(txHash) => {
          console.log("✅ Transaction submitted:", txHash);
        }}
      />
    );
  }

  // Show Swap Transaction view
  if (showSwapTransaction && appPassword) {
    console.log("🔄 [WalletDetail] Rendering SwapTransaction component with", availableTokensForSend.length, "tokens");
    return (
      <SwapTransaction
        walletId={wallet.id}
        walletHasPassphrase={wallet.has_passphrase}
        walletPassphrase={validatedPassphrase || undefined}
        availableTokens={availableTokensForSend}
        usbPath={usbPath}
        appPassword={appPassword}
        onBack={() => {
          setShowSwapTransaction(false);
          // Refresh balances after returning from swap
          handleRefreshBalances();
        }}
        onSuccess={(txHash) => {
          console.log("✅ Swap transaction submitted:", txHash);
          // Refresh balances after successful swap
          handleRefreshBalances();
        }}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#1e293b",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header with Account Info */}
      <div
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
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
                  color: "#1e293b",
                }}
              >
                {wallet.name}
              </h3>
              <button
                title="Switch Wallet"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  padding: "0.25rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#1e293b";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#64748b";
                }}
              >
                ▼
              </button>
            </div>
            <div
              style={{
                fontSize: "0.8125rem",
                color: "#64748b",
              }}
            >
              Wallet 01
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem" }}>
            <button
              title="Copy Address"
              onClick={() => setShowAddressList(true)}
              style={{
                background: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.5rem",
                cursor: "pointer",
                color: "#1e293b",
                fontSize: "1rem",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              📋
            </button>
            <button
              title="Refresh Balances"
              onClick={handleRefreshBalances}
              disabled={isRefreshing}
              style={{
                background: "transparent",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.5rem",
                cursor: isRefreshing ? "not-allowed" : "pointer",
                color: "#1e293b",
                fontSize: "1rem",
                opacity: isRefreshing ? 0.6 : 1,
                animation: isRefreshing ? "spin 1s linear infinite" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isRefreshing) e.currentTarget.style.background = "#f1f5f9";
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
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0.5rem",
                cursor: "pointer",
                color: "#1e293b",
                fontSize: "1rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
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
              color: "#1e293b",
            }}
          >
            {formatUSD(totalUsd)}
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: showPercentage ? "#22c55e" : "#64748b",
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
                color: "#64748b",
                cursor: "pointer",
                padding: "0.25rem",
                fontSize: "0.875rem",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#1e293b";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#64748b";
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
              onClick: () => {
                console.log("💸 [Send] Button clicked, available tokens:", availableTokensForSend.length);
                if (availableTokensForSend.length > 0) {
                  setShowSendTransaction(true);
                } else {
                  alert("No tokens with balance available to send. Please load your token balances first.");
                }
              },
            },
            {
              icon: "↓",
              label: "Receive",
              tooltip: "Receive tokens to your wallet",
              onClick: () => setShowAddressList(true),
            },
            { icon: "🔄", label: "Swap", tooltip: "Exchange tokens instantly", onClick: () => {
                console.log("🔄 [Swap] Button clicked, available tokens:", availableTokensForSend.length);
                if (availableTokensForSend.length > 0) {
                  setShowSwapTransaction(true);
                } else {
                  alert("No tokens with balance available to swap. Please load your token balances first.");
                }
              } },
            {
              icon: "📜",
              label: "History",
              tooltip: "View transaction history",
              onClick: () => {
                console.log("📜 [History] Button clicked, walletAddresses:", walletAddresses.length);
                // Get first EVM address (coin_type 60 = Ethereum compatible)
                // EVM addresses start with 0x and are used for ETH, Polygon, Arbitrum, etc.
                const evmAddress = walletAddresses.find(
                  (addr) => addr.coin_type === 60 && !addr.is_testnet
                );
                console.log("📜 [History] Found EVM address:", evmAddress);
                if (evmAddress) {
                  setHistoryAddress(evmAddress.address);
                  setHistoryNetwork("eth-mainnet");
                  setShowHistory(true);
                } else {
                  // Try to find any address that looks like EVM (starts with 0x)
                  const anyEvmAddress = walletAddresses.find(
                    (addr) => addr.address.startsWith("0x") && !addr.is_testnet
                  );
                  if (anyEvmAddress) {
                    console.log("📜 [History] Using fallback EVM address:", anyEvmAddress);
                    setHistoryAddress(anyEvmAddress.address);
                    setHistoryNetwork("eth-mainnet");
                    setShowHistory(true);
                  } else {
                    alert("No EVM address found. Transaction history requires an Ethereum-compatible address (0x...).");
                  }
                }
              },
            },
            { icon: "⋯", label: "More", tooltip: "More options and settings", onClick: () => {} },
          ].map((action) => (
            <button
              key={action.label}
              title={action.tooltip}
              onClick={action.onClick}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "1rem 0.5rem",
                cursor: "pointer",
                color: "#1e293b",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.125rem",
                }}
              >
                {action.icon}
              </div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
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
          borderBottom: "1px solid #e2e8f0",
          marginBottom: "1rem",
          background: "#ffffff",
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
              color: activeTab === tab.id ? "#1e293b" : "#64748b",
              fontSize: "0.9375rem",
              fontWeight: activeTab === tab.id ? "600" : "400",
              padding: "1rem 0",
              cursor: "pointer",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid #3b82f6"
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
              <p style={{ marginTop: "1rem", color: "#64748b" }}>
                Loading assets...
              </p>
            </div>
          ) : displayTokens.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "#64748b",
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
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "1rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    transition: "all 0.2s",
                    color: "#1e293b",
                    textAlign: "left",
                    opacity: token.usdValue === 0 ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
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
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
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
                          color: "#1e293b",
                        }}
                      >
                        {token.tokenSymbol}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          padding: "0.125rem 0.375rem",
                          borderRadius: "0.25rem",
                          background: token.network.includes("sepolia")
                            ? "#fef3c7"
                            : "#dbeafe",
                          color: token.network.includes("sepolia")
                            ? "#d97706"
                            : "#2563eb",
                          fontWeight: "500",
                        }}
                      >
                        {token.network.includes("sepolia") && "🧪 "}
                        {token.networkLabel}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        marginBottom: "0.125rem",
                      }}
                    >
                      {token.tokenName}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "#94a3b8",
                        fontFamily: "monospace",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={`Wallet: ${token.address}`}
                      >
                        💼 {token.address.slice(0, 6)}...
                        {token.address.slice(-4)}
                      </div>
                      {token.tokenAddress &&
                        token.tokenAddress !==
                          "0x0000000000000000000000000000000000000000" && (
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={`Contract: ${token.tokenAddress}`}
                          >
                            📜 {token.tokenAddress.slice(0, 6)}...
                            {token.tokenAddress.slice(-4)}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Token Balance */}
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: "600",
                        marginBottom: "0.25rem",
                        color: "#1e293b",
                      }}
                    >
                      {formatUSD(token.usdValue)}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        color: token.usdValue > 0 ? "#22c55e" : "#64748b",
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
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏦</div>
          <p
            style={{
              marginBottom: "0.5rem",
              fontWeight: "600",
              color: "#1e293b",
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
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🖼️</div>
          <p
            style={{
              marginBottom: "0.5rem",
              fontWeight: "600",
              color: "#1e293b",
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
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
          <p
            style={{
              marginBottom: "0.5rem",
              fontWeight: "600",
              color: "#1e293b",
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

      {/* Address List Modal with Blockchain Logos and Categorization */}
      {showAddressList && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowAddressList(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "90%",
              maxWidth: "650px",
              maxHeight: "85vh",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1.5rem",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.25rem",
                    fontWeight: "600",
                    color: "#1e293b",
                  }}
                >
                  Wallet Addresses
                </h3>
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    fontSize: "0.875rem",
                    color: "#64748b",
                  }}
                >
                  {wallet.name} • {walletAddresses.filter(a => !a.is_testnet).length} addresses
                </p>
              </div>
              <button
                onClick={() => setShowAddressList(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "0.5rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Address List with Categories */}
            <div
              style={{
                maxHeight: "70vh",
                overflowY: "auto",
              }}
            >
              {walletAddresses.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#64748b",
                  }}
                >
                  <p>No addresses loaded. Please unlock the wallet first.</p>
                </div>
              ) : (
                <>
                  {/* Supported Chains Section */}
                  {(() => {
                    const supportedAddrs = walletAddresses.filter(
                      (addr) => !addr.is_testnet && isChainSupported(addr.symbol)
                    );
                    if (supportedAddrs.length === 0) return null;
                    return (
                      <div>
                        <div
                          style={{
                            padding: "0.75rem 1.5rem",
                            background: "#f0fdf4",
                            borderBottom: "1px solid #bbf7d0",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#16a34a" }}>✓</span>
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: "600",
                              color: "#15803d",
                            }}
                          >
                            {CHAIN_CATEGORIES.SUPPORTED} ({supportedAddrs.length})
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#22c55e",
                              marginLeft: "0.5rem",
                            }}
                          >
                            Full transaction support
                          </span>
                        </div>
                        <div style={{ padding: "0.5rem" }}>
                          {supportedAddrs.map((addr) => (
                            <div
                              key={`${addr.symbol}-${addr.address}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "1rem",
                                padding: "0.875rem 1rem",
                                background:
                                  copiedAddress === addr.address
                                    ? "#dcfce7"
                                    : "transparent",
                                borderRadius: "12px",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                if (copiedAddress !== addr.address) {
                                  e.currentTarget.style.background = "#f1f5f9";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (copiedAddress !== addr.address) {
                                  e.currentTarget.style.background = "transparent";
                                }
                              }}
                            >
                              {/* Chain Icon */}
                              <div
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: iconErrors.has(addr.symbol) ? getChainFallbackIcon(addr.symbol) : "#f1f5f9",
                                }}
                              >
                                {iconErrors.has(addr.symbol) ? (
                                  <span style={{ color: "white", fontWeight: "600", fontSize: "0.875rem" }}>
                                    {addr.symbol.slice(0, 2)}
                                  </span>
                                ) : (
                                  <img
                                    src={getChainIconUrl(addr.symbol)}
                                    alt={addr.symbol}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={() => {
                                      setIconErrors(prev => new Set(prev).add(addr.symbol));
                                    }}
                                  />
                                )}
                              </div>

                              {/* Chain Info */}
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
                                      color: "#1e293b",
                                    }}
                                  >
                                    {addr.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      padding: "0.125rem 0.375rem",
                                      borderRadius: "0.25rem",
                                      background: "#dcfce7",
                                      color: "#15803d",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {addr.symbol}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#64748b",
                                    fontFamily: "monospace",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {addr.address}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                  onClick={() => handleCopyAddress(addr.address)}
                                  title="Copy address"
                                  style={{
                                    background: copiedAddress === addr.address ? "#dcfce7" : "#f1f5f9",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "0.5rem",
                                    cursor: "pointer",
                                    color: copiedAddress === addr.address ? "#16a34a" : "#64748b",
                                    fontSize: "1rem",
                                    transition: "all 0.2s",
                                  }}
                                >
                                  {copiedAddress === addr.address ? "✓" : "📋"}
                                </button>
                                <button
                                  onClick={() => setReceiveAddress(addr)}
                                  title="Show QR Code"
                                  style={{
                                    background: "#f1f5f9",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "0.5rem",
                                    cursor: "pointer",
                                    color: "#1e293b",
                                    fontSize: "1rem",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="7" rx="1" />
                                    <rect x="14" y="3" width="7" height="7" rx="1" />
                                    <rect x="3" y="14" width="7" height="7" rx="1" />
                                    <rect x="14" y="14" width="3" height="3" />
                                    <rect x="18" y="14" width="3" height="3" />
                                    <rect x="14" y="18" width="3" height="3" />
                                    <rect x="18" y="18" width="3" height="3" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Other Chains Section */}
                  {(() => {
                    const unsupportedAddrs = walletAddresses.filter(
                      (addr) => !addr.is_testnet && !isChainSupported(addr.symbol)
                    );
                    if (unsupportedAddrs.length === 0) return null;
                    return (
                      <div>
                        <div
                          style={{
                            padding: "0.75rem 1.5rem",
                            background: "#f8fafc",
                            borderBottom: "1px solid #e2e8f0",
                            borderTop: "1px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#64748b" }}>📦</span>
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: "600",
                              color: "#475569",
                            }}
                          >
                            {CHAIN_CATEGORIES.UNSUPPORTED} ({unsupportedAddrs.length})
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#94a3b8",
                              marginLeft: "0.5rem",
                            }}
                          >
                            Address only
                          </span>
                        </div>
                        {/* Disclaimer for Other Chains */}
                        <div
                          style={{
                            padding: "0.75rem 1.5rem",
                            background: "#fef3c7",
                            borderBottom: "1px solid #fcd34d",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#d97706", flexShrink: 0 }}>⚠️</span>
                          <div style={{ fontSize: "0.75rem", color: "#92400e", lineHeight: "1.4" }}>
                            <strong>Disclaimer:</strong> These addresses are derived using standard BIP-44 paths but have NOT been fully verified for compatibility with each blockchain's native wallet format.
                            Use at your own risk. We recommend verifying addresses with official tools before depositing significant funds.
                            <br />
                            <span style={{ color: "#b45309", fontStyle: "italic" }}>
                              Full transaction support for these chains is planned for future releases.
                            </span>
                          </div>
                        </div>
                        <div style={{ padding: "0.5rem" }}>
                          {unsupportedAddrs.map((addr) => (
                            <div
                              key={`${addr.symbol}-${addr.address}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "1rem",
                                padding: "0.875rem 1rem",
                                background:
                                  copiedAddress === addr.address
                                    ? "#dcfce7"
                                    : "transparent",
                                borderRadius: "12px",
                                transition: "all 0.2s",
                              }}
                              onMouseEnter={(e) => {
                                if (copiedAddress !== addr.address) {
                                  e.currentTarget.style.background = "#f1f5f9";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (copiedAddress !== addr.address) {
                                  e.currentTarget.style.background = "transparent";
                                }
                              }}
                            >
                              {/* Chain Icon */}
                              <div
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: iconErrors.has(addr.symbol) ? getChainFallbackIcon(addr.symbol) : "#f1f5f9",
                                }}
                              >
                                {iconErrors.has(addr.symbol) ? (
                                  <span style={{ color: "white", fontWeight: "600", fontSize: "0.875rem" }}>
                                    {addr.symbol.slice(0, 2)}
                                  </span>
                                ) : (
                                  <img
                                    src={getChainIconUrl(addr.symbol)}
                                    alt={addr.symbol}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={() => {
                                      setIconErrors(prev => new Set(prev).add(addr.symbol));
                                    }}
                                  />
                                )}
                              </div>

                              {/* Chain Info */}
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
                                      color: "#1e293b",
                                    }}
                                  >
                                    {addr.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "0.6875rem",
                                      padding: "0.125rem 0.375rem",
                                      borderRadius: "0.25rem",
                                      background: "#e2e8f0",
                                      color: "#475569",
                                      fontWeight: "500",
                                    }}
                                  >
                                    {addr.symbol}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#64748b",
                                    fontFamily: "monospace",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {addr.address}
                                </div>
                              </div>

                              {/* Copy Button Only */}
                              <button
                                onClick={() => handleCopyAddress(addr.address)}
                                title="Copy address"
                                style={{
                                  background: copiedAddress === addr.address ? "#dcfce7" : "#f1f5f9",
                                  border: "none",
                                  borderRadius: "8px",
                                  padding: "0.5rem",
                                  cursor: "pointer",
                                  color: copiedAddress === addr.address ? "#16a34a" : "#64748b",
                                  fontSize: "1rem",
                                  transition: "all 0.2s",
                                }}
                              >
                                {copiedAddress === addr.address ? "✓" : "📋"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receive Address Modal with QR Code */}
      {receiveAddress && (
        <ReceiveAddressModal
          address={receiveAddress}
          onClose={() => setReceiveAddress(null)}
          onCopy={(address, _symbol) => {
            handleCopyAddress(address);
          }}
        />
      )}
    </div>
  );
}
