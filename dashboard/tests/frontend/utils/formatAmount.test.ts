/**
 * The shared amount formatter.
 *
 * These pin the two decisions that matter for a wallet: amounts are truncated
 * rather than rounded, and the thousands separator does not follow the user's
 * locale. Both are correctness properties, not preferences — see the module
 * header for why.
 */

import { describe, it, expect } from "vitest";
import {
  formatAmount,
  formatUSD,
  shortenAddress,
  toDecimalString,
} from "@/utils/formatAmount";

describe("formatAmount", () => {
  it("groups thousands and keeps four decimals on large values", () => {
    expect(formatAmount("1234.5678")).toBe("1,234.5678");
    expect(formatAmount("1000000")).toBe("1,000,000.0000");
  });

  it("keeps six decimals below a thousand", () => {
    expect(formatAmount("1")).toBe("1.000000");
    expect(formatAmount("0.5")).toBe("0.500000");
  });

  // A wallet that rounds up invites the user to type a number they cannot
  // cover. The displayed figure has to be a floor.
  it("truncates rather than rounds", () => {
    expect(formatAmount("1.49999")).toBe("1.499990");
    expect(formatAmount("0.9999999")).toBe("0.999999");
    expect(formatAmount("1234.56789")).toBe("1,234.5678");
  });

  it("shows dust as a threshold", () => {
    expect(formatAmount("0.00000001")).toBe("<0.0001");
    expect(formatAmount("0.00009")).toBe("<0.0001");
  });

  it("renders zero as zero, not as dust", () => {
    expect(formatAmount("0")).toBe("0");
    expect(formatAmount(0)).toBe("0");
  });

  // Several of the implementations this replaces rendered the literal string
  // "NaN" into the UI for these.
  it("renders missing or malformed input as zero", () => {
    expect(formatAmount("")).toBe("0");
    expect(formatAmount(undefined)).toBe("0");
    expect(formatAmount(null)).toBe("0");
    expect(formatAmount("not a number")).toBe("0");
  });

  it("handles negatives", () => {
    expect(formatAmount("-1234.5678")).toBe("-1,234.5678");
  });

  // The separator must not follow the runtime locale: `1.234` is ambiguous
  // between one thousand and one-point-two-three-four, and the old code showed
  // a German user both conventions on different screens of the same app.
  it("uses en-US grouping regardless of locale", () => {
    const original = Intl.NumberFormat;
    try {
      // Force a locale whose conventions differ, the way a de-DE runtime would.
      Object.defineProperty(Intl, "NumberFormat", {
        configurable: true,
        writable: true,
        value: function (this: unknown, _l?: string, o?: Intl.NumberFormatOptions) {
          return new original("de-DE", o);
        } as unknown as typeof Intl.NumberFormat,
      });
      expect(formatAmount("1234.5678")).toBe("1,234.5678");
    } finally {
      Object.defineProperty(Intl, "NumberFormat", {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });
});

describe("formatUSD", () => {
  it("groups thousands and pins two decimals", () => {
    expect(formatUSD(1234.5)).toBe("$1,234.50");
    expect(formatUSD(1000000)).toBe("$1,000,000.00");
    expect(formatUSD(0)).toBe("$0.00");
  });

  // The previous implementation produced "$NaN" for these.
  it("renders missing input as zero", () => {
    expect(formatUSD(undefined)).toBe("$0.00");
    expect(formatUSD(null)).toBe("$0.00");
    expect(formatUSD(NaN)).toBe("$0.00");
  });
});

describe("shortenAddress", () => {
  const addr = "0x1234567890abcdef1234567890abcdef12345678";

  it("keeps the default six characters at each end", () => {
    expect(shortenAddress(addr)).toBe("0x1234...345678");
  });

  it("honours a wider shape where the layout has room", () => {
    expect(shortenAddress(addr, 10)).toBe("0x12345678...ef12345678");
  });

  it("leaves a value shorter than the shape untouched", () => {
    expect(shortenAddress("0x1234")).toBe("0x1234");
  });

  // Unguarded .length reads meant one malformed row could blank a whole list.
  it("returns empty for a missing value instead of throwing", () => {
    expect(shortenAddress(undefined)).toBe("");
    expect(shortenAddress(null)).toBe("");
    expect(shortenAddress("")).toBe("");
  });
});

describe("toDecimalString", () => {
  it("scales by the given decimals", () => {
    expect(toDecimalString("1500000000000000000", 18)).toBe("1.5");
    expect(toDecimalString("100000000", 6)).toBe("100");
    expect(toDecimalString("1", 18)).toBe("0.000000000000000001");
  });

  it("defaults to 18 decimals", () => {
    expect(toDecimalString("1500000000000000000")).toBe("1.5");
  });

  // `|| 18` would coerce 0 to 18 and divide by 10^18 instead of 10^0.
  it("honours zero decimals", () => {
    expect(toDecimalString("1000000", 0)).toBe("1000000");
  });

  it("accepts hex and bigint", () => {
    expect(toDecimalString("0x0", 18)).toBe("0");
    expect(toDecimalString(1500000000000000000n, 18)).toBe("1.5");
  });

  it("returns 0 for missing or malformed input", () => {
    expect(toDecimalString("")).toBe("0");
    expect(toDecimalString(null)).toBe("0");
    expect(toDecimalString(undefined)).toBe("0");
    expect(toDecimalString("not a number")).toBe("0");
  });

  // The whole reason this is BigInt: Number(2^256-1)/Number(10^18) yields
  // 1.157920892373162e+59, an unformattable string.
  it("keeps precision far above 2^53", () => {
    const max = (2n ** 256n - 1n).toString();
    const out = toDecimalString(max, 18);
    expect(out).not.toContain("e+");
    expect(out.split(".")[0]).toHaveLength(60);
  });

  it("handles negatives", () => {
    expect(toDecimalString("-1500000000000000000", 18)).toBe("-1.5");
  });
});
