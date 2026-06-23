import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// t(key, fallback) -> fallback so we can assert on human-readable text.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }),
}));

vi.mock('@/services/tauri-api', () => ({
  default: { addTouchedToken: vi.fn() },
}));

import { AddTokenDialog } from '@/components/AddTokenDialog';
import tauriApi from '@/services/tauri-api';

const baseProps = {
  usbPath: '/dev/usb0',
  userAddress: '0xUSER',
  network: 'eth-mainnet',
  networkLabel: 'Ethereum',
  sessionToken: 'tok',
  onAdded: vi.fn(),
  onClose: vi.fn(),
};

const VALID_ADDR = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984';

describe('AddTokenDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables submit until a valid address + symbol are entered', async () => {
    const user = userEvent.setup();
    render(<AddTokenDialog {...baseProps} />);

    const submit = screen.getByRole('button', { name: 'Add token' });
    expect(submit).toBeDisabled();

    // Invalid address keeps it disabled and shows a hint.
    await user.type(screen.getByPlaceholderText('0x...'), '0xnotvalid');
    expect(screen.getByText('Enter a valid 0x… contract address')).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it('calls addTouchedToken with the entered fields and fires callbacks on success', async () => {
    const user = userEvent.setup();
    (tauriApi.addTouchedToken as ReturnType<typeof vi.fn>).mockResolvedValue({ added: true });

    render(<AddTokenDialog {...baseProps} />);

    await user.type(screen.getByPlaceholderText('0x...'), VALID_ADDR);
    await user.type(screen.getByPlaceholderText('e.g. PEPE'), 'UNI');

    const submit = screen.getByRole('button', { name: 'Add token' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => {
      expect(tauriApi.addTouchedToken).toHaveBeenCalledWith({
        usbPath: '/dev/usb0',
        userAddress: '0xUSER',
        tokenAddress: VALID_ADDR,
        network: 'eth-mainnet',
        symbol: 'UNI',
        decimals: 18,
        sessionToken: 'tok',
      });
    });
    expect(baseProps.onAdded).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('shows the backend error and does NOT close on failure', async () => {
    const user = userEvent.setup();
    (tauriApi.addTouchedToken as ReturnType<typeof vi.fn>).mockRejectedValue({
      message: 'disk full',
    });

    render(<AddTokenDialog {...baseProps} />);
    await user.type(screen.getByPlaceholderText('0x...'), VALID_ADDR);
    await user.type(screen.getByPlaceholderText('e.g. PEPE'), 'UNI');
    await user.click(screen.getByRole('button', { name: 'Add token' }));

    await waitFor(() => {
      expect(screen.getByText('disk full')).toBeInTheDocument();
    });
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(baseProps.onAdded).not.toHaveBeenCalled();
  });

  it('cancel calls onClose without invoking the backend', async () => {
    const user = userEvent.setup();
    render(<AddTokenDialog {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(baseProps.onClose).toHaveBeenCalled();
    expect(tauriApi.addTouchedToken).not.toHaveBeenCalled();
  });
});
