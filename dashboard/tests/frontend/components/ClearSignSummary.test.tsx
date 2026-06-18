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

  it('renders the acknowledgment checkbox when the report is high-risk', () => {
    render(
      <ClearSignSummary
        intent={readable}
        security={{ proRequired: false, warnings: [], riskLevel: 'danger', blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' } }}
        acknowledged={false}
        onAcknowledgeChange={vi.fn()}
      />,
    );
    expect(screen.getByText('clearSign.ackRisk')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('does not render the acknowledgment checkbox when not high-risk', () => {
    render(
      <ClearSignSummary
        intent={readable}
        security={{ proRequired: false, warnings: [], riskLevel: 'safe' }}
        acknowledged={false}
        onAcknowledgeChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('clearSign.ackRisk')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('calls onAcknowledgeChange(true) when the checkbox is ticked', async () => {
    const onChange = vi.fn();
    render(
      <ClearSignSummary
        intent={readable}
        security={{ proRequired: false, warnings: [], riskLevel: 'danger', blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' } }}
        acknowledged={false}
        onAcknowledgeChange={onChange}
      />,
    );
    screen.getByRole('checkbox').click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders the security section and checkbox when intent is null but report is high-risk', () => {
    render(
      <ClearSignSummary
        intent={null}
        security={{ proRequired: false, warnings: [], riskLevel: 'danger', blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' } }}
        acknowledged={false}
        onAcknowledgeChange={vi.fn()}
      />,
    );
    expect(screen.getByText('clearSign.securityHeading')).toBeInTheDocument();
    expect(screen.getByText('clearSign.ackRisk')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('does not crash and renders nothing intent-related when intent is null and no security', () => {
    const { container } = render(<ClearSignSummary intent={null} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    // outer wrapper renders but is empty — no intent card, no security block
    expect(container.textContent).toBe('');
  });
});
