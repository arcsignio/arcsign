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
import { AddressBook } from "@/components/AddressBook";
import { SignGateAcknowledge } from "@/components/SignGateAcknowledge";
import { useSignGate } from "@/hooks/useSignGate";
import { isWalletLocked } from "@/utils/walletLock";
import { useIsPro } from "@/stores/dashboardStore";
import { getNativeToken, getNetworkKey } from "@/constants/nativeTokens";
import tauriApi, {
  type BuildTransactionResponse,
  type SignTransactionResponse,
  type BroadcastTransactionResponse,
  type EstimateFeeResponse,
  type SecurityReport,
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
  sessionToken: string;  // ✅ Session token for provider config access (low-risk operations)
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
    "avalanche-mainnet": "avalanche",
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
    "avalanche-mainnet": "https://snowtrace.io/tx/",
    "eth-sepolia": "https://sepolia.etherscan.io/tx/",
  };
  return `${explorers[network] || "https://etherscan.io/tx/"}${txHash}`;
}

// Get network display icon (using Internal Network IDs)
function getNetworkIcon(network: string): string {
  const icons: Record<string, string> = {
    "eth-mainnet": "E",
    "polygon-mainnet": "P",
    "arbitrum-mainnet": "A",
    "optimism-mainnet": "O",
    "base-mainnet": "B",
    "bnb-mainnet": "N",
    "avalanche-mainnet": "AV",
    "eth-sepolia": "T",
  };
  return icons[network] || "?";
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

/**
 * SecurityReportPanel — displays transaction security check results.
 * Pro users: full security report (blacklist check + simulation preview)
 * Free users: upgrade prompt with feature preview
 */
export const SecurityReportPanel: React.FC<{
  security: SecurityReport;
  isPro: boolean;
}> = ({ security, isPro }) => {
  // The blacklist check runs for EVERYONE (free, embedded seed) — its verdict is
  // valid regardless of Pro status. `proRequired` now means ONLY "simulation
  // didn't run", NOT "report invalid". So the danger/blacklist alert must render
  // for free users too; only the simulation preview + upgrade CTA are gated on
  // proRequired. (Backend computes the verdict — txguard.Check; the frontend only
  // renders the conclusion. The old `if (!isPro) return upgrade-prompt` swallowed
  // the whole panel, hiding a real OFAC hit behind "not security checked".)
  const isDanger = security.riskLevel === 'danger';
  const isWarning = security.riskLevel === 'warning';
  const simulationGated = security.proRequired; // simulation didn't run (no key / free)

  return (
    <div className={`security-panel ${isDanger ? 'security-panel-danger' : isWarning ? 'security-panel-warning' : 'security-panel-safe'}`}>
      <div className="security-header">
        <span className="security-icon">&#x1F6E1;</span>
        <span className="security-title">Security Check</span>
        <span className={`security-badge ${security.riskLevel}`}>
          {isDanger ? 'DANGER' : isWarning ? 'WARNING' : 'SAFE'}
        </span>
      </div>

      {/* Blacklist warning */}
      {security.blacklistMatch && (
        <div className="security-alert security-alert-danger">
          <strong>Blacklisted Address</strong>
          <p>Target address is on the {formatBlacklistSource(security.blacklistMatch.source)} blacklist ({security.blacklistMatch.category}).</p>
          <p className="security-alert-address">{security.blacklistMatch.value}</p>
        </div>
      )}

      {/* Simulation warnings */}
      {security.warnings?.filter(w => w.type === 'SIMULATION_FAILED').map((w, i) => (
        <div key={i} className="security-alert security-alert-warning">
          <strong>Simulation Warning</strong>
          <p>{w.message}</p>
        </div>
      ))}

      {/* Simulation results */}
      {security.simulation?.success && security.simulation.assetChanges?.length > 0 && (
        <div className="security-simulation">
          <p className="security-sim-title">Simulation Preview</p>
          {security.simulation.assetChanges.map((change, i) => {
            const isOutgoing = change.from.toLowerCase() !== change.to.toLowerCase() && change.changeType === 'TRANSFER';
            return (
              <div key={i} className={`security-sim-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                <span className="sim-direction">{isOutgoing ? '\u25BC' : '\u25B2'}</span>
                <span className="sim-amount">
                  {change.amount ? formatSimAmount(change.amount, change.decimals) : '?'} {change.symbol}
                </span>
              </div>
            );
          })}
          {security.simulation.gasUsed && (
            <div className="security-sim-row gas">
              <span className="sim-direction">&#x26FD;</span>
              <span className="sim-amount">Gas: {security.simulation.gasUsed}</span>
            </div>
          )}
        </div>
      )}

      {/* No blacklist match = address cleared the (free) blacklist check. */}
      {!security.blacklistMatch && !isDanger && !isWarning && (
        <p className="security-safe-text">Address is not on any known blacklist.</p>
      )}

      {/* Simulation upsell — only the SIMULATION is Pro-gated, not the blacklist.
          A slim note (not a scary "not security checked") so free users know the
          blacklist DID run; the deeper simulation preview is the Pro feature. */}
      {simulationGated && (
        <div className="security-sim-upsell">
          <p className="security-sim-upsell-text">
            Blacklist check complete. Transaction simulation preview is a Pro feature.
          </p>
          {!isPro && (
            <a
              href="https://arcsign.io/mint"
              target="_blank"
              rel="noopener noreferrer"
              className="security-upgrade-btn"
            >
              Upgrade to Pro — 30 USDT/year
            </a>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Map an internal blacklist source ID to a user-facing label. The backend seed
 * uses implementation-detail IDs like "embedded-ofac" / "embedded-mew" (the
 * "embedded-" prefix means it shipped in the offline seed); users should just
 * see "OFAC" / "MEW". Pure presentation — falls back to the raw source.
 */
function formatBlacklistSource(source: string): string {
  // Keep this map in sync with the backend's actual source values:
  //   seed.go        → "embedded-ofac" / "embedded-mew"
  //   manager.go     → "OFAC" / "ScamSniffer" / "MetaMask"
  // Every currently-emitted source is mapped, so the fallback below never runs
  // in practice. When a NEW backend source is added, ADD IT HERE — don't rely on
  // the fallback. The fallback's blanket .toUpperCase() is a deliberate
  // last-resort for an unmapped source (it would render e.g. "Chainalysis" as
  // "CHAINALYSIS"): acceptable as a safety net, not as the intended path.
  const map: Record<string, string> = {
    'embedded-ofac': 'OFAC',
    'embedded-mew': 'MEW',
    'OFAC': 'OFAC',
    'ScamSniffer': 'ScamSniffer',
    'MetaMask': 'MetaMask',
  };
  return map[source] || source.replace(/^embedded-/, '').toUpperCase();
}

/** Format simulation amount from raw units to human-readable */
function formatSimAmount(rawAmount: string, decimals: number): string {
  try {
    const num = parseFloat(rawAmount) / Math.pow(10, decimals || 18);
    if (num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return rawAmount;
  }
}

export const SendTransaction: React.FC<SendTransactionProps> = ({
  walletId,
  walletHasPassphrase = false,
  walletPassphrase: preValidatedPassphrase,  // Pre-validated from WalletDetail
  availableTokens,
  usbPath,
  sessionToken,  // ✅ Session token for low-risk operations
  onBack,
  onSuccess,
}) => {
  // Pro membership status
  const isPro = useIsPro();

  // Token selection state
  const [selectedToken, setSelectedToken] = useState<SendableToken | null>(null);

  // Form state
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [showContactPicker, setShowContactPicker] = useState(false);
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

  // Shared sign-gate: once the unsigned tx is built we know the real on-chain
  // target (token contract for ERC-20, recipient for native). Runs the txguard
  // security check, surfaces the backend's requiresAcknowledge conclusion, and
  // holds the acknowledgment checkbox state. Null until the tx is assembled.
  const gate = useSignGate(
    unsignedTx && selectedToken
      ? {
          from: unsignedTx.from,
          to: unsignedTx.to,
          chainId,
          value: unsignedTx.amount,
          data: "",
          usbPath,
          sessionToken,
          isPro,
        }
      : null,
  );

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
        sessionToken,  // ✅ Low-risk: fee estimation uses session token
      });
      setFeeEstimate(result);
      setError(null);
    } catch (err) {
      const appErr = err as AppError;
      console.error("Fee estimation failed:", appErr);
      // Don't show error for fee estimation - just clear the estimate
      setFeeEstimate(null);
    }
  }, [chainId, selectedToken, toAddress, amount, usbPath, sessionToken]);

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
        sessionToken,  // ✅ Low-risk: building transaction uses session token
        isPro,         // Pro membership enables security checks
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
    // Action-level guard: refuse to sign a backend-flagged danger until the user
    // ticks the acknowledgment checkbox (mirrors the button's disabled prop).
    if (gate.requiresAcknowledge && !gate.acknowledged) {
      return;
    }

    // Check if wallet is locked due to membership limit
    if (isWalletLocked(walletId)) {
      setError("Wallet is locked due to membership limit. Please upgrade to unlock.");
      return;
    }

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
        password: walletPassword,  // ✅ High-risk: wallet password for signing
        passphrase: preValidatedPassphrase || "",  // Use pre-validated passphrase from WalletDetail
        fromAddress: selectedToken.fromAddress,
        unsignedTx: unsignedTx,  // Pass the full BuildTransactionResponse
        usbPath,
        sessionToken,  // ✅ Session token for provider config access
        acknowledgedRisk: gate.acknowledged,  // user acknowledged a backend-flagged danger
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
        sessionToken,  // ✅ Low-risk: broadcasting uses session token
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

  // Native coin symbol for this chain (BNB on BSC, ETH on Ethereum/L2s, MATIC on
  // Polygon, AVAX on Avalanche). Gas is always paid in the native coin — never
  // hardcode "ETH". Falls back to "ETH" only if the network is unrecognized.
  const nativeSymbol = (() => {
    if (!selectedToken) return "ETH";
    const key = getNetworkKey(selectedToken.network) || getNetworkKey(selectedToken.networkLabel);
    return (key && getNativeToken(key)?.symbol) || "ETH";
  })();

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
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
              <span className="no-tokens-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>
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
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="text"
                placeholder="0x..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className={`address-input ${toAddress && !isValidAddress(toAddress) ? "invalid" : ""}`}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowContactPicker(true)}
                title="Select from Address Book"
                style={{
                  background: "#f0fdfa",
                  border: "1px solid #99f6e4",
                  borderRadius: "8px",
                  padding: "0.5rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </button>
            </div>
            {toAddress && !isValidAddress(toAddress) && (
              <span className="field-error">Invalid Ethereum address</span>
            )}
          </div>

          {/* Address Book Contact Picker */}
          {showContactPicker && (
            <AddressBook
              usbPath={usbPath}
              sessionToken={sessionToken}
              onBack={() => setShowContactPicker(false)}
              onSelectAddress={(address) => {
                setToAddress(address);
                setShowContactPicker(false);
              }}
            />
          )}

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
                        <span className={`speed-dot speed-${speed}`} />
                        {speed.charAt(0).toUpperCase() + speed.slice(1)}
                      </span>
                      <span className="fee-estimate">
                        {formatEth(feeWei)} {nativeSymbol}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>This is an ERC-20 token. Gas fees will be paid in {nativeSymbol}.</span>
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
                {formatEth(unsignedTx.fee)} {nativeSymbol}
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

          {/* Security Report Panel (Pro: full report, Free: upgrade prompt) */}
          {unsignedTx.security && (
            <SecurityReportPanel security={unsignedTx.security} isPro={isPro} />
          )}

          <div className="review-actions">
            <button className="secondary-button" onClick={() => setStep("input")}>
              Edit
            </button>
            <button
              className="primary-button"
              onClick={() => setStep("password")}
              style={unsignedTx.security?.riskLevel === 'danger' ? { background: '#dc2626' } : undefined}
            >
              {unsignedTx.security?.riskLevel === 'danger' ? 'I Understand the Risk — Continue' : 'Confirm & Sign'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Password Entry */}
      {step === "password" && (
        <div className="password-form">
          <div className="password-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
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

          {/* High-risk acknowledgment — friction gate for backend-flagged dangers */}
          <SignGateAcknowledge
            requiresAcknowledge={gate.requiresAcknowledge}
            acknowledged={gate.acknowledged}
            onChange={gate.setAcknowledged}
          />

          <div className="password-actions">
            <button className="secondary-button" onClick={() => setStep("review")}>
              Back
            </button>
            <button
              className="primary-button"
              onClick={handleSignTransaction}
              disabled={!walletPassword || isLoading || (gate.requiresAcknowledge && !gate.acknowledged)}
              style={gate.requiresAcknowledge ? { background: "#dc2626", boxShadow: "none" } : undefined}
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
          <div className="success-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
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
          <div className="error-icon-large"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
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
          background: #ccfbf1;
          border-radius: 20px;
          font-size: 13px;
          color: #0f766e;
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
          font-size: 12px;
          font-weight: 700;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0d9488, #2dd4bf);
          color: white;
          flex-shrink: 0;
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
          background: #ccfbf1;
          color: #0f766e;
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
          background: #ccfbf1;
          color: #0f766e;
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
          background: #ccfbf1;
          border-color: #2dd4bf;
          color: #0f766e;
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
          border-color: #2dd4bf;
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
          border-color: #2dd4bf;
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
          color: #2dd4bf;
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
          background: #f0fdfa;
          border-color: #2dd4bf;
        }

        .fee-speed {
          flex: 1;
          font-weight: 500;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .speed-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .speed-slow { background: #f59e0b; }
        .speed-normal { background: #2dd4bf; }
        .speed-fast { background: #10b981; }

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
          background: linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%);
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
          color: #0d9488;
        }

        .review-row.highlight {
          background: #ccfbf1;
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
          border-color: #2dd4bf;
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
          border-top-color: #2dd4bf;
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
          background: #ccfbf1;
          color: #0f766e;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .explorer-link:hover {
          background: #99f6e4;
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

        /* Security Report Panel */
        .security-panel {
          margin-top: 16px;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #334155;
        }
        .security-panel-safe {
          background: rgba(13, 148, 136, 0.08);
          border-color: rgba(13, 148, 136, 0.3);
        }
        .security-panel-warning {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.3);
        }
        .security-panel-danger {
          background: rgba(220, 38, 38, 0.08);
          border-color: rgba(220, 38, 38, 0.3);
        }
        .security-panel-free {
          background: rgba(100, 116, 139, 0.08);
          border-color: rgba(100, 116, 139, 0.3);
        }
        .security-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .security-icon {
          font-size: 18px;
        }
        .security-title {
          font-weight: 600;
          color: #1e293b;
          flex: 1;
        }
        .security-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .security-badge.safe {
          background: rgba(13, 148, 136, 0.18);
          color: #0f766e;
        }
        .security-badge.warning {
          background: rgba(245, 158, 11, 0.18);
          color: #b45309;
        }
        .security-badge.danger {
          background: rgba(220, 38, 38, 0.18);
          color: #b91c1c;
        }
        .security-alert {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 8px;
        }
        .security-alert-danger {
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.45);
          color: #b91c1c;
        }
        .security-alert-warning {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.45);
          color: #b45309;
        }
        .security-alert strong {
          display: block;
          margin-bottom: 4px;
          color: #dc2626;
          font-weight: 700;
        }
        .security-alert-danger p {
          color: #991b1b;
        }
        .security-alert p {
          font-size: 13px;
          margin: 2px 0;
        }
        .security-alert-address {
          font-family: monospace;
          font-size: 12px;
          opacity: 0.95;
          word-break: break-all;
        }
        .security-simulation {
          margin-top: 8px;
        }
        .security-sim-title {
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 8px;
        }
        .security-sim-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          font-size: 14px;
        }
        .security-sim-row.outgoing {
          color: #f87171;
        }
        .security-sim-row.incoming {
          color: #2dd4bf;
        }
        .security-sim-row.gas {
          color: #94a3b8;
          font-size: 12px;
          border-top: 1px solid #334155;
          padding-top: 8px;
          margin-top: 4px;
        }
        .sim-direction {
          width: 16px;
          text-align: center;
        }
        .sim-amount {
          font-weight: 500;
        }
        .security-safe-text {
          font-size: 13px;
          color: #2dd4bf;
        }
        .security-free-content {
          text-align: center;
        }
        .security-warning-text {
          color: #fbbf24;
          font-weight: 500;
          margin-bottom: 12px;
        }
        .security-features {
          text-align: left;
          margin-bottom: 16px;
        }
        .security-features-title {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 6px;
        }
        .security-features ul {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #cbd5e1;
        }
        .security-features li {
          margin-bottom: 4px;
        }
        .security-upgrade-btn {
          display: inline-block;
          background: linear-gradient(135deg, #0d9488, #2dd4bf);
          color: white;
          padding: 10px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: opacity 0.2s;
        }
        .security-upgrade-btn:hover {
          opacity: 0.9;
        }
        .security-sim-upsell {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.2);
          text-align: center;
        }
        .security-sim-upsell-text {
          font-size: 12px;
          color: #94a3b8;
          margin: 0 0 10px;
        }
      `}</style>
    </div>
  );
};
