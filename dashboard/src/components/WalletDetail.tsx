/**
 * Wallet Detail View - Asset-first display with multi-chain token balances
 * Feature: Asset management with Alchemy API integration + CoinGecko Token Lists
 */

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppPassword } from "@/contexts/AppPasswordContext";
import { useWalletConnect } from "@/contexts/WalletConnectContext";
import type { TokenBalance } from "@/types/tokens";
import type { Wallet } from "@/types/wallet";
import type { Address } from "@/types/address";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { normalizeTokenForDisplay } from "@/constants/commonTokens";
import {
  getNativeToken,
  isNativeTokenAddress,
  getNetworkKey,
} from "@/constants/nativeTokens";
import { formatUSD, formatBalance } from "@/utils/walletDetailFormat";
import { useWalletData } from "@/hooks/useWalletData";
import { usePriorityTokens, useAllTokens } from "@/hooks/useTokenList";
import type { ChainKey } from "@/services/tokenList";
import { type SendableToken } from "@/components/SendTransaction";
import { getChainIconUrl, getChainFallbackIcon, isChainSupported, isChainEnabled } from "@/utils/chainIcons";
import { aggregateTokens, type AggregatedToken } from "@/utils/aggregateTokens";
import { ChainAllocationTreemap, buildChainAllocation } from "@/components/ChainAllocationTreemap";
import { NETWORK_TO_CHAIN_MAP } from "@/utils/tokenWhitelist";
import { isWalletLocked } from "@/utils/walletLock";
import ReceiveAddressModal from "@/components/ReceiveAddressModal";
import { SessionsManagerModal } from "@/components/WalletConnect/SessionsManagerModal";
import { ExportBackup } from "@/components/ExportBackup";
import { NFTGallery } from "@/components/NFTGallery";
import { DefiPositions } from "@/components/DefiPositions";
import { TokenApprovals } from "@/components/TokenApprovals";
import { AddTokenDialog } from "@/components/AddTokenDialog";
import { WalletDetailViews } from "@/components/walletDetail/WalletDetailViews";

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
  onViewAddresses: _onViewAddresses,
}: WalletDetailProps) {
  const { t } = useTranslation();
  const { getSessionToken } = useAppPassword(); // ✅ Zero password storage!
  const walletConnect = useWalletConnect();

  // ── 解鎖 → 載入資料 狀態機（unlock / passphrase / refresh）──────────────────
  // 三個 handler 與其共享 state 已抽到 useWalletData（耦合的狀態機）。
  // validatedPassphrase 是簽章輸入，往下傳給子畫面的值與路徑不變。
  const { state, actions } = useWalletData({ wallet, usbPath });
  const {
    tokens,
    totalUsd,
    unavailableProviders,
    isLoading,
    isRefreshing,
    error,
    walletAddresses,
    validatedPassphrase,
    passphrase,
    isValidatingPassphrase,
    showPasswordPrompt,
    showPassphrasePrompt,
    tempPassword,
    passwordRef,
  } = state;
  const {
    setTempPassword,
    setPassphrase,
    setError,
    setShowPasswordPrompt,
    setShowPassphrasePrompt,
    unlock: handleLoadBalances,
    validatePassphrase: handleValidatePassphrase,
    refresh: handleRefreshBalances,
  } = actions;

  // Unknown token filter state (whitelist-based)
  const [showScamTokens, setShowScamTokens] = useState(false);
  // Hide zero-balance / valueless tokens by default (like OKX), with a toggle.
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  // Token detail modal: the aggregated row the user tapped (per-chain breakdown).
  const [selectedToken, setSelectedToken] = useState<AggregatedToken | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("crypto");
  const [showPercentage, setShowPercentage] = useState(true);
  const [showAddToken, setShowAddToken] = useState(false);

  // Transaction History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyAddress, setHistoryAddress] = useState("");
  // BSC address for membership NFT lookup
  const bscAddress = useMemo(() =>
    walletAddresses.find(a => a.symbol === 'BNB' && !a.is_testnet)?.address,
    [walletAddresses]
  );
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

  // Export backup dialog state
  const [showExportBackup, setShowExportBackup] = useState(false);

  // WalletConnect Sessions Manager modal state
  const [showSessionsManager, setShowSessionsManager] = useState(false);

  // Address Book state
  const [showAddressBook, setShowAddressBook] = useState(false);

  // Load priority tokens from CoinGecko token lists
  const { tokens: priorityTokens, isLoading: isLoadingPriority } =
    usePriorityTokens();

  // Load ALL tokens from local token lists for logo lookup (supports BSC, etc.)
  // ✅ Only load AFTER wallet is unlocked (!showPasswordPrompt means unlocked)
  // This prevents unnecessary loading before user enters password
  const { tokens: allTokensByChain } = useAllTokens(!showPasswordPrompt);

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
      "Avalanche": "avalanche",
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

      // Whether we actually HAVE a whitelist for this token's chain. The scam
      // filter only makes sense when we can verify against a loaded list. If the
      // chain's CoinGecko list hasn't loaded yet (or failed), "can't verify" must
      // NOT mean "hide" — otherwise legitimate balances (e.g. USDC from the
      // no-key degraded path) vanish until/unless the list loads. We only hide a
      // token when we positively have its chain's list AND it's absent from it.
      const chainWhitelist = chainKey ? allTokensByChain.get(chainKey) : undefined;
      const haveWhitelistForChain = !!chainWhitelist && chainWhitelist.length > 0;

      // 🛡️ Filter logic: hide only when verifiable-and-absent. Native always shows.
      const isUnknownToken =
        !isNative && haveWhitelistForChain && !isKnownToken;

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

  // Assets list view: native coins merged across chains, ERC-20 kept per-chain.
  // (See utils/aggregateTokens — also normalizes differently-spelled networks.)
  // Whitelist lookup for cross-chain ERC-20 merging: a (canonical network,
  // contract) is "known" if it's in the loaded CoinGecko token lists. Only known
  // ERC-20s merge across chains by symbol (so a fake same-named token stays apart).
  const knownErc20Set = useMemo(() => {
    const set = new Set<string>(); // `${chainKey}-${address}`
    allTokensByChain.forEach((chainTokens, chainKey) => {
      chainTokens.forEach((kt) => set.add(`${chainKey}-${kt.address.toLowerCase()}`));
    });
    return set;
  }, [allTokensByChain]);

  const isKnownErc20 = useCallback(
    (canonicalNet: string, tokenAddress: string) => {
      const chainKey = NETWORK_TO_CHAIN_MAP[canonicalNet];
      if (!chainKey || !tokenAddress) return false;
      return knownErc20Set.has(`${chainKey}-${tokenAddress.toLowerCase()}`);
    },
    [knownErc20Set],
  );

  const allAggregatedTokens = useMemo(
    () => aggregateTokens(displayTokens, isKnownErc20),
    [displayTokens, isKnownErc20],
  );

  // A row has value if it has any USD value OR any non-zero balance.
  const hasValue = (a: (typeof allAggregatedTokens)[number]) =>
    a.totalUsdValue > 0 || a.totalBalance > 0;
  const zeroBalanceCount = useMemo(
    () => allAggregatedTokens.filter((a) => !hasValue(a)).length,
    [allAggregatedTokens],
  );
  const aggregatedTokens = useMemo(
    () => (showZeroBalance ? allAggregatedTokens : allAggregatedTokens.filter(hasValue)),
    [allAggregatedTokens, showZeroBalance],
  );

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
      "Avalanche": "avalanche",
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

      // Mirror the display filter: only count as "unknown" (hidden) when we
      // positively have the chain's whitelist AND the token is absent from it.
      const chainWhitelist = chainKey ? allTokensByChain.get(chainKey) : undefined;
      const haveWhitelistForChain = !!chainWhitelist && chainWhitelist.length > 0;

      if (!isNative && haveWhitelistForChain && !isKnownToken) {
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

  // ── 子畫面 dispatch ───────────────────────────────────────────────────────
  // Show Transaction History view
  // ✅ Migrated to session tokens (2026-01-23)
  const sessionToken = getSessionToken();
  console.log("🔍 [WalletDetail] Checking showHistory condition:", {
    showHistory,
    historyAddress,
    hasSessionToken: !!sessionToken,
    shouldShowHistory: showHistory && historyAddress && sessionToken,
  });

  const subView = WalletDetailViews({
    // password prompt
    showPasswordPrompt,
    wallet,
    onBack,
    error,
    tempPassword,
    setTempPassword,
    handleLoadBalances,
    isLoading,
    // passphrase prompt
    showPassphrasePrompt,
    passphrase,
    setPassphrase,
    handleValidatePassphrase,
    isValidatingPassphrase,
    setShowPassphrasePrompt,
    setShowPasswordPrompt,
    passwordRef,
    setError,
    // session token (shared)
    sessionToken,
    // history
    showHistory,
    historyAddress,
    usbPath,
    setShowHistory,
    setHistoryAddress,
    // address book
    showAddressBook,
    setShowAddressBook,
    // send / swap / staking
    showSendTransaction,
    showSwapTransaction,
    showStakingTransaction,
    validatedPassphrase,
    availableTokensForSend,
    setShowSendTransaction,
    setShowSwapTransaction,
    setShowStakingTransaction,
    handleRefreshBalances,
  });
  if (subView) return subView;

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
            {/* WalletConnect Sessions Indicator */}
            {walletConnect.initialized && (
              <button
                title={t('walletConnect.connectedDapps')}
                onClick={() => setShowSessionsManager(true)}
                style={{
                  background: walletConnect.sessions.length > 0 ? "#ecfdf5" : "transparent",
                  border: walletConnect.sessions.length > 0 ? "1px solid #10b981" : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  color: walletConnect.sessions.length > 0 ? "#059669" : "#64748b",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = walletConnect.sessions.length > 0 ? "#d1fae5" : "#f1f5f9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = walletConnect.sessions.length > 0 ? "#ecfdf5" : "transparent";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                {walletConnect.sessions.length > 0 && (
                  <span>{walletConnect.sessions.length}</span>
                )}
              </button>
            )}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>{filteredScamCount}</span>
              </button>
            )}
            {/* Zero-balance toggle */}
            {zeroBalanceCount > 0 && (
              <button
                title={showZeroBalance
                  ? t('walletDetail.hideZeroBalance', 'Hide zero-balance tokens')
                  : t('walletDetail.showZeroBalance', { count: zeroBalanceCount, defaultValue: `Show ${zeroBalanceCount} zero-balance tokens` })
                }
                onClick={() => setShowZeroBalance(!showZeroBalance)}
                style={{
                  background: showZeroBalance ? "#e0e7ff" : "transparent",
                  border: showZeroBalance ? "1px solid #818cf8" : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  color: showZeroBalance ? "#4338ca" : "#1e293b",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = showZeroBalance ? "#c7d2fe" : "#f1f5f9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = showZeroBalance ? "#e0e7ff" : "transparent";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg>
                <span>{zeroBalanceCount}</span>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
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
          {(() => {
            // Check if wallet is locked
            const walletIsLocked = isWalletLocked(wallet.id);
            const lockedTooltip = t('wallet.walletLocked', 'Wallet is locked due to membership limit. Please upgrade to unlock.');

            return [
            {
              icon: "↑",
              label: t('walletDetail.send'),
              tooltip: walletIsLocked ? lockedTooltip : t('walletDetail.sendTooltip'),
              disabled: walletIsLocked,
              onClick: () => {
                if (walletIsLocked) {
                  alert(lockedTooltip);
                  return;
                }
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
              disabled: false,  // Receive is always enabled
              onClick: () => setShowAddressList(true),
            },
            { icon: "🔄", label: t('walletDetail.swap'), tooltip: walletIsLocked ? lockedTooltip : t('walletDetail.swapTooltip'), disabled: walletIsLocked, onClick: () => {
                if (walletIsLocked) {
                  alert(lockedTooltip);
                  return;
                }
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
              disabled: false,  // History viewing is always allowed
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
            { icon: "⋯", label: t('walletDetail.more'), tooltip: t('walletDetail.moreTooltip'), disabled: false, onClick: () => setShowMoreMenu(!showMoreMenu) },
          ];
          })().map((action) => (
            <button
              key={action.label}
              title={action.tooltip}
              onClick={action.onClick}
              disabled={action.disabled}
              style={{
                background: action.disabled ? "#f1f5f9" : "#ffffff",
                border: action.disabled ? "1px solid #cbd5e1" : "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "1rem 0.5rem",
                cursor: action.disabled ? "not-allowed" : "pointer",
                color: action.disabled ? "#94a3b8" : "#1e293b",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
                opacity: action.disabled ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!action.disabled) {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!action.disabled) {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: action.disabled ? "#e2e8f0" : "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.125rem",
                }}
              >
                {action.disabled ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke="currentColor" strokeWidth="2"/></svg> : action.icon}
              </div>
              <span style={{ fontSize: "0.75rem", color: action.disabled ? "#94a3b8" : "#64748b" }}>
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

              {/* Address Book Option */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowAddressBook(true);
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <div>
                  <div style={{ fontWeight: "500", color: "#1e293b" }}>{t('walletDetail.addressBook')}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Manage saved addresses</div>
                </div>
              </button>

              {/* WalletConnect Option */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  // Get first EVM address for WalletConnect
                  const evmAddress = walletAddresses.find(
                    a => !a.is_testnet && (a.symbol === 'ETH' || a.symbol === 'BNB' || a.symbol === 'MATIC' || a.symbol === 'ARB')
                  );
                  // Set wallet context before opening modal so it's available for signing
                  if (evmAddress) {
                    walletConnect.setWalletContext(wallet.id, evmAddress.address);
                  }
                  walletConnect.openPairingModal(evmAddress?.address);
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                <div>
                  <div style={{ fontWeight: "500", color: "#1e293b" }}>WalletConnect</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {walletConnect.sessions.length > 0
                      ? `${walletConnect.sessions.length} active session${walletConnect.sessions.length > 1 ? 's' : ''}`
                      : 'Connect to dApps'}
                  </div>
                </div>
              </button>

              {/* Export Backup Option */}
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowExportBackup(true);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "transparent",
                  border: "none",
                  borderTop: "1px solid #e2e8f0",
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <div>
                  <div style={{ fontWeight: "500", color: "#1e293b" }}>{t('backup.exportTitle')}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{t('backup.exportDescription')}</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export Backup Dialog */}
      {showExportBackup && (
        <ExportBackup
          walletId={wallet.id}
          walletName={wallet.name}
          usbPath={usbPath}
          onSuccess={() => setShowExportBackup(false)}
          onCancel={() => setShowExportBackup(false)}
        />
      )}

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
                  ? "2px solid #2dd4bf"
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
          {/* Provider status banner. With progressive-key support, a chain
              without an API key still shows BASIC assets (native + common
              tokens), reported as "degraded" — so we offer to unlock the full
              data rather than implying the chain is broken. A hard "missing_key"
              / "query_failed" stays an error. */}
          {unavailableProviders.length > 0 && (() => {
            const hasHardError = unavailableProviders.some(
              (p) => p.reason === "missing_key" || p.reason === "query_failed"
            );
            const isDegradedOnly = !hasHardError;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  background: isDegradedOnly ? "#eff6ff" : "#fffbeb",
                  border: `1px solid ${isDegradedOnly ? "#bfdbfe" : "#fde68a"}`,
                  borderRadius: "10px",
                  fontSize: "0.8125rem",
                  color: isDegradedOnly ? "#1e40af" : "#92400e",
                }}
              >
                {isDegradedOnly ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                )}
                <span>
                  {isDegradedOnly
                    ? t('walletDetail.degradedNotice', 'Showing basic assets (native coins + common tokens). Add an Alchemy API key in provider settings to unlock full token discovery, NFTs and transaction history.')
                    : (<>
                        {unavailableProviders.some((p) => p.provider === "alchemy") &&
                          t('walletDetail.alchemyKeyNeeded', 'Some chains (Ethereum, Polygon, Arbitrum, Optimism, Base) need an Alchemy API key. Add one in provider settings to see their tokens.')}
                        {unavailableProviders.some((p) => p.provider === "nodereal") &&
                          ' ' + t('walletDetail.noderealKeyNeeded', 'BSC token list needs a NodeReal API key (native BNB still shows).')}
                      </>)}
                </span>
              </div>
            );
          })()}
          {/* Import token: manually add a token (by contract) to table B so its
              balance is queried on the self-hosted path even if it's not in the
              common list — escape hatch for airdrops/old tokens scanning misses. */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setShowAddToken(true)}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.4rem 0.8rem", fontSize: "0.8125rem", fontWeight: 500,
                color: "#0d9488", background: "transparent",
                border: "1px solid #0d9488", borderRadius: "8px", cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {t('walletDetail.importToken', 'Import token')}
            </button>
          </div>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <LoadingSpinner />
              <p style={{ marginTop: "1rem", color: "#64748b" }}>
                {t('walletDetail.loadingAssetsDot')}
              </p>
            </div>
          ) : aggregatedTokens.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "#64748b",
              }}
            >
              <div style={{ marginBottom: "1rem" }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
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
              {aggregatedTokens.map((agg) => {
                // View shape compatible with the existing row markup. Native
                // coins are merged across chains; ERC-20 stay per-chain.
                const primary = agg.sources[0];
                const token = {
                  tokenSymbol: agg.symbol,
                  tokenName: agg.name,
                  tokenLogo: agg.logo,
                  usdValue: agg.totalUsdValue,
                  balance: String(agg.totalBalance),
                  network: primary.network,
                  networkLabel: agg.isMultiChain
                    ? `${agg.networks.length} chains`
                    : primary.networkLabel,
                  // For multi-chain rows there is no single wallet/contract
                  // address; hide them by leaving these empty.
                  address: agg.isMultiChain ? "" : primary.address,
                  tokenAddress: agg.isMultiChain ? "" : primary.tokenAddress,
                };
                return (
                <button
                  key={agg.key}
                  title={`View ${token.tokenSymbol} details`}
                  onClick={() => setSelectedToken(agg)}
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
                            : "#ccfbf1",
                          color: token.network.includes("sepolia")
                            ? "#d97706"
                            : "#0d9488",
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
                      {agg.isMultiChain ? (
                        <div title={agg.networks.join(", ")}>
                          🌐 on {agg.networks.length} chains
                        </div>
                      ) : token.address ? (
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
                      ) : null}
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
                );
              })}
            </div>
          )}

          {showAddToken && (() => {
            const evmAddr = walletAddresses.find(
              (a) => a.name === "Ethereum" || a.symbol === "ETH" || a.coin_type === 60
            );
            if (!evmAddr) return null;
            return (
              <AddTokenDialog
                usbPath={usbPath}
                userAddress={evmAddr.address}
                network="eth-mainnet"
                networkLabel="Ethereum"
                sessionToken={getSessionToken() || undefined}
                onAdded={() => { void handleRefreshBalances(); }}
                onClose={() => setShowAddToken(false)}
              />
            );
          })()}
        </div>
      )}

      {/* DeFi Tab */}
      {activeTab === "defi" && (
        <DefiPositions tokens={tokens} />
      )}

      {/* NFT Tab */}
      {activeTab === "nft" && (
        <NFTGallery
          walletId={wallet.id}
          password={passwordRef.current}
          usbPath={usbPath}
          sessionToken={getSessionToken() || undefined}
          bscAddress={bscAddress}
        />
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && (
        <TokenApprovals
          walletId={wallet.id}
          password={passwordRef.current}
          usbPath={usbPath}
          sessionToken={getSessionToken() || undefined}
          bscAddress={bscAddress}
        />
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {error}
        </div>
      )}

      {/* Token Detail Modal — per-chain breakdown of the tapped asset */}
      {selectedToken && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedToken(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "90%", maxWidth: "520px", maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "#f1f5f9", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selectedToken.logo
                  ? <img src={selectedToken.logo} alt={selectedToken.symbol} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontWeight: 600 }}>{selectedToken.symbol.charAt(0)}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1e293b" }}>{selectedToken.symbol}</div>
                <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>{selectedToken.name}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1e293b" }}>${selectedToken.totalUsdValue.toFixed(2)}</div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{selectedToken.isMultiChain ? `${selectedToken.networks.length} chains` : "1 chain"}</div>
              </div>
            </div>
            {/* Per-chain breakdown */}
            <div style={{ padding: "1rem 1.5rem 1.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                {t('walletDetail.byChain', 'By chain')}
              </div>
              {/* Allocation treemap — proportion of this asset across chains.
                  Driven by selectedToken.sources, so new chains draw themselves. */}
              {selectedToken.isMultiChain && (
                <div style={{ marginBottom: "1rem" }}>
                  <ChainAllocationTreemap slices={buildChainAllocation(selectedToken.sources)} />
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {selectedToken.sources
                  .slice()
                  .sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0))
                  .map((src, i) => (
                  <div key={`${src.network}-${i}`} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "10px" }}>
                    <img
                      src={getChainIconUrl(src.network) || getChainFallbackIcon(src.network)}
                      alt={src.networkLabel}
                      style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1e293b" }}>{src.networkLabel}</div>
                      {/* Per-chain contract address (ERC-20 only; native has none).
                          Lets the user verify "USDT on each chain, contract = ...". */}
                      {src.tokenAddress && (
                        <button
                          onClick={() => navigator.clipboard?.writeText(src.tokenAddress)}
                          title={`${t('walletDetail.copyContract', 'Copy contract')}: ${src.tokenAddress}`}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", textAlign: "left", fontSize: "0.6875rem", color: "#94a3b8", fontFamily: "monospace" }}
                        >
                          📜 {src.tokenAddress.slice(0, 8)}...{src.tokenAddress.slice(-6)}
                        </button>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1e293b" }}>{formatBalance(src.balance)} {src.tokenSymbol}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>${(src.usdValue || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
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

      {/* WalletConnect Sessions Manager Modal */}
      <SessionsManagerModal
        isOpen={showSessionsManager}
        onClose={() => setShowSessionsManager(false)}
        sessions={walletConnect.sessions}
        onDisconnect={async (topic) => {
          await walletConnect.disconnectSession(topic);
        }}
        onDisconnectAll={async () => {
          // Disconnect all sessions one by one
          for (const session of walletConnect.sessions) {
            await walletConnect.disconnectSession(session.topic);
          }
        }}
        onAddNew={() => {
          setShowSessionsManager(false);
          // Get first EVM address for WalletConnect
          const evmAddress = walletAddresses.find(
            a => !a.is_testnet && (a.symbol === 'ETH' || a.symbol === 'BNB' || a.symbol === 'MATIC' || a.symbol === 'ARB')
          );
          walletConnect.openPairingModal(evmAddress?.address);
        }}
      />
    </div>
  );
}

