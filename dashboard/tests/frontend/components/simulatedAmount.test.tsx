/**
 * Simulated balance-change amounts on the signing review.
 *
 * formatSimAmount divided by `Math.pow(10, decimals || 18)`. `||` is a truthy
 * check, so a zero-decimal token was divided by 10^18 instead of 10^0 — a
 * whole million rendered as "<0.0001", i.e. as nothing. Same class of defect
 * as the allowance bug fixed earlier, opposite direction.
 *
 * Rendered through SecurityReportPanel, which is where the figure actually
 * appears; formatSimAmount is module-local and a test reimplementing it would
 * pass with the component unchanged.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecurityReportPanel } from "@/components/SendTransaction";
import type { SecurityReport } from "@/services/tauri-api";

function reportWithChange(amount: string, decimals: number, symbol = "TKN"): SecurityReport {
  return {
    riskLevel: "safe",
    warnings: [],
    proRequired: false,
    simulation: {
      success: true,
      gasUsed: "21000",
      assetChanges: [
        {
          assetType: "ERC20",
          changeType: "TRANSFER",
          from: "0xabc",
          to: "0xdef",
          symbol,
          decimals,
          amount,
          logo: "",
        },
      ],
    },
  } as unknown as SecurityReport;
}

describe("simulated balance change amounts", () => {
  it("scales by the token's decimals", () => {
    render(<SecurityReportPanel security={reportWithChange("1500000", 6)} />);
    expect(screen.getByText(/1\.500000 TKN/)).toBeInTheDocument();
  });

  it("scales an 18-decimal token the same way", () => {
    render(<SecurityReportPanel security={reportWithChange("1500000000000000000", 18)} />);
    expect(screen.getByText(/1\.500000 TKN/)).toBeInTheDocument();
  });

  // The defect: `decimals || 18` coerced 0 to 18, so this rendered as dust.
  it("honours a zero-decimal token", () => {
    render(<SecurityReportPanel security={reportWithChange("1000000", 0)} />);
    expect(screen.getByText(/1,000,000\.0000 TKN/)).toBeInTheDocument();
  });

  // Above a thousand the old path used toLocaleString(undefined), which
  // follows the runtime locale — a German user saw "1.234,57" here and
  // "1,234.5678" on every already-consolidated screen.
  it("groups large amounts with a pinned separator", () => {
    render(<SecurityReportPanel security={reportWithChange("12345000000", 6)} />);
    expect(screen.getByText(/12,345\.0000 TKN/)).toBeInTheDocument();
  });
});
