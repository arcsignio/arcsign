/**
 * SignRequestDialog tests
 * Feature: WC sign dialog renders ClearSignSummary with intent + security
 * Task 5: WC 簽章接 txguard 安全報告 + SignRequestDialog 改用 ClearSignSummary
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignRequestDialog } from '@/components/WalletConnect/SignRequestDialog';
import type { SignatureRequestParams } from '@/services/walletconnect/request-handler';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const baseRequest: SignatureRequestParams = {
  type: 'eth_sendTransaction',
  dappName: 'Test dApp',
  dappUrl: 'https://test.dapp',
  chainId: 1,
  message: 'To: 0xRecipient\nValue: 0 ETH\nData: Transfer 100 USDC',
  rawMessage: '{"to":"0xRecipient"}',
};

describe('SignRequestDialog', () => {
  it('renders without intent (fallback string content)', () => {
    render(
      <SignRequestDialog
        isOpen={true}
        request={baseRequest}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    // Plain message content still visible
    expect(screen.getByText(/Transfer 100 USDC/)).toBeInTheDocument();
  });

  it('renders ClearSignSummary when intent is provided', () => {
    const request: SignatureRequestParams = {
      ...baseRequest,
      intent: {
        readable: true,
        title: 'Transfer 100 USDC',
        params: [{ label: 'To', value: '0xRecipient...1234' }],
        risks: [],
        raw: '0xa9059cbb',
      },
    };

    render(
      <SignRequestDialog
        isOpen={true}
        request={request}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    // ClearSignSummary shows the decoded title
    expect(screen.getAllByText('Transfer 100 USDC').length).toBeGreaterThan(0);
  });

  it('renders ClearSignSummary with intent + security (danger blacklist)', () => {
    const request: SignatureRequestParams = {
      ...baseRequest,
      intent: {
        readable: true,
        title: 'Transfer 100 USDC',
        params: [{ label: 'To', value: '0xbad...addr' }],
        risks: [],
        raw: '0xa9059cbb',
      },
      security: {
        proRequired: false,
        warnings: [],
        riskLevel: 'danger',
        requiresAcknowledge: true,
        blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
      },
    };

    render(
      <SignRequestDialog
        isOpen={true}
        request={request}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    // ClearSignSummary security section heading
    expect(screen.getByText('clearSign.securityHeading')).toBeInTheDocument();
    // Blacklist hit text
    expect(screen.getByText(/clearSign.blacklistHit/)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <SignRequestDialog
        isOpen={false}
        request={baseRequest}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables the send button until the risk is acknowledged (danger report)', () => {
    const request: SignatureRequestParams = {
      ...baseRequest,
      intent: { readable: true, title: 'Transfer 100 USDC', params: [], risks: [], raw: '0xa9059cbb' },
      security: {
        proRequired: false,
        warnings: [],
        riskLevel: 'danger',
        requiresAcknowledge: true,
        blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
      },
    };

    const { container } = render(
      <SignRequestDialog isOpen={true} request={request} onApprove={vi.fn()} onReject={vi.fn()} />,
    );

    const pw = container.querySelector('#wallet-password') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'pw' } });

    const sendBtn = screen.getByText('walletConnect.send').closest('button')!;
    expect(sendBtn).toBeDisabled();

    screen.getByRole('checkbox').click();
    expect(sendBtn).not.toBeDisabled();
  });

  it('does not gate the send button when the report is safe', () => {
    const request: SignatureRequestParams = {
      ...baseRequest,
      intent: { readable: true, title: 'Transfer 100 USDC', params: [], risks: [], raw: '0xa9059cbb' },
      security: { proRequired: false, warnings: [], riskLevel: 'safe' },
    };

    const { container } = render(
      <SignRequestDialog isOpen={true} request={request} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    const pw = container.querySelector('#wallet-password') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'pw' } });

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('walletConnect.send').closest('button')!).not.toBeDisabled();
  });

  it('resets acknowledgment when a new request arrives (no stale-ack leak across requests)', () => {
    const danger = {
      proRequired: false,
      warnings: [],
      riskLevel: 'danger',
      requiresAcknowledge: true,
      blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
    };
    const reqA: SignatureRequestParams = {
      ...baseRequest,
      intent: { readable: true, title: 'Transfer A', params: [], risks: [], raw: '0xa9059cbb' },
      security: danger,
    };
    const reqB: SignatureRequestParams = {
      ...baseRequest,
      intent: { readable: true, title: 'Transfer B', params: [], risks: [], raw: '0xa9059cbb' },
      security: danger,
    };

    const { container, rerender } = render(
      <SignRequestDialog isOpen={true} request={reqA} onApprove={vi.fn()} onReject={vi.fn()} />,
    );

    // acknowledge request A
    const pwA = container.querySelector('#wallet-password') as HTMLInputElement;
    fireEvent.change(pwA, { target: { value: 'pw' } });
    screen.getByRole('checkbox').click();
    expect(screen.getByText('walletConnect.send').closest('button')!).not.toBeDisabled();

    // a new danger request B arrives at the SAME mounted instance
    rerender(<SignRequestDialog isOpen={true} request={reqB} onApprove={vi.fn()} onReject={vi.fn()} />);

    // gate must be re-locked: checkbox unticked, send button disabled again
    const pwB = container.querySelector('#wallet-password') as HTMLInputElement;
    fireEvent.change(pwB, { target: { value: 'pw' } });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('walletConnect.send').closest('button')!).toBeDisabled();
  });

  it('does not sign a high-risk tx via Enter key without acknowledgment', () => {
    const onApprove = vi.fn();
    const request: SignatureRequestParams = {
      ...baseRequest,
      intent: { readable: true, title: 'Transfer 100 USDC', params: [], risks: [], raw: '0xa9059cbb' },
      security: {
        proRequired: false,
        warnings: [],
        riskLevel: 'danger',
        requiresAcknowledge: true,
        blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
      },
    };

    const { container } = render(
      <SignRequestDialog isOpen={true} request={request} onApprove={onApprove} onReject={vi.fn()} />,
    );

    const pw = container.querySelector('#wallet-password') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'pw' } });

    // press Enter WITHOUT ticking the acknowledgment checkbox
    fireEvent.keyDown(pw, { key: 'Enter' });
    expect(onApprove).not.toHaveBeenCalled();

    // after acknowledging, Enter signs
    screen.getByRole('checkbox').click();
    fireEvent.keyDown(pw, { key: 'Enter' });
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('shows the ack checkbox when security is danger but intent is absent (no deadlock)', () => {
    const request: SignatureRequestParams = {
      ...baseRequest,
      // intent omitted entirely — upstream failed to decode
      security: {
        proRequired: false,
        warnings: [],
        riskLevel: 'danger',
        requiresAcknowledge: true,
        blacklistMatch: { value: '0xbad', source: 'OFAC', category: 'sanctioned' },
      },
    };

    const { container } = render(
      <SignRequestDialog isOpen={true} request={request} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    const pw = container.querySelector('#wallet-password') as HTMLInputElement;
    fireEvent.change(pw, { target: { value: 'pw' } });

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    const sendBtn = screen.getByText('walletConnect.send').closest('button')!;
    expect(sendBtn).toBeDisabled();

    screen.getByRole('checkbox').click();
    expect(sendBtn).not.toBeDisabled();
  });
});
