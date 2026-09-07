/**
 * TransactionHistory Component
 * Feature: Display asset transfers (transaction history) from Alchemy API
 * Now supports querying ALL supported EVM chains simultaneously
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./TransactionHistory.module.css";
import { getNetworkColor } from "@/utils/chainIcons";
import {
  formatAmount as formatValue,
  shortenAddress as sharedShorten,
} from "@/utils/formatAmount";
import { useTranslation } from "react-i18next";
import tauriApi, {
  type AssetTransfer,
  type AssetTransfersResponse,
} from "@/services/tauri-api";
import {
  batchCheckTokens,
  type TokenCheckResult,
} from "@/utils/tokenWhitelist";
import { useTransactionLabels } from "@/hooks/useTransactionLabels";
import { useHasProviderKey } from "@/hooks/useHasProviderKey";
import { TransactionLabelModal } from "./TransactionLabelModal";

interface TransactionHistoryProps {
  address: string;
  usbPath: string;
  /** Session token for provider config decryption (PREFERRED) */
  sessionToken: string;
  onBack: () => void;
}

// Supported EVM chains for transaction history.
// Colours come from chainIcons, which owns chain identity — they were declared
// separately here, in TokenApprovals and in developer mode, and had drifted.
const EVM_CHAINS = [
  { id: "eth-mainnet", name: "Ethereum", shortName: "ETH", color: getNetworkColor("eth-mainnet") },
  { id: "polygon-mainnet", name: "Polygon", shortName: "MATIC", color: getNetworkColor("polygon-mainnet") },
  { id: "arbitrum-mainnet", name: "Arbitrum", shortName: "ARB", color: getNetworkColor("arbitrum-mainnet") },
  { id: "optimism-mainnet", name: "Optimism", shortName: "OP", color: getNetworkColor("optimism-mainnet") },
  { id: "base-mainnet", name: "Base", shortName: "BASE", color: getNetworkColor("base-mainnet") },
  { id: "bnb-mainnet", name: "BNB Chain", shortName: "BNB", color: getNetworkColor("bnb-mainnet") },
  { id: "avalanche-mainnet", name: "Avalanche", shortName: "AVAX", color: getNetworkColor("avalanche-mainnet") },
];

// Extended transfer with network info
interface TransferWithNetwork extends AssetTransfer {
  network: string;
  networkName: string;
  networkColor: string;
}

// Category display names and colors
const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  external: { label: "Transfer", color: "var(--brand-accent)" },
  internal: { label: "Internal", color: "var(--text-secondary)" },
  erc20: { label: "ERC-20", color: "var(--success)" },
  erc721: { label: "NFT", color: "#8b5cf6" },
  erc1155: { label: "Multi-Token", color: "var(--warning)" },
};

// Helper to format timestamp
function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Helper to shorten address
// 6/4 keeps this list's narrow column shape.
function shortenAddress(address: string): string {
  return sharedShorten(address, 6, 4);
}

// Helper to format value


// Helper to get block explorer URL
function getExplorerUrl(network: string, txHash: string): string {
  const explorers: Record<string, string> = {
    "eth-mainnet": "https://etherscan.io/tx/",
    "polygon-mainnet": "https://polygonscan.com/tx/",
    "arbitrum-mainnet": "https://arbiscan.io/tx/",
    "optimism-mainnet": "https://optimistic.etherscan.io/tx/",
    "base-mainnet": "https://basescan.org/tx/",
    "bnb-mainnet": "https://bscscan.com/tx/",
  };
  const baseUrl = explorers[network] || "https://etherscan.io/tx/";
  return `${baseUrl}${txHash}`;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  address,
  usbPath,
  sessionToken,
  onBack,
}) => {
  console.log("🔵 [TransactionHistory] Component rendered with props:", {
    address,
    hasSessionToken: !!sessionToken,
    usbPath,
  });

  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<TransferWithNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingChains, setLoadingChains] = useState<string[]>([]);
  const [chainStats, setChainStats] = useState<Record<string, number>>({});
  // Providers whose chains couldn't be queried because a key is missing, while
  // OTHER chains succeeded (e.g. Avalanche). Lets the UI warn instead of
  // silently dropping those chains' transactions.
  const [keyMissingProviders, setKeyMissingProviders] = useState<{ alchemy: boolean; nodereal: boolean }>({ alchemy: false, nodereal: false });
  const [tokenWarnings, setTokenWarnings] = useState<Map<string, TokenCheckResult>>(new Map());
  const [showUnverifiedTokens, setShowUnverifiedTokens] = useState(false);
  const [unverifiedTokenCount, setUnverifiedTokenCount] = useState(0);

  // Provider key status (for empty-state messaging)
  const { hasAlchemyKey, isLoading: isKeyLoading } = useHasProviderKey(usbPath, sessionToken);

  // Transaction labels
  const { getLabelForTx, setLabel, deleteLabel, loadLabels } = useTransactionLabels(usbPath, sessionToken);
  const [editingLabelTx, setEditingLabelTx] = useState<{ network: string; txHash: string } | null>(null);

  // Load labels on mount
  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  // Fetch transfers from all EVM chains
  const fetchAllChainTransfers = useCallback(
    async () => {
      console.log("🔵 [TransactionHistory] fetchAllChainTransfers called for address:", address);

      setIsLoading(true);
      setError(null);
      setKeyMissingProviders({ alchemy: false, nodereal: false });
      setLoadingChains(EVM_CHAINS.map(c => c.name));
      setChainStats({});

      const allTransfers: TransferWithNetwork[] = [];
      const stats: Record<string, number> = {};
      let errorCount = 0;

      // Query all chains in parallel
      const chainPromises = EVM_CHAINS.map(async (chain) => {
        try {
          console.log(`🔵 [TransactionHistory] Fetching from ${chain.name}...`);
          const response: AssetTransfersResponse =
            await tauriApi.getAssetTransfers({
              address,
              network: chain.id,
              maxCount: 30, // Limit per chain
              pageKey: "",
              usbPath,
              sessionToken,
            });

          const count = response.transfers?.length || 0;
          console.log(`✅ [TransactionHistory] ${chain.name}: ${count} transfers`);

          stats[chain.name] = count;

          // Add network info to each transfer
          const transfersWithNetwork: TransferWithNetwork[] = (response.transfers || []).map(t => ({
            ...t,
            network: chain.id,
            networkName: chain.name,
            networkColor: chain.color,
          }));

          return { chain: chain.name, chainId: chain.id, transfers: transfersWithNetwork, error: null as string | null };
        } catch (err: unknown) {
          const errorMessage = (err as { message?: string })?.message || "Unknown error";
          console.warn(`⚠️ [TransactionHistory] ${chain.name} failed:`, errorMessage);
          errorCount++;
          stats[chain.name] = -1; // -1 indicates error
          return { chain: chain.name, chainId: chain.id, transfers: [], error: errorMessage };
        } finally {
          setLoadingChains(prev => prev.filter(c => c !== chain.name));
        }
      });

      const results = await Promise.all(chainPromises);

      // Collect all transfers
      results.forEach(result => {
        allTransfers.push(...result.transfers);
      });

      // Sort by timestamp (newest first)
      allTransfers.sort((a, b) => {
        const timeA = a.metadata?.blockTimestamp ? new Date(a.metadata.blockTimestamp).getTime() : 0;
        const timeB = b.metadata?.blockTimestamp ? new Date(b.metadata.blockTimestamp).getTime() : 0;
        return timeB - timeA;
      });

      console.log(`🔵 [TransactionHistory] Total transfers across all chains: ${allTransfers.length}`);

      setTransfers(allTransfers);
      setChainStats(stats);

      // Detect chains that couldn't be queried (so a partial result — e.g.
      // Avalanche succeeded — still tells the user which chains need a key,
      // instead of silently dropping them). We group failures by which chain
      // failed (not by parsing the message — the backend sanitizes messages with
      // URLs, e.g. the NodeReal hint, so text matching is unreliable). Avalanche
      // (Glacier) is key-free and never fails this way; any other failed chain
      // means that provider needs a key: BNB → NodeReal, the rest → Alchemy.
      const noderealMissing = results.some(r => r.chainId === "bnb-mainnet" && !!r.error);
      const alchemyMissing = results.some(
        r => r.chainId !== "bnb-mainnet" && r.chainId !== "avalanche-mainnet" && !!r.error
      );
      setKeyMissingProviders({ alchemy: alchemyMissing, nodereal: noderealMissing });

      // Only show the full error state if ALL chains failed
      if (errorCount === EVM_CHAINS.length) {
        const firstBackendError = results.find(r => r.error)?.error;
        setError(firstBackendError || "Failed to load transaction history from all chains. Please check your network connection.");
      }

      setIsLoading(false);
    },
    [address, sessionToken, usbPath]
  );

  useEffect(() => {
    console.log("🔵 [TransactionHistory] useEffect triggered - fetching transfers from all chains");
    fetchAllChainTransfers();
  }, [address, fetchAllChainTransfers]);

  // Check token whitelist after transfers are loaded
  useEffect(() => {
    if (transfers.length === 0) return;

    const checkTokens = async () => {
      try {
        const checksData = transfers.map((t) => ({
          contractAddress: t.rawContract?.address,
          network: t.network,
          category: t.category,
          uniqueId: t.uniqueId,
        }));
        const results = await batchCheckTokens(checksData);
        setTokenWarnings(results);
      } catch (err) {
        console.error("[TransactionHistory] Failed to check token whitelist:", err);
      }
    };

    checkTokens();
  }, [transfers]);

  // Filter out unverified tokens (not in whitelist) and count them
  const filteredTransfers = useMemo(() => {
    // Wait for tokenWarnings to be populated
    if (tokenWarnings.size === 0 && transfers.length > 0) {
      // While checking, show all transfers
      return transfers;
    }

    const unverifiedTransfers: TransferWithNetwork[] = [];
    const verifiedTransfers: TransferWithNetwork[] = [];

    transfers.forEach(transfer => {
      const warning = tokenWarnings.get(transfer.uniqueId);
      // shouldWarn === true means token is NOT in whitelist
      if (warning?.shouldWarn === true) {
        unverifiedTransfers.push(transfer);
      } else {
        verifiedTransfers.push(transfer);
      }
    });

    setUnverifiedTokenCount(unverifiedTransfers.length);

    return showUnverifiedTokens ? transfers : verifiedTransfers;
  }, [transfers, showUnverifiedTokens, tokenWarnings]);

  // Determine if transfer is incoming or outgoing
  const getTransferDirection = (transfer: AssetTransfer): "in" | "out" => {
    return transfer.to.toLowerCase() === address.toLowerCase() ? "in" : "out";
  };

  return (
    <div className={styles.transactionHistory}>
      <header className={styles.historyHeader}>
        <button onClick={onBack} className={styles.backButton}>
          <span className="back-arrow">&larr;</span> {t("actions.back")}
        </button>
        <div className={styles.headerInfo}>
          <h2>{t("transaction.history")}</h2>
          <p className={styles.addressInfo}>
            {shortenAddress(address)}
          </p>
          <p className={styles.supportedChains}>
            Querying: {EVM_CHAINS.map(c => c.shortName).join(", ")}
          </p>
        </div>
        <button
          onClick={fetchAllChainTransfers}
          disabled={isLoading}
          className={styles.refreshButton}
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {/* Loading indicator with chain progress */}
      {loadingChains.length > 0 && (
        <div className={styles.loadingChains}>
          <div className={styles.loadingSpinnerSmall} />
          <span>Loading: {loadingChains.join(", ")}...</span>
        </div>
      )}

      {/* Chain stats summary */}
      {!isLoading && Object.keys(chainStats).length > 0 && (
        <div className={styles.chainStats}>
          {EVM_CHAINS.map(chain => {
            const count = chainStats[chain.name];
            const isError = count === -1;
            return (
              <span
                key={chain.id}
                className={`${styles.chainStat} ${isError ? styles.error : ''}`}
                style={{ borderColor: chain.color }}
              >
                <span className={styles.chainDot} style={{ backgroundColor: chain.color }} />
                {chain.shortName}: {isError ? '✕' : count}
              </span>
            );
          })}
        </div>
      )}

      {/* Partial-key notice: some chains succeeded (e.g. Avalanche) but others
          couldn't be queried because a key is missing. Shown only when NOT the
          all-failed error state. */}
      {!error && !isLoading && (keyMissingProviders.alchemy || keyMissingProviders.nodereal) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
            padding: "0.75rem 1rem",
            margin: "0.75rem 0",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            color: "#1e40af",
          }}
        >
          <span style={{ fontWeight: 600 }}>{t("transactionHistory.partialKeyNotice")}</span>
          {keyMissingProviders.alchemy && <span>{t("transactionHistory.partialAlchemyChains")}</span>}
          {keyMissingProviders.nodereal && <span>{t("transactionHistory.partialNodeRealChains")}</span>}
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          <p>{error}</p>
          <button onClick={fetchAllChainTransfers}>{t("addressBook.retry")}</button>
        </div>
      )}

      {/* Unverified token filter notice */}
      {unverifiedTokenCount > 0 && (
        <div className={styles.scamFilterNotice}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>
            已過濾 {unverifiedTokenCount} 筆未驗證的交易（不在白名單內）
          </span>
          <button
            onClick={() => setShowUnverifiedTokens(!showUnverifiedTokens)}
            className={styles.toggleScamButton}
          >
            {showUnverifiedTokens ? "隱藏" : "顯示"}
          </button>
        </div>
      )}

      {!error && transfers.length === 0 && !isLoading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
          {isKeyLoading ? null : !hasAlchemyKey ? (
            <>
              <h3>{t("transactionHistory.needKeyTitle")}</h3>
              <p>{t("transactionHistory.needKeyDescription")}</p>
            </>
          ) : (
            <>
              <h3>{t("transactionHistory.emptyTitle")}</h3>
              <p>{t("transactionHistory.emptyDescription")}</p>
            </>
          )}
        </div>
      )}

      {filteredTransfers.length > 0 && (
        <div className={styles.transfersList}>
          {filteredTransfers.map((transfer, index) => {
            const direction = getTransferDirection(transfer);
            const categoryStyle =
              CATEGORY_STYLES[transfer.category] || CATEGORY_STYLES.external;
            const warning = tokenWarnings.get(transfer.uniqueId);
            const shouldHighlight = warning?.shouldWarn === true;

            const txLabel = getLabelForTx(transfer.network, transfer.hash);

            return (
              <div
                key={`${transfer.uniqueId}-${index}`}
                className={`${styles.transferItem} ${shouldHighlight ? styles.transferItemWarning : ""}`}
                title={shouldHighlight ? t("transaction.unknownTokenWarning") : undefined}
              >
                <div className={styles.transferIcon}>
                  <span
                    className={`${styles.directionIndicator} ${direction}`}
                    title={direction === "in" ? "Received" : "Sent"}
                  >
                    {direction === "in" ? "↓" : "↑"}
                  </span>
                </div>

                <div className={styles.transferDetails}>
                  <div className={styles.transferMain}>
                    <div className={styles.badges}>
                      <span
                        className={styles.networkBadge}
                        style={{ backgroundColor: transfer.networkColor }}
                      >
                        {EVM_CHAINS.find(c => c.id === transfer.network)?.shortName || transfer.networkName}
                      </span>
                      <span
                        className={styles.categoryBadge}
                        style={{ backgroundColor: categoryStyle.color }}
                      >
                        {categoryStyle.label}
                      </span>
                      {txLabel && (
                        <span className={styles.txLabelBadge} onClick={() => setEditingLabelTx({ network: transfer.network, txHash: transfer.hash })}>
                          {txLabel.label.name}
                        </span>
                      )}
                      {shouldHighlight && (
                        <span className={styles.warningBadge}>
                          {t("transaction.tokenNotVerified")}
                        </span>
                      )}
                    </div>
                    <div className={styles.transferValueRow}>
                      <span className={styles.transferValue}>
                        {direction === "in" ? "+" : "-"}
                        {formatValue(transfer.value)} {transfer.asset}
                      </span>
                      <button
                        className={styles.txLabelEditBtn}
                        onClick={() => setEditingLabelTx({ network: transfer.network, txHash: transfer.hash })}
                        title={txLabel ? t("txLabel.editLabel") : t("txLabel.addLabel")}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    </div>
                  </div>

                  <div className={styles.transferAddresses}>
                    <span className="from-to">
                      {direction === "in" ? "From: " : "To: "}
                      {shortenAddress(
                        direction === "in" ? transfer.from : transfer.to
                      )}
                    </span>
                  </div>

                  <div className={styles.transferMeta}>
                    {transfer.metadata?.blockTimestamp && (
                      <span className={styles.timestamp}>
                        {formatTimestamp(transfer.metadata.blockTimestamp)}
                      </span>
                    )}
                    <a
                      href={getExplorerUrl(transfer.network, transfer.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.explorerLink}
                    >
                      {t("sendTransaction.viewOnExplorer")}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading && transfers.length === 0 && loadingChains.length === 0 && (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p>{t("sendTransaction.loadingTransactionHistory")}</p>
        </div>
      )}

      {/* Transaction Label Modal */}
      {editingLabelTx && (
        <TransactionLabelModal
          network={editingLabelTx.network}
          txHash={editingLabelTx.txHash}
          existingLabel={getLabelForTx(editingLabelTx.network, editingLabelTx.txHash)}
          onSave={async (name, category, notes) => {
            return await setLabel({
              network: editingLabelTx.network,
              txHash: editingLabelTx.txHash,
              name,
              category,
              notes,
            });
          }}
          onDelete={async () => {
            return await deleteLabel(editingLabelTx.network, editingLabelTx.txHash);
          }}
          onClose={() => setEditingLabelTx(null)}
        />
      )}
    </div>
  );
};
