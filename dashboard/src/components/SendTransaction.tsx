/**
 * SendTransaction Component
 * Feature: EVM Transaction Send Functionality
 *
 * Complete transaction flow:
 * 1. User selects which token to send (from their available balance)
 * 2. User enters recipient address and amount
 * 3. Estimate fees and build unsigned transaction
 * 4. User confirms and enters wallet password
 * 5. Sign transaction with wallet private key
 * 6. Broadcast to blockchain network
 * 7. Track transaction status
 */

import React, { useState, useEffect, useCallback } from "react";
import tauriApi, {
  type BuildTransactionResponse,
  type SignTransactionResponse,
  type BroadcastTransactionResponse,
  type EstimateFeeResponse,
  type AppError,
} from "@/services/tauri-api";

/**
 * SendableToken represents a token that the user can send
 * This is passed from WalletDetail based on tokens with balance > 0
 */
export interface SendableToken {
  network: string;           // "eth-mainnet", "polygon-mainnet", "eth-sepolia"
  networkLabel: string;      // "Ethereum", "Polygon", "eth-sepolia"
  tokenAddress: string;      // "" for native, contract address for ERC-20
  tokenSymbol: string;       // "ETH", "USDT", "AAVE"
  tokenName: string;         // "Ethereum", "Tether USD"
  tokenLogo: string;         // Logo URL
  balance: string;           // "0.05", "100.5"
  usdValue: number;          // USD value
  decimals: number;          // Token decimals
  fromAddress: string;       // User's wallet address on this network
}

type FeeSpeed = "slow" | "normal" | "fast";

// Transaction steps - now includes token selection
type TransactionStep =
  | "select"     // Select which token to send
  | "input"      // Enter recipient and amount
  | "review"     // Review transaction details
  | "password"   // Enter wallet password
  | "signing"    // Signing in progress
  | "broadcasting" // Broadcasting in progress
  | "success"    // Transaction submitted
  | "error";     // Error occurred

interface SendTransactionProps {
  walletId: string;
  walletHasPassphrase?: boolean;  // True if wallet uses BIP39 passphrase
  walletPassphrase?: string;      // Pre-validated passphrase from WalletDetail
  availableTokens: SendableToken[];  // Tokens with balance > 0
  usbPath: string;
  appPassword: string;
  onBack: () => void;
  onSuccess?: (txHash: string) => void;
}

// Map Internal Network ID to chainId for backend API
// Backend token balances use Internal Network IDs: "arbitrum-mainnet", "optimism-mainnet"
// Transaction API expects short chainId: "arbitrum", "optimism"
function networkToChainId(network: string): string {
  const mapping: Record<string, string> = {
    "eth-mainnet": "ethereum",
    "polygon-mainnet": "polygon",
    "arbitrum-mainnet": "arbitrum",
    "optimism-mainnet": "optimism",
    "base-mainnet": "base",
    "bnb-mainnet": "bnb",
    "eth-sepolia": "ethereum-sepolia",
  };
  return mapping[network] || network;
}

// Get block explorer URL for a transaction (using Internal Network IDs)
function getExplorerUrl(network: string, txHash: string): string {
  const explorers: Record<string, string> = {
    "eth-mainnet": "https://etherscan.io/tx/",
    "polygon-mainnet": "https://polygonscan.com/tx/",
    "arbitrum-mainnet": "https://arbiscan.io/tx/",
    "optimism-mainnet": "https://optimistic.etherscan.io/tx/",
    "base-mainnet": "https://basescan.org/tx/",
    "bnb-mainnet": "https://bscscan.com/tx/",
    "eth-sepolia": "https://sepolia.etherscan.io/tx/",
  };
  return `${explorers[network] || "https://etherscan.io/tx/"}${txHash}`;
}

// Get network display icon (using Internal Network IDs)
function getNetworkIcon(network: string): string {
  const icons: Record<string, string> = {
    "eth-mainnet": "⟠",
    "polygon-mainnet": "⬡",
    "arbitrum-mainnet": "🔵",
    "optimism-mainnet": "🔴",
    "base-mainnet": "🔷",
    "bnb-mainnet": "🟡",
    "eth-sepolia": "🧪",
  };
  return icons[network] || "🔗";
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

/**
 * Convert human-readable amount to smallest unit (wei for 18 decimals)
 * Example: "1.5" with 18 decimals -> "1500000000000000000"
 */
function toSmallestUnit(amount: string, decimals: number): string {
  // Handle empty or invalid input
  if (!amount || isNaN(parseFloat(amount))) {
    return "0";
  }

  // Split into integer and decimal parts
  const parts = amount.split(".");
  const integerPart = parts[0] || "0";
  let decimalPart = parts[1] || "";

  // Pad or truncate decimal part to match token decimals
  if (decimalPart.length < decimals) {
    decimalPart = decimalPart.padEnd(decimals, "0");
  } else if (decimalPart.length > decimals) {
    decimalPart = decimalPart.slice(0, decimals);
  }

  // Combine and remove leading zeros
  const result = (integerPart + decimalPart).replace(/^0+/, "") || "0";
  return result;
}

// Helper to shorten address
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export const SendTransaction: React.FC<SendTransactionProps> = ({
  walletId,
  walletHasPassphrase = false,
  walletPassphrase: preValidatedPassphrase,  // Pre-validated from WalletDetail
  availableTokens,
  usbPath,
  appPassword,
  onBack,
  onSuccess,
}) => {
  // Token selection state
  const [selectedToken, setSelectedToken] = useState<SendableToken | null>(null);

  // Form state
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed>("normal");
  const [walletPassword, setWalletPassword] = useState("");

  // Transaction state
  const [step, setStep] = useState<TransactionStep>("select");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction data
  const [feeEstimate, setFeeEstimate] = useState<EstimateFeeResponse | null>(null);
  const [unsignedTx, setUnsignedTx] = useState<BuildTransactionResponse | null>(null);
  // signedTx is set but only used for debugging - suppress warning
  const [_signedTx, setSignedTx] = useState<SignTransactionResponse | null>(null);
  void _signedTx; // Suppress unused variable warning
  const [broadcastResult, setBroadcastResult] = useState<BroadcastTransactionResponse | null>(null);

  // Get chainId for backend API
  const chainId = selectedToken ? networkToChainId(selectedToken.network) : "";

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
    if (!selectedToken || !isValidAddress(toAddress) || !isValidAmount(amount)) {
      setFeeEstimate(null);
      return;
    }

    try {
      console.log("💰 Estimating fees...");
      const result = await tauriApi.estimateFee({
        chainId,
        from: selectedToken.fromAddress,
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
  }, [chainId, selectedToken, toAddress, amount, usbPath, appPassword]);

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
    if (!selectedToken) {
      setError("Please select a token first");
      return;
    }
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
      // Convert human-readable amount to smallest unit (wei)
      // e.g., "1" LINK (18 decimals) -> "1000000000000000000"
      const decimals = selectedToken.decimals || 18;
      const amountInSmallestUnit = toSmallestUnit(amount, decimals);

      console.log("🔧 Building transaction...", {
        amount,
        decimals,
        amountInSmallestUnit,
        tokenSymbol: selectedToken.tokenSymbol,
      });

      const result = await tauriApi.buildTransaction({
        chainId,
        from: selectedToken.fromAddress,
        to: toAddress,
        amount: amountInSmallestUnit,  // Send in smallest unit (wei)
        feeSpeed,
        usbPath,
        appPassword,
        // For ERC-20 tokens, include token contract address
        tokenAddress: selectedToken.tokenAddress || undefined,
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
    if (!unsignedTx || !selectedToken) {
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
        passphrase: preValidatedPassphrase || "",  // Use pre-validated passphrase from WalletDetail
        fromAddress: selectedToken.fromAddress,
        unsignedTx: unsignedTx,  // Pass the full BuildTransactionResponse
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
      console.log("📡 Broadcasting transaction...", { txHash: signed.txHash });
      const result = await tauriApi.broadcastTransaction({
        chainId,
        signedTx: signed,  // Pass the entire SignTransactionResponse object
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
    setSelectedToken(null);
    setToAddress("");
    setAmount("");
    setWalletPassword("");
    setFeeSpeed("normal");
    setStep("select");
    setError(null);
    setFeeEstimate(null);
    setUnsignedTx(null);
    setSignedTx(null);
    setBroadcastResult(null);
  };

  // Handle token selection
  const handleSelectToken = (token: SendableToken) => {
    setSelectedToken(token);
    setStep("input");
  };

  // Check if it's an ERC-20 token (has tokenAddress)
  const isERC20 = selectedToken && selectedToken.tokenAddress && selectedToken.tokenAddress !== "";

  // Format balance display (truncate, no rounding)
  const formatBalance = (balance: string, _decimals?: number): string => {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num < 0.0001) return "<0.0001";

    // Truncate instead of rounding
    const truncate = (n: number, decimals: number): string => {
      const factor = Math.pow(10, decimals);
      return (Math.floor(n * factor) / factor).toFixed(decimals);
    };

    if (num < 0.01) return truncate(num, 6);
    if (num < 1000) return truncate(num, 6);
    return truncate(num, 4);
  };

  // Group tokens by network for better display
  const tokensByNetwork = availableTokens.reduce((acc, token) => {
    const network = token.networkLabel;
    if (!acc[network]) acc[network] = [];
    acc[network].push(token);
    return acc;
  }, {} as Record<string, SendableToken[]>);


  return (
    <div className="send-transaction">
      <header className="send-header">
        <button onClick={step === "select" ? onBack : () => setStep("select")} className="back-button">
          <span>&larr;</span> Back
        </button>
        <h2>Send {selectedToken ? selectedToken.tokenSymbol : "Token"}</h2>
        {selectedToken && (
          <div className="chain-badge">
            <span className="chain-icon">{getNetworkIcon(selectedToken.network)}</span>
            {selectedToken.networkLabel}
          </div>
        )}
      </header>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Step 0: Token Selection */}
      {step === "select" && (
        <div className="token-select-form">
          <h3>Select Token to Send</h3>
          <p className="select-description">Choose which asset you want to send</p>

          {availableTokens.length === 0 ? (
            <div className="no-tokens">
              <span className="no-tokens-icon">📭</span>
              <p>No tokens with balance available to send</p>
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
                    {tokens[0].network.includes("sepolia") && (
                      <span className="testnet-badge">Testnet</span>
                    )}
                  </div>
                  <div className="network-tokens">
                    {tokens.map((token, idx) => (
                      <button
                        key={`${token.network}-${token.tokenAddress || "native"}-${idx}`}
                        className="token-option"
                        onClick={() => handleSelectToken(token)}
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
                          {token.tokenAddress && (
                            <span className="token-type">ERC-20</span>
                          )}
                        </div>
                        <div className="token-balance">
                          <span className="balance-amount">{formatBalance(token.balance, token.decimals)}</span>
                          {token.usdValue > 0 && (
                            <span className="balance-usd">${token.usdValue.toFixed(2)}</span>
                          )}
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

      {/* Step 1: Input Form */}
      {step === "input" && selectedToken && (
        <div className="input-form">
          {/* Selected Token Info */}
          <div className="selected-token-card">
            <div className="token-icon">
              {selectedToken.tokenLogo ? (
                <img src={selectedToken.tokenLogo} alt={selectedToken.tokenSymbol} />
              ) : (
                <span className="token-icon-fallback">{selectedToken.tokenSymbol.slice(0, 2)}</span>
              )}
            </div>
            <div className="token-details">
              <span className="token-symbol">{selectedToken.tokenSymbol}</span>
              <span className="token-balance-info">
                Balance: {formatBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.tokenSymbol}
              </span>
            </div>
            <button className="change-token-btn" onClick={() => setStep("select")}>
              Change
            </button>
          </div>

          {/* From Address */}
          <div className="form-group">
            <label>From</label>
            <div className="address-display">
              <span className="address-text">{shortenAddress(selectedToken.fromAddress)}</span>
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
            <label>Amount ({selectedToken.tokenSymbol})</label>
            <div className="amount-input-wrapper">
              <input
                type="text"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="amount-input"
              />
              <button className="max-button" onClick={() => setAmount(selectedToken.balance)}>
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
                  // Map speed to backend fee fields
                  const feeWei = speed === "slow"
                    ? feeEstimate.minFee
                    : speed === "normal"
                      ? feeEstimate.recommendedFee
                      : feeEstimate.maxFee;
                  // Estimate time based on speed (rough estimates)
                  const estimatedMinutes = speed === "slow" ? 10 : speed === "normal" ? 3 : 1;
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
                        {formatEth(feeWei)} ETH
                      </span>
                      <span className="fee-time">
                        ~{estimatedMinutes} min
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ERC-20 Notice */}
          {isERC20 && (
            <div className="erc20-notice">
              <span className="notice-icon">ℹ️</span>
              <span>This is an ERC-20 token. Gas fees will be paid in ETH.</span>
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
      {step === "review" && unsignedTx && selectedToken && (
        <div className="review-form">
          <h3>Review Transaction</h3>

          <div className="review-details">
            <div className="review-row">
              <span className="review-label">Network</span>
              <span className="review-value">
                {getNetworkIcon(selectedToken.network)} {selectedToken.networkLabel}
              </span>
            </div>
            <div className="review-row">
              <span className="review-label">Token</span>
              <span className="review-value">
                {selectedToken.tokenSymbol} {isERC20 && <span className="erc20-tag">(ERC-20)</span>}
              </span>
            </div>
            <div className="review-row">
              <span className="review-label">From</span>
              <span className="review-value address">{shortenAddress(selectedToken.fromAddress)}</span>
            </div>
            <div className="review-row">
              <span className="review-label">To</span>
              <span className="review-value address">{shortenAddress(toAddress)}</span>
            </div>
            <div className="review-row highlight">
              <span className="review-label">Amount</span>
              <span className="review-value amount">
                {amount} {selectedToken.tokenSymbol}
              </span>
            </div>
            <div className="review-row">
              <span className="review-label">Estimated Fee</span>
              <span className="review-value">
                {formatEth(unsignedTx.fee)} ETH
              </span>
            </div>
            {!isERC20 && (
              <div className="review-row total">
                <span className="review-label">Total</span>
                <span className="review-value">
                  {(parseFloat(amount) + parseFloat(unsignedTx.fee) / 1e18).toFixed(6)} {selectedToken.tokenSymbol}
                </span>
              </div>
            )}
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

          {/* Passphrase indicator - shown if wallet uses passphrase (already validated) */}
          {walletHasPassphrase && preValidatedPassphrase && (
            <div className="passphrase-validated">
              <span className="validated-icon">✓</span>
              <span>BIP39 passphrase verified</span>
            </div>
          )}

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
      {step === "broadcasting" && selectedToken && (
        <div className="progress-view">
          <div className="progress-spinner" />
          <h3>Broadcasting Transaction...</h3>
          <p>Submitting your transaction to the {selectedToken.networkLabel} network.</p>
        </div>
      )}

      {/* Step 6: Success */}
      {step === "success" && broadcastResult && selectedToken && (
        <div className="success-view">
          <div className="success-icon">✅</div>
          <h3>Transaction Submitted!</h3>
          <p className="success-message">
            Your transaction has been submitted to the {selectedToken.networkLabel} network.
          </p>

          <div className="tx-hash">
            <span className="tx-label">Transaction Hash</span>
            <code className="tx-value">{shortenAddress(broadcastResult.txHash)}</code>
          </div>

          <div className="success-actions">
            <a
              href={getExplorerUrl(selectedToken.network, broadcastResult.txHash)}
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

        /* Token Selection Styles */
        .token-select-form h3 {
          margin: 0 0 8px;
          font-size: 18px;
          color: #111827;
        }

        .select-description {
          margin: 0 0 20px;
          font-size: 14px;
          color: #6b7280;
        }

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
          margin: 0 0 20px;
          color: #6b7280;
        }

        .token-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .network-group {
          background: #f9fafb;
          border-radius: 12px;
          overflow: hidden;
        }

        .network-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #f3f4f6;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .network-icon {
          font-size: 16px;
        }

        .testnet-badge {
          margin-left: auto;
          padding: 2px 8px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
        }

        .network-tokens {
          display: flex;
          flex-direction: column;
        }

        .token-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: white;
          border: none;
          border-bottom: 1px solid #e5e7eb;
          cursor: pointer;
          text-align: left;
          transition: background 0.2s;
          width: 100%;
        }

        .token-option:last-child {
          border-bottom: none;
        }

        .token-option:hover {
          background: #f9fafb;
        }

        .token-option .token-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .token-option .token-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .token-icon-fallback {
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
        }

        .token-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .token-info .token-symbol {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
        }

        .token-info .token-name {
          font-size: 12px;
          color: #6b7280;
        }

        .token-type {
          display: inline-block;
          padding: 2px 6px;
          background: #dbeafe;
          color: #1d4ed8;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          margin-top: 2px;
          width: fit-content;
        }

        .token-balance {
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .balance-amount {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
        }

        .balance-usd {
          font-size: 12px;
          color: #6b7280;
        }

        .token-arrow {
          color: #9ca3af;
          font-size: 18px;
        }

        /* Selected Token Card */
        .selected-token-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .selected-token-card .token-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .selected-token-card .token-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .token-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .token-details .token-symbol {
          font-size: 18px;
          font-weight: 600;
          color: #0369a1;
        }

        .token-balance-info {
          font-size: 13px;
          color: #0284c7;
        }

        .change-token-btn {
          padding: 8px 16px;
          background: white;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          color: #0284c7;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .change-token-btn:hover {
          background: #0ea5e9;
          color: white;
        }

        /* ERC-20 Notice */
        .erc20-notice {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #fefce8;
          border: 1px solid #fef08a;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #854d0e;
        }

        .erc20-tag {
          font-size: 11px;
          padding: 2px 6px;
          background: #dbeafe;
          color: #1d4ed8;
          border-radius: 4px;
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

        /* Passphrase Validated Indicator */
        .passphrase-validated {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 8px;
          margin-bottom: 16px;
          color: #166534;
          font-size: 14px;
          font-weight: 500;
        }

        .validated-icon {
          font-size: 16px;
          color: #22c55e;
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
