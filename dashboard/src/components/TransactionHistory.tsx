/**
 * TransactionHistory Component
 * Feature: Display asset transfers (transaction history) from Alchemy API
 */

import React, { useState, useEffect, useCallback } from "react";
import tauriApi, {
  type AssetTransfer,
  type AssetTransfersResponse,
} from "@/services/tauri-api";

interface TransactionHistoryProps {
  address: string;
  network: string; // e.g., "eth-mainnet", "polygon-mainnet"
  password: string;
  usbPath: string;
  onBack: () => void;
}

// Network display names
const NETWORK_NAMES: Record<string, string> = {
  "eth-mainnet": "Ethereum",
  "polygon-mainnet": "Polygon",
  "arbitrum-mainnet": "Arbitrum",
  "optimism-mainnet": "Optimism",
  "base-mainnet": "Base",
  "bnb-mainnet": "BNB Chain",
};

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
  network,
  password,
  usbPath,
  onBack,
}) => {
  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageKey, setPageKey] = useState<string>("");
  const [hasMore, setHasMore] = useState(false);

  const fetchTransfers = useCallback(
    async (loadMore = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const response: AssetTransfersResponse =
          await tauriApi.getAssetTransfers({
            address,
            network,
            maxCount: 50,
            pageKey: loadMore ? pageKey : "",
            password,
            usbPath,
          });

        if (loadMore) {
          setTransfers((prev) => [...prev, ...response.transfers]);
        } else {
          setTransfers(response.transfers);
        }

        setPageKey(response.pageKey);
        setHasMore(response.pageKey !== "");
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load transaction history";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [address, network, password, usbPath, pageKey]
  );

  useEffect(() => {
    fetchTransfers(false);
  }, [address, network]);

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
            {shortenAddress(address)} on{" "}
            {NETWORK_NAMES[network] || network}
          </p>
        </div>
        <button
          onClick={() => fetchTransfers(false)}
          disabled={isLoading}
          className="refresh-button"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => fetchTransfers(false)}>Retry</button>
        </div>
      )}

      {!error && transfers.length === 0 && !isLoading && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Transactions Found</h3>
          <p>This address has no transaction history on {NETWORK_NAMES[network] || network}.</p>
        </div>
      )}

      {transfers.length > 0 && (
        <div className="transfers-list">
          {transfers.map((transfer) => {
            const direction = getTransferDirection(transfer);
            const categoryStyle =
              CATEGORY_STYLES[transfer.category] || CATEGORY_STYLES.external;

            return (
              <div key={transfer.uniqueId} className="transfer-item">
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
                    <span
                      className="category-badge"
                      style={{ backgroundColor: categoryStyle.color }}
                    >
                      {categoryStyle.label}
                    </span>
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
                      href={getExplorerUrl(network, transfer.hash)}
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

          {hasMore && (
            <button
              className="load-more-button"
              onClick={() => fetchTransfers(true)}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Load More"}
            </button>
          )}
        </div>
      )}

      {isLoading && transfers.length === 0 && (
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

        .category-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
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

        .explorer-link {
          color: #3b82f6;
          text-decoration: none;
        }

        .explorer-link:hover {
          text-decoration: underline;
        }

        .load-more-button {
          width: 100%;
          padding: 12px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
          transition: background 0.2s;
        }

        .load-more-button:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .load-more-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
