/**
 * SecurityReportPanel component tests
 *
 * Regression coverage for the "blacklist is free, not Pro-gated" change: a free
 * user (isPro=false, proRequired=true) whose target address is on the OFAC
 * blacklist MUST see the blacklist danger alert — NOT the old "this transaction
 * has not been security checked" upgrade prompt that swallowed the whole panel.
 * Only the SIMULATION preview is Pro-gated. (Backend computes the verdict in
 * txguard.Check; this panel only renders the conclusion.)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityReportPanel } from '@/components/SendTransaction';
import type { SecurityReport } from '@/services/tauri-api';

const blacklistedDangerReport: SecurityReport = {
  proRequired: true, // simulation did NOT run (free user / no Alchemy key)
  blacklistMatch: {
    value: '0x8589427373D6D84E98730D7795D8f6f8731FDA16',
    source: 'OFAC',
    category: 'sanctioned',
  },
  warnings: [],
  riskLevel: 'danger',
  requiresAcknowledge: true,
};

const cleanFreeReport: SecurityReport = {
  proRequired: true, // free user, simulation not run
  warnings: [],
  riskLevel: 'safe',
  requiresAcknowledge: false,
};

describe('SecurityReportPanel — blacklist is free, not Pro-gated', () => {
  it('shows the blacklist danger alert to a FREE user (does not hide it behind an upgrade wall)', () => {
    render(<SecurityReportPanel security={blacklistedDangerReport} isPro={false} />);

    // The OFAC blacklist verdict must be visible to free users.
    expect(screen.getByText('Blacklisted Address')).toBeInTheDocument();
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
    render(<SecurityReportPanel security={embeddedOfac} isPro={false} />);

    // User sees "OFAC", not the implementation-detail "embedded-ofac".
    expect(screen.getByText(/on the OFAC blacklist \(sanctioned\)/)).toBeInTheDocument();
    expect(screen.queryByText(/embedded-ofac/)).not.toBeInTheDocument();
  });

  it('shows a slim simulation upsell (not a scary "unchecked" message) when simulation is Pro-gated', () => {
    render(<SecurityReportPanel security={cleanFreeReport} isPro={false} />);

    // Blacklist DID run and the address is clean — free users learn that.
    expect(
      screen.getByText(/Address is not on any known blacklist/i),
    ).toBeInTheDocument();

    // Only the simulation is gated, and the upsell makes that explicit.
    expect(
      screen.getByText(/Transaction simulation preview is a Pro feature/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Upgrade to Pro/i)).toBeInTheDocument();
  });

  it('does NOT show the upgrade upsell to a Pro user', () => {
    const proReport: SecurityReport = { ...cleanFreeReport, proRequired: false };
    render(<SecurityReportPanel security={proReport} isPro={true} />);

    expect(screen.queryByText(/Upgrade to Pro/i)).not.toBeInTheDocument();
  });

  it('renders the blacklist alert for a Pro user too', () => {
    const proBlacklist: SecurityReport = { ...blacklistedDangerReport, proRequired: false };
    render(<SecurityReportPanel security={proBlacklist} isPro={true} />);

    expect(screen.getByText('Blacklisted Address')).toBeInTheDocument();
    expect(screen.getByText('DANGER')).toBeInTheDocument();
    // No upsell for a Pro user whose simulation ran.
    expect(
      screen.queryByText(/Transaction simulation preview is a Pro feature/i),
    ).not.toBeInTheDocument();
  });
});
