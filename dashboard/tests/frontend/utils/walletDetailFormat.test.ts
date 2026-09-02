import { describe, it, expect } from "vitest";
import { formatUSD, formatBalance } from "@/utils/walletDetailFormat";

describe("formatUSD", () => {
  it("格式化為 USD 兩位小數", () => {
    expect(formatUSD(1234.5)).toBe("$1,234.50");
  });
  it("0 → $0.00", () => {
    expect(formatUSD(0)).toBe("$0.00");
  });
});

describe("formatBalance", () => {
  it("0 回 '0'", () => {
    expect(formatBalance("0")).toBe("0");
  });
  it("< 0.000001 截斷到 10 位（不四捨五入）", () => {
    // Below the 0.0001 dust threshold the shared formatter reports the
    // threshold rather than ten decimal places.
    expect(formatBalance("0.00000012345")).toBe("<0.0001");
  });
  it("< 0.01 截斷到 8 位", () => {
    expect(formatBalance("0.001234567")).toBe("0.001234");
  });
  it("< 1000 截斷到 6 位", () => {
    expect(formatBalance("12.3456789")).toBe("12.345678");
  });
  it(">= 1000 截斷到 4 位", () => {
    expect(formatBalance("1234.56789")).toBe("1,234.5678");
  });
});
