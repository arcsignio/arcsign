import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SignGateAcknowledge } from '@/components/SignGateAcknowledge';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe('SignGateAcknowledge', () => {
  it('renders the checkbox + warning when required', () => {
    render(<SignGateAcknowledge requiresAcknowledge acknowledged={false} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText('clearSign.ackRisk')).toBeInTheDocument();
  });
  it('renders nothing when not required', () => {
    const { container } = render(<SignGateAcknowledge requiresAcknowledge={false} acknowledged={false} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('calls onChange(true) when ticked', () => {
    const onChange = vi.fn();
    render(<SignGateAcknowledge requiresAcknowledge acknowledged={false} onChange={onChange} />);
    screen.getByRole('checkbox').click();
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
