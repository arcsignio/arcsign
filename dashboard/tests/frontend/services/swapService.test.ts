import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import { fetchSwapTokens, fetchQuote, buildSwap, executeApproval } from "@/services/swapService";

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

const erc20 = { network: "eth-mainnet", fromAddress: "0xowner", tokenAddress: "0xtoken", tokenSymbol: "USDC", tokenName: "USD Coin", decimals: 6, balance: "100" } as any;
const native = { network: "eth-mainnet", fromAddress: "0xowner", tokenAddress: "", tokenSymbol: "ETH", tokenName: "Ether", decimals: 18, balance: "1" } as any;
const baseBuild = { chainId: "ethereum", toTokenAddress: "0xb", amountWei: "1000000", slippage: 0.5, provider: "openocean", isPro: false, usbPath: "/u", sessionToken: "t" };

describe("swapService.buildSwap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("native token: builds swap, no allowance check, needsApproval=false", async () => {
    (api.buildSwapTransaction as any).mockResolvedValue({ txData: { to: "0xrouter" } });
    const r = await buildSwap({ ...baseBuild, fromToken: native });
    expect(api.checkSwapAllowance).not.toHaveBeenCalled();
    expect(r.allowance).toEqual({ needsApproval: false, current: null });
    expect(r.swapTx).toEqual({ txData: { to: "0xrouter" } });
  });

  it("erc20 with sufficient allowance: needsApproval=false", async () => {
    (api.buildSwapTransaction as any).mockResolvedValue({ txData: { to: "0xrouter" } });
    (api.checkSwapAllowance as any).mockResolvedValue({ allowance: "2000000" });
    const r = await buildSwap({ ...baseBuild, fromToken: erc20, amountWei: "1000000" });
    expect(r.allowance).toEqual({ needsApproval: false, current: "2000000" });
  });

  it("erc20 with insufficient allowance: needsApproval=true", async () => {
    (api.buildSwapTransaction as any).mockResolvedValue({ txData: { to: "0xrouter" } });
    (api.checkSwapAllowance as any).mockResolvedValue({ allowance: "500000" });
    const r = await buildSwap({ ...baseBuild, fromToken: erc20, amountWei: "1000000" });
    expect(r.allowance).toEqual({ needsApproval: true, current: "500000" });
  });

  it("erc20 allowance check throws: treat as needsApproval=true (safe default), current=null", async () => {
    (api.buildSwapTransaction as any).mockResolvedValue({ txData: { to: "0xrouter" } });
    (api.checkSwapAllowance as any).mockRejectedValue(new Error("rpc down"));
    const r = await buildSwap({ ...baseBuild, fromToken: erc20 });
    expect(r.allowance).toEqual({ needsApproval: true, current: null });
  });

  it("forwards build params incl. provider undefined when isPro", async () => {
    (api.buildSwapTransaction as any).mockResolvedValue({ txData: { to: "0xrouter" } });
    (api.checkSwapAllowance as any).mockResolvedValue({ allowance: "0" });
    await buildSwap({ ...baseBuild, fromToken: erc20, isPro: true });
    expect(api.buildSwapTransaction).toHaveBeenCalledWith(expect.objectContaining({ provider: undefined, isPro: true, fromTokenAddress: "0xtoken", toTokenAddress: "0xb" }));
  });
});

const apprParams = { chainId: "ethereum", walletId: "w1", fromToken: erc20, spenderAddress: "0xrouter", approvalAmountWei: "1000000", walletPassword: "pw", preValidatedPassphrase: "", usbPath: "/u", sessionToken: "t" };

describe("swapService.executeApproval", () => {
  // Fake timers so the 3s poll sleep costs no real wall-clock time. The loop is
  // driven by advancing timers + flushing microtasks (runAllTimersAsync).
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("runs getApproval→build→sign→broadcast→poll and returns the tx hash on confirmation", async () => {
    (api.getSwapApproval as any).mockResolvedValue({ to: "0xtoken", data: "0xapprovecalldata" });
    (api.buildTransaction as any).mockResolvedValue({ unsigned: "0xbuilt" });
    (api.signTransaction as any).mockResolvedValue("0xsigned");
    (api.broadcastTransaction as any).mockResolvedValue({ txHash: "0xapprovalhash" });
    (api.queryTransactionStatus as any).mockResolvedValue({ status: "confirmed" });

    const promise = executeApproval(apprParams);
    // Drive the real poll loop through its 3s sleep without waiting in real time.
    await vi.runAllTimersAsync();
    const hash = await promise;
    expect(hash).toBe("0xapprovalhash");

    // SAFETY: signTransaction params byte-identical to the handler
    expect(api.signTransaction).toHaveBeenCalledWith({
      chainId: "ethereum", walletId: "w1", password: "pw", passphrase: "",
      fromAddress: "0xowner", unsignedTx: { unsigned: "0xbuilt" }, usbPath: "/u", sessionToken: "t",
    });
    // approval build sends value "0" and the approve calldata to the token contract
    expect(api.buildTransaction).toHaveBeenCalledWith(expect.objectContaining({ to: "0xtoken", amount: "0", data: "0xapprovecalldata", feeSpeed: "fast" }));
  });

  it("throws APPROVAL_FAILED when status is failed", async () => {
    (api.getSwapApproval as any).mockResolvedValue({ to: "0xtoken", data: "0xd" });
    (api.buildTransaction as any).mockResolvedValue({ unsigned: "0xbuilt" });
    (api.signTransaction as any).mockResolvedValue("0xsigned");
    (api.broadcastTransaction as any).mockResolvedValue({ txHash: "0xh" });
    (api.queryTransactionStatus as any).mockResolvedValue({ status: "failed" });
    const promise = executeApproval(apprParams);
    const assertion = expect(promise).rejects.toThrow("APPROVAL_FAILED");
    await vi.runAllTimersAsync();
    await assertion;
  });
});
