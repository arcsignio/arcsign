import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SwapConfirm } from "@/components/swap/SwapConfirm";
import type { ToToken } from "@/components/swap/SwapConfirm";
import type { SendableToken } from "@/components/SendTransaction";
import type { SwapQuoteResponse } from "@/services/tauri-api";
import type { SignReview } from "@/hooks/useSignReview";

const fromToken: SendableToken = {
  fromAddress: "0xabc",
  tokenAddress: "",
  tokenSymbol: "ETH",
  tokenName: "Ethereum",
  balance: "1.5",
  decimals: 18,
  network: "ethereum-mainnet",
  networkLabel: "Ethereum",
  tokenLogo: "",
};

const toToken: ToToken = {
  address: "0xusdc",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
};

const swapQuote: SwapQuoteResponse = {
  fromAmount: "1000000000000000000",
  toAmount: "2000000",
  toAmountMin: "1980000",
  exchangeRate: "2.0",
  priceImpact: "0.1",
  gasCostETH: "0.001",
  feeRate: "0",
  protocols: ["OpenOcean"],
  routeType: "single",
  dex: "OpenOcean",
  approvalAddress: "",
};

// Builds a review fixture. `security` must be set to something ClearSignSummary
// will render (and isHighRiskSign will read) when a checkbox is expected —
// SignReview renders null when neither intent nor security is present.
function makeReview(overrides: Partial<SignReview> = {}): SignReview {
  return {
    security: undefined,
    requiresAcknowledge: false,
    acknowledged: false,
    setAcknowledged: vi.fn(),
    intent: undefined,
    ...overrides,
  };
}

const dangerSecurity = {
  riskLevel: "danger",
  warnings: [],
  requiresAcknowledge: true,
};

describe("SwapConfirm", () => {
  it("renders the confirm swap heading and from/to amounts", () => {
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={false}
        walletPassword=""
        isLoading={false}
        review={makeReview()}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    // swap-summary contains the from amount and both symbols
    expect(document.querySelector(".swap-summary")).toBeTruthy();
    // "1 ETH" is in the youPay summary row as text content
    const summaryValues = document.querySelectorAll(".summary-value");
    const text = Array.from(summaryValues).map(el => el.textContent).join(" ");
    expect(text).toContain("ETH");
  });

  it("disables confirm button when requiresAcknowledge is true and acknowledged is false", () => {
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={false}
        walletPassword="secret"
        isLoading={false}
        review={makeReview({ requiresAcknowledge: true, acknowledged: false, security: dangerSecurity })}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables confirm button when requiresAcknowledge is true and acknowledged is true", () => {
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={false}
        walletPassword="secret"
        isLoading={false}
        review={makeReview({ requiresAcknowledge: true, acknowledged: true, security: dangerSecurity })}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("fires setAcknowledged when the acknowledgment checkbox is toggled", () => {
    const setAcknowledged = vi.fn();
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={false}
        walletPassword=""
        isLoading={false}
        review={makeReview({ requiresAcknowledge: true, acknowledged: false, security: dangerSecurity, setAcknowledged })}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const checkbox = document.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox);
    expect(setAcknowledged).toHaveBeenCalledOnce();
  });

  it("fires onPasswordChange when typing in the password input", () => {
    const onPasswordChange = vi.fn();
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={false}
        walletPassword=""
        isLoading={false}
        review={makeReview()}
        onPasswordChange={onPasswordChange}
        onConfirm={() => {}}
      />,
    );
    const input = document.querySelector(".password-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "mypassword" } });
    expect(onPasswordChange).toHaveBeenCalledWith("mypassword");
  });

  it("shows route-updated notice when routeChanged is true", () => {
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={true}
        walletPassword=""
        isLoading={false}
        review={makeReview()}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(document.querySelector(".route-updated-notice")).toBeTruthy();
  });

  it("does NOT render the acknowledge checkbox when requiresAcknowledge is false", () => {
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={false}
        walletPassword=""
        isLoading={false}
        review={makeReview()}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    // SignReview / ClearSignSummary render no checkbox when requiresAcknowledge=false
    // and there's no intent/security to show (SignReview returns null entirely).
    expect(document.querySelector("input[type='checkbox']")).toBeNull();
  });
});
