/**
 * The fee and total figures on the send screen.
 *
 * These are read immediately before a user signs, and nothing asserted them —
 * the existing SendTransaction test checks only the label beside each number.
 * formatEth rendered the literal string "NaN" for empty input and dropped
 * thousands separators, and the total row did its own inline /1e18 at a
 * different precision than the fee row seven lines above it.
 *
 * Asserted through the rendered component rather than a copy of the helper:
 * formatEth is module-local, so a test that reimplemented the expression would
 * pass with the component untouched.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendTransaction, type SendableToken } from "@/components/SendTransaction";

vi.mock("@/services/tauri-api", () => ({
  default: {
    estimateFee: vi.fn(),
    buildTransaction: vi.fn(),
    signTransaction: vi.fn(),
    broadcastTransaction: vi.fn(),
  },
  checkTransactionSecurity: vi.fn(),
}));

vi.mock("@/components/AddressBook", () => ({
  AddressBook: () => <div data-testid="address-book-mock" />,
}));

import tauriApi, { checkTransactionSecurity } from "@/services/tauri-api";

const ethToken: SendableToken = {
  network: "eth-mainnet",
  networkLabel: "Ethereum",
  tokenAddress: "",
  tokenSymbol: "ETH",
  tokenName: "Ethereum",
  tokenLogo: "",
  balance: "5000",
  usdValue: 2500,
  decimals: 18,
  fromAddress: "0xaaaa000000000000000000000000000000000001",
};

const props = {
  walletId: "wallet-1",
  availableTokens: [ethToken],
  usbPath: "/dev/usb0",
  sessionToken: "test-session-token",
  onBack: vi.fn(),
  onSuccess: vi.fn(),
};

const RECIPIENT = "0xcccc000000000000000000000000000000000003";

/** Drives the flow to the review step, where the fee and total are shown. */
async function reviewWithFee(feeWei: string, amount = "0.5") {
  (tauriApi.buildTransaction as never as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "tx-123",
    chainId: "ethereum",
    from: ethToken.fromAddress,
    to: RECIPIENT,
    amount: "500000000000000000",
    fee: feeWei,
    signingPayload: "base64payload==",
    data: "",
    humanReadable: "{}",
    buildTimestamp: "2026-03-24T00:00:00Z",
  });

  const user = userEvent.setup();
  render(<SendTransaction {...props} />);

  const ethBtn = screen
    .getAllByRole("button")
    .find((b) => b.classList.contains("token-option") && b.textContent?.includes("ETH"));
  await user.click(ethBtn!);

  await user.type(screen.getByPlaceholderText("0x..."), RECIPIENT);
  await user.type(screen.getByPlaceholderText("0.0"), amount);
  await user.click(screen.getByText("sendTransaction.continue"));

  await waitFor(() =>
    expect(screen.getByText("sendTransaction.reviewTransaction")).toBeInTheDocument(),
  );
}

describe("send-screen amount formatting", () => {
  beforeEach(() => {
    (tauriApi.estimateFee as never as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (checkTransactionSecurity as never as ReturnType<typeof vi.fn>).mockResolvedValue({
      proRequired: false,
      warnings: [],
      riskLevel: "safe",
    });
  });

  it("groups a large fee and keeps four decimals", async () => {
    await reviewWithFee("1000000000000000000000");
    expect(screen.getByText(/1,000\.0000/)).toBeInTheDocument();
  });

  it("keeps six decimals below a thousand", async () => {
    await reviewWithFee("1500000000000000000");
    expect(screen.getByText(/1\.500000/)).toBeInTheDocument();
  });

  it("shows a dust fee as a threshold with no space", async () => {
    await reviewWithFee("1");
    expect(screen.getByText(/<0\.0001/)).toBeInTheDocument();
  });

  // formatEth("") reached NaN.toFixed(4) and printed the string "NaN" into the
  // fee row of a screen the user reads before signing.
  it("never renders NaN", async () => {
    await reviewWithFee("");
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  // The total row converted the fee inline at 6 decimals while the fee row
  // above it used 4 — two precisions for related figures on one screen.
  //
  // The amount is deliberately above a thousand: below it, the old inline
  // `.toFixed(6)` and the shared rule produce the same string, so a smaller
  // figure would pass with this fix reverted and prove nothing.
  it("formats the total through the same rule as the fee", async () => {
    await reviewWithFee("2100000000000000", "1500");
    // 1500 + 0.0021 -> grouped, four decimals at this magnitude.
    // The old path gave "1500.002100": no separator, six decimals.
    expect(screen.getByText(/1,500\.0021/)).toBeInTheDocument();
  });
});
