import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SwapQuoteView } from "@/components/swap/SwapQuoteView";
import type { ToToken } from "@/components/swap/SwapQuoteView";
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

const quote: SwapQuoteResponse = {
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

const isValidAmount = (v: string) => {
  const n = parseFloat(v);
  return !isNaN(n) && n > 0;
};

describe("SwapQuoteView", () => {
  it("renders from and to token symbols", () => {
    render(
      <SwapQuoteView
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        quote={null}
        isLoading={false}
        slippage={0.5}
        isValidAmount={isValidAmount}
        onAmountChange={() => {}}
        onSetMax={() => {}}
        onSetHalf={() => {}}
        onSlippageChange={() => {}}
        onSelectFromToken={() => {}}
        onSelectToToken={() => {}}
        onSwapTokens={() => {}}
        onContinue={() => {}}
      />,
    );
    // Both symbols appear in the UI
    expect(screen.getAllByText("ETH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("USDC").length).toBeGreaterThan(0);
  });

  it("renders exchange rate when quote is provided", () => {
    render(
      <SwapQuoteView
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        quote={quote}
        isLoading={false}
        slippage={0.5}
        isValidAmount={isValidAmount}
        onAmountChange={() => {}}
        onSetMax={() => {}}
        onSetHalf={() => {}}
        onSlippageChange={() => {}}
        onSelectFromToken={() => {}}
        onSelectToToken={() => {}}
        onSwapTokens={() => {}}
        onContinue={() => {}}
      />,
    );
    // Exchange rate row: "1 ETH = 2.0 USDC"
    expect(screen.getByText(/2\.0/)).toBeTruthy();
  });

  it("fires onAmountChange when typing in the amount input", () => {
    const onAmountChange = vi.fn();
    render(
      <SwapQuoteView
        fromToken={fromToken}
        toToken={toToken}
        amount=""
        quote={null}
        isLoading={false}
        slippage={0.5}
        isValidAmount={isValidAmount}
        onAmountChange={onAmountChange}
        onSetMax={() => {}}
        onSetHalf={() => {}}
        onSlippageChange={() => {}}
        onSelectFromToken={() => {}}
        onSelectToToken={() => {}}
        onSwapTokens={() => {}}
        onContinue={() => {}}
      />,
    );
    const input = document.querySelector(".amount-input-large") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.5" } });
    expect(onAmountChange).toHaveBeenCalledWith("0.5");
  });

  it("disables the continue button when there is no quote", () => {
    render(
      <SwapQuoteView
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        quote={null}
        isLoading={false}
        slippage={0.5}
        isValidAmount={isValidAmount}
        onAmountChange={() => {}}
        onSetMax={() => {}}
        onSetHalf={() => {}}
        onSlippageChange={() => {}}
        onSelectFromToken={() => {}}
        onSelectToToken={() => {}}
        onSwapTokens={() => {}}
        onContinue={() => {}}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables the continue button when amount is valid and quote exists", () => {
    render(
      <SwapQuoteView
        fromToken={fromToken}
        toToken={toToken}
        amount="1"
        quote={quote}
        isLoading={false}
        slippage={0.5}
        isValidAmount={isValidAmount}
        onAmountChange={() => {}}
        onSetMax={() => {}}
        onSetHalf={() => {}}
        onSlippageChange={() => {}}
        onSelectFromToken={() => {}}
        onSelectToToken={() => {}}
        onSwapTokens={() => {}}
        onContinue={() => {}}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("fires onSlippageChange when a slippage option is clicked", () => {
    const onSlippageChange = vi.fn();
    render(
      <SwapQuoteView
        fromToken={fromToken}
        toToken={toToken}
        amount=""
        quote={null}
        isLoading={false}
        slippage={0.5}
        isValidAmount={isValidAmount}
        onAmountChange={() => {}}
        onSetMax={() => {}}
        onSetHalf={() => {}}
        onSlippageChange={onSlippageChange}
        onSelectFromToken={() => {}}
        onSelectToToken={() => {}}
        onSwapTokens={() => {}}
        onContinue={() => {}}
      />,
    );
    const slippageButtons = document.querySelectorAll(".slippage-option");
    expect(slippageButtons.length).toBe(3);
    fireEvent.click(slippageButtons[1]); // 1% option
    expect(onSlippageChange).toHaveBeenCalledWith(1);
  });
});
