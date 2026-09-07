import { describe, it, expect, vi } from "vitest";
import styles from "../../../../src/components/swap/swap.module.css";
import { render, fireEvent } from "@testing-library/react";
import { SwapResult } from "@/components/swap/SwapResult";

describe("SwapResult — mode=success", () => {
  it("renders success-form container with success icon", () => {
    render(
      <SwapResult
        mode="success"
        txHash="0xabc123"
        txUrl="https://etherscan.io/tx/0xabc123"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    expect(document.querySelector(`.${styles.successForm}`)).toBeTruthy();
    expect(document.querySelector(`.${styles.successIcon}`)).toBeTruthy();
  });

  it("shows transaction hash link when txHash and txUrl are provided", () => {
    render(
      <SwapResult
        mode="success"
        txHash="0xabc123def456"
        txUrl="https://etherscan.io/tx/0xabc123def456"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    const link = document.querySelector(`.${styles.txHashLink}`) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain("etherscan.io");
    // shortenAddress shows "0xabc1...f456"
    expect(link.textContent).toContain("0x");
  });

  it("calls onNewSwap when primary button is clicked", () => {
    const onNewSwap = vi.fn();
    render(
      <SwapResult
        mode="success"
        txHash="0xabc"
        txUrl="https://example.com"
        onNewSwap={onNewSwap}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    const btn = document.querySelector(`.${styles.primaryButton}`) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onNewSwap).toHaveBeenCalledOnce();
  });

  it("calls onBack when secondary button is clicked", () => {
    const onBack = vi.fn();
    render(
      <SwapResult
        mode="success"
        txHash="0xabc"
        txUrl="https://example.com"
        onNewSwap={vi.fn()}
        onBack={onBack}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    const btn = document.querySelector(`.${styles.secondaryButton}`) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("does NOT show error-form", () => {
    render(
      <SwapResult
        mode="success"
        txHash="0xabc"
        txUrl="https://example.com"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    expect(document.querySelector(`.${styles.errorForm}`)).toBeNull();
  });
});

describe("SwapResult — mode=error", () => {
  it("renders error-form container with error icon", () => {
    render(
      <SwapResult
        mode="error"
        error="Transaction reverted"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    expect(document.querySelector(`.${styles.errorForm}`)).toBeTruthy();
    expect(document.querySelector(`.${styles.errorIconLarge}`)).toBeTruthy();
  });

  it("shows the error message when error prop is set", () => {
    render(
      <SwapResult
        mode="error"
        error="Slippage too high"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    const desc = document.querySelector(`.${styles.errorDescription}`);
    expect(desc!.textContent).toContain("Slippage too high");
  });

  it("calls onTryAgain when primary button is clicked", () => {
    const onTryAgain = vi.fn();
    render(
      <SwapResult
        mode="error"
        error="something failed"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={onTryAgain}
        onStartOver={vi.fn()}
      />,
    );
    const btn = document.querySelector(`.${styles.primaryButton}`) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onTryAgain).toHaveBeenCalledOnce();
  });

  it("calls onStartOver when secondary button is clicked", () => {
    const onStartOver = vi.fn();
    render(
      <SwapResult
        mode="error"
        error="something failed"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={onStartOver}
      />,
    );
    const btn = document.querySelector(`.${styles.secondaryButton}`) as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onStartOver).toHaveBeenCalledOnce();
  });

  it("does NOT show success-form", () => {
    render(
      <SwapResult
        mode="error"
        error="fail"
        onNewSwap={vi.fn()}
        onBack={vi.fn()}
        onTryAgain={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    expect(document.querySelector(`.${styles.successForm}`)).toBeNull();
  });
});
