/**
 * useSwapFlow — state machine for the SwapTransaction feature.
 *
 * Extracted verbatim from SwapTransaction.tsx (Task 4 of the swap decomposition).
 * Holds every useState / useEffect / useCallback / plain handler + the useSignGate
 * call. Behavior is IDENTICAL to the pre-extraction component — this is a pure
 * mechanical move. The render layer reads state.* and calls actions.*.
 *
 * SAFETY: the useSignGate derivation, the handleSignAndBroadcast gate check, and
 * the acknowledgedRisk plumbing are copied byte-for-byte. Do not alter them.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSignGate } from "@/hooks/useSignGate";
import { isWalletLocked } from "@/utils/walletLock";
import {
  type SwapQuoteResponse,
  type BuildSwapTransactionResponse,
  type AppError,
  type SwapTokenInfo,
} from "@/services/tauri-api";
import type { SendableToken } from "@/components/SendTransaction";
import * as swapService from "@/services/swapService";
import {
  networkToChainId,
  toSmallestUnit,
  SUPPORTED_SWAP_CHAINS,
  type SwapProvider,
} from "@/utils/swapFormat";

// Swap steps
export type SwapStep =
  | "selectFrom"         // Select source token
  | "selectTo"           // Select destination token
  | "input"              // Enter amount
  | "quote"              // Review quote
  | "approve"            // Show approval needed (if needed)
  | "approvalPassword"   // Enter password for approval tx
  | "approving"          // Approval tx in progress
  | "password"           // Enter wallet password for swap
  | "signing"            // Signing in progress
  | "broadcasting"       // Broadcasting in progress
  | "success"            // Transaction submitted
  | "error";             // Error occurred

// Token list cache for each chain (chain-specific, not provider-specific)
// Key is chainId only (e.g., "ethereum", "bnb"), value is array of tokens
// This follows cold wallet security best practice: token registry is chain-specific,
// provider only affects quote/route/build operations
type TokenCache = Record<string, SwapTokenInfo[]>;

// Destination token shape (from SwapConfirm's ToToken, network optional here)
type ToToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  network?: string;
};

export interface UseSwapFlowParams {
  walletId: string;
  walletPassphrase?: string;
  availableTokens: SendableToken[];
  usbPath: string;
  sessionToken: string;
  isPro: boolean;
  onSuccess?: (txHash: string) => void;
}

export function useSwapFlow({
  walletId,
  walletPassphrase: preValidatedPassphrase,
  availableTokens,
  usbPath,
  sessionToken,
  isPro,
  onSuccess,
}: UseSwapFlowParams) {
  const { t } = useTranslation();
  // Token selection state
  const [fromToken, setFromToken] = useState<SendableToken | null>(null);
  const [toToken, setToToken] = useState<ToToken | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [walletPassword, setWalletPassword] = useState("");

  // Approval state
  const [approvalAmount, setApprovalAmount] = useState(""); // Approval amount in human-readable format
  const [isUnlimitedApproval, setIsUnlimitedApproval] = useState(false);
  const [currentAllowance, setCurrentAllowance] = useState<string | null>(null); // Current on-chain allowance
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);

  // Transaction state
  const [step, setStep] = useState<SwapStep>("selectFrom");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quote and transaction data
  const [quote, setQuote] = useState<SwapQuoteResponse | null>(null);
  const [swapTx, setSwapTx] = useState<BuildSwapTransactionResponse | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // DEX Token List state
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

  // Shared sign-gate: once the DEX router tx data is built we know the real
  // on-chain target (router) + calldata. Runs the txguard security check,
  // surfaces the backend's requiresAcknowledge conclusion, and holds the
  // acknowledgment checkbox state. Null until the swap tx is assembled.
  const gate = useSignGate(
    swapTx && fromToken
      ? {
          from: fromToken.fromAddress,
          to: swapTx.txData.to,
          chainId,
          value: swapTx.txData.value || "0",
          data: swapTx.txData.data || "",
          usbPath,
          sessionToken,
          isPro,
        }
      : null,
  );

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

        const response = await swapService.fetchSwapTokens({
          chainId,
          provider: registryProvider, // Fixed registry source
          usbPath,
          sessionToken,  // ✅ Low-risk: token registry query
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
  }, [fromToken, chainId, tokenCacheKey, usbPath, sessionToken, tokenCache]);

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

      const result = await swapService.fetchQuote({
        chainId,
        fromTokenAddress: fromAddr,
        toTokenAddress: toToken.address,
        amount: amountWei,
        fromAddress: fromToken.fromAddress,
        slippage,
        provider: isPro ? undefined : selectedProvider, // Pro: backend picks best; Free: user-selected
        isPro,
        usbPath,
        sessionToken,  // ✅ Low-risk: quote query
      });

      setQuote(result);
    } catch (err) {
      const appErr = err as AppError;
      console.error("Quote fetch failed:", appErr);
      setError(appErr.message || t('swap.failedToGetQuote'));
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [fromToken, toToken, amount, chainId, slippage, selectedProvider, isPro, usbPath, sessionToken]);

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

  // Build swap transaction - first check allowance, then decide if approval is needed
  const handleBuildSwapTx = async () => {
    if (!fromToken || !toToken || !quote) {
      setError(t('swap.missingRequiredData'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amountWei = toSmallestUnit(amount, fromToken.decimals);

      console.log("🔧 Building swap transaction...");

      const { swapTx: builtTx, allowance } = await swapService.buildSwap({
        chainId,
        fromToken,
        toTokenAddress: toToken.address,
        amountWei,
        slippage,
        provider: selectedProvider,
        isPro,
        usbPath,
        sessionToken,
      });

      setSwapTx(builtTx);
      setCurrentAllowance(allowance.current);

      if (allowance.needsApproval) {
        setApprovalAmount(amount);
        setIsUnlimitedApproval(false);
        setStep("approve");
      } else {
        setStep("password");
      }
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr.message || t('swap.failedToBuildTx'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle approval - navigate to approval password step
  const handleApprove = async () => {
    // Navigate to approval password step to get user's password for signing approval tx
    setStep("approvalPassword");
  };

  // Execute the approval transaction (sign and broadcast)
  const handleExecuteApproval = async () => {
    if (!walletPassword) {
      setError(t('swap.pleaseEnterPassword'));
      return;
    }
    if (!fromToken || !quote || !swapTx) {
      setError(t('swap.missingTokenOrQuote'));
      return;
    }

    setStep("approving");
    setIsLoading(true);
    setError(null);
    setApprovalTxHash(null);

    try {
      // Determine approval amount: unlimited or specific amount
      let approvalAmountWei = "";
      if (!isUnlimitedApproval && approvalAmount) {
        approvalAmountWei = toSmallestUnit(approvalAmount, fromToken.decimals);
        console.log(`🔐 Getting approval for specific amount: ${approvalAmount} (${approvalAmountWei} wei)`);
      } else {
        console.log("🔐 Getting unlimited approval...");
      }

      // Use swapTx.txData.to as the spender (DEX router address)
      // Note: quote.approvalAddress may be empty for some DEX providers (e.g., OpenOcean)
      // The swap transaction's "to" field is the DEX router that needs approval
      const spenderAddress = quote.approvalAddress || swapTx.txData.to;
      console.log(`🔐 Spender address: ${spenderAddress}`);

      const approvalTxHash = await swapService.executeApproval({
        chainId,
        walletId,
        fromToken,
        spenderAddress,
        approvalAmountWei,
        walletPassword,
        preValidatedPassphrase: preValidatedPassphrase || "",
        usbPath,
        sessionToken,
      });

      setApprovalTxHash(approvalTxHash);

      // Success! Now proceed to swap password step
      console.log("✅ Approval complete, proceeding to swap...");
      setWalletPassword(""); // Clear password for security, user will re-enter for swap
      setStep("password");

    } catch (err) {
      const appErr = err as AppError;
      console.error("🔴 Approval failed:", appErr);
      const msg = appErr.message;
      if (msg === "APPROVAL_FAILED") {
        setError(t('swap.approvalFailed'));
      } else if (msg === "APPROVAL_TIMEOUT") {
        setError(t('swap.approvalTimeout'));
      } else {
        setError(appErr.message || t('swap.failedToApprove'));
      }
      setStep("approve"); // Go back to approve step to retry
    } finally {
      setIsLoading(false);
    }
  };

  // Sign and broadcast swap
  const handleSignAndBroadcast = async () => {
    // Action-level guard: refuse to sign a backend-flagged danger until the user
    // ticks the acknowledgment checkbox (mirrors the button's disabled prop).
    if (gate.requiresAcknowledge && !gate.acknowledged) {
      return;
    }

    // Check if wallet is locked due to membership limit
    if (isWalletLocked(walletId)) {
      setError(t('wallet.walletLocked', 'Wallet is locked due to membership limit. Please upgrade to unlock.'));
      return;
    }

    if (!walletPassword) {
      setError(t('swap.pleaseEnterPassword'));
      return;
    }
    if (!swapTx || !fromToken) {
      setError(t('swap.noTransactionToSign'));
      return;
    }

    setStep("signing");
    setIsLoading(true);
    setError(null);

    try {
      const txHash = await swapService.executeSwap(
        {
          chainId,
          walletId,
          fromToken,
          toToken,
          swapTx,
          walletPassword,
          preValidatedPassphrase: preValidatedPassphrase || "",
          acknowledgedRisk: gate.acknowledged,
          isPro,
          usbPath,
          sessionToken,
        },
        { onProgress: (stage) => setStep(stage) },
      );

      setTxHash(txHash);
      setStep("success");
      onSuccess?.(txHash);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr.message || t('swap.failedToExecuteSwap'));
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

  // Handle provider selection
  const handleProviderSelect = (provider: SwapProvider) => {
    setSelectedProvider(provider);
    setShowProviderDropdown(false);
    // Reset quote when provider changes
    setQuote(null);
  };

  return {
    state: {
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
      selectedProvider,
      showProviderDropdown,
      chainId,
      swappableTokens,
      tokensByNetwork,
      gate,
    },
    actions: {
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
      setSelectedProvider,
      setShowProviderDropdown,
      isValidAmount,
      getDestinationTokens,
      handleSelectFromToken,
      handleSelectToToken,
      handleBuildSwapTx,
      handleApprove,
      handleExecuteApproval,
      handleSignAndBroadcast,
      handleReset,
      handleProviderSelect,
    },
  };
}
