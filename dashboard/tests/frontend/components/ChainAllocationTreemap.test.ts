/**
 * Tests for the chain-allocation treemap data layer.
 * Focus: it is driven entirely by the sources passed in, so any new chain
 * appears automatically with no code change.
 */
import { describe, it, expect } from "vitest";
import { buildChainAllocation } from "@/components/ChainAllocationTreemap";

describe("buildChainAllocation", () => {
  it("computes weights from USD value, sorted descending", () => {
    const out = buildChainAllocation([
      { network: "eth-mainnet", networkLabel: "Ethereum", usdValue: 100 },
      { network: "base-mainnet", networkLabel: "Base", usdValue: 300 },
      { network: "arbitrum-mainnet", networkLabel: "Arbitrum", usdValue: 200 },
    ]);
    expect(out.map((s) => s.networkLabel)).toEqual(["Base", "Arbitrum", "Ethereum"]);
    expect(out.map((s) => s.weight)).toEqual([300, 200, 100]);
  });

  it("falls back to balance when USD value is absent (NodeReal/Glacier case)", () => {
    const out = buildChainAllocation([
      { network: "bnb-mainnet", networkLabel: "BNB Chain", usdValue: 0, balance: "5" },
      { network: "avalanche-mainnet", networkLabel: "Avalanche", usdValue: 0, balance: "2" },
    ]);
    expect(out.map((s) => s.networkLabel)).toEqual(["BNB Chain", "Avalanche"]);
    expect(out.map((s) => s.weight)).toEqual([5, 2]);
  });

  it("drops zero-weight chains", () => {
    const out = buildChainAllocation([
      { network: "eth-mainnet", networkLabel: "Ethereum", usdValue: 100 },
      { network: "base-mainnet", networkLabel: "Base", usdValue: 0, balance: "0" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].networkLabel).toBe("Ethereum");
  });

  it("merges duplicate sources on the same chain", () => {
    const out = buildChainAllocation([
      { network: "eth-mainnet", networkLabel: "Ethereum", usdValue: 100 },
      { network: "eth-mainnet", networkLabel: "Ethereum", usdValue: 50 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].weight).toBe(150);
  });

  it("includes an arbitrary new chain with no code change (modularity)", () => {
    // A hypothetical future chain ArcSign hasn't shipped yet — it must still
    // flow into the allocation purely from its source row.
    const out = buildChainAllocation([
      { network: "eth-mainnet", networkLabel: "Ethereum", usdValue: 100 },
      { network: "scroll-mainnet", networkLabel: "Scroll", usdValue: 400 },
    ]);
    expect(out.map((s) => s.networkLabel)).toEqual(["Scroll", "Ethereum"]);
  });

  it("returns empty for no usable sources", () => {
    expect(buildChainAllocation([])).toEqual([]);
    expect(buildChainAllocation([{ network: "x", networkLabel: "X", usdValue: 0 }])).toEqual([]);
  });
});
