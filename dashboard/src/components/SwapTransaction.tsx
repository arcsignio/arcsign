/**
 * SwapTransaction Component
 * Feature: Token Swap via 1inch DEX Aggregator
 *
 * Complete swap flow:
 * 1. User selects source token (from balance)
 * 2. User selects destination token
 * 3. User enters amount to swap
 * 4. Get quote from 1inch (show exchange rate, price impact, etc.)
 * 5. If needed, approve token spending
 * 6. User confirms and enters wallet password
 * 7. Sign and broadcast swap transaction
 * 8. Track transaction status
 */

import React, { useState, useEffect, useCallback } from "react";
import tauriApi, {
  type SwapQuoteResponse,
  type BuildSwapTransactionResponse,
  type AppError,
  type SwapTokenInfo,
} from "@/services/tauri-api";
import type { SendableToken } from "./SendTransaction";

// Swap steps
type SwapStep =
  | "selectFrom"    // Select source token
  | "selectTo"      // Select destination token
  | "input"         // Enter amount
  | "quote"         // Review quote
  | "approve"       // Approve token (if needed)
  | "password"      // Enter wallet password
  | "signing"       // Signing in progress
  | "broadcasting"  // Broadcasting in progress
  | "success"       // Transaction submitted
  | "error";        // Error occurred

interface SwapTransactionProps {
  walletId: string;
  walletHasPassphrase?: boolean;
  walletPassphrase?: string;
  availableTokens: SendableToken[];
  usbPath: string;
  appPassword: string;
  onBack: () => void;
  onSuccess?: (txHash: string) => void;
}

// Token list cache for each chain (chain-specific, not provider-specific)
// Key is chainId only (e.g., "ethereum", "bnb"), value is array of tokens
// This follows cold wallet security best practice: token registry is chain-specific,
// provider only affects quote/route/build operations
type TokenCache = Record<string, SwapTokenInfo[]>;

// Map network to chainId for backend
function networkToChainId(network: string): string {
  const mapping: Record<string, string> = {
    "eth-mainnet": "ethereum",
    "polygon-mainnet": "polygon",
    "arb-mainnet": "arbitrum",
    "opt-mainnet": "optimism",
    "base-mainnet": "base",
    "bnb-mainnet": "bnb",
  };
  return mapping[network] || network;
}

// Get block explorer URL for a transaction
function getExplorerUrl(network: string, txHash: string): string {
  const explorers: Record<string, string> = {
    "eth-mainnet": "https://etherscan.io/tx/",
    "polygon-mainnet": "https://polygonscan.com/tx/",
    "arb-mainnet": "https://arbiscan.io/tx/",
    "opt-mainnet": "https://optimistic.etherscan.io/tx/",
    "base-mainnet": "https://basescan.org/tx/",
    "bnb-mainnet": "https://bscscan.com/tx/",
  };
  return `${explorers[network] || "https://etherscan.io/tx/"}${txHash}`;
}

// Get network display icon
function getNetworkIcon(network: string): string {
  const icons: Record<string, string> = {
    "eth-mainnet": "⟠",
    "polygon-mainnet": "⬡",
    "arb-mainnet": "🔵",
    "opt-mainnet": "🔴",
    "base-mainnet": "🔷",
    "bnb-mainnet": "🟡",
  };
  return icons[network] || "🔗";
}

// Convert human-readable amount to smallest unit (wei)
function toSmallestUnit(amount: string, decimals: number): string {
  if (!amount || isNaN(parseFloat(amount))) return "0";
  const parts = amount.split(".");
  const integerPart = parts[0] || "0";
  let decimalPart = parts[1] || "";
  if (decimalPart.length < decimals) {
    decimalPart = decimalPart.padEnd(decimals, "0");
  } else if (decimalPart.length > decimals) {
    decimalPart = decimalPart.slice(0, decimals);
  }
  const result = (integerPart + decimalPart).replace(/^0+/, "") || "0";
  return result;
}

// Convert smallest unit to human-readable
function fromSmallestUnit(amount: string, decimals: number): string {
  if (!amount || amount === "0") return "0";
  // Default to 18 decimals if not specified
  const dec = decimals || 18;
  const padded = amount.padStart(dec + 1, "0");
  const intPart = padded.slice(0, -dec) || "0";
  const decPart = padded.slice(-dec);
  // Limit decimal places to 8 for readability
  const trimmed = decPart.slice(0, 8).replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}

// Get native token symbol for a network
function getNativeTokenSymbol(network: string): string {
  const mapping: Record<string, string> = {
    "eth-mainnet": "ETH",
    "polygon-mainnet": "MATIC",
    "arb-mainnet": "ETH",
    "opt-mainnet": "ETH",
    "base-mainnet": "ETH",
    "bnb-mainnet": "BNB",
    "ethereum": "ETH",
    "polygon": "MATIC",
    "arbitrum": "ETH",
    "optimism": "ETH",
    "base": "ETH",
    "bsc": "BNB",
  };
  return mapping[network] || "ETH";
}

// Helper to shorten address
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

// Format balance display (truncate, no rounding)
function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  const truncate = (n: number, decimals: number): string => {
    const factor = Math.pow(10, decimals);
    return (Math.floor(n * factor) / factor).toFixed(decimals);
  };
  if (num < 0.01) return truncate(num, 6);
  if (num < 1000) return truncate(num, 6);
  return truncate(num, 4);
}

// Supported chains for swap
const SUPPORTED_SWAP_CHAINS = ["eth-mainnet", "polygon-mainnet", "arb-mainnet", "opt-mainnet", "base-mainnet", "bnb-mainnet"];

// DEX Provider types (matching backend)
type SwapProvider = "openocean" | "kyberswap";

interface ProviderInfo {
  id: SwapProvider;
  name: string;
  description: string;
  logoUrl: string;
  website: string;
}

// Available DEX providers (static list matching backend)
const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  {
    id: "openocean",
    name: "OpenOcean",
    description: "Cross-chain DEX aggregator with best rates",
    logoUrl: "https://openocean.finance/favicon.ico",
    website: "https://openocean.finance",
  },
  {
    id: "kyberswap",
    name: "KyberSwap",
    description: "Multi-chain DEX aggregator by Kyber Network",
    logoUrl: "https://kyberswap.com/favicon.ico",
    website: "https://kyberswap.com",
  },
];

export const SwapTransaction: React.FC<SwapTransactionProps> = ({
  walletId,
  walletHasPassphrase: _walletHasPassphrase = false,
  walletPassphrase: preValidatedPassphrase,
  availableTokens,
  usbPath,
  appPassword,
  onBack,
  onSuccess,
}) => {
  void _walletHasPassphrase; // Reserved for future passphrase validation
  // Token selection state
  const [fromToken, setFromToken] = useState<SendableToken | null>(null);
  const [toToken, setToToken] = useState<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
    network?: string;
  } | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [walletPassword, setWalletPassword] = useState("");

  // Transaction state
  const [step, setStep] = useState<SwapStep>("selectFrom");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quote and transaction data
  const [quote, setQuote] = useState<SwapQuoteResponse | null>(null);
  const [swapTx, setSwapTx] = useState<BuildSwapTransactionResponse | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // 1inch Token List state
  const [tokenCache, setTokenCache] = useState<TokenCache>({});
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");

  // DEX Provider state
  const [selectedProvider, setSelectedProvider] = useState<SwapProvider>("openocean");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);

  // Filter tokens to supported chains only
  const swappableTokens = availableTokens.filter(t => SUPPORTED_SWAP_CHAINS.includes(t.network));

  // Get chainId for backend API
  const chainId = fromToken ? networkToChainId(fromToken.network) : "";

  // Cache key is chain-specific only (not provider-specific)
  // Token list is unified per-chain, provider only affects quote/route/build
  const tokenCacheKey = chainId;

  // Fetch tokens from unified Token Registry (chain-specific, not provider-specific)
  // Token list is always fetched from OpenOcean as the registry source
  // This follows cold wallet security best practice: token registry is static per-chain
  useEffect(() => {
    if (!fromToken || !chainId) return;

    // Check if we already have cached tokens for this chain
    if (tokenCache[tokenCacheKey]) {
      console.log(`[SwapTransaction] Using cached tokens for chain: ${tokenCacheKey}`);
      return;
    }

    const fetchTokens = async () => {
      setLoadingTokens(true);
      try {
        // Always use OpenOcean as token registry source (chain-specific)
        // Provider selection only affects quote/route/build, not token list
        const registryProvider = "openocean";
        console.log(`[SwapTransaction] Fetching token registry for chain: ${chainId} (source: ${registryProvider})`);

        const response = await tauriApi.getSwapTokens({
          chainId,
          provider: registryProvider, // Fixed registry source
          usbPath,
          appPassword,
        });

        console.log(`[SwapTransaction] Loaded ${response.tokens.length} tokens for chain: ${chainId}`);

        // Cache the tokens with chain-specific key
        setTokenCache(prev => ({
          ...prev,
          [tokenCacheKey]: response.tokens,
        }));
      } catch (err) {
        console.error(`[SwapTransaction] Failed to fetch token registry for chain ${chainId}:`, err);
        // Don't set error - we can still use user's existing tokens
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchTokens();
  }, [fromToken, chainId, tokenCacheKey, usbPath, appPassword, tokenCache]);

  // Get destination token options based on selected source token's chain
  // Uses unified Token Registry (chain-specific) + user's wallet tokens
  // Three-layer strategy: 1) Registry, 2) Wallet tokens, 3) Custom token (future)
  const getDestinationTokens = useCallback(() => {
    if (!fromToken) return [];

    // Get tokens from chain-specific Token Registry cache
    const registryTokens = tokenCache[tokenCacheKey] || [];

    // Combine API tokens with user's tokens on same network
    const userTokensOnChain = availableTokens.filter(t => t.network === fromToken.network);

    // Create unified list, filtering out the source token
    const allTokens: Array<{
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      logoURI?: string;
      balance?: string;
    }> = [];

    // Add user's tokens first (they have balances)
    userTokensOnChain.forEach(t => {
      const addr = t.tokenAddress || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      if (addr.toLowerCase() !== (fromToken.tokenAddress || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee").toLowerCase()) {
        allTokens.push({
          address: addr,
          symbol: t.tokenSymbol,
          name: t.tokenName,
          decimals: t.decimals,
          logoURI: t.tokenLogo,
          balance: t.balance,
        });
      }
    });

    // Add registry tokens that aren't already in the list (from user's wallet)
    registryTokens.forEach(regToken => {
      const exists = allTokens.some(t => t.address.toLowerCase() === regToken.address.toLowerCase());
      if (!exists && regToken.address.toLowerCase() !== (fromToken.tokenAddress || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee").toLowerCase()) {
        allTokens.push({
          address: regToken.address,
          symbol: regToken.symbol,
          name: regToken.name,
          decimals: regToken.decimals,
          logoURI: regToken.logoURI,
        });
      }
    });

    // Apply search filter if query exists
    if (tokenSearchQuery.trim()) {
      const query = tokenSearchQuery.toLowerCase().trim();
      return allTokens.filter(t =>
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.address.toLowerCase().includes(query)
      );
    }

    return allTokens;
  }, [fromToken, tokenCacheKey, availableTokens, tokenCache, tokenSearchQuery]);

  // Validate amount
  const isValidAmount = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  };

  // Get quote when amount changes
  const fetchQuote = useCallback(async () => {
    if (!fromToken || !toToken || !isValidAmount(amount)) {
      setQuote(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amountWei = toSmallestUnit(amount, fromToken.decimals);
      const fromAddr = fromToken.tokenAddress || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

      console.log("🔄 Fetching swap quote...", { chainId, fromAddr, toAddr: toToken.address, amount: amountWei });

      const result = await tauriApi.getSwapQuote({
        chainId,
        fromTokenAddress: fromAddr,
        toTokenAddress: toToken.address,
        amount: amountWei,
        fromAddress: fromToken.fromAddress,
        slippage,
        provider: selectedProvider,
        usbPath,
        appPassword,
      });

      setQuote(result);
    } catch (err) {
      const appErr = err as AppError;
      console.error("Quote fetch failed:", appErr);
      setError(appErr.message || "Failed to get swap quote");
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [fromToken, toToken, amount, chainId, slippage, selectedProvider, usbPath, appPassword]);

  // Debounced quote fetch
  useEffect(() => {
    if (step === "input" && fromToken && toToken && amount) {
      const timer = setTimeout(fetchQuote, 500);
      return () => clearTimeout(timer);
    }
  }, [step, fromToken, toToken, amount, fetchQuote]);

  // Handle source token selection
  const handleSelectFromToken = (token: SendableToken) => {
    setFromToken(token);
    setToToken(null);
    setAmount("");
    setQuote(null);
    setTokenSearchQuery(""); // Clear search query when selecting source token
    setStep("selectTo");
  };

  // Handle destination token selection
  const handleSelectToToken = (token: { address: string; symbol: string; name: string; decimals: number; logoURI?: string }) => {
    setToToken({ ...token, network: fromToken?.network });
    setTokenSearchQuery(""); // Clear search query after selecting destination token
    setStep("input");
  };

  // Build swap transaction
  const handleBuildSwapTx = async () => {
    if (!fromToken || !toToken || !quote) {
      setError("Missing required data");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amountWei = toSmallestUnit(amount, fromToken.decimals);
      const fromAddr = fromToken.tokenAddress || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

      console.log("🔧 Building swap transaction...");

      const result = await tauriApi.buildSwapTransaction({
        chainId,
        fromTokenAddress: fromAddr,
        toTokenAddress: toToken.address,
        amount: amountWei,
        fromAddress: fromToken.fromAddress,
        slippage,
        provider: selectedProvider,
        usbPath,
        appPassword,
      });

      setSwapTx(result);

      // Check if approval is needed
      if (quote.needsApproval) {
        setStep("approve");
      } else {
        setStep("password");
      }
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr.message || "Failed to build swap transaction");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle approval (simplified - in reality would sign and broadcast approval tx)
  const handleApprove = async () => {
    // For now, skip to password step - approval would be a separate tx
    setStep("password");
  };

  // Sign and broadcast swap
  const handleSignAndBroadcast = async () => {
    if (!walletPassword) {
      setError("Please enter your wallet password");
      return;
    }
    if (!swapTx || !fromToken) {
      setError("No transaction to sign");
      return;
    }

    setStep("signing");
    setIsLoading(true);
    setError(null);

    try {
      console.log("🔨 Building swap transaction...");

      // Step 1: Build transaction using the swap data from OpenOcean
      // The buildTransaction call calculates the correct signingPayload (tx hash)
      // Note: OpenOcean provides gas estimates but backend will recalculate for safety
      const buildResult = await tauriApi.buildTransaction({
        chainId,
        from: fromToken.fromAddress,
        to: swapTx.txData.to,
        amount: swapTx.txData.value || "0",
        data: swapTx.txData.data || "",
        feeSpeed: "fast", // Use fast for swap tx to ensure they go through
        usbPath,
        appPassword,
      });

      console.log("✅ Build result:", buildResult);
      console.log("✍️ Signing swap transaction...");

      // Step 2: Sign transaction with the proper unsigned tx from buildTransaction
      const signResult = await tauriApi.signTransaction({
        chainId,
        walletId,
        password: walletPassword,
        passphrase: preValidatedPassphrase || "",
        fromAddress: fromToken.fromAddress,
        unsignedTx: buildResult,
        usbPath,
        appPassword,
      });

      setStep("broadcasting");
      console.log("📡 Broadcasting swap transaction...");

      const broadcastResult = await tauriApi.broadcastTransaction({
        chainId,
        signedTx: signResult,
        usbPath,
        appPassword,
      });

      setTxHash(broadcastResult.txHash);
      setStep("success");
      onSuccess?.(broadcastResult.txHash);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr.message || "Failed to execute swap");
      setStep("error");
    } finally {
      setIsLoading(false);
      setWalletPassword("");
    }
  };

  // Reset form
  const handleReset = () => {
    setFromToken(null);
    setToToken(null);
    setAmount("");
    setWalletPassword("");
    setSlippage(0.5);
    setStep("selectFrom");
    setError(null);
    setQuote(null);
    setSwapTx(null);
    setTxHash(null);
  };

  // Group tokens by network
  const tokensByNetwork = swappableTokens.reduce((acc, token) => {
    const network = token.networkLabel;
    if (!acc[network]) acc[network] = [];
    acc[network].push(token);
    return acc;
  }, {} as Record<string, SendableToken[]>);

  // Get back handler based on current step
  const getBackHandler = () => {
    switch (step) {
      case "selectFrom": return onBack;
      case "selectTo": return () => { setFromToken(null); setStep("selectFrom"); };
      case "input": return () => { setToToken(null); setStep("selectTo"); };
      case "quote": return () => setStep("input");
      case "approve": return () => setStep("input");
      case "password": return () => setStep("input");
      default: return handleReset;
    }
  };

  // Get current provider info
  const currentProvider = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider) || AVAILABLE_PROVIDERS[0];

  // Handle provider selection
  const handleProviderSelect = (provider: SwapProvider) => {
    setSelectedProvider(provider);
    setShowProviderDropdown(false);
    // Reset quote when provider changes
    setQuote(null);
  };

  return (
    <div className="swap-transaction">
      <header className="swap-header">
        <button onClick={getBackHandler()} className="back-button">
          <span>&larr;</span> Back
        </button>
        <h2>Swap Tokens</h2>
        <div className="header-badges">
          {/* DEX Provider Selector */}
          <div className="provider-selector">
            <button
              className="provider-badge"
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            >
              <img
                src={currentProvider.logoUrl}
                alt={currentProvider.name}
                className="provider-logo"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <span className="provider-name">{currentProvider.name}</span>
              <span className="dropdown-arrow">{showProviderDropdown ? '▲' : '▼'}</span>
            </button>
            {showProviderDropdown && (
              <div className="provider-dropdown">
                {AVAILABLE_PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    className={`provider-option ${provider.id === selectedProvider ? 'selected' : ''}`}
                    onClick={() => handleProviderSelect(provider.id)}
                  >
                    <img
                      src={provider.logoUrl}
                      alt={provider.name}
                      className="provider-logo"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                    <div className="provider-info">
                      <span className="provider-name">{provider.name}</span>
                      <span className="provider-desc">{provider.description}</span>
                    </div>
                    {provider.id === selectedProvider && <span className="check-mark">✓</span>}
                  </button>
                ))}
              </div>
            )}
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
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Step 1: Select Source Token */}
      {step === "selectFrom" && (
        <div className="token-select-form">
          <h3>Select Token to Swap</h3>
          <p className="select-description">Choose which asset you want to swap from</p>

          {swappableTokens.length === 0 ? (
            <div className="no-tokens">
              <span className="no-tokens-icon">📭</span>
              <p>No tokens available for swap on supported chains</p>
              <p className="supported-chains">Supported: Ethereum, Polygon, Arbitrum, Optimism, Base, BNB Chain</p>
              <button className="secondary-button" onClick={onBack}>
                Go Back
              </button>
            </div>
          ) : (
            <div className="token-list">
              {Object.entries(tokensByNetwork).map(([networkLabel, tokens]) => (
                <div key={networkLabel} className="network-group">
                  <div className="network-header">
                    <span className="network-icon">{getNetworkIcon(tokens[0].network)}</span>
                    <span className="network-name">{networkLabel}</span>
                  </div>
                  <div className="network-tokens">
                    {tokens.map((token, idx) => (
                      <button
                        key={`${token.network}-${token.tokenAddress || "native"}-${idx}`}
                        className="token-option"
                        onClick={() => handleSelectFromToken(token)}
                      >
                        <div className="token-icon">
                          {token.tokenLogo ? (
                            <img src={token.tokenLogo} alt={token.tokenSymbol} />
                          ) : (
                            <span className="token-icon-fallback">{token.tokenSymbol.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className="token-info">
                          <span className="token-symbol">{token.tokenSymbol}</span>
                          <span className="token-name">{token.tokenName}</span>
                        </div>
                        <div className="token-balance">
                          <span className="balance-amount">{formatBalance(token.balance)}</span>
                        </div>
                        <span className="token-arrow">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Destination Token */}
      {step === "selectTo" && fromToken && (
        <div className="token-select-form">
          <h3>Select Token to Receive</h3>
          <p className="select-description">
            Swapping from {fromToken.tokenSymbol} on {fromToken.networkLabel}
          </p>

          {/* Search Input */}
          <div className="token-search-wrapper">
            <input
              type="text"
              placeholder="Search by name, symbol, or address..."
              value={tokenSearchQuery}
              onChange={(e) => setTokenSearchQuery(e.target.value)}
              className="token-search-input"
            />
            {tokenSearchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setTokenSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Loading State */}
          {loadingTokens && (
            <div className="token-loading">
              <div className="token-loading-spinner"></div>
              <span>Loading token registry...</span>
            </div>
          )}

          {/* Token Count Info */}
          {!loadingTokens && tokenCache[tokenCacheKey] && (
            <div className="token-count-info">
              {getDestinationTokens().length} tokens available
              {tokenSearchQuery && ` (filtered)`}
            </div>
          )}

          <div className="token-list">
            {getDestinationTokens().length === 0 && !loadingTokens ? (
              <div className="no-tokens-found">
                {tokenSearchQuery
                  ? `No tokens found matching "${tokenSearchQuery}"`
                  : "No tokens available"}
              </div>
            ) : (
              getDestinationTokens().map((token, idx) => (
                <button
                  key={`${token.address}-${idx}`}
                  className="token-option"
                  onClick={() => handleSelectToToken(token)}
                >
                  <div className="token-icon">
                    {token.logoURI ? (
                      <img src={token.logoURI} alt={token.symbol} />
                    ) : (
                      <span className="token-icon-fallback">{token.symbol.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="token-info">
                    <span className="token-symbol">{token.symbol}</span>
                    <span className="token-name">{token.name}</span>
                  </div>
                  {token.balance && (
                    <div className="token-balance">
                      <span className="balance-amount">{formatBalance(token.balance)}</span>
                    </div>
                  )}
                  <span className="token-arrow">→</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Step 3: Input Amount */}
      {step === "input" && fromToken && toToken && (
        <div className="swap-input-form">
          {/* From Token */}
          <div className="swap-token-card from">
            <div className="token-card-header">
              <span className="card-label">You Pay</span>
              <span className="balance-label">
                Balance: {formatBalance(fromToken.balance)} {fromToken.tokenSymbol}
              </span>
            </div>
            <div className="token-card-body">
              <input
                type="text"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="amount-input-large"
              />
              <div className="token-selector" onClick={() => setStep("selectFrom")}>
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
              <button className="max-button" onClick={() => setAmount(fromToken.balance)}>
                MAX
              </button>
              <button className="half-button" onClick={() => setAmount(String(parseFloat(fromToken.balance) / 2))}>
                50%
              </button>
            </div>
          </div>

          {/* Swap Direction Indicator */}
          <div className="swap-direction">
            <button className="swap-direction-btn" onClick={() => {
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
            }}>
              ↕
            </button>
          </div>

          {/* To Token */}
          <div className="swap-token-card to">
            <div className="token-card-header">
              <span className="card-label">You Receive</span>
            </div>
            <div className="token-card-body">
              <div className="amount-display">
                {isLoading ? (
                  <span className="loading-text">Loading...</span>
                ) : quote ? (
                  fromSmallestUnit(quote.toAmount, toToken.decimals)
                ) : (
                  "0.0"
                )}
              </div>
              <div className="token-selector" onClick={() => setStep("selectTo")}>
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
                  Min: {fromSmallestUnit(quote.toAmountMin, toToken.decimals)} {toToken.symbol}
                </span>
              </div>
            )}
          </div>

          {/* Quote Details */}
          {quote && (
            <div className="quote-details">
              <div className="quote-row">
                <span className="quote-label">Exchange Rate</span>
                <span className="quote-value">
                  1 {fromToken.tokenSymbol} = {quote.exchangeRate} {toToken.symbol}
                </span>
              </div>
              <div className="quote-row">
                <span className="quote-label">Price Impact</span>
                <span className={`quote-value ${
                  quote.priceImpact !== "N/A" && parseFloat(quote.priceImpact) > 3 ? "warning" : ""
                }`}>
                  {quote.priceImpact === "N/A" || quote.priceImpact === "" || quote.priceImpact === "0"
                    ? "N/A"
                    : `${quote.priceImpact}%`}
                </span>
              </div>
              <div className="quote-row">
                <span className="quote-label">Estimated Gas</span>
                <span className="quote-value">{quote.gasCostETH} {getNativeTokenSymbol(fromToken.network)}</span>
              </div>
              <div className="quote-row">
                <span className="quote-label">Route</span>
                <span className="quote-value route">{quote.protocols.join(" → ")}</span>
              </div>
            </div>
          )}

          {/* Slippage Settings */}
          <div className="slippage-settings">
            <span className="slippage-label">Slippage Tolerance</span>
            <div className="slippage-options">
              {[0.5, 1, 3].map(s => (
                <button
                  key={s}
                  className={`slippage-option ${slippage === s ? "selected" : ""}`}
                  onClick={() => setSlippage(s)}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>

          {/* Continue Button */}
          <button
            className="primary-button"
            onClick={handleBuildSwapTx}
            disabled={isLoading || !isValidAmount(amount) || !quote}
          >
            {isLoading ? "Loading..." : "Review Swap"}
          </button>
        </div>
      )}

      {/* Approval Step */}
      {step === "approve" && quote && (
        <div className="approve-form">
          <h3>Approve Token Spending</h3>
          <p className="approve-description">
            To swap {fromToken?.tokenSymbol}, you need to approve the DEX router to spend your tokens.
          </p>

          <div className="approval-details">
            <div className="approval-row">
              <span className="approval-label">Token</span>
              <span className="approval-value">{fromToken?.tokenSymbol}</span>
            </div>
            <div className="approval-row">
              <span className="approval-label">Spender</span>
              <span className="approval-value address">{shortenAddress(quote.approvalAddress)}</span>
            </div>
          </div>

          <button className="primary-button" onClick={handleApprove}>
            Approve {fromToken?.tokenSymbol}
          </button>
          <button className="secondary-button" onClick={() => setStep("input")}>
            Cancel
          </button>
        </div>
      )}

      {/* Password Step */}
      {step === "password" && swapTx && fromToken && toToken && (
        <div className="password-form">
          <h3>Confirm Swap</h3>

          <div className="swap-summary">
            <div className="swap-summary-row">
              <span className="summary-label">You Pay</span>
              <span className="summary-value">
                {amount} {fromToken.tokenSymbol}
              </span>
            </div>
            <div className="swap-summary-row">
              <span className="summary-label">You Receive</span>
              <span className="summary-value highlight">
                ~{fromSmallestUnit(swapTx.quote.toAmount, toToken.decimals)} {toToken.symbol}
              </span>
            </div>
            <div className="swap-summary-row">
              <span className="summary-label">Network</span>
              <span className="summary-value">
                {getNetworkIcon(fromToken.network)} {fromToken.networkLabel}
              </span>
            </div>
            <div className="swap-summary-row">
              <span className="summary-label">Exchange Rate</span>
              <span className="summary-value">
                1 {fromToken.tokenSymbol} ≈ {swapTx.quote.exchangeRate} {toToken.symbol}
              </span>
            </div>
            <div className="swap-summary-row">
              <span className="summary-label">Price Impact</span>
              <span className="summary-value" style={{ color: parseFloat(swapTx.quote.priceImpact || '0') < -1 ? '#ef4444' : '#10b981' }}>
                {swapTx.quote.priceImpact}%
              </span>
            </div>
            <div className="swap-summary-row">
              <span className="summary-label">Estimated Gas Fee</span>
              <span className="summary-value">
                ~{swapTx.quote.gasCostETH} {getNativeTokenSymbol(fromToken.network)}
              </span>
            </div>
            <div className="swap-summary-row">
              <span className="summary-label">Minimum Received</span>
              <span className="summary-value">
                {fromSmallestUnit(swapTx.quote.toAmountMin, toToken.decimals)} {toToken.symbol}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label>Wallet Password</label>
            <input
              type="password"
              placeholder="Enter your wallet password"
              value={walletPassword}
              onChange={(e) => setWalletPassword(e.target.value)}
              className="password-input"
              autoFocus
            />
          </div>

          <button
            className="primary-button"
            onClick={handleSignAndBroadcast}
            disabled={isLoading || !walletPassword}
          >
            {isLoading ? "Processing..." : "Confirm Swap"}
          </button>
        </div>
      )}

      {/* Signing/Broadcasting Steps */}
      {(step === "signing" || step === "broadcasting") && (
        <div className="processing-form">
          <div className="processing-spinner"></div>
          <h3>{step === "signing" ? "Signing Transaction..." : "Broadcasting Transaction..."}</h3>
          <p className="processing-description">
            {step === "signing"
              ? "Please wait while we sign your swap transaction"
              : "Submitting your swap to the blockchain..."
            }
          </p>
        </div>
      )}

      {/* Success Step */}
      {step === "success" && txHash && fromToken && (
        <div className="success-form">
          <div className="success-icon">✓</div>
          <h3>Swap Submitted!</h3>
          <p className="success-description">
            Your swap transaction has been submitted to the network.
          </p>

          <div className="tx-hash-display">
            <span className="tx-label">Transaction Hash</span>
            <a
              href={getExplorerUrl(fromToken.network, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-hash-link"
            >
              {shortenAddress(txHash)} ↗
            </a>
          </div>

          <div className="success-actions">
            <button className="primary-button" onClick={handleReset}>
              New Swap
            </button>
            <button className="secondary-button" onClick={onBack}>
              Back to Wallet
            </button>
          </div>
        </div>
      )}

      {/* Error Step */}
      {step === "error" && (
        <div className="error-form">
          <div className="error-icon-large">✕</div>
          <h3>Swap Failed</h3>
          <p className="error-description">{error || "An error occurred during the swap"}</p>

          <div className="error-actions">
            <button className="primary-button" onClick={() => setStep("input")}>
              Try Again
            </button>
            <button className="secondary-button" onClick={handleReset}>
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Inline Styles - Light theme to match WalletDetail/SendTransaction */}
      <style>{`
.swap-transaction {
  min-height: 100vh;
  background: #f8fafc;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #111827;
}

/* Token Select Form - Step 1 & 2 */
.token-select-form {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.token-select-form h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.select-description {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #6b7280;
}

/* No Tokens State */
.no-tokens {
  text-align: center;
  padding: 40px 20px;
}

.no-tokens-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.no-tokens p {
  margin: 0 0 8px 0;
  color: #6b7280;
  font-size: 14px;
}

.supported-chains {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 20px !important;
}

/* Token Search */
.token-search-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.token-search-input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  color: #111827;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.token-search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.token-search-input::placeholder {
  color: #9ca3af;
}

.search-clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  border: none;
  border-radius: 50%;
  color: #6b7280;
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.search-clear-btn:hover {
  background: #d1d5db;
}

/* Token Loading State */
.token-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: #6b7280;
  font-size: 14px;
}

.token-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Token Count Info */
.token-count-info {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 12px;
  padding-left: 4px;
}

/* No Tokens Found */
.no-tokens-found {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 14px;
}

/* Network Group */
.network-group {
  margin-bottom: 16px;
}

.network-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 12px;
}

.network-icon {
  font-size: 18px;
}

.network-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.network-tokens {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Token Option Button */
.token-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.token-option:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.token-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.token-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-icon-fallback {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.token-icon-small {
  width: 24px;
  height: 24px;
}

.token-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.token-symbol {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.token-name {
  font-size: 13px;
  color: #6b7280;
}

.token-balance {
  text-align: right;
}

.balance-amount {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.token-arrow {
  font-size: 18px;
  color: #9ca3af;
}

/* Chain Badge */
.chain-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 13px;
  color: #374151;
  margin-left: auto;
}

.chain-icon {
  font-size: 14px;
}

/* Swap Input Form - Step 3 */
.swap-input-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.swap-token-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.swap-token-card.from {
  border: 2px solid #e5e7eb;
}

.swap-token-card.to {
  border: 2px solid #e5e7eb;
  background: #f9fafb;
}

.token-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.balance-label {
  font-size: 12px;
  color: #9ca3af;
}

.token-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.amount-input-large {
  flex: 1;
  font-size: 28px;
  font-weight: 600;
  color: #111827;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
}

.amount-input-large::placeholder {
  color: #d1d5db;
}

.token-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 20px;
  cursor: pointer;
}

.dropdown-arrow {
  font-size: 12px;
  color: #6b7280;
}

.token-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.half-button,
.max-button {
  padding: 6px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.half-button:hover,
.max-button:hover {
  background: #dbeafe;
}

/* Swap Direction Button */
.swap-direction {
  display: flex;
  justify-content: center;
  margin: -8px 0;
  position: relative;
  z-index: 1;
}

.swap-direction-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.swap-direction-btn:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* Quote Details */
.quote-details {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 16px;
}

.quote-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #dcfce7;
}

.quote-row:last-child {
  border-bottom: none;
}

.quote-label {
  font-size: 13px;
  color: #6b7280;
}

.quote-value {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
}

.quote-value.route {
  font-size: 12px;
  color: #6b7280;
}

.min-received {
  font-size: 12px;
  color: #16a34a;
  margin-top: 4px;
}

.amount-display {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

/* Slippage Settings */
.slippage-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.slippage-label {
  font-size: 13px;
  color: #6b7280;
}

.slippage-options {
  display: flex;
  gap: 8px;
}

.slippage-options button {
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.slippage-options button:hover {
  border-color: #9ca3af;
}

.slippage-options button.selected {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #2563eb;
}

/* Loading State */
.loading-text {
  color: #6b7280;
  font-size: 14px;
  text-align: center;
  padding: 20px;
}

.swap-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.swap-header h2 {
  flex: 1;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Provider Selector */
.provider-selector {
  position: relative;
}

.provider-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: #374151;
  transition: all 0.2s;
}

.provider-badge:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

.provider-logo {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}

.provider-badge .provider-name {
  font-weight: 500;
}

.dropdown-arrow {
  font-size: 10px;
  color: #9ca3af;
  margin-left: 2px;
}

.provider-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 280px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: white;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s;
}

.provider-option:hover {
  background: #f9fafb;
}

.provider-option.selected {
  background: #eff6ff;
}

.provider-option .provider-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.provider-option .provider-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.provider-option .provider-name {
  font-weight: 500;
  color: #111827;
  font-size: 14px;
}

.provider-option .provider-desc {
  font-size: 12px;
  color: #6b7280;
}

.check-mark {
  color: #3b82f6;
  font-weight: bold;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: background 0.2s;
}

.back-button:hover {
  background: #e5e7eb;
}

.swap-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

/* Token Selection */
.token-selection {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.token-selection h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.token-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 450px;
  overflow-y: auto;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.token-item:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.token-item.selected {
  background: #eff6ff;
  border-color: #3b82f6;
}

.token-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.token-icon-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.token-icon-wrapper img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.token-icon-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.network-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  background: #f8fafc;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border: 2px solid #f8fafc;
}

.token-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.token-symbol {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.token-name {
  font-size: 13px;
  color: #6b7280;
}

.token-balance {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.balance-amount {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.balance-network {
  font-size: 12px;
  color: #6b7280;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: #9ca3af;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

/* Swap Input Form */
.swap-input-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.swap-input-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.swap-pair-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.swap-token-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.swap-token-card img,
.swap-token-card .token-icon-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.swap-token-card .token-icon-placeholder {
  font-size: 12px;
}

.swap-token-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.swap-token-info .symbol {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.swap-token-info .network {
  font-size: 11px;
  color: #6b7280;
}

.swap-arrow {
  font-size: 20px;
  color: #9ca3af;
}

.amount-input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.amount-input-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.amount-input-wrapper {
  display: flex;
  gap: 8px;
}

.amount-input-wrapper input {
  flex: 1;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #111827;
  font-size: 18px;
  font-weight: 500;
  outline: none;
  transition: border-color 0.2s;
}

.amount-input-wrapper input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.amount-input-wrapper input.error {
  border-color: #ef4444;
}

.max-button {
  padding: 8px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  color: #2563eb;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.max-button:hover {
  background: #dbeafe;
}

.balance-display {
  font-size: 13px;
  color: #6b7280;
}

.amount-error {
  font-size: 13px;
  color: #ef4444;
}

.get-quote-button {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.get-quote-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.get-quote-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Quote Display */
.quote-display {
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
}

.quote-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #16a34a;
}

.quote-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #dcfce7;
}

.quote-row:last-child {
  border-bottom: none;
}

.quote-label {
  font-size: 13px;
  color: #6b7280;
}

.quote-value {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
}

.quote-value.large {
  font-size: 16px;
  font-weight: 600;
}

.quote-value.warning {
  color: #d97706;
}

.quote-value.route {
  font-size: 12px;
  color: #6b7280;
}

/* Slippage Settings */
.slippage-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.slippage-label {
  font-size: 13px;
  color: #6b7280;
}

.slippage-options {
  display: flex;
  gap: 8px;
}

.slippage-option {
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.slippage-option:hover {
  border-color: #9ca3af;
}

.slippage-option.selected {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #2563eb;
}

/* Primary and Secondary Buttons */
.primary-button {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-button {
  padding: 12px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-button:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

/* Approval Form */
.approve-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.approve-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.approve-description {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.approval-details {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.approval-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.approval-label {
  font-size: 13px;
  color: #6b7280;
}

.approval-value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.approval-value.address {
  font-family: monospace;
  font-size: 13px;
  color: #374151;
}

/* Password Form */
.password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.password-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.swap-summary {
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.swap-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.swap-summary-row:last-child {
  border-bottom: none;
}

.summary-label {
  font-size: 13px;
  color: #6b7280;
}

.summary-value {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.summary-value.highlight {
  color: #16a34a;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.password-input {
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #111827;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.password-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Processing Form */
.processing-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.processing-form h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.processing-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.processing-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Success Form */
.success-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.success-form h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.success-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #dcfce7;
  border: 2px solid #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #22c55e;
}

.tx-hash-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 24px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.tx-label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tx-hash-link {
  font-family: monospace;
  font-size: 14px;
  color: #2563eb;
  text-decoration: none;
  transition: color 0.2s;
}

.tx-hash-link:hover {
  color: #1d4ed8;
}

.success-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.success-actions .primary-button,
.success-actions .secondary-button {
  flex: 1;
  min-width: 120px;
}

/* Error Form */
.error-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 20px;
  text-align: center;
}

.error-form h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.error-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  max-width: 300px;
  word-break: break-word;
}

.error-icon-large {
  width: 64px;
  height: 64px;
  background: #fee2e2;
  border: 2px solid #ef4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #ef4444;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.error-actions .primary-button,
.error-actions .secondary-button {
  flex: 1;
  min-width: 120px;
}

/* Error text inline */
.error-text {
  font-size: 13px;
  color: #ef4444;
  margin: 4px 0 0 0;
}

/* Error banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  margin-bottom: 16px;
}

.error-icon {
  font-size: 16px;
}

.error-message {
  font-size: 14px;
  color: #991b1b;
}
      `}</style>
    </div>
  );
};

export default SwapTransaction;
