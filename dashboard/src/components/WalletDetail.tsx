/**
 * Wallet Detail View - Asset-first display with multi-chain token balances
 * Feature: Asset management with Alchemy API integration + CoinGecko Token Lists
 */

import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppPassword } from "@/contexts/AppPasswordContext";
import { useWalletSessionStore } from "@/stores/walletSessionStore";
import { useWalletConnect } from "@/contexts/WalletConnectContext";
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
// import { TransactionHistory } from "@/components/TransactionHistory"; // TODO: Re-enable when needed
import { SendTransaction, type SendableToken } from "@/components/SendTransaction";
import SwapTransaction from "@/components/SwapTransaction";
import StakingTransaction from "@/components/StakingTransaction";
import { getChainIconUrl, getChainFallbackIcon, isChainSupported, isChainEnabled } from "@/utils/chainIcons";
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
  const { t } = useTranslation();
  const { getSessionToken } = useAppPassword(); // ✅ Zero password storage!
  const walletSession = useWalletSessionStore();
  const walletConnect = useWalletConnect();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unknown token filter state (whitelist-based)
  const [showScamTokens, setShowScamTokens] = useState(false);

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

  // Staking Transaction state
  const [showStakingTransaction, setShowStakingTransaction] = useState(false);

  // More menu dropdown state
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load priority tokens from CoinGecko token lists
  const { tokens: priorityTokens, isLoading: isLoadingPriority } =
    usePriorityTokens();

  // Load ALL tokens from local token lists for logo lookup (supports BSC, etc.)
  // ✅ Only load AFTER wallet is unlocked (!showPasswordPrompt means unlocked)
  // This prevents unnecessary loading before user enters password
  const { tokens: allTokensByChain } = useAllTokens(!showPasswordPrompt);

  // NOTE: Removed session-based password skip logic
  // Security requirement: Always require password when entering wallet
  // Session is preserved for non-sensitive operations (future use)
  // but unlocking wallet always requires password verification

  const handleLoadBalances = async () => {
    if (!tempPassword || !getSessionToken()) {
      setError(t('walletDetail.pleaseEnterPassword'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🚀 Starting wallet unlock...", {
        walletId: wallet.id,
        usbPath,
        hasPassword: !!tempPassword,
        hasSessionToken: !!getSessionToken(),
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
        sessionToken: getSessionToken() || undefined, // ✅ Backend will decrypt provider key from session
        // ✅ No appPassword needed - zero password storage!
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
      const errorMessage = error.message || "";

      // Check for password-related errors and show user-friendly message
      if (errorMessage.includes("invalid wallet credentials") ||
          errorMessage.includes("Invalid wallet credentials") ||
          errorMessage.includes("Failed to create wallet session")) {
        setError(t("walletDetail.incorrectPassword"));
      } else {
        setError(errorMessage || t("walletDetail.failedToLoadBalances"));
      }
      console.error("❌ Failed to load token balances:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle passphrase validation for wallets with BIP39 passphrase
  const handleValidatePassphrase = async () => {
    if (!passphrase || !getSessionToken()) {
      setError(t('walletDetail.pleaseEnterPassphrase'));
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
          sessionToken: getSessionToken() || undefined, // ✅ Backend will decrypt provider key
          // ✅ No appPassword - zero password storage!
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
        setError(t('walletDetail.invalidPassphrase'));
      }
    } catch (err) {
      const error = err as AppError;
      setError(error.message || t('walletDetail.failedToValidatePassphrase'));
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
    if (!passwordRef.current || !getSessionToken()) {
      console.warn("Cannot refresh: missing password or sessionToken");
      setError(t('walletDetail.sessionExpired'));
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
        sessionToken: getSessionToken() || undefined, // ✅ Backend will decrypt provider key
        // ✅ No appPassword - zero password storage!
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
      setError(error.message || t('walletDetail.failedToRefresh'));
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

    // 🛡️ NEW STRATEGY: Whitelist-based filtering using CoinGecko token lists
    // Build whitelist: Create lookup map of all known legitimate tokens
    const knownTokenAddresses = new Map<string, { chainKey: ChainKey; symbol: string }>();

    // Map networkLabel to chain key
    const chainKeyMap: Record<string, ChainKey> = {
      "Ethereum": "ethereum",
      "BNB Chain": "bsc",
      "Polygon": "polygon",
      "Arbitrum": "arbitrum",
      "Optimism": "optimism",
      "Base": "base",
    };

    // Build whitelist from all known tokens across all chains
    // (Including CoinGecko lists + wrapped tokens whitelist loaded in useAllTokens)
    if (allTokensByChain.size > 0) {
      allTokensByChain.forEach((chainTokens, chainKey) => {
        chainTokens.forEach((knownToken) => {
          const key = `${chainKey}-${knownToken.address.toLowerCase()}`;
          knownTokenAddresses.set(key, { chainKey, symbol: knownToken.symbol });
        });
      });
      console.log(`🛡️ Loaded ${knownTokenAddresses.size} known tokens (CoinGecko + wrapped tokens whitelist)`);
    }

    // Track filtered tokens for UI
    const filteredUnknownTokens: TokenBalance[] = [];

    // Add all user tokens first (these have actual balances)
    // 🛡️ Only show tokens that are in the CoinGecko whitelist OR native tokens
    tokens.forEach((token) => {
      const tokenAddress = token.tokenAddress.toLowerCase();
      const networkKey = getNetworkKey(token.networkLabel);
      const chainKey = chainKeyMap[token.networkLabel];

      // ✅ Always allow native tokens (ETH, BNB, MATIC, etc.)
      const isNative = networkKey && isNativeTokenAddress(token.tokenAddress);

      // ✅ Check if token is in CoinGecko whitelist
      const whitelistKey = chainKey ? `${chainKey}-${tokenAddress}` : null;
      const isKnownToken = whitelistKey && knownTokenAddresses.has(whitelistKey);

      // 🛡️ Filter logic: Only show if native OR in whitelist (unless user wants to see all)
      const isUnknownToken = !isNative && !isKnownToken;

      if (isUnknownToken && !showScamTokens) {
        console.log(`🚫 Hiding unknown token: ${token.tokenSymbol} (${token.tokenName}) at ${tokenAddress}`);
        filteredUnknownTokens.push(token);
        return; // Skip this token
      }

      if (isUnknownToken && showScamTokens) {
        console.log(`⚠️ Showing unknown token (user enabled):`, {
          symbol: token.tokenSymbol,
          name: token.tokenName,
          address: tokenAddress,
          network: token.network,
          networkLabel: token.networkLabel,
        });
      }

      // Check if this is a native token and enrich with metadata
      // (networkKey already declared above, reuse it)

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
        // Reuse chainKey from above (already declared)
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

      // Debug: Log key for unknown tokens
      if (isUnknownToken) {
        console.log(`🔑 Adding unknown token to map with key: ${key}`);
        if (tokenMap.has(key)) {
          console.warn(`⚠️ Key collision detected! Overwriting existing token with key: ${key}`);
        }
      }

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
    console.log(`🛡️ Whitelist filter: ${filteredUnknownTokens.length} unknown tokens ${showScamTokens ? 'shown (user enabled)' : 'hidden'}`);

    return result;
  }, [tokens, priorityTokens, isLoadingPriority, allTokensByChain, showScamTokens]);

  // Group tokens by network (prepared for future use in network grouping view)
  const _tokensByNetwork = displayTokens.reduce((acc, token) => {
    if (!acc[token.networkLabel]) {
      acc[token.networkLabel] = [];
    }
    acc[token.networkLabel].push(token);
    return acc;
  }, {} as Record<string, TokenBalance[]>);
  void _tokensByNetwork; // Suppress unused variable warning

  // Calculate filtered unknown tokens count (whitelist-based)
  const filteredScamCount = useMemo(() => {
    // Map networkLabel to chain key
    const chainKeyMap: Record<string, ChainKey> = {
      "Ethereum": "ethereum",
      "BNB Chain": "bsc",
      "Polygon": "polygon",
      "Arbitrum": "arbitrum",
      "Optimism": "optimism",
      "Base": "base",
    };

    // Build whitelist from CoinGecko token lists
    const knownTokenAddresses = new Set<string>();
    if (allTokensByChain.size > 0) {
      allTokensByChain.forEach((chainTokens, chainKey) => {
        chainTokens.forEach((knownToken) => {
          knownTokenAddresses.add(`${chainKey}-${knownToken.address.toLowerCase()}`);
        });
      });
    }

    // Count tokens that are NOT in whitelist and NOT native tokens
    let unknownCount = 0;
    tokens.forEach((token) => {
      const tokenAddress = token.tokenAddress.toLowerCase();
      const networkKey = getNetworkKey(token.networkLabel);
      const chainKey = chainKeyMap[token.networkLabel];

      const isNative = networkKey && isNativeTokenAddress(token.tokenAddress);
      const whitelistKey = chainKey ? `${chainKey}-${tokenAddress}` : null;
      const isKnownToken = whitelistKey && knownTokenAddresses.has(whitelistKey);

      if (!isNative && !isKnownToken) {
        unknownCount++;
      }
    });

    return unknownCount;
  }, [tokens, allTokensByChain]);

  // Convert tokens to SendableToken format for SendTransaction
  // IMPORTANT: This must be before any conditional returns to follow React Hooks rules
  // ✅ Use displayTokens (filtered) instead of raw tokens to respect whitelist filter
  const availableTokensForSend = useMemo((): SendableToken[] => {
    // Filter tokens with balance > 0
    const tokensWithBalance = displayTokens.filter((t) => {
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
  }, [displayTokens]);

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

  // Show passphrase prompt for wallets with BIP39 passphrase
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

  // Show Transaction History view
  // TODO: TransactionHistory needs migration to session tokens
  const sessionToken = getSessionToken();
  console.log("🔍 [WalletDetail] Checking showHistory condition:", {
    showHistory,
    historyAddress,
    hasSessionToken: !!sessionToken,
    shouldShowHistory: showHistory && historyAddress && sessionToken,
  });

  if (showHistory && historyAddress && sessionToken) {
    console.log("✅ [WalletDetail] Rendering TransactionHistory component");
    // TODO: TransactionHistory component hasn't been migrated to session tokens yet
    // For now, we cannot show history without appPassword
    console.error("❌ TransactionHistory component needs migration to session tokens");
    return (
      <div className="error-message">
        {t('walletDetail.featureNotAvailable')} - Transaction History needs update
      </div>
    );
  }

  // Show Send Transaction view
  // ✅ Migrated to session tokens (2026-01-12)
  if (showSendTransaction && sessionToken) {
    console.log("💸 [WalletDetail] Rendering SendTransaction component with", availableTokensForSend.length, "tokens");
    return (
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
        }}
      />
    );
  }

  // Show Swap Transaction view (✅ Migrated to session tokens)
  if (showSwapTransaction && sessionToken) {
    console.log("🔄 [WalletDetail] Rendering SwapTransaction component with", availableTokensForSend.length, "tokens");
    return (
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
        }}
      />
    );
  }

  // Show Staking Transaction view (✅ Migrated to session tokens)
  if (showStakingTransaction && sessionToken) {
    console.log("📈 [WalletDetail] Rendering StakingTransaction component with", availableTokensForSend.length, "tokens");
    return (
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
    );
  }

  // Original staking code (kept for reference)
  /*
  if (showStakingTransaction && sessionToken) {
    return (
      <StakingTransaction
        walletId={wallet.id}
        walletHasPassphrase={wallet.has_passphrase}
        walletPassphrase={validatedPassphrase || undefined}
        availableTokens={availableTokensForSend}
        usbPath={usbPath}
        appPassword={sessionToken}  // TODO: Fix this
        onBack={() => {
          setShowStakingTransaction(false);
          handleRefreshBalances();
        }}
        onSuccess={(txHash) => {
          console.log("✅ Staking transaction submitted:", txHash);
          // Refresh balances after successful staking
          handleRefreshBalances();
        }}
      />
    );
  }
  */

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
          ← {t('walletDetail.backToWallets')}
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
                title={t('walletDetail.switchWallet')}
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
              {t('walletDetail.wallet01')}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.75rem" }}>
            <button
              title={t('walletDetail.copyAddress')}
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
              title={t('walletDetail.refreshBalances')}
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
            {/* 🛡️ Scam Token Filter Toggle */}
            {filteredScamCount > 0 && (
              <button
                title={showScamTokens
                  ? t('walletDetail.hideScamTokens')
                  : t('walletDetail.showScamTokens', { count: filteredScamCount })
                }
                onClick={() => setShowScamTokens(!showScamTokens)}
                style={{
                  background: showScamTokens ? "#fef3c7" : "transparent",
                  border: showScamTokens ? "1px solid #fbbf24" : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  color: showScamTokens ? "#b45309" : "#1e293b",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = showScamTokens ? "#fde68a" : "#f1f5f9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = showScamTokens ? "#fef3c7" : "transparent";
                }}
              >
                <span>🛡️</span>
                <span>{filteredScamCount}</span>
              </button>
            )}
            <button
              title={t('walletDetail.networkSettings')}
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
              title={t('walletDetail.changeTimePeriod')}
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
            position: "relative",
          }}
        >
          {[
            {
              icon: "↑",
              label: t('walletDetail.send'),
              tooltip: t('walletDetail.sendTooltip'),
              onClick: () => {
                console.log("💸 [Send] Button clicked, available tokens:", availableTokensForSend.length);
                if (availableTokensForSend.length > 0) {
                  setShowSendTransaction(true);
                } else {
                  alert(t('walletDetail.noTokensToSend'));
                }
              },
            },
            {
              icon: "↓",
              label: t('walletDetail.receive'),
              tooltip: t('walletDetail.receiveTooltip'),
              onClick: () => setShowAddressList(true),
            },
            { icon: "🔄", label: t('walletDetail.swap'), tooltip: t('walletDetail.swapTooltip'), onClick: () => {
                console.log("🔄 [Swap] Button clicked, available tokens:", availableTokensForSend.length);
                if (availableTokensForSend.length > 0) {
                  setShowSwapTransaction(true);
                } else {
                  alert(t('walletDetail.noTokensToSwap'));
                }
              } },
            {
              icon: "📜",
              label: t('walletDetail.history'),
              tooltip: t('walletDetail.historyTooltip'),
              onClick: () => {
                console.log("📜 [History] Button clicked, walletAddresses:", walletAddresses.length);
                // Get first EVM address (coin_type 60 = Ethereum compatible)
                // EVM addresses start with 0x and are used for ETH, Polygon, Arbitrum, etc.
                // All EVM chains share the same address, so we just need one
                const evmAddress = walletAddresses.find(
                  (addr) => addr.coin_type === 60 && !addr.is_testnet
                );
                console.log("📜 [History] Found EVM address:", evmAddress);
                if (evmAddress) {
                  setHistoryAddress(evmAddress.address);
                  setShowHistory(true);
                } else {
                  // Try to find any address that looks like EVM (starts with 0x)
                  const anyEvmAddress = walletAddresses.find(
                    (addr) => addr.address.startsWith("0x") && !addr.is_testnet
                  );
                  if (anyEvmAddress) {
                    console.log("📜 [History] Using fallback EVM address:", anyEvmAddress);
                    setHistoryAddress(anyEvmAddress.address);
                    setShowHistory(true);
                  } else {
                    alert(t('walletDetail.noEvmAddress'));
                  }
                }
              },
            },
            { icon: "⋯", label: t('walletDetail.more'), tooltip: t('walletDetail.moreTooltip'), onClick: () => setShowMoreMenu(!showMoreMenu) },
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

          {/* More Menu Dropdown */}
          {showMoreMenu && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: "0",
                marginTop: "0.5rem",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                zIndex: 50,
                minWidth: "200px",
                overflow: "hidden",
              }}
            >
              {/* Staking Option */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  // Show staking options - balance check happens at staking time
                  setShowStakingTransaction(true);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #e2e8f0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  textAlign: "left",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: "1.25rem" }}>📈</span>
                <div>
                  <div style={{ fontWeight: "500", color: "#1e293b" }}>{t('walletDetail.staking')}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{t('walletDetail.stakingDesc')}</div>
                </div>
              </button>

              {/* WalletConnect Option */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  walletConnect.openPairingModal();
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  textAlign: "left",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: "1.25rem" }}>🔗</span>
                <div>
                  <div style={{ fontWeight: "500", color: "#1e293b" }}>WalletConnect</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {walletConnect.sessions.length > 0
                      ? `${walletConnect.sessions.length} active session${walletConnect.sessions.length > 1 ? 's' : ''}`
                      : 'Connect to dApps'}
                  </div>
                </div>
              </button>

              {/* Close Menu on Outside Click */}
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close More menu */}
      {showMoreMenu && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
          }}
          onClick={() => setShowMoreMenu(false)}
        />
      )}

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
          { id: "crypto" as TabType, label: t('walletDetail.crypto') },
          { id: "defi" as TabType, label: t('walletDetail.defi') },
          { id: "nft" as TabType, label: t('walletDetail.nft') },
          { id: "approvals" as TabType, label: t('walletDetail.approvals') },
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
                {t('walletDetail.loadingAssetsDot')}
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
              <p>{t('walletDetail.noTokensFound')}</p>
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
            {t('walletDetail.defiComingSoon')}
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            {t('walletDetail.defiDescription')}
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
            {t('walletDetail.nftComingSoon')}
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            {t('walletDetail.nftDescription')}
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
            {t('walletDetail.approvalsComingSoon')}
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            {t('walletDetail.approvalsDescription')}
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
                  {t('walletDetail.walletAddresses')}
                </h3>
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    fontSize: "0.875rem",
                    color: "#64748b",
                  }}
                >
                  {wallet.name} • {walletAddresses.filter(a => !a.is_testnet).length} {t('walletDetail.addresses')}
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
                  <p>{t('walletDetail.noAddressesLoaded')}</p>
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
                            {t('walletDetail.supportedChains')} ({supportedAddrs.length})
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#22c55e",
                              marginLeft: "0.5rem",
                            }}
                          >
                            {t('walletDetail.fullTransactionSupport')}
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
                                  title={t('walletDetail.copyAddressTooltip')}
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
                                  title={t('walletDetail.showQrCode')}
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
                      (addr) => !addr.is_testnet && !isChainSupported(addr.symbol) && isChainEnabled(addr.symbol)
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
                            {t('walletDetail.otherChains')} ({unsupportedAddrs.length})
                          </span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#94a3b8",
                              marginLeft: "0.5rem",
                            }}
                          >
                            {t('walletDetail.addressOnly')}
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
                            <strong>{t('walletDetail.disclaimer')}</strong> {t('walletDetail.disclaimerText')}
                            <br />
                            <span style={{ color: "#b45309", fontStyle: "italic" }}>
                              {t('walletDetail.disclaimerFuture')}
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
                                title={t('walletDetail.copyAddressTooltip')}
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
