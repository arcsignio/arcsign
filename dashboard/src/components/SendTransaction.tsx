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
import styles from "./SendTransaction.module.css";

// CSS Modules 的類名在 build 期雜湊，`speed-${speed}` 這種拼接會拼出
// 對不到任何規則的字串（三種速度會變成同一個顏色），故攤成對應表。
const SPEED_DOT: Record<string, string> = {
  slow: styles.speedSlow,
  normal: styles.speedNormal,
  fast: styles.speedFast,
};
import { useTranslation } from "react-i18next";
import {
  formatAmount,
  formatAmount as formatBalance,
  formatUSD,
  shortenAddress as sharedShorten,
  toDecimalString,
} from "@/utils/formatAmount";
import { AddressBook } from "@/components/AddressBook";
import { SignReview } from "@/components/SignReview";
import { PasswordInput } from "@/components/PasswordInput";
import { useSignReview } from "@/hooks/useSignReview";
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


// Helper to format ETH values.
//
// showDust: this renders fees, not balances. A BSC transfer costs about
// 0.00002 BNB, so the balance rule's "<0.0001" collapsed slow, normal and fast
// into the same string and made the speed selector meaningless.
function formatEth(wei: string): string {
  return formatAmount(toDecimalString(wei, 18), { showDust: true });
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

// 8/6 preserves this screen's existing shape.
function shortenAddress(address: string): string {
  return sharedShorten(address, 8, 6);
}

/**
 * SecurityReportPanel — displays transaction security check results
 * (blacklist check + simulation preview, when simulation data is available).
 */
export const SecurityReportPanel: React.FC<{
  security: SecurityReport;
}> = ({ security }) => {
  const { t } = useTranslation();
  const isDanger = security.riskLevel === 'danger';
  const isWarning = security.riskLevel === 'warning';

  return (
    <div className={`${styles.securityPanel} ${isDanger ? styles.securityPanelDanger : isWarning ? styles.securityPanelWarning : styles.securityPanelSafe}`}>
      <div className={styles.securityHeader}>
        <span className={styles.securityIcon}>&#x1F6E1;</span>
        <span className={styles.securityTitle}>{t("clearSign.securityHeading")}</span>
        <span className={`${styles.securityBadge} ${security.riskLevel}`}>
          {isDanger ? 'DANGER' : isWarning ? 'WARNING' : 'SAFE'}
        </span>
      </div>

      {/* Blacklist warning */}
      {security.blacklistMatch && (
        <div className={`${styles.securityAlertDanger} ${styles.securityAlert} `.trim()}>
          <strong>{t("sendTransaction.blacklistedAddress")}</strong>
          <p>Target address is on the {formatBlacklistSource(security.blacklistMatch.source)} blacklist ({security.blacklistMatch.category}).</p>
          <p className={styles.securityAlertAddress}>{security.blacklistMatch.value}</p>
        </div>
      )}

      {/* Simulation warnings */}
      {security.warnings?.filter(w => w.type === 'SIMULATION_FAILED').map((w, i) => (
        <div key={i} className={`${styles.securityAlertWarning} ${styles.securityAlert} `.trim()}>
          <strong>{t("sendTransaction.simulationWarning")}</strong>
          <p>{w.message}</p>
        </div>
      ))}

      {/* Simulation results */}
      {security.simulation?.success && security.simulation.assetChanges?.length > 0 && (
        <div className={styles.securitySimulation}>
          <p className={styles.securitySimTitle}>{t("sendTransaction.simulationPreview")}</p>
          {security.simulation.assetChanges.map((change, i) => {
            const isOutgoing = change.from.toLowerCase() !== change.to.toLowerCase() && change.changeType === 'TRANSFER';
            return (
              <div key={i} className={`${styles.securitySimRow} ${isOutgoing ? styles.outgoing : styles.incoming}`}>
                <span className={styles.simDirection}>{isOutgoing ? '\u25BC' : '\u25B2'}</span>
                <span className={styles.simAmount}>
                  {change.amount ? formatSimAmount(change.amount, change.decimals) : '?'} {change.symbol}
                </span>
              </div>
            );
          })}
          {security.simulation.gasUsed && (
            <div className={`${styles.securitySimRow} ${styles.gas}`.trim()}>
              <span className={styles.simDirection}>&#x26FD;</span>
              <span className={styles.simAmount}>{t("sendTransaction.gasLabel")}: {security.simulation.gasUsed}</span>
            </div>
          )}
        </div>
      )}

      {/* No blacklist match = address cleared the blacklist check. */}
      {!security.blacklistMatch && !isDanger && !isWarning && (
        <p className={styles.securitySafeText}>{t("sendTransaction.notOnBlacklist")}</p>
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

/**
 * Format simulation amount from raw units to human-readable.
 *
 * decimals is passed through as given. The previous body used
 * `decimals || 18`, and `||` is a truthy check — a zero-decimal token was
 * divided by 10^18 rather than 10^0, so a whole million rendered as
 * "<0.0001": a balance change worth reading, displayed as nothing.
 */
function formatSimAmount(rawAmount: string, decimals: number): string {
  return formatAmount(toDecimalString(rawAmount, decimals));
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
  const { t } = useTranslation();

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
  const review = useSignReview(
    unsignedTx && selectedToken
      ? {
          from: unsignedTx.from,
          to: unsignedTx.to,
          chainId,
          value: unsignedTx.amount,
          // The real calldata, not "": an ERC-20 transfer must decode as one
          // and its digest must cover the bytes actually being signed.
          data: unsignedTx.data ?? "",
          usbPath,
          sessionToken,
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
    if (review.requiresAcknowledge && !review.acknowledged) {
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
        acknowledgedRisk: review.acknowledged,  // user acknowledged a backend-flagged danger
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

  // Group tokens by network for better display
  const tokensByNetwork = availableTokens.reduce((acc, token) => {
    const network = token.networkLabel;
    if (!acc[network]) acc[network] = [];
    acc[network].push(token);
    return acc;
  }, {} as Record<string, SendableToken[]>);


  return (
    <div className={styles.sendTransaction}>
      <header className={styles.sendHeader}>
        <button onClick={step === "select" ? onBack : () => setStep("select")} className={styles.backButton}>
          <span>&larr;</span> {t("actions.back")}
        </button>
        <h2>{t("transaction.send")} {selectedToken ? selectedToken.tokenSymbol : t("swap.token")}</h2>
        {selectedToken && (
          <div className={styles.chainBadge}>
            <span className="chain-icon">{getNetworkIcon(selectedToken.network)}</span>
            {selectedToken.networkLabel}
          </div>
        )}
      </header>

      {/* Error Display */}
      {error && (
        <div className={styles.errorBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Step 0: Token Selection */}
      {step === "select" && (
        <div className={styles.tokenSelectForm}>
          <h3>{t("sendTransaction.selectTokenTitle")}</h3>
          <p className={styles.selectDescription}>{t("sendTransaction.selectTokenDescription")}</p>

          {availableTokens.length === 0 ? (
            <div className={styles.noTokens}>
              <span className={styles.noTokensIcon}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>
              <p>{t("sendTransaction.noTokensAvailable")}</p>
              <button className={styles.secondaryButton} onClick={onBack}>
                {t("swap.goBack")}
              </button>
            </div>
          ) : (
            <div className={styles.tokenList}>
              {Object.entries(tokensByNetwork).map(([networkLabel, tokens]) => (
                <div key={networkLabel} className={styles.networkGroup}>
                  <div className={styles.networkHeader}>
                    <span className={styles.networkIcon}>{getNetworkIcon(tokens[0].network)}</span>
                    <span className="network-name">{networkLabel}</span>
                    {tokens[0].network.includes("sepolia") && (
                      <span className={styles.testnetBadge}>{t("sendTransaction.testnet")}</span>
                    )}
                  </div>
                  <div className={styles.networkTokens}>
                    {tokens.map((token, idx) => (
                      <button
                        key={`${token.network}-${token.tokenAddress || "native"}-${idx}`}
                        className={styles.tokenOption}
                        onClick={() => handleSelectToken(token)}
                      >
                        <div className={styles.tokenIcon}>
                          {token.tokenLogo ? (
                            <img src={token.tokenLogo} alt={token.tokenSymbol} />
                          ) : (
                            <span className={styles.tokenIconFallback}>{token.tokenSymbol.slice(0, 2)}</span>
                          )}
                        </div>
                        <div className={styles.tokenInfo}>
                          <span className={styles.tokenSymbol}>{token.tokenSymbol}</span>
                          <span className={styles.tokenName}>{token.tokenName}</span>
                          {token.tokenAddress && (
                            <span className={styles.tokenType}>{t("transaction.erc20")}</span>
                          )}
                        </div>
                        <div className={styles.tokenBalance}>
                          <span className={styles.balanceAmount}>{formatBalance(token.balance)}</span>
                          {token.usdValue > 0 && (
                            <span className={styles.balanceUsd}>{formatUSD(token.usdValue)}</span>
                          )}
                        </div>
                        <span className={styles.tokenArrow}>→</span>
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
          <div className={styles.selectedTokenCard}>
            <div className={styles.tokenIcon}>
              {selectedToken.tokenLogo ? (
                <img src={selectedToken.tokenLogo} alt={selectedToken.tokenSymbol} />
              ) : (
                <span className={styles.tokenIconFallback}>{selectedToken.tokenSymbol.slice(0, 2)}</span>
              )}
            </div>
            <div className={styles.tokenDetails}>
              <span className={styles.tokenSymbol}>{selectedToken.tokenSymbol}</span>
              <span className={styles.tokenBalanceInfo}>
                {t("sendTransaction.balance")}: {formatBalance(selectedToken.balance)} {selectedToken.tokenSymbol}
              </span>
            </div>
            <button className={styles.changeTokenBtn} onClick={() => setStep("select")}>
              {t("sendTransaction.change")}
            </button>
          </div>

          {/* From Address */}
          <div className={styles.formGroup}>
            <label>{t("transaction.from")}</label>
            <div className={styles.addressDisplay}>
              <span className={`${styles.address} -text`.trim()}>{shortenAddress(selectedToken.fromAddress)}</span>
            </div>
          </div>

          {/* To Address */}
          <div className={styles.formGroup}>
            <label>{t("sendTransaction.toAddress")}</label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="text"
                placeholder="0x..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className={`${styles.addressInput} ${toAddress && !isValidAddress(toAddress) ? styles.invalid : ""}`}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowContactPicker(true)}
                title={t("addressBook.selectFromContacts")}
                aria-label={t("addressBook.selectFromContacts")}
                style={{
                  background: "var(--brand-faint)",
                  border: "1px solid var(--brand-accent)",
                  borderRadius: "8px",
                  padding: "0.5rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </button>
            </div>
            {toAddress && !isValidAddress(toAddress) && (
              <span className={styles.fieldError}>{t("sendTransaction.invalidAddress")}</span>
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
          <div className={styles.formGroup}>
            <label>{t("transaction.amount")} ({selectedToken.tokenSymbol})</label>
            <div className={styles.amountInputWrapper}>
              <input
                type="text"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={styles.amountInput}
              />
              <button className={styles.maxButton} onClick={() => setAmount(selectedToken.balance)}>
                MAX
              </button>
            </div>
          </div>

          {/* Fee Speed Selector */}
          {feeEstimate && (
            <div className={styles.formGroup}>
              <label>{t("sendTransaction.transactionSpeed")}</label>
              <div className={styles.feeSelector}>
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
                      className={`${styles.feeOption} ${feeSpeed === speed ? styles.selected : ""}`}
                      onClick={() => setFeeSpeed(speed)}
                    >
                      <span className={styles.feeSpeed}>
                        <span className={`${styles.speedDot} ${SPEED_DOT[speed]}`} />
                        {speed.charAt(0).toUpperCase() + speed.slice(1)}
                      </span>
                      <span className={styles.feeEstimate}>
                        {formatEth(feeWei)} {nativeSymbol}
                      </span>
                      <span className={styles.feeTime}>
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
            <div className={styles.erc20Notice}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>{t("sendTransaction.erc20GasNotice", { symbol: nativeSymbol })}</span>
            </div>
          )}

          {/* Continue Button */}
          <button
            className={styles.primaryButton}
            onClick={handleBuildTransaction}
            disabled={isLoading || !isValidAddress(toAddress) || !isValidAmount(amount)}
          >
            {isLoading ? t("sendTransaction.buildingTransaction") : t("sendTransaction.continue")}
          </button>
        </div>
      )}

      {/* Step 2: Review Transaction */}
      {step === "review" && unsignedTx && selectedToken && (
        <div className={styles.reviewForm}>
          <h3>{t("sendTransaction.reviewTransaction")}</h3>

          <div className={styles.reviewDetails}>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t("addToken.network")}</span>
              <span className={styles.reviewValue}>
                {getNetworkIcon(selectedToken.network)} {selectedToken.networkLabel}
              </span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t("swap.token")}</span>
              <span className={styles.reviewValue}>
                {selectedToken.tokenSymbol} {isERC20 && <span className={styles.erc20Tag}>({t("transaction.erc20")})</span>}
              </span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t("transaction.from")}</span>
              <span className={`${styles.reviewValue} ${styles.address}`.trim()}>{shortenAddress(selectedToken.fromAddress)}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t("transaction.to")}</span>
              <span className={`${styles.reviewValue} ${styles.address}`.trim()}>{shortenAddress(toAddress)}</span>
            </div>
            <div className={`${styles.reviewRow} ${styles.highlight}`.trim()}>
              <span className={styles.reviewLabel}>{t("transaction.amount")}</span>
              <span className={`${styles.reviewValue} ${styles.amount}`.trim()}>
                {amount} {selectedToken.tokenSymbol}
              </span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>{t("sendTransaction.estimatedFee")}</span>
              <span className={styles.reviewValue}>
                {formatEth(unsignedTx.fee)} {nativeSymbol}
              </span>
            </div>
            {!isERC20 && (
              <div className={`${styles.reviewRow} ${styles.total}`.trim()}>
                <span className={styles.reviewLabel}>{t("sendTransaction.total")}</span>
                <span className={styles.reviewValue}>
                  {/* Same rule as the fee row above: this line used its own
                      inline conversion at six decimals while the fee showed
                      four, seven lines apart on one screen. */}
                  {formatAmount(
                    parseFloat(amount) + parseFloat(toDecimalString(unsignedTx.fee, 18))
                  )} {selectedToken.tokenSymbol}
                </span>
              </div>
            )}
          </div>

          {/* Security Report Panel (blacklist check + simulation preview) */}
          {unsignedTx.security && (
            <SecurityReportPanel security={unsignedTx.security} />
          )}

          <div className={styles.reviewActions}>
            <button className={styles.secondaryButton} onClick={() => setStep("input")}>
              {t("addressBook.edit")}
            </button>
            <button
              className={styles.primaryButton}
              onClick={() => setStep("password")}
              style={unsignedTx.security?.riskLevel === 'danger' ? { background: 'var(--danger)' } : undefined}
            >
              {unsignedTx.security?.riskLevel === 'danger' ? t("sendTransaction.understandRiskContinue") : t("sendTransaction.confirmAndSign")}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Password Entry */}
      {step === "password" && (
        <div className={styles.passwordForm}>
          <div className={styles.passwordIcon}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
          <h3>{t("dashboard.enterWalletPassword")}</h3>
          <p className={styles.passwordDescription}>
            {t("sendTransaction.passwordRequiredDescription")}
          </p>

          <div className={styles.formGroup}>
            <PasswordInput
              placeholder={t("dashboard.enterWalletPasswordPlaceholder")}
              value={walletPassword}
              onChange={(e) => setWalletPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSignTransaction()}
              autoFocus
              className={styles.passwordInput}
            />
          </div>

          {/* Passphrase indicator - shown if wallet uses passphrase (already validated) */}
          {walletHasPassphrase && preValidatedPassphrase && (
            <div className={styles.passphraseValidated}>
              <span className={styles.validatedIcon}>✓</span>
              <span>{t("sendTransaction.passphraseVerified")}</span>
            </div>
          )}

          {/* Full pre-signature review: what it does, what's risky, consent, digest */}
          <SignReview review={review} />

          <div className={styles.passwordActions}>
            <button className={styles.secondaryButton} onClick={() => setStep("review")}>
              {t("actions.back")}
            </button>
            <button
              className={styles.primaryButton}
              onClick={handleSignTransaction}
              disabled={!walletPassword || isLoading || (review.requiresAcknowledge && !review.acknowledged)}
              style={review.requiresAcknowledge ? { background: "var(--danger)", boxShadow: "none" } : undefined}
            >
              {t("sendTransaction.signAndSend")}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Signing in Progress */}
      {step === "signing" && (
        <div className={styles.progressView}>
          <div className={styles.progressSpinner} />
          <h3>{t("sendTransaction.signingTransaction")}</h3>
          <p>{t("sendTransaction.pleaseWaitSigning")}</p>
        </div>
      )}

      {/* Step 5: Broadcasting */}
      {step === "broadcasting" && selectedToken && (
        <div className={styles.progressView}>
          <div className={styles.progressSpinner} />
          <h3>{t("sendTransaction.broadcastingTransaction")}</h3>
          <p>{t("sendTransaction.submittingToNetwork", { network: selectedToken.networkLabel })}</p>
        </div>
      )}

      {/* Step 6: Success */}
      {step === "success" && broadcastResult && selectedToken && (
        <div className={styles.successView}>
          <div className={styles.successIcon}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <h3>{t("sendTransaction.transactionSubmitted")}</h3>
          <p className={styles.successMessage}>
            {t("sendTransaction.submittedToNetwork", { network: selectedToken.networkLabel })}
          </p>

          <div className={styles.txHash}>
            <span className={styles.txLabel}>{t("transaction.hash")}</span>
            <code className={styles.txValue}>{shortenAddress(broadcastResult.txHash)}</code>
          </div>

          <div className={styles.successActions}>
            <a
              href={getExplorerUrl(selectedToken.network, broadcastResult.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.explorerLink}
            >
              {t("sendTransaction.viewOnExplorer")}
            </a>
            <button className={styles.primaryButton} onClick={handleReset}>
              {t("sendTransaction.sendAnother")}
            </button>
            <button className={styles.secondaryButton} onClick={onBack}>
              {t("staking.done")}
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {step === "error" && (
        <div className={styles.errorView}>
          <div className={styles.errorIconLarge}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
          <h3>{t("errors.transactionFailed")}</h3>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.errorActions}>
            <button className={styles.secondaryButton} onClick={handleReset}>
              {t("swap.tryAgain")}
            </button>
            <button className={styles.secondaryButton} onClick={onBack}>
              {t("actions.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
