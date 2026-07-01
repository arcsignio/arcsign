import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/tauri-api", () => ({
  getSwapTokens: vi.fn(),
  getSwapQuote: vi.fn(),
  buildSwapTransaction: vi.fn(),
  checkSwapAllowance: vi.fn(),
  getSwapApproval: vi.fn(),
  buildTransaction: vi.fn(),
  signTransaction: vi.fn(),
  broadcastTransaction: vi.fn(),
  queryTransactionStatus: vi.fn(),
  addTouchedToken: vi.fn(),
}));

import * as api from "@/services/tauri-api";
import { fetchSwapTokens, fetchQuote } from "@/services/swapService";

describe("swapService.fetchSwapTokens", () => {
  beforeEach(() => vi.clearAllMocks());
  it("passes params straight through to getSwapTokens and returns its result", async () => {
    (api.getSwapTokens as any).mockResolvedValue({ tokens: [{ address: "0x1" }] });
    const p = { chainId: "ethereum", provider: "openocean", usbPath: "/u", sessionToken: "t" };
    const out = await fetchSwapTokens(p);
    expect(api.getSwapTokens).toHaveBeenCalledWith(p);
    expect(out).toEqual({ tokens: [{ address: "0x1" }] });
  });
});

describe("swapService.fetchQuote", () => {
  beforeEach(() => vi.clearAllMocks());
  it("forwards all quote params to getSwapQuote and returns the quote", async () => {
    (api.getSwapQuote as any).mockResolvedValue({ dex: "OpenOcean", feeRate: "0.1" });
    const p = { chainId: "ethereum", fromTokenAddress: "0xa", toTokenAddress: "0xb", amount: "1000", fromAddress: "0xowner", slippage: 0.5, provider: "openocean", isPro: false, usbPath: "/u", sessionToken: "t" };
    const out = await fetchQuote(p);
    expect(api.getSwapQuote).toHaveBeenCalledWith(p);
    expect(out).toEqual({ dex: "OpenOcean", feeRate: "0.1" });
  });
  it("propagates the underlying error (no swallowing)", async () => {
    (api.getSwapQuote as any).mockRejectedValue(new Error("quote boom"));
    await expect(fetchQuote({ chainId: "ethereum", fromTokenAddress: "0xa", toTokenAddress: "0xb", amount: "1", fromAddress: "0xo", slippage: 0.5, isPro: false, usbPath: "/u", sessionToken: "t" })).rejects.toThrow("quote boom");
  });
});
