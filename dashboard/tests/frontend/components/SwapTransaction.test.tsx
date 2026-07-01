import { describe, it, expect } from "vitest";
import { swapRouteChanged } from "@/components/SwapTransaction";

describe("swapRouteChanged", () => {
  it("returns false when provider and fee match", () => {
    expect(swapRouteChanged(
      { dex: "OpenOcean", feeRate: "0.1" } as any,
      { dex: "OpenOcean", feeRate: "0.1" } as any,
    )).toBe(false);
  });

  it("returns true when provider changed (fallback)", () => {
    expect(swapRouteChanged(
      { dex: "OpenOcean", feeRate: "0.1" } as any,
      { dex: "KyberSwap", feeRate: "0" } as any,
    )).toBe(true);
  });

  it("returns true when fee changed", () => {
    expect(swapRouteChanged(
      { dex: "OpenOcean", feeRate: "0.1" } as any,
      { dex: "OpenOcean", feeRate: "0" } as any,
    )).toBe(true);
  });

  it("returns false when the first quote is missing (nothing to compare)", () => {
    expect(swapRouteChanged(null, { dex: "KyberSwap", feeRate: "0" } as any)).toBe(false);
  });
});
