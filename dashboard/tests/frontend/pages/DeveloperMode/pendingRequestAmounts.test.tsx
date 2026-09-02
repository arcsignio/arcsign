/**
 * Amount formatting in the developer-mode pending request list.
 *
 * `formatValue` here was a sixth copy of formatWeiValue. `formatEstimatedCost`
 * multiplied in BigInt — correct, since gas × gasPrice routinely exceeds 2^53 —
 * and then dropped to Number on the very next line, discarding the precision it
 * had just been careful to keep. `formatGasLimit` used toLocaleString(), which
 * follows the runtime locale.
 *
 * All four are closures inside the component, so these assert through the
 * rendered list rather than reimplementing them.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PendingRequests } from "@/pages/DeveloperMode/PendingRequests";
import type { DevSignRequest } from "@/types/developer";

// 0x5208 = 21000 gas, 0x2E90EDD000 = 200 Gwei, 0x14D1120D7B160000 = 1.5 ETH.
// Cost = 21000 × 200e9 = 4.2e15 wei = 0.0042 ETH.
const request: DevSignRequest = {
  id: "req-1",
  type: "call",
  from: "0xaaaa000000000000000000000000000000000001",
  to: "0xcccc000000000000000000000000000000000003",
  value: "0x14D1120D7B160000",
  gas: "0x5208",
  gasPrice: "0x2E90EDD000",
  network: "ethereum",
  chainId: 1,
} as DevSignRequest;

function renderWith(overrides: Partial<DevSignRequest> = {}) {
  render(
    <PendingRequests
      requests={[{ ...request, ...overrides }]}
      messageRequests={[]}
      onApprove={vi.fn()}
      onReject={vi.fn()}
      onApproveMessage={vi.fn()}
      onRejectMessage={vi.fn()}
      session={null}
    />,
  );
}

describe("pending request amounts", () => {
  it("groups the gas limit with a pinned separator", () => {
    renderWith({ gas: "0x1C9C380" }); // 30,000,000
    expect(screen.getByText(/30,000,000/)).toBeInTheDocument();
  });

  // Gwei keeps two decimals: "200.000000 Gwei" says nothing the shorter form
  // does not.
  it("shows gas price in Gwei at two decimals", () => {
    renderWith();
    expect(screen.getByText(/200\.00 Gwei/)).toBeInTheDocument();
  });

  it("formats the value with the chain's symbol", () => {
    renderWith();
    expect(screen.getByText(/1\.500000 ETH/)).toBeInTheDocument();
  });

  // Deliberately above a thousand: the old path produced "1000.000000 ETH"
  // with no separator, so a smaller value would pass either way and prove
  // nothing about the migration.
  it("groups a large value", () => {
    renderWith({ value: "0x3635C9ADC5DEA00000" }); // 1000 ETH
    expect(screen.getByText(/1,000\.0000 ETH/)).toBeInTheDocument();
  });

  // gas × gasPrice is computed in BigInt and must stay there through scaling —
  // 30M gas at 100 Gwei is 3e18 wei, far past 2^53.
  it("formats an estimated cost beyond float range", () => {
    renderWith({ gas: "0x1C9C380", gasPrice: "0x174876E800" });
    expect(screen.getByText(/~3\.000000 ETH/)).toBeInTheDocument();
  });

  it("uses the chain's own symbol on BSC", () => {
    renderWith({ network: "bsc" });
    expect(screen.getByText(/1\.500000 BNB/)).toBeInTheDocument();
  });
});
