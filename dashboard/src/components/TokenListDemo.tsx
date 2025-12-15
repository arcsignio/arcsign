/**
 * Token List Demo Component
 * For testing and demonstrating token list functionality
 */

import { useState } from "react";
import {
  usePriorityTokens,
  useTopTokens,
  useTokenSearch,
} from "@/hooks/useTokenList";
import type { ChainKey } from "@/services/tokenList";

export function TokenListDemo() {
  const [selectedChain, setSelectedChain] = useState<ChainKey>("ethereum");
  const [searchTerm, setSearchTerm] = useState("");

  const { tokens: priorityTokens, isLoading: loadingPriority } =
    usePriorityTokens();
  const { tokens: topTokens, isLoading: loadingTop } = useTopTokens(
    selectedChain,
    10
  );
  const { tokens: searchResults, isLoading: searching } =
    useTokenSearch(searchTerm);

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "700", marginBottom: "2rem" }}>
        Token List Demo
      </h1>

      {/* Chain Selector */}
      <div style={{ marginBottom: "2rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "600",
          }}
        >
          Select Chain:
        </label>
        <select
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value as ChainKey)}
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            borderRadius: "0.5rem",
            border: "2px solid #e5e7eb",
          }}
        >
          <option value="ethereum">Ethereum</option>
          <option value="arbitrum">Arbitrum One</option>
          <option value="polygon">Polygon</option>
          <option value="optimism">Optimism</option>
          <option value="bsc">BSC</option>
        </select>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "2rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "600",
          }}
        >
          Search Token:
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter token symbol (e.g., USDC)"
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            borderRadius: "0.5rem",
            border: "2px solid #e5e7eb",
            width: "100%",
            maxWidth: "400px",
          }}
        />
        {searching && <span style={{ marginLeft: "1rem" }}>Searching...</span>}
      </div>

      {/* Search Results */}
      {searchTerm && searchResults.length > 0 && (
        <div style={{ marginBottom: "3rem" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "1rem",
            }}
          >
            Search Results ({searchResults.length})
          </h2>
          <div style={{ display: "grid", gap: "1rem" }}>
            {searchResults.slice(0, 20).map((token, idx) => (
              <div
                key={`${token.chainId}-${token.address}-${idx}`}
                style={{
                  padding: "1rem",
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  style={{ width: "40px", height: "40px", borderRadius: "50%" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text y="28" font-size="28">🪙</text></svg>';
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600" }}>{token.symbol}</div>
                  <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                    {token.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                    {token.chainName} • {token.address.slice(0, 10)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority Tokens */}
      <div style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            marginBottom: "1rem",
          }}
        >
          Priority Tokens
          {loadingPriority && (
            <span style={{ marginLeft: "1rem", fontSize: "0.875rem" }}>
              Loading...
            </span>
          )}
        </h2>
        <div
          style={{
            fontSize: "0.875rem",
            color: "#6b7280",
            marginBottom: "1rem",
          }}
        >
          Common tokens that are always displayed (USDT, USDC, ETH, etc.)
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          {priorityTokens.slice(0, 12).map((token, idx) => (
            <div
              key={`${token.chainId}-${token.address}-${idx}`}
              style={{
                padding: "1rem",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <img
                src={token.logoURI}
                alt={token.symbol}
                style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><text y="24" font-size="24">🪙</text></svg>';
                }}
              />
              <div>
                <div style={{ fontWeight: "600", fontSize: "0.875rem" }}>
                  {token.symbol}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                  {token.chainName}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Tokens by Chain */}
      <div>
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            marginBottom: "1rem",
          }}
        >
          Top 10 Tokens on{" "}
          {selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)}
          {loadingTop && (
            <span style={{ marginLeft: "1rem", fontSize: "0.875rem" }}>
              Loading...
            </span>
          )}
        </h2>
        <div style={{ display: "grid", gap: "1rem" }}>
          {topTokens.map((token, idx) => (
            <div
              key={`${token.chainId}-${token.address}`}
              style={{
                padding: "1rem",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div
                style={{
                  width: "32px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontWeight: "600",
                }}
              >
                #{idx + 1}
              </div>
              <img
                src={token.logoURI}
                alt={token.symbol}
                style={{ width: "40px", height: "40px", borderRadius: "50%" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text y="28" font-size="28">🪙</text></svg>';
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "600" }}>{token.symbol}</div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                  {token.name}
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                  fontFamily: "monospace",
                }}
              >
                {token.address.slice(0, 10)}...{token.address.slice(-8)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
