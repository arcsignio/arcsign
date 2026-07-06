/**
 * useWalletData — 錢包「解鎖 → 載入資料」狀態機 hook。
 *
 * 由 WalletDetail.tsx 抽出：三個 handler（unlock / validatePassphrase / refresh）
 * 與其共享 state 是一組耦合狀態機，故收攏成單一 hook。行為與原元件逐字一致 ——
 * 特別是 `validatedPassphrase`（簽章輸入）的驗證時機、`setValidatedPassphrase`
 * 呼叫點，以及 password 生命週期（`tempPassword` 用完即清、`passwordRef.current`
 * 作為 transient 持有者）皆原封不動搬遷，不得「優化」。
 */
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppPassword } from "@/contexts/AppPasswordContext";
import { useWalletSessionStore } from "@/stores/walletSessionStore";
import { useWalletConnect } from "@/contexts/WalletConnectContext";
import tauriApi, { type AppError } from "@/services/tauri-api";
import type { TokenBalance, TokenBalancesResponse, ProviderUnavailable } from "@/types/tokens";
import type { Wallet } from "@/types/wallet";
import type { Address } from "@/types/address";
import { enrichNativeTokens } from "@/utils/enrichTokens";

export interface UseWalletDataParams {
  wallet: Wallet;
  usbPath: string;
}

export function useWalletData({ wallet, usbPath }: UseWalletDataParams) {
  const { t } = useTranslation();
  const { getSessionToken } = useAppPassword(); // ✅ Zero password storage!
  const walletSession = useWalletSessionStore();
  const walletConnect = useWalletConnect();

  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  // Providers (chains) that couldn't be fetched — e.g. no Alchemy/NodeReal key.
  const [unavailableProviders, setUnavailableProviders] = useState<ProviderUnavailable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet session state (replaces password state)
  const [tempPassword, setTempPassword] = useState(""); // Only used during unlock, immediately discarded
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true);
  // Temporary password ref for operations that still require password
  // TODO: Migrate all APIs to use session tokens, then remove this ref
  const passwordRef = useRef<string>("");

  // Passphrase validation state (for wallets with BIP39 passphrase)
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [validatedPassphrase, setValidatedPassphrase] = useState<string | null>(null);
  const [isValidatingPassphrase, setIsValidatingPassphrase] = useState(false);

  // Store wallet addresses from AddressBook (loaded when unlocking wallet)
  const [walletAddresses, setWalletAddresses] = useState<Address[]>([]);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        enrichNativeTokens(response.tokens);
      } else {
        console.error("❌ Invalid tokens data:", response?.tokens);
      }

      setTokens(response.tokens);
      setTotalUsd(response.totalUsd);
      setUnavailableProviders(response.unavailableProviders || []);
      setShowPasswordPrompt(false);

      // Set wallet context for WalletConnect signing operations
      // Use the first EVM address (Ethereum address) for WalletConnect
      console.log("[WalletDetail] Looking for ETH address in:",
        addressResponse.addresses.slice(0, 5).map(a => ({ name: a.name, symbol: a.symbol, address: a.address.slice(0, 10) }))
      );
      const evmAddress = addressResponse.addresses.find(
        (addr) => addr.name === "Ethereum" || addr.symbol === "ETH" || addr.coin_type === 60
      );
      if (evmAddress) {
        walletConnect.setWalletContext(wallet.id, evmAddress.address);
        console.log("[WalletDetail] ✅ Set WalletConnect context:", {
          walletId: wallet.id,
          address: evmAddress.address,
        });
      } else {
        console.warn("[WalletDetail] ⚠️ No Ethereum address found in wallet!");
      }
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
          enrichNativeTokens(response.tokens);
        }

        setTokens(response.tokens);
        setTotalUsd(response.totalUsd);

        // Set wallet context for WalletConnect signing operations
        // Use the first EVM address (Ethereum address) for WalletConnect
        const evmAddress = walletAddresses.find(
          (addr) => addr.name === "Ethereum" || addr.symbol === "ETH" || addr.coin_type === 60
        );
        if (evmAddress) {
          walletConnect.setWalletContext(wallet.id, evmAddress.address);
          console.log("[WalletDetail] ✅ Set WalletConnect context (with passphrase):", {
            walletId: wallet.id,
            address: evmAddress.address,
          });
        } else {
          console.warn("[WalletDetail] ⚠️ No Ethereum address found in wallet (passphrase flow)!");
        }
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
        enrichNativeTokens(response.tokens);
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

  return {
    state: {
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
    },
    actions: {
      setTempPassword,
      setPassphrase,
      setError,
      setShowPasswordPrompt,
      setShowPassphrasePrompt,
      unlock: handleLoadBalances,
      validatePassphrase: handleValidatePassphrase,
      refresh: handleRefreshBalances,
    },
  };
}
