import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PairingDialog } from '@/components/PairingDialog';

describe('PairingDialog', () => {
  it('shows the pairing code and origin', () => {
    render(<PairingDialog code="1234-5678" origin="https://arcsign.io" onClose={() => {}} />);
    expect(screen.getByText('1234-5678')).toBeInTheDocument();
    expect(screen.getByText(/arcsign\.io/)).toBeInTheDocument();
  });

  it('renders nothing when no code', () => {
    const { container } = render(<PairingDialog code={null} origin={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows fallback (未知) when origin is null', () => {
    render(<PairingDialog code="8888-9999" origin={null} onClose={() => {}} />);
    expect(screen.getByText(/未知/)).toBeInTheDocument();
  });

  it('calls onClose when 關閉 button is clicked', () => {
    const onClose = vi.fn();
    render(<PairingDialog code="1234-5678" origin="https://arcsign.io" onClose={onClose} />);
    fireEvent.click(screen.getByText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
