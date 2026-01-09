/**
 * StakingTransaction Component
 * Feature: Liquid Staking via verified protocols (Lido)
 *
 * Complete staking flow:
 * 1. User selects staking protocol (e.g., Lido)
 * 2. User enters ETH amount to stake
 * 3. Review estimated stETH output and APY
 * 4. User confirms and enters wallet password
 * 5. Sign and broadcast staking transaction
 * 6. Track transaction status
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import tauriApi, { type AppError, type BuildTransactionResponse } from "@/services/tauri-api";
import type { SendableToken } from "./SendTransaction";
import type { StakingStep, DefiProtocol } from "@/types/defi";
import {
  getStakingProtocols,
  encodeLidoSubmit,
} from "@/constants/defiProtocols";

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

// Convert human-readable amount to wei
function toWei(amount: string): string {
  if (!amount || isNaN(parseFloat(amount))) return "0";
  const parts = amount.split(".");
  const integerPart = parts[0] || "0";
  let decimalPart = parts[1] || "";
  if (decimalPart.length < 18) {
    decimalPart = decimalPart.padEnd(18, "0");
  } else if (decimalPart.length > 18) {
    decimalPart = decimalPart.slice(0, 18);
  }
  const result = (integerPart + decimalPart).replace(/^0+/, "") || "0";
  return result;
}

// Convert wei to human-readable
function fromWei(amount: string): string {
  if (!amount || amount === "0") return "0";
  const padded = amount.padStart(19, "0");
  const intPart = padded.slice(0, -18) || "0";
  const decPart = padded.slice(-18);
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

// Get block explorer URL
function getExplorerUrl(txHash: string): string {
  return `https://etherscan.io/tx/${txHash}`;
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

  // Protocol selection
  const [selectedProtocol, setSelectedProtocol] = useState<DefiProtocol | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [walletPassword, setWalletPassword] = useState("");

  // Transaction state
  const [step, setStep] = useState<StakingStep>("selectProtocol");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction data
  const [txHash, setTxHash] = useState<string | null>(null);
  const [estimatedStETH, setEstimatedStETH] = useState<string>("");
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);

  // Get available staking protocols
  const stakingProtocols = getStakingProtocols();

  // Filter ETH tokens from Ethereum mainnet only (for Lido staking)
  const ethTokens = availableTokens.filter(
    t => t.network === "eth-mainnet" && !t.tokenAddress
  );

  // Get user's ETH balance
  const ethBalance = ethTokens.length > 0 ? ethTokens[0].balance : "0";
  const ethAddress = ethTokens.length > 0 ? ethTokens[0].fromAddress : "";

  // Calculate estimated stETH output (1:1 for Lido)
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      // Lido stETH is 1:1 with ETH at time of staking
      setEstimatedStETH(amount);
    } else {
      setEstimatedStETH("");
    }
  }, [amount]);

  // Validate amount
  const isValidAmount = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0 && num <= parseFloat(ethBalance);
  };

  // Handle protocol selection
  const handleSelectProtocol = (protocol: DefiProtocol) => {
    setSelectedProtocol(protocol);
    setStep("input");
  };

  // Handle amount input with max button
  const handleSetMaxAmount = () => {
    // Leave some ETH for gas (0.01 ETH buffer)
    const maxAmount = Math.max(0, parseFloat(ethBalance) - 0.01);
    setAmount(maxAmount > 0 ? maxAmount.toString() : "0");
  };

  // Build and review transaction
  const handleReview = async () => {
    if (!selectedProtocol || !isValidAmount(amount)) {
      setError(t('staking.invalidAmount'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Estimate gas for the staking transaction
      const lidoContract = selectedProtocol.contracts.find(c => c.network === "ethereum");
      if (!lidoContract) {
        throw new Error("Protocol not available on Ethereum");
      }

      const amountWei = toWei(amount);
      const callData = encodeLidoSubmit();

      console.log("📊 Estimating gas for staking transaction...", {
        to: lidoContract.address,
        value: amountWei,
        data: callData,
      });

      const feeEstimate = await tauriApi.estimateFee({
        chainId: "ethereum",
        from: ethAddress,
        to: lidoContract.address,
        amount: amountWei,
        usbPath,
        appPassword,
      });

      // Use recommendedFee (maps to "normal" speed)
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
    if (!selectedProtocol || !walletPassword) {
      setError(t('staking.missingPassword'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setStep("signing");

    try {
      const lidoContract = selectedProtocol.contracts.find(c => c.network === "ethereum");
      if (!lidoContract) {
        throw new Error("Protocol not available on Ethereum");
      }

      const amountWei = toWei(amount);
      const callData = encodeLidoSubmit();

      // 1. Build the transaction
      console.log("🔧 Building staking transaction...");
      const buildResult: BuildTransactionResponse = await tauriApi.buildTransaction({
        chainId: "ethereum",
        from: ethAddress,
        to: lidoContract.address,
        amount: amountWei,
        data: callData,
        feeSpeed: "normal",
        usbPath,
        appPassword,
      });

      console.log("✅ Transaction built:", buildResult);

      // 2. Sign the transaction
      console.log("✍️ Signing transaction...");
      const signResult = await tauriApi.signTransaction({
        chainId: "ethereum",
        walletId,
        password: walletPassword,
        passphrase: preValidatedPassphrase || "",
        fromAddress: ethAddress,
        unsignedTx: buildResult,  // Pass the full BuildTransactionResponse
        usbPath,
        appPassword,
      });

      console.log("✅ Transaction signed");

      // 3. Broadcast the transaction
      setStep("broadcasting");
      console.log("📡 Broadcasting transaction...");

      const broadcastResult = await tauriApi.broadcastTransaction({
        chainId: "ethereum",
        signedTx: signResult,  // Pass the full SignTransactionResponse
        usbPath,
        appPassword,
      });

      console.log("✅ Transaction broadcast:", broadcastResult.txHash);

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

  // Render protocol selection step
  const renderProtocolSelection = () => (
    <div className="staking-protocol-selection">
      <h2 className="text-xl font-semibold mb-4">{t('staking.selectProtocol')}</h2>
      <p className="text-sm text-gray-600 mb-6">{t('staking.selectProtocolDesc')}</p>

      {stakingProtocols.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {t('staking.noProtocolsAvailable')}
        </div>
      ) : (
        <div className="space-y-3">
          {stakingProtocols.map((protocol) => (
            <button
              key={protocol.id}
              onClick={() => handleSelectProtocol(protocol)}
              className="w-full p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="flex items-center gap-4">
                <img
                  src={protocol.logoUrl}
                  alt={protocol.name}
                  className="w-10 h-10 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://via.placeholder.com/40?text=?";
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{protocol.name}</span>
                    {protocol.verified && (
                      <span className="text-green-600 text-xs">✓ {t('staking.verified')}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{protocol.description}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    {protocol.apy && (
                      <span className="text-green-600 font-medium">
                        APY: {protocol.apy}%
                      </span>
                    )}
                    {protocol.tvlUsd && (
                      <span>
                        TVL: ${(protocol.tvlUsd / 1_000_000_000).toFixed(1)}B
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </button>
          ))}
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
        onClick={() => setStep("selectProtocol")}
        className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        ← {t('staking.changeProtocol')}
      </button>

      <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
        <img
          src={selectedProtocol?.logoUrl}
          alt={selectedProtocol?.name}
          className="w-8 h-8 rounded-full"
        />
        <div>
          <span className="font-semibold">{selectedProtocol?.name}</span>
          <span className="text-sm text-green-600 ml-2">
            APY: {selectedProtocol?.apy}%
          </span>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">{t('staking.enterAmount')}</h2>

      {ethTokens.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-red-600 mb-2">{t('staking.noEthAvailable')}</p>
          <p className="text-sm text-gray-500">{t('staking.needEthOnMainnet')}</p>
        </div>
      ) : (
        <>
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
                <span className="text-gray-500">ETH</span>
                <button
                  onClick={handleSetMaxAmount}
                  className="text-blue-600 text-sm hover:text-blue-800"
                >
                  MAX
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {t('staking.available')}: {formatBalance(ethBalance)} ETH
            </div>
          </div>

          {estimatedStETH && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">{t('staking.youWillReceive')}</div>
              <div className="text-xl font-semibold text-green-700">
                ~{formatBalance(estimatedStETH)} stETH
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('staking.exchangeRate')}: 1 ETH = 1 stETH
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
        </>
      )}
    </div>
  );

  // Render review step
  const renderReview = () => (
    <div className="staking-review">
      <h2 className="text-xl font-semibold mb-4">{t('staking.reviewTransaction')}</h2>

      <div className="space-y-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">{t('staking.protocol')}</div>
          <div className="font-semibold">{selectedProtocol?.name}</div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">{t('staking.stakeAmount')}</div>
          <div className="font-semibold text-lg">{amount} ETH</div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">{t('staking.youWillReceive')}</div>
          <div className="font-semibold text-lg text-green-700">~{estimatedStETH} stETH</div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500 mb-1">{t('staking.estimatedApy')}</div>
          <div className="font-semibold text-green-600">{selectedProtocol?.apy}%</div>
        </div>

        {gasEstimate && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-1">{t('staking.estimatedGas')}</div>
            <div className="font-semibold">{fromWei(gasEstimate)} ETH</div>
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
        <p className="text-sm text-blue-800">
          <strong>{t('staking.note')}:</strong> {t('staking.stETHExplanation')}
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
        <span className="text-3xl">✓</span>
      </div>
      <h2 className="text-xl font-semibold mb-2 text-green-700">{t('staking.stakingSuccessful')}</h2>
      <p className="text-sm text-gray-600 mb-4">
        {t('staking.stakingSuccessDesc', { amount: amount, token: 'stETH' })}
      </p>

      {txHash && (
        <div className="mb-6">
          <a
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {t('staking.viewOnExplorer')} →
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
        <span className="text-3xl">✕</span>
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
      {step === "selectProtocol" && renderProtocolSelection()}
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
