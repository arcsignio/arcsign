/**
 * SecurityReportPanel component tests
 *
 * Regression coverage for "blacklist alert must always show": a target address
 * on the OFAC blacklist MUST see the blacklist danger alert regardless of
 * whether simulation data is present. (Backend computes the verdict in
 * txguard.Check; this panel only renders the conclusion.)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityReportPanel } from '@/components/SendTransaction';
import type { SecurityReport } from '@/services/tauri-api';

const blacklistedDangerReport: SecurityReport = {
  blacklistMatch: {
    value: '0x8589427373D6D84E98730D7795D8f6f8731FDA16',
    source: 'OFAC',
    category: 'sanctioned',
  },
  warnings: [],
  riskLevel: 'danger',
  requiresAcknowledge: true,
};

const cleanReport: SecurityReport = {
  warnings: [],
  riskLevel: 'safe',
  requiresAcknowledge: false,
};

describe('SecurityReportPanel', () => {
  it('shows the blacklist danger alert', () => {
    render(<SecurityReportPanel security={blacklistedDangerReport} />);

    // The OFAC blacklist verdict must be visible.
    expect(screen.getByText('sendTransaction.blacklistedAddress')).toBeInTheDocument();
    expect(screen.getByText(/OFAC blacklist \(sanctioned\)/)).toBeInTheDocument();
    expect(
      screen.getByText('0x8589427373D6D84E98730D7795D8f6f8731FDA16'),
    ).toBeInTheDocument();

    // The DANGER badge must show.
    expect(screen.getByText('DANGER')).toBeInTheDocument();

    // Regression guard: the misleading "not been security checked" copy must be gone.
    expect(
      screen.queryByText(/has not been security checked/i),
    ).not.toBeInTheDocument();
  });

  it('renders the internal source ID "embedded-ofac" as the user-facing "OFAC"', () => {
    const embeddedOfac: SecurityReport = {
      ...blacklistedDangerReport,
      blacklistMatch: {
        value: '0x8589427373D6D84E98730D7795D8f6f8731FDA16',
        source: 'embedded-ofac', // the actual ID the backend seed emits
        category: 'sanctioned',
      },
    };
    render(<SecurityReportPanel security={embeddedOfac} />);

    // User sees "OFAC", not the implementation-detail "embedded-ofac".
    expect(screen.getByText(/on the OFAC blacklist \(sanctioned\)/)).toBeInTheDocument();
    expect(screen.queryByText(/embedded-ofac/)).not.toBeInTheDocument();
  });

  it('shows the clean blacklist message when there is no match', () => {
    render(<SecurityReportPanel security={cleanReport} />);

    expect(
      screen.getByText('sendTransaction.notOnBlacklist'),
    ).toBeInTheDocument();
  });

  it('shows the simulation preview when simulation data is present', () => {
    const withSimulation: SecurityReport = {
      ...cleanReport,
      simulation: {
        success: true,
        gasUsed: '21000',
        assetChanges: [
          {
            assetType: 'NATIVE',
            changeType: 'TRANSFER',
            from: '0xabc',
            to: '0xdef',
            symbol: 'ETH',
            decimals: 18,
            amount: '1000000000000000000',
            logo: '',
          },
        ],
      },
    };
    render(<SecurityReportPanel security={withSimulation} />);

    expect(screen.getByText('sendTransaction.simulationPreview')).toBeInTheDocument();
  });
});
