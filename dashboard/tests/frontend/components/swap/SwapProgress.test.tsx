import { describe, it, expect } from "vitest";
import styles from "../../../../src/components/swap/swap.module.css";
import { render } from "@testing-library/react";
import { SwapProgress } from "@/components/swap/SwapProgress";

describe("SwapProgress — mode=approving", () => {
  it("renders approving-form container", () => {
    render(
      <SwapProgress
        mode="approving"
        tokenSymbol="USDT"
        networkLabel="Ethereum"
      />,
    );
    expect(document.querySelector(`.${styles.approvingForm}`)).toBeTruthy();
    expect(document.querySelector(`.${styles.approvingSpinner}`)).toBeTruthy();
  });

  it("does NOT show tx link when approvalTxHash is absent", () => {
    render(
      <SwapProgress
        mode="approving"
        tokenSymbol="USDT"
        networkLabel="Ethereum"
      />,
    );
    expect(document.querySelector(`.${styles.approvalTxInfo}`)).toBeNull();
  });

  it("shows tx link when approvalTxHash and approvalTxUrl are provided", () => {
    render(
      <SwapProgress
        mode="approving"
        tokenSymbol="USDT"
        networkLabel="Ethereum"
        approvalTxHash="0xabc123def456"
        approvalTxUrl="https://etherscan.io/tx/0xabc123def456"
      />,
    );
    expect(document.querySelector(`.${styles.approvalTxInfo}`)).toBeTruthy();
    const link = document.querySelector(`.${styles.txHashLink}`) as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain("etherscan.io");
  });

  it("shows confirmation-status with pulsing indicator when tx hash present", () => {
    render(
      <SwapProgress
        mode="approving"
        tokenSymbol="ETH"
        networkLabel="Ethereum"
        approvalTxHash="0xabc"
        approvalTxUrl="https://etherscan.io/tx/0xabc"
      />,
    );
    expect(document.querySelector(`.${styles.statusIndicator}.${styles.pulsing}`)).toBeTruthy();
    expect(document.querySelector(`.${styles.confirmationStatus}`)).toBeTruthy();
  });
});

describe("SwapProgress — mode=signing", () => {
  it("renders processing-form container", () => {
    render(<SwapProgress mode="signing" />);
    expect(document.querySelector(`.${styles.processingForm}`)).toBeTruthy();
    expect(document.querySelector(`.${styles.processingSpinner}`)).toBeTruthy();
  });

  it("does NOT render approving-form", () => {
    render(<SwapProgress mode="signing" />);
    expect(document.querySelector(`.${styles.approvingForm}`)).toBeNull();
  });
});

describe("SwapProgress — mode=broadcasting", () => {
  it("renders processing-form container", () => {
    render(<SwapProgress mode="broadcasting" />);
    expect(document.querySelector(`.${styles.processingForm}`)).toBeTruthy();
  });

  it("does NOT render approving-form", () => {
    render(<SwapProgress mode="broadcasting" />);
    expect(document.querySelector(`.${styles.approvingForm}`)).toBeNull();
  });
});
