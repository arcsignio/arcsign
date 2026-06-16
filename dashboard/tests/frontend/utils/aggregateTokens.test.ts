/**
 * Tests for the assets-list token aggregation layer.
 */
import { describe, it, expect } from "vitest";
import { aggregateTokens, canonicalNetwork, type IsKnownToken } from "@/utils/aggregateTokens";
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

  it("merges whitelisted ERC-20 across chains by symbol (USDC → one row)", () => {
    // Both contracts are whitelisted → real USDC on 2 chains becomes one row.
    const known = () => true;
    const out = aggregateTokens([
      tok({ tokenSymbol: "USDC", tokenName: "USD Coin", tokenAddress: "0xA", network: "eth-mainnet", usdValue: 100 }),
      tok({ tokenSymbol: "USDC", tokenName: "USD Coin", tokenAddress: "0xB", network: "polygon-mainnet", networkLabel: "Polygon", usdValue: 50 }),
    ], known);
    expect(out).toHaveLength(1);
    expect(out[0].symbol).toBe("USDC");
    expect(out[0].isMultiChain).toBe(true);
    expect(out[0].totalUsdValue).toBe(150);
    expect(out[0].sources).toHaveLength(2); // detail page can show both contracts
  });

  it("does NOT merge a same-named fake token into the real one (whitelist gate)", () => {
    // Real USDC on Ethereum (whitelisted) + a fake "USDC" on Polygon (not).
    const known: IsKnownToken = (net, addr) =>
      net === "eth-mainnet" && addr.toLowerCase() === "0xreal";
    const out = aggregateTokens([
      tok({ tokenSymbol: "USDC", tokenAddress: "0xREAL", network: "eth-mainnet", usdValue: 100 }),
      tok({ tokenSymbol: "USDC", tokenAddress: "0xFAKE", network: "polygon-mainnet", networkLabel: "Polygon", usdValue: 999999 }),
    ], known);
    // Two rows: the fake must NOT be merged into real USDC's value.
    expect(out).toHaveLength(2);
    const real = out.find((r) => r.sources[0].tokenAddress === "0xREAL")!;
    expect(real.totalUsdValue).toBe(100); // not polluted by the fake's 999999
    expect(real.isMultiChain).toBe(false);
  });

  it("keeps ERC-20 per-chain when no whitelist is provided (safe default)", () => {
    const out = aggregateTokens([
      tok({ tokenSymbol: "USDC", tokenAddress: "0xA", network: "eth-mainnet", usdValue: 100 }),
      tok({ tokenSymbol: "USDC", tokenAddress: "0xB", network: "polygon-mainnet", networkLabel: "Polygon", usdValue: 50 }),
    ]); // no isKnownToken arg
    expect(out).toHaveLength(2);
  });

  it("sorts rows by total USD value descending", () => {
    const out = aggregateTokens([
      tok({ tokenSymbol: "ETH", tokenAddress: "", usdValue: 5 }),
      tok({ tokenSymbol: "USDC", tokenAddress: "0xA", usdValue: 100 }),
    ]);
    expect(out[0].symbol).toBe("USDC");
    expect(out[1].symbol).toBe("ETH");
  });

  it("merges sources from the same chain reported under two spellings", () => {
    // BSC arriving once as "BNB Chain"/bnb-mainnet and once as "BSC"/bsc-mainnet
    // must collapse to ONE detail row (not two), with balances summed.
    const known = () => true;
    const out = aggregateTokens([
      tok({ tokenSymbol: "USDC", tokenAddress: "0xC", network: "bnb-mainnet", networkLabel: "BNB Chain", balance: "50", usdValue: 50 }),
      tok({ tokenSymbol: "USDC", tokenAddress: "0xC", network: "bsc", networkLabel: "BSC", balance: "0", usdValue: 0 }),
    ], known);
    expect(out).toHaveLength(1);
    expect(out[0].sources).toHaveLength(1); // one BSC row, not two
    expect(out[0].networks).toEqual(["bsc-mainnet"]);
    expect(out[0].isMultiChain).toBe(false);
    expect(out[0].sources[0].balance).toBe("50");
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
