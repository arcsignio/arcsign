import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TokenPicker } from "@/components/swap/TokenPicker";
import type { DestToken } from "@/components/swap/TokenPicker";
import type { SendableToken } from "@/components/SendTransaction";

const makeFromToken = (overrides: Partial<SendableToken> = {}): SendableToken => ({
  fromAddress: "0xabc",
  tokenAddress: "",
  tokenSymbol: "ETH",
  tokenName: "Ethereum",
  balance: "1.5",
  decimals: 18,
  network: "ethereum-mainnet",
  networkLabel: "Ethereum",
  tokenLogo: "",
  ...overrides,
});

const makeDestToken = (overrides: Partial<DestToken> = {}): DestToken => ({
  address: "0xusdc",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  ...overrides,
});

describe("TokenPicker — mode: from", () => {
  it("renders tokens grouped by network", () => {
    const eth = makeFromToken({ tokenSymbol: "ETH", networkLabel: "Ethereum" });
    render(
      <TokenPicker
        mode="from"
        tokensByNetwork={{ Ethereum: [eth] }}
        onSelectToken={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getAllByText("ETH").length).toBeGreaterThan(0);
    // Network header renders the label — at least one element with the class
    expect(document.querySelector(".network-name")).toBeTruthy();
  });

  it("fires onSelectToken when a token button is clicked", () => {
    const onSelect = vi.fn();
    const eth = makeFromToken({ tokenSymbol: "ETH" });
    render(
      <TokenPicker
        mode="from"
        tokensByNetwork={{ Ethereum: [eth] }}
        onSelectToken={onSelect}
        onBack={() => {}}
      />,
    );
    const buttons = document.querySelectorAll(".token-option");
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(eth);
  });

  it("shows empty state and back button when no tokens", () => {
    const onBack = vi.fn();
    render(
      <TokenPicker
        mode="from"
        tokensByNetwork={{}}
        onSelectToken={() => {}}
        onBack={onBack}
      />,
    );
    // Should show the secondary-button (goBack)
    const backBtn = document.querySelector(".secondary-button") as HTMLElement;
    expect(backBtn).toBeTruthy();
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("TokenPicker — mode: to", () => {
  it("renders a list of destination tokens", () => {
    const usdc = makeDestToken({ symbol: "USDC", name: "USD Coin" });
    render(
      <TokenPicker
        mode="to"
        destinationTokens={[usdc]}
        searchQuery=""
        loadingTokens={false}
        cacheHasTokens={true}
        fromTokenSymbol="ETH"
        fromTokenNetworkLabel="Ethereum"
        onSearch={() => {}}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.getByText("USDC")).toBeTruthy();
  });

  it("fires onSelectToken when a destination token is clicked", () => {
    const onSelect = vi.fn();
    const usdc = makeDestToken({ symbol: "USDC" });
    render(
      <TokenPicker
        mode="to"
        destinationTokens={[usdc]}
        searchQuery=""
        loadingTokens={false}
        cacheHasTokens={false}
        fromTokenSymbol="ETH"
        fromTokenNetworkLabel="Ethereum"
        onSearch={() => {}}
        onSelectToken={onSelect}
      />,
    );
    const buttons = document.querySelectorAll(".token-option");
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(usdc);
  });

  it("fires onSearch when typing in the search input", () => {
    const onSearch = vi.fn();
    render(
      <TokenPicker
        mode="to"
        destinationTokens={[]}
        searchQuery=""
        loadingTokens={false}
        cacheHasTokens={false}
        fromTokenSymbol="ETH"
        fromTokenNetworkLabel="Ethereum"
        onSearch={onSearch}
        onSelectToken={() => {}}
      />,
    );
    const input = document.querySelector(".token-search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "USDC" } });
    expect(onSearch).toHaveBeenCalledWith("USDC");
  });

  it("shows loading state when loadingTokens is true", () => {
    render(
      <TokenPicker
        mode="to"
        destinationTokens={[]}
        searchQuery=""
        loadingTokens={true}
        cacheHasTokens={false}
        fromTokenSymbol="ETH"
        fromTokenNetworkLabel="Ethereum"
        onSearch={() => {}}
        onSelectToken={() => {}}
      />,
    );
    expect(document.querySelector(".token-loading")).toBeTruthy();
  });
});
