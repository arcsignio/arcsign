import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SwapConfirm } from "@/components/swap/SwapConfirm";
import type { ToToken } from "@/components/swap/SwapConfirm";
import type { SendableToken } from "@/components/SendTransaction";
import type { SwapQuoteResponse } from "@/services/tauri-api";

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
        requiresAcknowledge={false}
        acknowledged={false}
        onAcknowledgeChange={() => {}}
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
        requiresAcknowledge={true}
        acknowledged={false}
        onAcknowledgeChange={() => {}}
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
        requiresAcknowledge={true}
        acknowledged={true}
        onAcknowledgeChange={() => {}}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("fires onAcknowledgeChange when the acknowledgment checkbox is toggled", () => {
    const onAcknowledgeChange = vi.fn();
    render(
      <SwapConfirm
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        swapQuote={swapQuote}
        routeChanged={false}
        walletPassword=""
        isLoading={false}
        requiresAcknowledge={true}
        acknowledged={false}
        onAcknowledgeChange={onAcknowledgeChange}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    const checkbox = document.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox);
    expect(onAcknowledgeChange).toHaveBeenCalledOnce();
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
        requiresAcknowledge={false}
        acknowledged={false}
        onAcknowledgeChange={() => {}}
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
        requiresAcknowledge={false}
        acknowledged={false}
        onAcknowledgeChange={() => {}}
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
        requiresAcknowledge={false}
        acknowledged={false}
        onAcknowledgeChange={() => {}}
        onPasswordChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    // SignGateAcknowledge renders null when requiresAcknowledge=false
    expect(document.querySelector("input[type='checkbox']")).toBeNull();
  });
});
