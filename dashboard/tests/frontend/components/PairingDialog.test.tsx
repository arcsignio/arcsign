import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PairingDialog } from '@/components/PairingDialog';

describe('PairingDialog', () => {
  it('shows the pairing code and origin', () => {
    render(<PairingDialog code="1234-5678" origin="https://arcsign.io" />);
    expect(screen.getByText('1234-5678')).toBeInTheDocument();
    expect(screen.getByText(/arcsign\.io/)).toBeInTheDocument();
  });

  it('renders nothing when no code', () => {
    const { container } = render(<PairingDialog code={null} origin={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
