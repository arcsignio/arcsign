/**
 * StakingTransaction Component
 * Feature: Multi-chain Liquid Staking via verified protocols
 *
 * Complete staking flow:
 * 1. User sees ALL staking options in a flat list (ETH→stETH via Lido, BNB→ankrBNB via Ankr, etc.)
 * 2. User selects a staking option
 * 3. User enters amount to stake
 * 4. Review estimated output and APY
 * 5. User confirms and enters wallet password
 * 6. Sign and broadcast staking transaction
 * 7. Track transaction status
 */

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import tauriApi, { type AppError, type BuildTransactionResponse } from "@/services/tauri-api";
import type { SendableToken } from "./SendTransaction";
import type { StakingStep, StakableAsset, StakingProvider } from "@/types/defi";
import {
  getStakableAssetsWithMetrics,
  getCallDataEncoder,
  getExplorerTxUrl,
} from "@/constants/stakingRegistry";

interface StakingTransactionProps {
  walletId: string;
  walletHasPassphrase?: boolean;
  walletPassphrase?: string;
  availableTokens: SendableToken[];
  usbPath: string;
  appPassword: string;
  onBack: () => void;
  onSuccess?: (txHash: string) => void;
}

// Flat staking option combining asset and provider
interface StakingOption {
  asset: StakableAsset;
  provider: StakingProvider;
  // Computed fields for display
  id: string;           // e.g., "lido-eth"
  inputSymbol: string;  // e.g., "ETH"
  outputSymbol: string; // e.g., "stETH"
  chainName: string;    // e.g., "Ethereum"
  providerName: string; // e.g., "Lido"
}

// Map network names to chain IDs used in availableTokens
const NETWORK_TO_TOKEN_NETWORK: Record<string, string> = {
  ethereum: "eth-mainnet",
  bsc: "bsc-mainnet",
  polygon: "polygon-mainnet",
};

// Convert human-readable amount to wei (supports different decimals)
function toSmallestUnit(amount: string, decimals: number = 18): string {
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

// Convert smallest unit to human-readable (supports different decimals)
function fromSmallestUnit(amount: string, decimals: number = 18): string {
  if (!amount || amount === "0") return "0";
  const padded = amount.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, -decimals) || "0";
  const decPart = padded.slice(-decimals);
  const trimmed = decPart.slice(0, 8).replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}

// Format balance for display
function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  if (num < 0.01) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  return num.toFixed(2);
}

// Format TVL for display
function formatTvl(tvl: number | undefined): string {
  if (!tvl) return "-";
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(0)}M`;
  return `$${tvl.toLocaleString()}`;
}

export const StakingTransaction: React.FC<StakingTransactionProps> = ({
  walletId,
  walletHasPassphrase: _walletHasPassphrase = false,
  walletPassphrase: preValidatedPassphrase,
  availableTokens,
  usbPath,
  appPassword,
  onBack,
  onSuccess,
}) => {
  void _walletHasPassphrase;
  const { t } = useTranslation();

  // Selected staking option (combines asset + provider)
  const [selectedOption, setSelectedOption] = useState<StakingOption | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [walletPassword, setWalletPassword] = useState("");

  // Transaction state
  const [step, setStep] = useState<StakingStep>("selectOption");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction data
  const [txHash, setTxHash] = useState<string | null>(null);
  const [estimatedOutput, setEstimatedOutput] = useState<string>("");
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);

  // Metrics loading state (APY + TVL)
  const [stakingOptions, setStakingOptions] = useState<StakingOption[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  // Fetch staking options with APY and TVL on mount
  useEffect(() => {
    async function loadStakingOptions() {
      setIsLoadingMetrics(true);
      try {
        const assetsWithMetrics = await getStakableAssetsWithMetrics();
        const options: StakingOption[] = [];

        for (const asset of assetsWithMetrics) {
          for (const provider of asset.providers) {
            options.push({
              asset,
              provider,
              id: provider.id,
              inputSymbol: asset.symbol,
              outputSymbol: provider.outputToken,
              chainName: asset.name,
              providerName: provider.name,
            });
          }
        }

        setStakingOptions(options);
      } catch (error) {
        console.error("Failed to load staking options:", error);
      } finally {
        setIsLoadingMetrics(false);
      }
    }

    loadStakingOptions();
  }, []);

  // Use the loaded staking options
  const allStakingOptions = stakingOptions;

  // Get user's balance for a specific asset
  const getAssetBalance = (asset: StakableAsset): string => {
    const tokenNetwork = NETWORK_TO_TOKEN_NETWORK[asset.chainId];
    const token = availableTokens.find(
      t => t.network === tokenNetwork && !t.tokenAddress
    );
    return token?.balance || "0";
  };

  // Get user's address for selected option
  const selectedAssetAddress = useMemo(() => {
    if (!selectedOption) return "";
    const tokenNetwork = NETWORK_TO_TOKEN_NETWORK[selectedOption.asset.chainId];
    const token = availableTokens.find(
      t => t.network === tokenNetwork && !t.tokenAddress
    );
    return token?.fromAddress || "";
  }, [selectedOption, availableTokens]);

  // Get balance for selected option
  const selectedAssetBalance = useMemo(() => {
    if (!selectedOption) return "0";
    return getAssetBalance(selectedOption.asset);
  }, [selectedOption, availableTokens]);

  // Calculate estimated output (1:1 for most liquid staking)
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      setEstimatedOutput(amount);
    } else {
      setEstimatedOutput("");
    }
  }, [amount]);

  // Validate amount
  const isValidAmount = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0 && num <= parseFloat(selectedAssetBalance);
  };

  // Handle option selection
  const handleSelectOption = (option: StakingOption) => {
    setSelectedOption(option);
    setAmount("");
    setStep("input");
  };

  // Handle amount input with max button
  const handleSetMaxAmount = () => {
    // Leave some native token for gas (0.01 buffer)
    const maxAmount = Math.max(0, parseFloat(selectedAssetBalance) - 0.01);
    setAmount(maxAmount > 0 ? maxAmount.toString() : "0");
  };

  // Build and review transaction
  const handleReview = async () => {
    if (!selectedOption || !isValidAmount(amount)) {
      setError(t('staking.invalidAmount'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const amountSmallest = toSmallestUnit(amount, selectedOption.asset.decimals);
      const encoder = getCallDataEncoder(selectedOption.provider.id);
      const callData = encoder(amountSmallest);

      console.log("Estimating gas for staking transaction...", {
        chainId: selectedOption.asset.chainId,
        to: selectedOption.provider.contractAddress,
        value: amountSmallest,
        data: callData,
      });

      const feeEstimate = await tauriApi.estimateFee({
        chainId: selectedOption.asset.chainId,
        from: selectedAssetAddress,
        to: selectedOption.provider.contractAddress,
        amount: amountSmallest,
        usbPath,
        appPassword,
      });

      setGasEstimate(feeEstimate.recommendedFee || null);
      setStep("review");
    } catch (err) {
      const appErr = err as AppError;
      console.error("Gas estimation failed:", appErr);
      setError(appErr.message || t('staking.gasEstimateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Proceed to password entry
  const handleProceedToPassword = () => {
    setStep("password");
  };

  // Execute staking transaction
  const handleExecuteStaking = async () => {
    if (!selectedOption || !walletPassword) {
      setError(t('staking.missingPassword'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep("signing");

    try {
      const amountSmallest = toSmallestUnit(amount, selectedOption.asset.decimals);
      const encoder = getCallDataEncoder(selectedOption.provider.id);
      const callData = encoder(amountSmallest);

      // 1. Build the transaction
      console.log("Building staking transaction...");
      const buildResult: BuildTransactionResponse = await tauriApi.buildTransaction({
        chainId: selectedOption.asset.chainId,
        from: selectedAssetAddress,
        to: selectedOption.provider.contractAddress,
        amount: amountSmallest,
        data: callData,
        feeSpeed: "normal",
        usbPath,
        appPassword,
      });

      console.log("Transaction built:", buildResult);

      // 2. Sign the transaction
      console.log("Signing transaction...");
      const signResult = await tauriApi.signTransaction({
        chainId: selectedOption.asset.chainId,
        walletId,
        password: walletPassword,
        passphrase: preValidatedPassphrase || "",
        fromAddress: selectedAssetAddress,
        unsignedTx: buildResult,
        usbPath,
        appPassword,
      });

      console.log("Transaction signed");

      // 3. Broadcast the transaction
      setStep("broadcasting");
      console.log("Broadcasting transaction...");

      const broadcastResult = await tauriApi.broadcastTransaction({
        chainId: selectedOption.asset.chainId,
        signedTx: signResult,
        usbPath,
        appPassword,
      });

      console.log("Transaction broadcast:", broadcastResult.txHash);

      setTxHash(broadcastResult.txHash);
      setStep("success");

      // Clear password from memory
      setWalletPassword("");

      // Callback
      if (onSuccess) {
        onSuccess(broadcastResult.txHash);
      }
    } catch (err) {
      const appErr = err as AppError;
      console.error("Staking transaction failed:", appErr);
      setError(appErr.message || t('staking.transactionFailed'));
      setStep("error");
      setWalletPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  // Render flat list of all staking options
  const renderOptionSelection = () => (
    <div className="staking-option-selection">
      <h2 className="text-xl font-semibold mb-4">{t('staking.selectStakingOption')}</h2>
      <p className="text-sm text-gray-600 mb-6">{t('staking.selectStakingOptionDesc')}</p>

      {isLoadingMetrics ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">{t('staking.loadingMetrics')}</p>
        </div>
      ) : (
      <div className="space-y-3">
        {allStakingOptions.map((option) => {
          const balance = getAssetBalance(option.asset);
          const hasBalance = parseFloat(balance) > 0;

          return (
            <button
              key={option.id}
              onClick={() => handleSelectOption(option)}
              className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                {/* Provider logo */}
                <img
                  src={option.provider.logoUrl}
                  alt={option.providerName}
                  className="w-10 h-10 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/40?text=?";
                  }}
                />
                <div className="flex-1">
                  {/* Main line: ETH → stETH (Lido) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{option.inputSymbol}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-semibold text-blue-600">{option.outputSymbol}</span>
                    <span className="text-gray-500">({option.providerName})</span>
                    {option.provider.verified && (
                      <span className="text-green-600 text-xs">&check;</span>
                    )}
                  </div>

                  {/* Second line: Chain, APY, TVL */}
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
                    <span>{option.chainName}</span>
                    {option.provider.apy && (
                      <span className="text-green-600 font-medium">
                        APY: {option.provider.apy}%
                      </span>
                    )}
                    {option.provider.tvlUsd && (
                      <span>TVL: {formatTvl(option.provider.tvlUsd)}</span>
                    )}
                  </div>

                  {/* Third line: User balance */}
                  <div className={`text-xs mt-1 ${hasBalance ? 'text-gray-600' : 'text-gray-400'}`}>
                    {t('staking.yourBalance')}: {formatBalance(balance)} {option.inputSymbol}
                  </div>
                </div>
                <span className="text-gray-400">&rarr;</span>
              </div>
            </button>
          );
        })}
      </div>
      )}

      <button
        onClick={onBack}
        className="mt-6 w-full py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
      >
        {t('staking.goBack')}
      </button>
    </div>
  );

  // Render amount input step
  const renderAmountInput = () => (
    <div className="staking-amount-input">
      <button
        onClick={() => {
          setSelectedOption(null);
          setStep("selectOption");
        }}
        className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        &larr; {t('staking.changeOption')}
      </button>

      {/* Selected option summary */}
      <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
        <img
          src={selectedOption?.provider.logoUrl}
          alt={selectedOption?.providerName}
          className="w-8 h-8 rounded-full"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{selectedOption?.inputSymbol}</span>
            <span className="text-gray-400">→</span>
            <span className="font-semibold text-blue-600">{selectedOption?.outputSymbol}</span>
            <span className="text-gray-500">({selectedOption?.providerName})</span>
          </div>
          <div className="text-sm text-gray-500">{selectedOption?.chainName}</div>
        </div>
        {selectedOption?.provider.apy && (
          <span className="text-sm text-green-600 font-medium">
            APY: {selectedOption.provider.apy}%
          </span>
        )}
      </div>

      <h2 className="text-xl font-semibold mb-4">{t('staking.enterAmount')}</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('staking.amountToStake')}
        </label>
        <div className="relative">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-gray-500">{selectedOption?.inputSymbol}</span>
            <button
              onClick={handleSetMaxAmount}
              className="text-blue-600 text-sm hover:text-blue-800"
            >
              MAX
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {t('staking.available')}: {formatBalance(selectedAssetBalance)} {selectedOption?.inputSymbol}
        </div>
      </div>

      {/* Insufficient balance warning */}
      {amount && parseFloat(amount) > 0 && parseFloat(amount) > parseFloat(selectedAssetBalance) && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700">{t('staking.insufficientBalance')}</p>
        </div>
      )}

      {estimatedOutput && parseFloat(amount) <= parseFloat(selectedAssetBalance) && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">{t('staking.youWillReceive')}</div>
          <div className="text-xl font-semibold text-green-700">
            ~{formatBalance(estimatedOutput)} {selectedOption?.outputSymbol}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {t('staking.exchangeRate')}: 1 {selectedOption?.inputSymbol} = 1 {selectedOption?.outputSymbol}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          {t('actions.cancel')}
        </button>
        <button
          onClick={handleReview}
          disabled={!isValidAmount(amount) || isLoading}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? t('common.loading') : t('staking.reviewTransaction')}
        </button>
      </div>
    </div>
  );

  // Render review step
  const renderReview = () => (
    <div className="staking-review">
      <h2 className="text-xl font-semibold mb-4">{t('staking.reviewTransaction')}</h2>

      <div className="space-y-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">{t('staking.provider')}</div>
          <div className="font-semibold">{selectedOption?.providerName}</div>
          <div className="text-sm text-gray-500">{selectedOption?.chainName}</div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">{t('staking.stakeAmount')}</div>
          <div className="font-semibold text-lg">{amount} {selectedOption?.inputSymbol}</div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">{t('staking.youWillReceive')}</div>
          <div className="font-semibold text-lg text-green-700">
            ~{estimatedOutput} {selectedOption?.outputSymbol}
          </div>
        </div>

        {selectedOption?.provider.apy && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">{t('staking.estimatedApy')}</div>
            <div className="font-semibold text-green-600">{selectedOption.provider.apy}%</div>
          </div>
        )}

        {gasEstimate && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">{t('staking.estimatedGas')}</div>
            <div className="font-semibold">
              {fromSmallestUnit(gasEstimate, selectedOption?.asset.decimals || 18)} {selectedOption?.inputSymbol}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
        <p className="text-sm text-blue-800">
          <strong>{t('staking.note')}:</strong> {t('staking.liquidStakingExplanation', {
            outputToken: selectedOption?.outputSymbol,
          })}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setStep("input")}
          className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          {t('staking.goBack')}
        </button>
        <button
          onClick={handleProceedToPassword}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('staking.confirmStake')}
        </button>
      </div>
    </div>
  );

  // Render password entry step
  const renderPasswordEntry = () => (
    <div className="staking-password">
      <h2 className="text-xl font-semibold mb-4">{t('staking.enterPassword')}</h2>
      <p className="text-sm text-gray-600 mb-6">{t('staking.enterPasswordDesc')}</p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('staking.walletPassword')}
        </label>
        <input
          type="password"
          value={walletPassword}
          onChange={(e) => setWalletPassword(e.target.value)}
          placeholder={t('staking.passwordPlaceholder')}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            setWalletPassword("");
            setStep("review");
          }}
          className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          {t('staking.goBack')}
        </button>
        <button
          onClick={handleExecuteStaking}
          disabled={!walletPassword || isLoading}
          className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('staking.confirmAndStake')}
        </button>
      </div>
    </div>
  );

  // Render signing/broadcasting step
  const renderProgress = () => (
    <div className="staking-progress text-center py-8">
      <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
      <h2 className="text-xl font-semibold mb-2">
        {step === "signing" ? t('staking.signingTransaction') : t('staking.broadcastingTransaction')}
      </h2>
      <p className="text-sm text-gray-600">
        {t('staking.pleaseWait')}
      </p>
    </div>
  );

  // Render success step
  const renderSuccess = () => (
    <div className="staking-success text-center py-8">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">&check;</span>
      </div>
      <h2 className="text-xl font-semibold mb-2 text-green-700">{t('staking.stakingSuccessful')}</h2>
      <p className="text-sm text-gray-600 mb-4">
        {t('staking.stakingSuccessDesc', {
          amount: amount,
          symbol: selectedOption?.inputSymbol,
          token: selectedOption?.outputSymbol
        })}
      </p>

      {txHash && selectedOption && (
        <div className="mb-6">
          <a
            href={getExplorerTxUrl(selectedOption.asset.chainId, txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {t('staking.viewOnExplorer')} &rarr;
          </a>
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        {t('staking.done')}
      </button>
    </div>
  );

  // Render error step
  const renderError = () => (
    <div className="staking-error text-center py-8">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">&times;</span>
      </div>
      <h2 className="text-xl font-semibold mb-2 text-red-700">{t('staking.transactionFailed')}</h2>
      <p className="text-sm text-gray-600 mb-4">{error}</p>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          {t('staking.goBack')}
        </button>
        <button
          onClick={() => {
            setError(null);
            setStep("input");
          }}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('staking.tryAgain')}
        </button>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="staking-transaction max-w-lg mx-auto p-4">
      {step === "selectOption" && renderOptionSelection()}
      {step === "input" && renderAmountInput()}
      {step === "review" && renderReview()}
      {step === "password" && renderPasswordEntry()}
      {(step === "signing" || step === "broadcasting") && renderProgress()}
      {step === "success" && renderSuccess()}
      {step === "error" && renderError()}
    </div>
  );
};

export default StakingTransaction;
