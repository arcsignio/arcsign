import { describe, it, expect } from "vitest";
import {
  networkToChainId,
  getExplorerUrl,
  getNetworkIcon,
  getNativeTokenSymbol,
  toSmallestUnit,
  fromSmallestUnit,
  shortenAddress,
  formatBalance,
} from "@/utils/swapFormat";

describe("networkToChainId", () => {
  it("maps known internal network ids to short chain ids", () => {
    expect(networkToChainId("eth-mainnet")).toBe("ethereum");
    expect(networkToChainId("bnb-mainnet")).toBe("bnb");
  });
  it("passes through an unknown network unchanged", () => {
    expect(networkToChainId("unknown-net")).toBe("unknown-net");
  });
});

describe("getExplorerUrl", () => {
  it("builds a known-chain explorer url", () => {
    expect(getExplorerUrl("polygon-mainnet", "0xabc")).toBe("https://polygonscan.com/tx/0xabc");
  });
  it("falls back to etherscan for an unknown network", () => {
    expect(getExplorerUrl("nope", "0xabc")).toBe("https://etherscan.io/tx/0xabc");
  });
});

describe("getNetworkIcon", () => {
  it("returns the mapped icon", () => {
    expect(getNetworkIcon("base-mainnet")).toBe("🔷");
  });
  it("falls back to the link glyph", () => {
    expect(getNetworkIcon("nope")).toBe("🔗");
  });
});

describe("getNativeTokenSymbol", () => {
  it("resolves both internal ids and short chain ids", () => {
    expect(getNativeTokenSymbol("polygon-mainnet")).toBe("MATIC");
    expect(getNativeTokenSymbol("bsc")).toBe("BNB");
  });
  it("defaults to ETH for unknowns", () => {
    expect(getNativeTokenSymbol("nope")).toBe("ETH");
  });
});

describe("toSmallestUnit", () => {
  it("converts a whole number", () => {
    expect(toSmallestUnit("1", 6)).toBe("1000000");
  });
  it("pads short decimal parts", () => {
    expect(toSmallestUnit("1.5", 6)).toBe("1500000");
  });
  it("truncates over-long decimal parts to the token's decimals", () => {
    expect(toSmallestUnit("1.1234567", 2)).toBe("112");
  });
  it("returns '0' for empty or non-numeric input", () => {
    expect(toSmallestUnit("", 6)).toBe("0");
    expect(toSmallestUnit("abc", 6)).toBe("0");
  });
});

describe("fromSmallestUnit", () => {
  it("converts wei back to human-readable", () => {
    expect(fromSmallestUnit("1500000", 6)).toBe("1.5");
  });
  it("returns '0' for zero or empty", () => {
    expect(fromSmallestUnit("0", 18)).toBe("0");
    expect(fromSmallestUnit("", 18)).toBe("0");
  });
  it("defaults to 18 decimals when decimals is 0", () => {
    expect(fromSmallestUnit("1000000000000000000", 0)).toBe("1");
  });
});

describe("shortenAddress", () => {
  it("shortens a full address", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678"))
      .toBe("0x123456...345678");
  });
  it("returns short strings unchanged", () => {
    expect(shortenAddress("0x1234")).toBe("0x1234");
  });
});

describe("formatBalance", () => {
  it("returns '0' for zero", () => {
    expect(formatBalance("0")).toBe("0");
  });
  it("returns the small-value sentinel below 0.0001", () => {
    expect(formatBalance("0.00001")).toBe("<0.0001");
  });
  it("truncates (does not round) mid-range values to 6 decimals", () => {
    expect(formatBalance("0.1234569")).toBe("0.123456");
  });
  it("truncates large values to 4 decimals", () => {
    expect(formatBalance("12345.98765")).toBe("12345.9876");
  });
});
