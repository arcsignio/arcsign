import { describe, it, expect, vi } from "vitest";
import { enrichNativeTokens } from "@/utils/enrichTokens";
import type { TokenBalance } from "@/types/tokens";

vi.mock("@/constants/nativeTokens", () => ({
  getNetworkKey: (label: string) => (label === "Ethereum" ? "ethereum" : label === "BSC" ? "bsc" : null),
  isNativeTokenAddress: (addr: string) => addr === "0x0000000000000000000000000000000000000000",
  getNativeToken: (key: string) =>
    key === "ethereum"
      ? { symbol: "ETH", name: "Ethereum", logoURI: "eth.png" }
      : key === "bsc"
        ? { symbol: "BNB", name: "BNB", logoURI: "bnb.png" }
        : null,
}));

const NATIVE = "0x0000000000000000000000000000000000000000";
const mk = (over: Partial<TokenBalance>): TokenBalance => ({
  tokenAddress: NATIVE,
  network: "Ethereum",
  networkLabel: "Ethereum",
  tokenSymbol: "",
  tokenName: "",
  tokenLogo: "",
  balance: "0",
  usdValue: 0,
  ...over,
} as TokenBalance);

describe("enrichNativeTokens", () => {
  it("補齊 native token 的 symbol/name/logo（原本空）", () => {
    const [t] = enrichNativeTokens([mk({})]);
    expect(t.tokenSymbol).toBe("ETH");
    expect(t.tokenName).toBe("Ethereum");
    expect(t.tokenLogo).toBe("eth.png");
  });

  it("已有 symbol 的 native token 不被覆蓋", () => {
    const [t] = enrichNativeTokens([mk({ tokenSymbol: "WETH", tokenName: "Wrapped", tokenLogo: "w.png" })]);
    expect(t.tokenSymbol).toBe("WETH");
    expect(t.tokenName).toBe("Wrapped");
  });

  it("非 native token 不動", () => {
    const [t] = enrichNativeTokens([mk({ tokenAddress: "0xabc", tokenSymbol: "USDC" })]);
    expect(t.tokenSymbol).toBe("USDC");
  });

  it("未知 network（getNetworkKey 回 null）不動", () => {
    const [t] = enrichNativeTokens([mk({ network: "Unknown", networkLabel: "Unknown", tokenSymbol: "" })]);
    expect(t.tokenSymbol).toBe("");
  });

  it("空陣列回空陣列", () => {
    expect(enrichNativeTokens([])).toEqual([]);
  });

  it("依 networkLabel 決定 native metadata（BSC → BNB）", () => {
    const [t] = enrichNativeTokens([mk({ network: "BSC", networkLabel: "BSC" })]);
    expect(t.tokenSymbol).toBe("BNB");
  });
});
