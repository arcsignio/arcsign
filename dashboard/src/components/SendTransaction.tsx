/**
 * SendTransaction Component
 * Feature: EVM Transaction Send Functionality
 *
 * Complete transaction flow:
 * 1. User enters recipient address and amount
 * 2. Estimate fees and build unsigned transaction
 * 3. User confirms and enters wallet password
 * 4. Sign transaction with wallet private key
 * 5. Broadcast to blockchain network
 * 6. Track transaction status
 */

import React, { useState, useEffect, useCallback } from "react";
import tauriApi, {
  type BuildTransactionResponse,
  type SignTransactionResponse,
  type BroadcastTransactionResponse,
  type EstimateFeeResponse,
  type AppError,
} from "@/services/tauri-api";

// Mainnet EVM chains
const MAINNET_CHAINS = [
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "⟠" },
  { id: "polygon", name: "Polygon", symbol: "MATIC", icon: "⬡" },
  { id: "arbitrum", name: "Arbitrum", symbol: "ETH", icon: "🔵" },
  { id: "optimism", name: "Optimism", symbol: "ETH", icon: "🔴" },
  { id: "base", name: "Base", symbol: "ETH", icon: "🔷" },
] as const;

// Testnet chains (dev mode only)
const TESTNET_CHAINS = [
  { id: "ethereum-sepolia", name: "Sepolia Testnet", symbol: "ETH", icon: "🧪", isTestnet: true },
] as const;

// Combine chains based on environment
const SUPPORTED_CHAINS = import.meta.env.DEV
  ? [...MAINNET_CHAINS, ...TESTNET_CHAINS]
  : MAINNET_CHAINS;

type ChainId = typeof MAINNET_CHAINS[number]["id"] | typeof TESTNET_CHAINS[number]["id"];
type FeeSpeed = "slow" | "normal" | "fast";

// Transaction steps
type TransactionStep =
  | "input"      // Enter recipient and amount
  | "review"     // Review transaction details
  | "password"   // Enter wallet password
  | "signing"    // Signing in progress
  | "broadcasting" // Broadcasting in progress
  | "success"    // Transaction submitted
  | "error";     // Error occurred

interface SendTransactionProps {
  walletId: string;
  fromAddress: string;
  usbPath: string;
  appPassword: string;
  onBack: () => void;
  onSuccess?: (txHash: string) => void;
}

// Helper to get block explorer URL
function getExplorerUrl(chainId: ChainId, txHash: string): string {
  const explorers: Record<ChainId, string> = {
    ethereum: "https://etherscan.io/tx/",
    polygon: "https://polygonscan.com/tx/",
    arbitrum: "https://arbiscan.io/tx/",
    optimism: "https://optimistic.etherscan.io/tx/",
    base: "https://basescan.org/tx/",
    "ethereum-sepolia": "https://sepolia.etherscan.io/tx/",
  };
  return `${explorers[chainId]}${txHash}`;
}

// Helper to format ETH values
function formatEth(wei: string): string {
  const eth = parseFloat(wei) / 1e18;
  if (eth === 0) return "0";
  if (eth < 0.0001) return "<0.0001";
  if (eth < 0.01) return eth.toFixed(6);
  if (eth < 1) return eth.toFixed(4);
  return eth.toFixed(4);
}

// Helper to shorten address
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export const SendTransaction: React.FC<SendTransactionProps> = ({
  walletId,
  fromAddress,
  usbPath,
  appPassword,
  onBack,
  onSuccess,
}) => {
  // Form state
  const [chainId, setChainId] = useState<ChainId>("ethereum");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed>("normal");
  const [walletPassword, setWalletPassword] = useState("");

  // Transaction state
  const [step, setStep] = useState<TransactionStep>("input");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction data
  const [feeEstimate, setFeeEstimate] = useState<EstimateFeeResponse | null>(null);
  const [unsignedTx, setUnsignedTx] = useState<BuildTransactionResponse | null>(null);
  // signedTx is set but only used for debugging - suppress warning
  const [_signedTx, setSignedTx] = useState<SignTransactionResponse | null>(null);
  void _signedTx; // Suppress unused variable warning
  const [broadcastResult, setBroadcastResult] = useState<BroadcastTransactionResponse | null>(null);

  // Get current chain info
  const currentChain = SUPPORTED_CHAINS.find(c => c.id === chainId) || SUPPORTED_CHAINS[0];

  // Validate Ethereum address
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Validate amount
  const isValidAmount = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  };

  // Estimate fees when inputs change
  const estimateFees = useCallback(async () => {
    if (!isValidAddress(toAddress) || !isValidAmount(amount)) {
      setFeeEstimate(null);
      return;
    }

    try {
      console.log("💰 Estimating fees...");
      const result = await tauriApi.estimateFee({
        chainId,
        from: fromAddress,
        to: toAddress,
        amount,
        usbPath,
        appPassword,
      });
      setFeeEstimate(result);
      setError(null);
    } catch (err) {
      const appErr = err as AppError;
      console.error("Fee estimation failed:", appErr);
      // Don't show error for fee estimation - just clear the estimate
      setFeeEstimate(null);
    }
  }, [chainId, fromAddress, toAddress, amount, usbPath, appPassword]);

  // Debounced fee estimation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (toAddress && amount) {
        estimateFees();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [toAddress, amount, chainId, estimateFees]);

  // Step 1: Build unsigned transaction
  const handleBuildTransaction = async () => {
    if (!isValidAddress(toAddress)) {
      setError("Invalid recipient address");
      return;
    }
    if (!isValidAmount(amount)) {
      setError("Invalid amount");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("🔧 Building transaction...");
      const result = await tauriApi.buildTransaction({
        chainId,
        from: fromAddress,
        to: toAddress,
        amount,
        feeSpeed,
        usbPath,
        appPassword,
      });
      setUnsignedTx(result);
      setStep("review");
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr.message || "Failed to build transaction");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Sign transaction with wallet password
  const handleSignTransaction = async () => {
    if (!walletPassword) {
      setError("Please enter your wallet password");
      return;
    }
    if (!unsignedTx) {
      setError("No transaction to sign");
      return;
    }

    setStep("signing");
    setIsLoading(true);
    setError(null);

    try {
      console.log("✍️ Signing transaction...");
      const result = await tauriApi.signTransaction({
        chainId,
        walletId,
        password: walletPassword,
        fromAddress,
        unsignedTx: unsignedTx.unsignedTx,
        usbPath,
        appPassword,
      });
      setSignedTx(result);

      // Immediately broadcast after signing
      await handleBroadcastTransaction(result);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr.message || "Failed to sign transaction");
      setStep("password");
    } finally {
      setIsLoading(false);
      setWalletPassword(""); // Clear password from memory
    }
  };

  // Step 3: Broadcast signed transaction
  const handleBroadcastTransaction = async (signed: SignTransactionResponse) => {
    setStep("broadcasting");
    setIsLoading(true);

    try {
      console.log("📡 Broadcasting transaction...");
      const result = await tauriApi.broadcastTransaction({
        chainId,
        signedTx: signed.signedTx,
        usbPath,
        appPassword,
      });
      setBroadcastResult(result);
      setStep("success");
      onSuccess?.(result.txHash);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr.message || "Failed to broadcast transaction");
      setStep("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setToAddress("");
    setAmount("");
    setWalletPassword("");
    setFeeSpeed("normal");
    setStep("input");
    setError(null);
    setFeeEstimate(null);
    setUnsignedTx(null);
    setSignedTx(null);
    setBroadcastResult(null);
  };


  return (
    <div className="send-transaction">
      <header className="send-header">
        <button onClick={onBack} className="back-button">
          <span>&larr;</span> Back
        </button>
        <h2>Send {currentChain.symbol}</h2>
        <div className="chain-badge">
          <span className="chain-icon">{currentChain.icon}</span>
          {currentChain.name}
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

      {/* Step 1: Input Form */}
      {step === "input" && (
        <div className="input-form">
          {/* From Address */}
          <div className="form-group">
            <label>From</label>
            <div className="address-display">
              <span className="address-text">{shortenAddress(fromAddress)}</span>
            </div>
          </div>

          {/* Chain Selector */}
          <div className="form-group">
            <label>Network</label>
            <div className="chain-selector">
              {SUPPORTED_CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  className={`chain-option ${chainId === chain.id ? "selected" : ""}`}
                  onClick={() => setChainId(chain.id)}
                >
                  <span className="chain-icon">{chain.icon}</span>
                  <span className="chain-name">{chain.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* To Address */}
          <div className="form-group">
            <label>To Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className={`address-input ${toAddress && !isValidAddress(toAddress) ? "invalid" : ""}`}
            />
            {toAddress && !isValidAddress(toAddress) && (
              <span className="field-error">Invalid Ethereum address</span>
            )}
          </div>

          {/* Amount */}
          <div className="form-group">
            <label>Amount ({currentChain.symbol})</label>
            <div className="amount-input-wrapper">
              <input
                type="text"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="amount-input"
              />
              <button className="max-button" onClick={() => setAmount("MAX")}>
                MAX
              </button>
            </div>
          </div>

          {/* Fee Speed Selector */}
          {feeEstimate && (
            <div className="form-group">
              <label>Transaction Speed</label>
              <div className="fee-selector">
                {(["slow", "normal", "fast"] as FeeSpeed[]).map((speed) => {
                  const fee = feeEstimate[speed];
                  return (
                    <button
                      key={speed}
                      className={`fee-option ${feeSpeed === speed ? "selected" : ""}`}
                      onClick={() => setFeeSpeed(speed)}
                    >
                      <span className="fee-speed">
                        {speed === "slow" ? "🐢" : speed === "normal" ? "🚗" : "🚀"}
                        {speed.charAt(0).toUpperCase() + speed.slice(1)}
                      </span>
                      <span className="fee-estimate">
                        {formatEth(fee.estimatedFeeWei)} {currentChain.symbol}
                      </span>
                      <span className="fee-time">
                        ~{Math.ceil(fee.estimatedTimeSeconds / 60)} min
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Continue Button */}
          <button
            className="primary-button"
            onClick={handleBuildTransaction}
            disabled={isLoading || !isValidAddress(toAddress) || !isValidAmount(amount)}
          >
            {isLoading ? "Building Transaction..." : "Continue"}
          </button>
        </div>
      )}

      {/* Step 2: Review Transaction */}
      {step === "review" && unsignedTx && (
        <div className="review-form">
          <h3>Review Transaction</h3>

          <div className="review-details">
            <div className="review-row">
              <span className="review-label">Network</span>
              <span className="review-value">
                {currentChain.icon} {currentChain.name}
              </span>
            </div>
            <div className="review-row">
              <span className="review-label">From</span>
              <span className="review-value address">{shortenAddress(fromAddress)}</span>
            </div>
            <div className="review-row">
              <span className="review-label">To</span>
              <span className="review-value address">{shortenAddress(toAddress)}</span>
            </div>
            <div className="review-row highlight">
              <span className="review-label">Amount</span>
              <span className="review-value amount">
                {amount} {currentChain.symbol}
              </span>
            </div>
            <div className="review-row">
              <span className="review-label">Estimated Fee</span>
              <span className="review-value">
                {formatEth(unsignedTx.feeEstimate.estimatedFeeWei)} {currentChain.symbol}
              </span>
            </div>
            <div className="review-row total">
              <span className="review-label">Total</span>
              <span className="review-value">
                {(parseFloat(amount) + parseFloat(unsignedTx.feeEstimate.estimatedFeeEth)).toFixed(6)} {currentChain.symbol}
              </span>
            </div>
          </div>

          <div className="review-actions">
            <button className="secondary-button" onClick={() => setStep("input")}>
              Edit
            </button>
            <button className="primary-button" onClick={() => setStep("password")}>
              Confirm & Sign
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Password Entry */}
      {step === "password" && (
        <div className="password-form">
          <div className="password-icon">🔐</div>
          <h3>Enter Wallet Password</h3>
          <p className="password-description">
            Your password is required to sign this transaction securely.
          </p>

          <div className="form-group">
            <input
              type="password"
              placeholder="Enter wallet password"
              value={walletPassword}
              onChange={(e) => setWalletPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSignTransaction()}
              autoFocus
              className="password-input"
            />
          </div>

          <div className="password-actions">
            <button className="secondary-button" onClick={() => setStep("review")}>
              Back
            </button>
            <button
              className="primary-button"
              onClick={handleSignTransaction}
              disabled={!walletPassword || isLoading}
            >
              Sign & Send
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Signing in Progress */}
      {step === "signing" && (
        <div className="progress-view">
          <div className="progress-spinner" />
          <h3>Signing Transaction...</h3>
          <p>Please wait while your transaction is being signed.</p>
        </div>
      )}

      {/* Step 5: Broadcasting */}
      {step === "broadcasting" && (
        <div className="progress-view">
          <div className="progress-spinner" />
          <h3>Broadcasting Transaction...</h3>
          <p>Submitting your transaction to the {currentChain.name} network.</p>
        </div>
      )}

      {/* Step 6: Success */}
      {step === "success" && broadcastResult && (
        <div className="success-view">
          <div className="success-icon">✅</div>
          <h3>Transaction Submitted!</h3>
          <p className="success-message">
            Your transaction has been submitted to the {currentChain.name} network.
          </p>

          <div className="tx-hash">
            <span className="tx-label">Transaction Hash</span>
            <code className="tx-value">{shortenAddress(broadcastResult.txHash)}</code>
          </div>

          <div className="success-actions">
            <a
              href={getExplorerUrl(chainId, broadcastResult.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
            >
              View on Explorer →
            </a>
            <button className="primary-button" onClick={handleReset}>
              Send Another
            </button>
            <button className="secondary-button" onClick={onBack}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {step === "error" && (
        <div className="error-view">
          <div className="error-icon-large">❌</div>
          <h3>Transaction Failed</h3>
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <button className="secondary-button" onClick={handleReset}>
              Try Again
            </button>
            <button className="secondary-button" onClick={onBack}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        .send-transaction {
          max-width: 480px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .send-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .send-header h2 {
          flex: 1;
          margin: 0;
          font-size: 20px;
          color: #111827;
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

        .chain-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #dbeafe;
          border-radius: 20px;
          font-size: 13px;
          color: #1d4ed8;
          font-weight: 500;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 8px;
          margin-bottom: 20px;
          color: #dc2626;
          font-size: 14px;
        }

        .error-banner button {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          color: #dc2626;
          font-size: 16px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .address-display {
          padding: 12px 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
          color: #6b7280;
        }

        .chain-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chain-option {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
          transition: all 0.2s;
        }

        .chain-option:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .chain-option.selected {
          background: #dbeafe;
          border-color: #3b82f6;
          color: #1d4ed8;
        }

        .address-input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          font-family: monospace;
          transition: border-color 0.2s;
        }

        .address-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .address-input.invalid {
          border-color: #ef4444;
        }

        .field-error {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: #ef4444;
        }

        .amount-input-wrapper {
          display: flex;
          gap: 8px;
        }

        .amount-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 500;
        }

        .amount-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .max-button {
          padding: 12px 16px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: #3b82f6;
        }

        .max-button:hover {
          background: #e5e7eb;
        }

        .fee-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .fee-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .fee-option:hover {
          background: #f3f4f6;
        }

        .fee-option.selected {
          background: #dbeafe;
          border-color: #3b82f6;
        }

        .fee-speed {
          flex: 1;
          font-weight: 500;
          color: #374151;
        }

        .fee-estimate {
          font-size: 14px;
          color: #6b7280;
        }

        .fee-time {
          font-size: 12px;
          color: #9ca3af;
        }

        .primary-button {
          width: 100%;
          padding: 14px 24px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
        }

        .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .primary-button:disabled {
          background: #d1d5db;
          box-shadow: none;
          cursor: not-allowed;
        }

        .secondary-button {
          padding: 12px 24px;
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .secondary-button:hover {
          background: #e5e7eb;
        }

        /* Review Form */
        .review-form h3 {
          margin: 0 0 20px;
          font-size: 18px;
          color: #111827;
        }

        .review-details {
          background: #f9fafb;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .review-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .review-row:last-child {
          border-bottom: none;
        }

        .review-label {
          font-size: 14px;
          color: #6b7280;
        }

        .review-value {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
        }

        .review-value.address {
          font-family: monospace;
        }

        .review-value.amount {
          font-size: 18px;
          color: #2563eb;
        }

        .review-row.highlight {
          background: #dbeafe;
          margin: 0 -16px;
          padding: 12px 16px;
          border-radius: 8px;
        }

        .review-row.total {
          font-weight: 600;
        }

        .review-actions {
          display: flex;
          gap: 12px;
        }

        .review-actions .secondary-button {
          flex: 1;
        }

        .review-actions .primary-button {
          flex: 2;
        }

        /* Password Form */
        .password-form {
          text-align: center;
          padding: 20px 0;
        }

        .password-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .password-form h3 {
          margin: 0 0 8px;
          font-size: 20px;
          color: #111827;
        }

        .password-description {
          margin: 0 0 24px;
          font-size: 14px;
          color: #6b7280;
        }

        .password-input {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 16px;
          text-align: center;
          transition: all 0.2s;
        }

        .password-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .password-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .password-actions .secondary-button {
          flex: 1;
        }

        .password-actions .primary-button {
          flex: 2;
        }

        /* Progress View */
        .progress-view {
          text-align: center;
          padding: 48px 20px;
        }

        .progress-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 24px;
        }

        .progress-view h3 {
          margin: 0 0 8px;
          font-size: 20px;
          color: #111827;
        }

        .progress-view p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        /* Success View */
        .success-view {
          text-align: center;
          padding: 32px 20px;
        }

        .success-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .success-view h3 {
          margin: 0 0 8px;
          font-size: 24px;
          color: #111827;
        }

        .success-message {
          margin: 0 0 24px;
          font-size: 14px;
          color: #6b7280;
        }

        .tx-hash {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .tx-label {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .tx-value {
          font-size: 14px;
          font-family: monospace;
          color: #111827;
        }

        .success-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .explorer-link {
          display: block;
          padding: 12px;
          background: #dbeafe;
          color: #1d4ed8;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .explorer-link:hover {
          background: #bfdbfe;
        }

        /* Error View */
        .error-view {
          text-align: center;
          padding: 48px 20px;
        }

        .error-icon-large {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .error-view h3 {
          margin: 0 0 8px;
          font-size: 20px;
          color: #111827;
        }

        .error-view .error-message {
          margin: 0 0 24px;
          font-size: 14px;
          color: #dc2626;
        }

        .error-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
