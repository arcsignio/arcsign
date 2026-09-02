/**
 * TokenApprovals — display correctness for the figures a user acts on.
 *
 * These cover defects found by inventory rather than by anyone using the app,
 * which is the point: the approvals screen tells a user whether they granted
 * access to a protocol they recognise. That fact was rendered in a border
 * colour — invisible — and it is not the kind of wrong that throws.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenApprovals } from "@/components/TokenApprovals";

vi.mock("@/hooks/useTokenApprovals", () => ({
  useTokenApprovals: vi.fn(),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

vi.mock("@/services/tauri-api", () => ({
  default: {
    buildTransaction: vi.fn(),
    signTransaction: vi.fn(),
    broadcastTransaction: vi.fn(),
  },
}));

vi.mock("@/hooks/useSignReview", () => ({
  useSignReview: () => ({
    security: undefined,
    requiresAcknowledge: false,
    acknowledged: false,
    setAcknowledged: vi.fn(),
    intent: undefined,
  }),
}));

import { useTokenApprovals } from "@/hooks/useTokenApprovals";

const props = {
  walletId: "w1",
  password: "pw",
  usbPath: "/dev/usb0",
  sessionToken: "token",
};

function entry(over: Record<string, unknown> = {}) {
  return {
    network: "eth-mainnet",
    networkLabel: "Ethereum",
    tokenAddress: "0xtoken1",
    tokenSymbol: "TEST",
    tokenName: "Test Token",
    spender: "0xspender1abcdef1234567890",
    allowance: "0",
    isUnlimited: false,
    ownerAddress: "0xuser",
    ...over,
  };
}

function withApprovals(approvals: ReturnType<typeof entry>[]) {
  vi.mocked(useTokenApprovals).mockReturnValue({
    approvals,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  } as never);
  return render(<TokenApprovals {...props} />);
}

describe("TokenApprovals display", () => {
  beforeEach(() => vi.clearAllMocks());

  // The protocol name was rendered in #e2e8f0 — a border colour, ~1.2:1 on
  // white. It was invisible for exactly the spenders the backend could
  // identify, so "I approved Uniswap" looked like a blank next to the address.
  it("renders a known spender name in readable ink", () => {
    withApprovals([entry({ spenderName: "Uniswap V3", riskLevel: "green" })]);

    const name = screen.getByText("Uniswap V3");
    expect(name.style.color).not.toMatch(/e2e8f0|rgb\(226,\s*232,\s*240\)/i);
    expect(name.style.color).toBeTruthy();
  });

  // A malformed provider row used to throw inside the list, blanking every
  // other approval — including the dangerous one the user came to revoke.
  it("survives a row with a missing spender address", () => {
    withApprovals([
      entry({ spender: undefined, tokenSymbol: "BROKEN" }),
      entry({ tokenSymbol: "INTACT", spenderName: "Aave", riskLevel: "green" }),
    ]);

    expect(screen.getByText("Aave")).toBeInTheDocument();
  });

  // A 100 USDC allowance is 100_000_000 raw units (6 decimals). Assuming 18
  // rendered it as "<0.001 USDC" — an allowance worth revoking, displayed as
  // nothing worth revoking.
  it("scales an allowance by the token's real decimals", () => {
    withApprovals([
      entry({
        tokenSymbol: "USDC",
        decimals: 6,
        allowance: "100000000",
        riskLevel: "yellow",
      }),
    ]);

    expect(screen.getByText("100.00 USDC")).toBeInTheDocument();
  });

  // Falls back to the ERC-20 default when the backend does not send decimals.
  it("treats a missing decimals field as 18", () => {
    withApprovals([
      entry({ tokenSymbol: "DAI", allowance: "5000000000000000000", riskLevel: "green" }),
    ]);

    expect(screen.getByText("5.00 DAI")).toBeInTheDocument();
  });

  // The old thresholds compared raw units against 1e24 and called it ">1T",
  // which at 18 decimals is a million tokens.
  it("labels a million tokens as M, not T", () => {
    withApprovals([
      entry({
        tokenSymbol: "TEST",
        decimals: 18,
        allowance: "1000000000000000000000000",
        riskLevel: "yellow",
      }),
    ]);

    expect(screen.getByText("1M TEST")).toBeInTheDocument();
  });
});
