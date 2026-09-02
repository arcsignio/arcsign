/**
 * The value line in the WalletConnect approval prompt.
 *
 * This is the string a user reads immediately before approving a transaction,
 * and it had no test at all. Two defects it carried: "0" rendered as
 * "0.000000 ETH" while "0x0" rendered as "0 ETH" — the same value, two
 * strings, because the guard treats "0" as truthy — and the dust threshold was
 * "< 0.0001" with a space no other screen in the app uses.
 */

import { describe, it, expect } from "vitest";
import { formatWeiValue } from "@/services/walletconnect/utils/validators";

describe("formatWeiValue", () => {
  it("renders zero the same way regardless of notation", () => {
    expect(formatWeiValue("0", "ETH")).toBe("0 ETH");
    expect(formatWeiValue("0x0", "ETH")).toBe("0 ETH");
    expect(formatWeiValue("0x", "ETH")).toBe("0 ETH");
    expect(formatWeiValue(undefined, "ETH")).toBe("0 ETH");
  });

  it("formats a normal value", () => {
    expect(formatWeiValue("1500000000000000000", "ETH")).toBe("1.500000 ETH");
  });

  it("groups large values", () => {
    expect(formatWeiValue("1000000000000000000000", "ETH")).toBe("1,000.0000 ETH");
  });

  // No space after "<", matching every other screen.
  it("uses the shared dust threshold", () => {
    expect(formatWeiValue("1", "ETH")).toBe("<0.0001 ETH");
  });

  it("carries the chain's own symbol", () => {
    expect(formatWeiValue("1500000000000000000", "BNB")).toBe("1.500000 BNB");
  });

  // A signing surface must not turn an unreadable value into a confident
  // "0 ETH". Show what actually arrived instead.
  it("passes an unparseable value through unchanged", () => {
    expect(formatWeiValue("totally bogus", "ETH")).toBe("totally bogus");
  });
});
