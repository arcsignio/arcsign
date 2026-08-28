import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignReview } from '@/components/SignReview';
import type { SignReview as SignReviewData } from '@/hooks/useSignReview';
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

function review(over: Partial<SignReviewData> = {}): SignReviewData {
  // ClearSignSummary derives the checkbox from `security.requiresAcknowledge`
  // via isHighRiskSign(security) — it does not read review.requiresAcknowledge
  // directly. Keep the two in sync here so the fixture mirrors what the real
  // useSignReview hook always produces (requiresAcknowledge is *derived from*
  // security, never set independently).
  const requiresAcknowledge = over.requiresAcknowledge ?? false;
  return {
    security: { requiresAcknowledge, riskLevel: 'safe', warnings: [] } as never,
    requiresAcknowledge,
    acknowledged: false,
    setAcknowledged: vi.fn(),
    intent: intent(),
    ...over,
  };
}

describe('SignReview', () => {
  it('shows the transaction description and the digest together', () => {
    render(<SignReview review={review()} />);
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText(GROUPED)).toBeInTheDocument();
  });

  it('hides the acknowledgement checkbox when the backend does not require it', () => {
    render(<SignReview review={review({ requiresAcknowledge: false })} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows the acknowledgement checkbox when the backend requires it', () => {
    render(<SignReview review={review({ requiresAcknowledge: true })} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('still shows the digest when the transaction could not be decoded', () => {
    // The fallback case the digest exists for.
    render(
      <SignReview
        review={review({ intent: intent({ readable: false, title: 'Unreadable' }) })}
      />,
    );
    expect(screen.getByText(GROUPED)).toBeInTheDocument();
  });

  it('renders nothing when there is no transaction to review', () => {
    const { container } = render(
      <SignReview review={review({ intent: undefined, security: undefined })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // Equivalent of the case Task 2 deleted from ClearSignSummary.test.tsx
  // ("renders nothing digest-related when the intent carries no digest")
  // when digest moved out into DigestPanel. Restored here at the SignReview
  // level since this is the component that now decides whether DigestPanel
  // renders at all.
  it('renders no digest section when the intent carries no digest, but still shows the description', () => {
    render(<SignReview review={review({ intent: intent({ digest: undefined }) })} />);
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.queryByText('clearSign.digestCalldata')).not.toBeInTheDocument();
    expect(screen.queryByText('clearSign.digestEip712')).not.toBeInTheDocument();
  });

  it('renders description, then acknowledgement checkbox, then digest, in that order', () => {
    // Order is deliberate: what the transaction does, then the consent
    // checkbox, then the optional deep-check fingerprint last — it must
    // not stand between the user and understanding the transaction.
    render(
      <SignReview review={review({ requiresAcknowledge: true })} />,
    );

    const description = screen.getByText('Transfer');
    const checkbox = screen.getByRole('checkbox');
    const digest = screen.getByText(GROUPED);

    // DOCUMENT_POSITION_FOLLOWING (4) means the argument comes after `node`.
    expect(
      description.compareDocumentPosition(checkbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      checkbox.compareDocumentPosition(digest) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
