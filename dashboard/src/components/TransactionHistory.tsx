/**
 * TransactionHistory Component
 * Feature: Display asset transfers (transaction history) from Alchemy API
 * Now supports querying ALL supported EVM chains simultaneously
 */

import React, { useState, useEffect, useCallback } from "react";
import tauriApi, {
  type AssetTransfer,
  type AssetTransfersResponse,
} from "@/services/tauri-api";

interface TransactionHistoryProps {
  address: string;
  usbPath: string;
  /** Session token for provider config decryption (PREFERRED) */
  sessionToken: string;
  onBack: () => void;
}

// Supported EVM chains for transaction history
const EVM_CHAINS = [
  { id: "eth-mainnet", name: "Ethereum", shortName: "ETH", color: "#627EEA" },
  { id: "polygon-mainnet", name: "Polygon", shortName: "MATIC", color: "#8247E5" },
  { id: "arbitrum-mainnet", name: "Arbitrum", shortName: "ARB", color: "#28A0F0" },
  { id: "optimism-mainnet", name: "Optimism", shortName: "OP", color: "#FF0420" },
  { id: "base-mainnet", name: "Base", shortName: "BASE", color: "#0052FF" },
  { id: "bnb-mainnet", name: "BNB Chain", shortName: "BNB", color: "#F0B90B" },
];

// Extended transfer with network info
interface TransferWithNetwork extends AssetTransfer {
  network: string;
  networkName: string;
  networkColor: string;
}

// Category display names and colors
const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  external: { label: "Transfer", color: "#3b82f6" },
  internal: { label: "Internal", color: "#6b7280" },
  erc20: { label: "ERC-20", color: "#10b981" },
  erc721: { label: "NFT", color: "#8b5cf6" },
  erc1155: { label: "Multi-Token", color: "#f59e0b" },
};

// Helper to format timestamp
function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  return date.toLocaleString();
}

// Helper to shorten address
function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper to format value
function formatValue(value: number): string {
  if (value === 0) return "0";
  if (value < 0.0001) return "<0.0001";
  if (value < 1) return value.toFixed(6);
  if (value < 1000) return value.toFixed(4);
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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

  const [transfers, setTransfers] = useState<TransferWithNetwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingChains, setLoadingChains] = useState<string[]>([]);
  const [chainStats, setChainStats] = useState<Record<string, number>>({});

  // Fetch transfers from all EVM chains
  const fetchAllChainTransfers = useCallback(
    async () => {
      console.log("🔵 [TransactionHistory] fetchAllChainTransfers called for address:", address);

      setIsLoading(true);
      setError(null);
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

          return { chain: chain.name, transfers: transfersWithNetwork, error: null };
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.warn(`⚠️ [TransactionHistory] ${chain.name} failed:`, errorMessage);
          errorCount++;
          stats[chain.name] = -1; // -1 indicates error
          return { chain: chain.name, transfers: [], error: errorMessage };
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

      // Only show error if ALL chains failed
      if (errorCount === EVM_CHAINS.length) {
        setError("Failed to load transaction history from all chains. Please check your network connection.");
      }

      setIsLoading(false);
    },
    [address, sessionToken, usbPath]
  );

  useEffect(() => {
    console.log("🔵 [TransactionHistory] useEffect triggered - fetching transfers from all chains");
    fetchAllChainTransfers();
  }, [address, fetchAllChainTransfers]);

  // Determine if transfer is incoming or outgoing
  const getTransferDirection = (transfer: AssetTransfer): "in" | "out" => {
    return transfer.to.toLowerCase() === address.toLowerCase() ? "in" : "out";
  };

  return (
    <div className="transaction-history">
      <header className="history-header">
        <button onClick={onBack} className="back-button">
          <span className="back-arrow">&larr;</span> Back
        </button>
        <div className="header-info">
          <h2>Transaction History</h2>
          <p className="address-info">
            {shortenAddress(address)}
          </p>
          <p className="supported-chains">
            Querying: {EVM_CHAINS.map(c => c.shortName).join(", ")}
          </p>
        </div>
        <button
          onClick={fetchAllChainTransfers}
          disabled={isLoading}
          className="refresh-button"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {/* Loading indicator with chain progress */}
      {loadingChains.length > 0 && (
        <div className="loading-chains">
          <div className="loading-spinner-small" />
          <span>Loading: {loadingChains.join(", ")}...</span>
        </div>
      )}

      {/* Chain stats summary */}
      {!isLoading && Object.keys(chainStats).length > 0 && (
        <div className="chain-stats">
          {EVM_CHAINS.map(chain => {
            const count = chainStats[chain.name];
            const isError = count === -1;
            return (
              <span
                key={chain.id}
                className={`chain-stat ${isError ? 'error' : ''}`}
                style={{ borderColor: chain.color }}
              >
                <span className="chain-dot" style={{ backgroundColor: chain.color }} />
                {chain.shortName}: {isError ? '✕' : count}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchAllChainTransfers}>Retry</button>
        </div>
      )}

      {!error && transfers.length === 0 && !isLoading && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Transactions Found</h3>
          <p>This address has no transaction history on supported EVM chains.</p>
        </div>
      )}

      {transfers.length > 0 && (
        <div className="transfers-list">
          {transfers.map((transfer, index) => {
            const direction = getTransferDirection(transfer);
            const categoryStyle =
              CATEGORY_STYLES[transfer.category] || CATEGORY_STYLES.external;

            return (
              <div key={`${transfer.uniqueId}-${index}`} className="transfer-item">
                <div className="transfer-icon">
                  <span
                    className={`direction-indicator ${direction}`}
                    title={direction === "in" ? "Received" : "Sent"}
                  >
                    {direction === "in" ? "↓" : "↑"}
                  </span>
                </div>

                <div className="transfer-details">
                  <div className="transfer-main">
                    <div className="badges">
                      <span
                        className="network-badge"
                        style={{ backgroundColor: transfer.networkColor }}
                      >
                        {EVM_CHAINS.find(c => c.id === transfer.network)?.shortName || transfer.networkName}
                      </span>
                      <span
                        className="category-badge"
                        style={{ backgroundColor: categoryStyle.color }}
                      >
                        {categoryStyle.label}
                      </span>
                    </div>
                    <span className="transfer-value">
                      {direction === "in" ? "+" : "-"}
                      {formatValue(transfer.value)} {transfer.asset}
                    </span>
                  </div>

                  <div className="transfer-addresses">
                    <span className="from-to">
                      {direction === "in" ? "From: " : "To: "}
                      {shortenAddress(
                        direction === "in" ? transfer.from : transfer.to
                      )}
                    </span>
                  </div>

                  <div className="transfer-meta">
                    {transfer.metadata?.blockTimestamp && (
                      <span className="timestamp">
                        {formatTimestamp(transfer.metadata.blockTimestamp)}
                      </span>
                    )}
                    <a
                      href={getExplorerUrl(transfer.network, transfer.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="explorer-link"
                    >
                      View on Explorer &rarr;
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading && transfers.length === 0 && loadingChains.length === 0 && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading transaction history...</p>
        </div>
      )}

      <style>{`
        .transaction-history {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
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

        .header-info {
          text-align: center;
        }

        .header-info h2 {
          margin: 0;
          font-size: 20px;
          color: #111827;
        }

        .address-info {
          margin: 4px 0 0;
          font-size: 14px;
          color: #6b7280;
        }

        .supported-chains {
          margin: 2px 0 0;
          font-size: 12px;
          color: #9ca3af;
        }

        .refresh-button {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .refresh-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-chains {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: #f0f9ff;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #0369a1;
        }

        .loading-spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid #bfdbfe;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .chain-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
          justify-content: center;
        }

        .chain-stat {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #f9fafb;
          border: 1px solid;
          border-radius: 16px;
          font-size: 12px;
          color: #4b5563;
        }

        .chain-stat.error {
          background: #fef2f2;
          color: #dc2626;
        }

        .chain-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          color: #dc2626;
        }

        .error-message button {
          margin-top: 12px;
          padding: 8px 16px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          background: #f9fafb;
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          margin: 0 0 8px;
          color: #374151;
        }

        .empty-state p {
          margin: 0;
          color: #6b7280;
        }

        .transfers-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transfer-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          transition: border-color 0.2s;
        }

        .transfer-item:hover {
          border-color: #d1d5db;
        }

        .transfer-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f3f4f6;
          flex-shrink: 0;
        }

        .direction-indicator {
          font-size: 20px;
          font-weight: bold;
        }

        .direction-indicator.in {
          color: #10b981;
        }

        .direction-indicator.out {
          color: #ef4444;
        }

        .transfer-details {
          flex: 1;
          min-width: 0;
        }

        .transfer-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .badges {
          display: flex;
          gap: 6px;
        }

        .network-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: white;
        }

        .category-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          color: white;
        }

        .transfer-value {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .transfer-addresses {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .transfer-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #9ca3af;
        }

        .timestamp {
          flex-shrink: 0;
        }

        .explorer-link {
          color: #3b82f6;
          text-decoration: none;
          margin-left: auto;
        }

        .explorer-link:hover {
          text-decoration: underline;
        }

        .loading-state {
          text-align: center;
          padding: 48px 24px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
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
