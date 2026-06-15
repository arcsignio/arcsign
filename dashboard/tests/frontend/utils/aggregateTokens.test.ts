/**
 * Tests for the assets-list token aggregation layer.
 */
import { describe, it, expect } from "vitest";
import { aggregateTokens, canonicalNetwork } from "@/utils/aggregateTokens";
import type { TokenBalance } from "@/types/tokens";

function tok(p: Partial<TokenBalance>): TokenBalance {
  return {
    address: "0xwallet",
    network: "eth-mainnet",
    networkLabel: "Ethereum",
    tokenAddress: "", // native by default
    tokenSymbol: "ETH",
    tokenName: "Ethereum",
    tokenLogo: "",
    balance: "1",
    rawBalance: "0x1",
    decimals: 18,
    usdValue: 0,
    priceUsd: 0,
    ...p,
  };
}

describe("aggregateTokens", () => {
  it("merges native coins across chains into one row", () => {
    const out = aggregateTokens([
      tok({ network: "eth-mainnet", networkLabel: "Ethereum", balance: "1", usdValue: 2000 }),
      tok({ network: "base-mainnet", networkLabel: "Base", balance: "0.5", usdValue: 1000 }),
      tok({ network: "arbitrum-mainnet", networkLabel: "Arbitrum One", balance: "0.5", usdValue: 1000 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe("ETH");
    expect(out[0].isMultiChain).toBe(true);
    expect(out[0].networks).toHaveLength(3);
    expect(out[0].totalUsdValue).toBe(4000);
    expect(out[0].totalBalance).toBe(2);
  });

  it("collapses differently-spelled networks for the same chain", () => {
    // "ethereum" and "eth-mainnet" are the same chain — must not double-count.
    const out = aggregateTokens([
      tok({ network: "ethereum", networkLabel: "Ethereum", usdValue: 10 }),
      tok({ network: "eth-mainnet", networkLabel: "Ethereum", usdValue: 10 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].networks).toEqual(["eth-mainnet"]);
    expect(out[0].isMultiChain).toBe(false);
  });

  it("keeps ERC-20 tokens separate per chain (different contracts)", () => {
    const out = aggregateTokens([
      tok({ tokenSymbol: "USDC", tokenName: "USD Coin", tokenAddress: "0xA", network: "eth-mainnet", usdValue: 100 }),
      tok({ tokenSymbol: "USDC", tokenName: "USD Coin", tokenAddress: "0xB", network: "polygon-mainnet", networkLabel: "Polygon", usdValue: 50 }),
    ]);
    // Same symbol, different chains/contracts → two rows, not merged.
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.symbol === "USDC")).toBe(true);
    expect(out.every((r) => !r.isMultiChain)).toBe(true);
  });

  it("sorts rows by total USD value descending", () => {
    const out = aggregateTokens([
      tok({ tokenSymbol: "ETH", tokenAddress: "", usdValue: 5 }),
      tok({ tokenSymbol: "USDC", tokenAddress: "0xA", usdValue: 100 }),
    ]);
    expect(out[0].symbol).toBe("USDC");
    expect(out[1].symbol).toBe("ETH");
  });

  it("handles empty input", () => {
    expect(aggregateTokens([])).toEqual([]);
  });
});

describe("canonicalNetwork", () => {
  it("normalizes various spellings to canonical keys", () => {
    expect(canonicalNetwork(tok({ network: "ethereum", networkLabel: "Ethereum" }))).toBe("eth-mainnet");
    expect(canonicalNetwork(tok({ network: "matic-mainnet", networkLabel: "Polygon" }))).toBe("polygon-mainnet");
    expect(canonicalNetwork(tok({ network: "Arbitrum One", networkLabel: "Arbitrum One" }))).toBe("arbitrum-mainnet");
  });
});
