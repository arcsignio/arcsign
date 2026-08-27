import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApprovalView } from "@/components/swap/ApprovalView";
import type { SendableToken } from "@/components/SendTransaction";
import type { SwapQuoteResponse } from "@/services/tauri-api";

const fromToken: SendableToken = {
  fromAddress: "0xabc",
  tokenAddress: "0xtoken",
  tokenSymbol: "USDT",
  tokenName: "Tether USD",
  balance: "100",
  decimals: 6,
  network: "ethereum-mainnet",
  networkLabel: "Ethereum",
  tokenLogo: "",
};

const quote: SwapQuoteResponse = {
  fromAmount: "100000000",
  toAmount: "99000000000000000000",
  toAmountMin: "98000000000000000000",
  exchangeRate: "990",
  priceImpact: "-0.1",
  gasCostETH: "0.002",
  feeRate: "0",
  protocols: ["OpenOcean"],
  routeType: "single",
  dex: "OpenOcean",
  approvalAddress: "0xspender123",
};

const baseApproveProps = {
  fromToken,
  quote,
  swapTxTo: undefined,
  currentAllowance: undefined,
  amount: "100",
  approvalAmount: "100",
  isUnlimitedApproval: false,
  walletPassword: "",
  isLoading: false,
  error: null,
  onSetUnlimited: vi.fn(),
  onApprovalAmountChange: vi.fn(),
  onApprove: vi.fn(),
  onExecuteApproval: vi.fn(),
  onPasswordChange: vi.fn(),
  onCancel: vi.fn(),
};

describe("ApprovalView — mode=approve", () => {
  it("renders approve form heading and token info", () => {
    render(<ApprovalView mode="approve" {...baseApproveProps} />);
    expect(document.querySelector(".approve-form")).toBeTruthy();
    expect(document.querySelector(".approval-details")).toBeTruthy();
    // Token symbol should appear in the details
    const approvalValues = document.querySelectorAll(".approval-value");
    const text = Array.from(approvalValues).map(el => el.textContent).join(" ");
    expect(text).toContain("USDT");
  });

  it("shows the spender address shortened", () => {
    render(<ApprovalView mode="approve" {...baseApproveProps} />);
    // shortenAddress("0xspender123") → "0xspen...r123"
    const addressEl = document.querySelector(".approval-value.address");
    expect(addressEl).toBeTruthy();
    expect(addressEl!.textContent).toContain("0x");
  });

  it("shows specific amount input when isUnlimitedApproval is false", () => {
    render(<ApprovalView mode="approve" {...baseApproveProps} isUnlimitedApproval={false} />);
    expect(document.querySelector(".input-with-suffix")).toBeTruthy();
    expect(document.querySelector(".unlimited-warning")).toBeNull();
  });

  it("shows unlimited warning when isUnlimitedApproval is true", () => {
    render(<ApprovalView mode="approve" {...baseApproveProps} isUnlimitedApproval={true} />);
    expect(document.querySelector(".unlimited-warning")).toBeTruthy();
    expect(document.querySelector(".input-with-suffix")).toBeNull();
  });

  it("calls onApprove when primary button is clicked", () => {
    const onApprove = vi.fn();
    render(<ApprovalView mode="approve" {...baseApproveProps} onApprove={onApprove} />);
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ApprovalView mode="approve" {...baseApproveProps} onCancel={onCancel} />);
    const btn = document.querySelector(".secondary-button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows currentAllowance row when provided", () => {
    render(<ApprovalView mode="approve" {...baseApproveProps} currentAllowance="50000000" />);
    const rows = document.querySelectorAll(".approval-row");
    // token + spender + allowance + amount = 4 rows
    expect(rows.length).toBe(4);
  });

  it("shows inline error when error prop is set", () => {
    render(<ApprovalView mode="approve" {...baseApproveProps} error="something went wrong" />);
    expect(document.querySelector(".error-message")).toBeTruthy();
  });

  it("calls onSetUnlimited(true) when Unlimited toggle is clicked", () => {
    const onSetUnlimited = vi.fn();
    render(<ApprovalView mode="approve" {...baseApproveProps} onSetUnlimited={onSetUnlimited} />);
    const toggleButtons = document.querySelectorAll(".toggle-button");
    // Second button is "Unlimited"
    fireEvent.click(toggleButtons[1]);
    expect(onSetUnlimited).toHaveBeenCalledWith(true);
  });

  it("calls onApprovalAmountChange when approval amount input changes", () => {
    const onApprovalAmountChange = vi.fn();
    render(
      <ApprovalView
        mode="approve"
        {...baseApproveProps}
        isUnlimitedApproval={false}
        onApprovalAmountChange={onApprovalAmountChange}
      />,
    );
    const input = document.querySelector(".input-with-suffix input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "200" } });
    expect(onApprovalAmountChange).toHaveBeenCalledWith("200");
  });
});

describe("ApprovalView — mode=approvalPassword", () => {
  const passwordProps = {
    ...baseApproveProps,
    walletPassword: "",
  };

  // ── approvalReview: sign gate for the approve() calldata ──────────────────

  it("renders nothing extra when approvalReview is absent (calldata not fetched yet)", () => {
    render(<ApprovalView mode="approvalPassword" {...passwordProps} walletPassword="secret" />);
    // No review block, and the button is enabled purely on walletPassword.
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("disables the primary button when approvalReview requires acknowledgment and it isn't given", () => {
    render(
      <ApprovalView
        mode="approvalPassword"
        {...passwordProps}
        walletPassword="secret"
        approvalReview={{
          security: undefined,
          requiresAcknowledge: true,
          acknowledged: false,
          setAcknowledged: vi.fn(),
          intent: undefined,
        }}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables the primary button once approvalReview is acknowledged", () => {
    render(
      <ApprovalView
        mode="approvalPassword"
        {...passwordProps}
        walletPassword="secret"
        approvalReview={{
          security: undefined,
          requiresAcknowledge: true,
          acknowledged: true,
          setAcknowledged: vi.fn(),
          intent: undefined,
        }}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("renders password form heading", () => {
    render(<ApprovalView mode="approvalPassword" {...passwordProps} />);
    expect(document.querySelector(".password-form")).toBeTruthy();
  });

  it("shows token and spender details", () => {
    render(<ApprovalView mode="approvalPassword" {...passwordProps} />);
    const approvalValues = document.querySelectorAll(".approval-value");
    const text = Array.from(approvalValues).map(el => el.textContent).join(" ");
    expect(text).toContain("USDT");
    expect(text).toContain("0x");
  });

  it("renders password input", () => {
    render(<ApprovalView mode="approvalPassword" {...passwordProps} />);
    const input = document.querySelector("input[type='password']") as HTMLInputElement;
    expect(input).toBeTruthy();
  });

  it("calls onPasswordChange when typing in password input", () => {
    const onPasswordChange = vi.fn();
    render(
      <ApprovalView mode="approvalPassword" {...passwordProps} onPasswordChange={onPasswordChange} />,
    );
    const input = document.querySelector("input[type='password']") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "mypassword" } });
    expect(onPasswordChange).toHaveBeenCalledWith("mypassword");
  });

  it("primary button is disabled when walletPassword is empty", () => {
    render(<ApprovalView mode="approvalPassword" {...passwordProps} walletPassword="" />);
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("primary button is enabled when walletPassword is set", () => {
    render(
      <ApprovalView mode="approvalPassword" {...passwordProps} walletPassword="secret" isLoading={false} />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("calls onExecuteApproval when primary button is clicked", () => {
    const onExecuteApproval = vi.fn();
    render(
      <ApprovalView
        mode="approvalPassword"
        {...passwordProps}
        walletPassword="secret"
        onExecuteApproval={onExecuteApproval}
      />,
    );
    const btn = document.querySelector(".primary-button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onExecuteApproval).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ApprovalView mode="approvalPassword" {...passwordProps} onCancel={onCancel} />);
    const btn = document.querySelector(".secondary-button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cancel button is disabled when isLoading is true", () => {
    render(<ApprovalView mode="approvalPassword" {...passwordProps} isLoading={true} />);
    const btn = document.querySelector(".secondary-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
