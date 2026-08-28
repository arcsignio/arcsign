import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClearSignSummary } from '@/components/ClearSignSummary';
import type { DecodedIntent } from '@/services/clearsign/types';

const DIGEST = '0x4755849ff3e76aee51482cb91076c18efb4ae57b7340d404d19d03b3fc0d669d';
const GROUPED = '4755 849f f3e7 6aee 5148 2cb9 1076 c18e fb4a e57b 7340 d404 d19d 03b3 fc0d 669d';

function intent(over: Partial<DecodedIntent> = {}): DecodedIntent {
  return {
    readable: true,
    title: 'Transfer',
    params: [{ label: 'To', value: '0xabc...123' }],
    risks: [],
    raw: '0xa9059cbb',
    digest: { kind: 'calldata', primary: DIGEST },
    ...over,
  };
}

describe('digest display', () => {
  it('shows the digest grouped into 16 blocks of 4', () => {
    render(<ClearSignSummary intent={intent()} />);
    expect(screen.getByText(GROUPED)).toBeInTheDocument();
  });

  it('shows the digest even when the transaction is unreadable', () => {
    // The fallback case a digest exists for.
    render(<ClearSignSummary intent={intent({ readable: false, title: 'Unreadable' })} />);
    expect(screen.getByText(GROUPED)).toBeInTheDocument();
  });

  it('shows the digest when a descriptor is present', () => {
    render(
      <ClearSignSummary
        intent={intent({
          abiSource: 'erc7730',
          descriptorMeta: { owner: 'Uniswap Labs', contractName: 'Router' },
        })}
      />,
    );
    expect(screen.getByText(GROUPED)).toBeInTheDocument();
  });

  it('keeps EIP-712 domain and message hashes behind a disclosure', async () => {
    const user = userEvent.setup();
    const dh = '0x866a5aba21966af95d6c7ab78eb2b2fc913915c28be3b9aa07cc04ff903e3f28';
    const mh = '0x4f1bf464cdc42b37c401c5495e143d702931d30213ee69c500f8847a36d75903';

    render(
      <ClearSignSummary
        intent={intent({
          digest: { kind: 'eip712', primary: DIGEST, detail: { domainHash: dh, messageHash: mh } },
        })}
      />,
    );

    expect(screen.queryByText('clearSign.digestDomainHash')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'clearSign.digestShowDetail' }));
    expect(screen.getByText('clearSign.digestDomainHash')).toBeInTheDocument();
  });

  it('renders nothing digest-related when the intent carries no digest', () => {
    render(<ClearSignSummary intent={intent({ digest: undefined })} />);
    expect(screen.queryByText('clearSign.digestCalldata')).not.toBeInTheDocument();
  });
});
