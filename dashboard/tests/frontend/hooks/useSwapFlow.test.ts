/**
 * useSwapFlow — renderHook tests for pure state transitions.
 *
 * Focus: synchronous step changes that require no real network.
 * The tauri-api default export is mocked so async side-effects resolve
 * immediately (or are simply never triggered). useSignGate is mocked
 * because it calls checkTransactionSecurity, which needs a real USB path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── mocks must be hoisted before importing the hook ───────────────────────────

vi.mock("@/services/tauri-api", () => ({
  default: {
    getSwapTokens: vi.fn().mockResolvedValue({ tokens: [] }),
    getSwapQuote: vi.fn().mockResolvedValue({}),
    buildSwapTransaction: vi.fn().mockResolvedValue({ txData: { to: "0xrouter", value: "0", data: "0x" } }),
    checkSwapAllowance: vi.fn().mockResolvedValue({ allowance: "0" }),
    getSwapApproval: vi.fn().mockResolvedValue({ to: "0xtoken", data: "0x" }),
    buildTransaction: vi.fn().mockResolvedValue("0xraw"),
    signTransaction: vi.fn().mockResolvedValue("0xsigned"),
    broadcastTransaction: vi.fn().mockResolvedValue({ txHash: "0xtxhash" }),
    queryTransactionStatus: vi.fn().mockResolvedValue({ status: "confirmed" }),
    addTouchedToken: vi.fn().mockResolvedValue({}),
    checkTransactionSecurity: vi.fn().mockResolvedValue({ proRequired: false, warnings: [], riskLevel: "safe", requiresAcknowledge: false }),
  },
  checkTransactionSecurity: vi.fn().mockResolvedValue({ proRequired: false, warnings: [], riskLevel: "safe", requiresAcknowledge: false }),
}));

// Mock useSignGate so the hook renders without a real USB/backend call.
// Real return shape from useSignGate.ts: { security, requiresAcknowledge, acknowledged, setAcknowledged }
vi.mock("@/hooks/useSignGate", () => ({
  useSignGate: () => ({
    security: undefined,
    requiresAcknowledge: false,
    acknowledged: false,
    setAcknowledged: vi.fn(),
  }),
}));

// Mock walletLock utility — no real USB store in tests
vi.mock("@/utils/walletLock", () => ({
  isWalletLocked: vi.fn().mockReturnValue(false),
}));

// ── imports after mocks ────────────────────────────────────────────────────────

import { useSwapFlow } from "@/hooks/useSwapFlow";
import type { SendableToken } from "@/components/SendTransaction";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Minimal SendableToken for eth-mainnet (a SUPPORTED_SWAP_CHAINS member). */
const ethToken: SendableToken = {
  network: "eth-mainnet",
  networkLabel: "Ethereum",
  fromAddress: "0xabc",
  tokenAddress: "",         // native ETH
  tokenSymbol: "ETH",
  tokenName: "Ether",
  tokenLogo: "",
  balance: "1.0",
  usdValue: 3000,
  decimals: 18,
};

/** A second ERC-20 token on the same chain for destination selection. */
const usdcToken: SendableToken = {
  network: "eth-mainnet",
  networkLabel: "Ethereum",
  fromAddress: "0xabc",
  tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  tokenSymbol: "USDC",
  tokenName: "USD Coin",
  tokenLogo: "",
  balance: "500",
  usdValue: 500,
  decimals: 6,
};

const baseParams = {
  walletId: "w1",
  availableTokens: [ethToken, usdcToken],
  usbPath: "/usb",
  sessionToken: "tok",
  isPro: false,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("useSwapFlow — initial state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts on the selectFrom step", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    expect(result.current.state.step).toBe("selectFrom");
  });

  it("starts with no fromToken, toToken, or amount", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    expect(result.current.state.fromToken).toBeNull();
    expect(result.current.state.toToken).toBeNull();
    expect(result.current.state.amount).toBe("");
  });

  it("starts with default provider openocean", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    expect(result.current.state.selectedProvider).toBe("openocean");
  });

  it("starts with no error", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    expect(result.current.state.error).toBeNull();
  });

  it("exposes all expected actions", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    const a = result.current.actions;
    expect(typeof a.handleSelectFromToken).toBe("function");
    expect(typeof a.handleSelectToToken).toBe("function");
    expect(typeof a.handleReset).toBe("function");
    expect(typeof a.handleProviderSelect).toBe("function");
    // The brief used "goBack" as a placeholder name — the real hook does NOT export it.
    expect((a as any).goBack).toBeUndefined();
  });
});

describe("useSwapFlow — handleSelectFromToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("advances step to selectTo", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    expect(result.current.state.step).toBe("selectTo");
  });

  it("stores the chosen token in fromToken", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    expect(result.current.state.fromToken).toEqual(ethToken);
  });

  it("resets amount to empty string", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    // Give amount a non-empty value first via setAmount
    act(() => { result.current.actions.setAmount("5"); });
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    expect(result.current.state.amount).toBe("");
  });

  it("resets toToken to null", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    // Simulate having picked a destination token previously
    act(() => { result.current.actions.handleSelectFromToken(usdcToken); });
    act(() => {
      result.current.actions.handleSelectToToken({
        address: ethToken.tokenAddress || "0xeee",
        symbol: ethToken.tokenSymbol,
        name: ethToken.tokenName,
        decimals: ethToken.decimals,
      });
    });
    // Now select a new source token — toToken must be cleared
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    expect(result.current.state.toToken).toBeNull();
  });

  it("clears tokenSearchQuery", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.setTokenSearchQuery("usdc"); });
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    expect(result.current.state.tokenSearchQuery).toBe("");
  });
});

describe("useSwapFlow — handleSelectToToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("advances step to input after selecting destination token", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    act(() => {
      result.current.actions.handleSelectToToken({
        address: usdcToken.tokenAddress,
        symbol: usdcToken.tokenSymbol,
        name: usdcToken.tokenName,
        decimals: usdcToken.decimals,
      });
    });
    expect(result.current.state.step).toBe("input");
  });

  it("stores the chosen destination token in toToken", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    act(() => {
      result.current.actions.handleSelectToToken({
        address: usdcToken.tokenAddress,
        symbol: usdcToken.tokenSymbol,
        name: usdcToken.tokenName,
        decimals: usdcToken.decimals,
      });
    });
    expect(result.current.state.toToken?.symbol).toBe("USDC");
  });

  it("clears tokenSearchQuery after selecting destination token", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    act(() => { result.current.actions.setTokenSearchQuery("usdc"); });
    act(() => {
      result.current.actions.handleSelectToToken({
        address: usdcToken.tokenAddress,
        symbol: usdcToken.tokenSymbol,
        name: usdcToken.tokenName,
        decimals: usdcToken.decimals,
      });
    });
    expect(result.current.state.tokenSearchQuery).toBe("");
  });
});

describe("useSwapFlow — handleProviderSelect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches provider from openocean to kyberswap", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleProviderSelect("kyberswap"); });
    expect(result.current.state.selectedProvider).toBe("kyberswap");
  });

  it("closes the provider dropdown after selection", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    // Open the dropdown first
    act(() => { result.current.actions.setShowProviderDropdown(true); });
    expect(result.current.state.showProviderDropdown).toBe(true);
    // Select a provider — dropdown must close
    act(() => { result.current.actions.handleProviderSelect("kyberswap"); });
    expect(result.current.state.showProviderDropdown).toBe(false);
  });

  it("resets quote to null when provider changes", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    // Give quote a non-null value via setQuote
    act(() => { result.current.actions.setQuote({ fromToken: "0xeee", toToken: "0xusdc", fromTokenAmount: "1", toTokenAmount: "2000", estimatedGas: "21000", provider: "openocean" } as any); });
    act(() => { result.current.actions.handleProviderSelect("kyberswap"); });
    expect(result.current.state.quote).toBeNull();
  });
});

describe("useSwapFlow — handleReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets step back to selectFrom", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    expect(result.current.state.step).toBe("selectTo");
    act(() => { result.current.actions.handleReset(); });
    expect(result.current.state.step).toBe("selectFrom");
  });

  it("clears fromToken and toToken", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.handleSelectFromToken(ethToken); });
    act(() => { result.current.actions.handleReset(); });
    expect(result.current.state.fromToken).toBeNull();
    expect(result.current.state.toToken).toBeNull();
  });

  it("clears amount, error, quote, swapTx, txHash", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => {
      result.current.actions.setAmount("1.5");
      result.current.actions.setError("boom");
    });
    act(() => { result.current.actions.handleReset(); });
    expect(result.current.state.amount).toBe("");
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.quote).toBeNull();
    expect(result.current.state.swapTx).toBeNull();
    expect(result.current.state.txHash).toBeNull();
  });

  it("clears walletPassword (secret hygiene) and resets slippage to 0.5", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    // Pre-dirty both fields so the post-reset assertions are non-tautological.
    act(() => {
      result.current.actions.setWalletPassword("secret");
      result.current.actions.setSlippage(1.0);
    });
    expect(result.current.state.walletPassword).toBe("secret");
    expect(result.current.state.slippage).toBe(1.0);

    act(() => { result.current.actions.handleReset(); });

    expect(result.current.state.walletPassword).toBe("");
    expect(result.current.state.slippage).toBe(0.5);
  });
});

describe("useSwapFlow — swappableTokens filter", () => {
  it("includes only tokens on SUPPORTED_SWAP_CHAINS", () => {
    const unsupportedToken: SendableToken = {
      ...ethToken,
      network: "avax-mainnet",   // not in SUPPORTED_SWAP_CHAINS
      networkLabel: "Avalanche",
    };
    const { result } = renderHook(() =>
      useSwapFlow({ ...baseParams, availableTokens: [ethToken, unsupportedToken] })
    );
    expect(result.current.state.swappableTokens).toHaveLength(1);
    expect(result.current.state.swappableTokens[0].network).toBe("eth-mainnet");
  });
});

describe("useSwapFlow — setStep direct control", () => {
  beforeEach(() => vi.clearAllMocks());

  it("can jump to any step via setStep", () => {
    const { result } = renderHook(() => useSwapFlow(baseParams));
    act(() => { result.current.actions.setStep("password"); });
    expect(result.current.state.step).toBe("password");
  });
});
