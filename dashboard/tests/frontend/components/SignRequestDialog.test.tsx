/**
 * SignRequestDialog tests
 * Feature: WC sign dialog renders ClearSignSummary with intent + security
 * Task 5: WC 簽章接 txguard 安全報告 + SignRequestDialog 改用 ClearSignSummary
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
