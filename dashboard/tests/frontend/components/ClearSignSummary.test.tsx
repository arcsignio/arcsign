import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClearSignSummary } from '@/components/ClearSignSummary';
import type { DecodedIntent } from '@/services/clearsign/types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const readable: DecodedIntent = {
  readable: true, title: 'Approve Unlimited', params: [{ label: 'Spender', value: '0x1111...0582' }],
  risks: ['unlimited-approval'], raw: '0x095ea7b3',
};
const unreadable: DecodedIntent = { readable: false, title: 'Unreadable transaction', params: [], risks: [], raw: '0xdeadbeef' };

describe('ClearSignSummary', () => {
  it('shows the decoded title, params and risk badge when readable', () => {
    render(<ClearSignSummary intent={readable} />);
    expect(screen.getByText('Approve Unlimited')).toBeInTheDocument();
    expect(screen.getByText(/0x1111\.\.\.0582/)).toBeInTheDocument();
    expect(screen.getByText('clearSign.riskUnlimited')).toBeInTheDocument();
  });

  it('shows the unreadable warning and raw data toggle when not readable', () => {
    render(<ClearSignSummary intent={unreadable} />);
    expect(screen.getByText('clearSign.unreadableTitle')).toBeInTheDocument();
    expect(screen.getByText('clearSign.showRaw')).toBeInTheDocument();
  });

  it('renders the security section when a security report is passed', () => {
    render(<ClearSignSummary intent={readable} security={{ proRequired: false, warnings: [], riskLevel: 'danger', blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' } }} />);
    expect(screen.getByText('clearSign.securityHeading')).toBeInTheDocument();
    expect(screen.getByText(/clearSign.blacklistHit/)).toBeInTheDocument();
  });
});
