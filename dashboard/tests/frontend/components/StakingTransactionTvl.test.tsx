/**
 * TVL display on the staking screen.
 *
 * The previous implementation used toFixed(0) at the millions tier, so a $1.5M
 * TVL displayed as "$2M" — a third higher than reality. It also returned "-"
 * for zero via a falsy check, in a branch that could never run: the only call
 * site guarded with `tvlUsd &&`, so a zero TVL rendered nothing at all.
 *
 * Asserted through the rendered component; formatTvl is module-local.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const getStakableAssetsWithMetrics = vi.fn();

vi.mock("@/constants/stakingRegistry", () => ({
  getStakableAssetsWithMetrics: (...a: unknown[]) => getStakableAssetsWithMetrics(...a),
  getCallDataEncoder: () => () => "0x",
  getExplorerTxUrl: () => "https://example.com",
}));

vi.mock("@/services/tauri-api", () => ({
  default: {
    buildTransaction: vi.fn(),
    signTransaction: vi.fn(),
    broadcastTransaction: vi.fn(),
    estimateFee: vi.fn(),
  },
  checkTransactionSecurity: vi.fn(async () => ({
    proRequired: false,
    warnings: [],
    riskLevel: "safe",
  })),
}));

import { StakingTransaction } from "@/components/StakingTransaction";

function assetWithTvl(tvlUsd: number | undefined) {
  return [
    {
      symbol: "ETH",
      name: "Ethereum",
      network: "eth-mainnet",
      networkLabel: "Ethereum",
      decimals: 18,
      logo: "",
      providers: [
        {
          id: "lido",
          name: "Lido",
          apy: 3.2,
          tvlUsd,
          contractAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
          minAmount: "0",
        },
      ],
    },
  ];
}

function renderWithTvl(tvlUsd: number | undefined) {
  getStakableAssetsWithMetrics.mockResolvedValue(assetWithTvl(tvlUsd));
  render(
    <StakingTransaction
      walletId="w1"
      availableTokens={[
        {
          network: "eth-mainnet",
          networkLabel: "Ethereum",
          tokenAddress: "",
          tokenSymbol: "ETH",
          tokenName: "Ethereum",
          tokenLogo: "",
          balance: "10",
          usdValue: 25000,
          decimals: 18,
          fromAddress: "0x1111111111111111111111111111111111111111",
        },
      ]}
      usbPath="/tmp/usb"
      sessionToken="tok"
      onBack={vi.fn()}
    />,
  );
}

describe("staking TVL display", () => {
  beforeEach(() => vi.clearAllMocks());

  // The defect: toFixed(0) rounded 1.5 to 2, so $1.5M showed as $2M.
  it("does not overstate a fractional million", async () => {
    renderWithTvl(1500000);
    expect(await screen.findByText(/\$1\.5M/)).toBeInTheDocument();
  });

  it("abbreviates billions", async () => {
    renderWithTvl(2500000000);
    expect(await screen.findByText(/\$2\.5B/)).toBeInTheDocument();
  });

  it("leaves small values unabbreviated", async () => {
    renderWithTvl(999);
    expect(await screen.findByText(/\$999/)).toBeInTheDocument();
  });

  // Zero is distinguishable from absent: a protocol reporting zero TVL is a
  // signal worth showing, not one to hide behind the same dash as "unknown".
  it("shows a zero TVL rather than omitting the row", async () => {
    renderWithTvl(0);
    expect(await screen.findByText(/\$0/)).toBeInTheDocument();
  });
});
