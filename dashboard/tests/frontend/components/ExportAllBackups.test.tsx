import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportAllBackups } from '@/components/ExportAllBackups';

vi.mock('@/services/tauri-api', () => ({
  default: {
    exportAllBackups: vi.fn(),
  },
}));

import tauriApi from '@/services/tauri-api';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const defaultProps = {
  usbPath: '/dev/usb0',
  walletCount: 3,
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('ExportAllBackups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with wallet count', () => {
    render(<ExportAllBackups {...defaultProps} />);
    expect(screen.getByText('backup.exportAllTitle')).toBeInTheDocument();
    expect(screen.getByText(/3.*wallet.wallets/)).toBeInTheDocument();
  });

  it('export button disabled without password', () => {
    render(<ExportAllBackups {...defaultProps} />);
    expect(screen.getByText('backup.exportAllConfirm')).toBeDisabled();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    render(<ExportAllBackups {...defaultProps} />);
    await user.click(screen.getByText('common.cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('exports successfully with password', async () => {
    const user = userEvent.setup();
    (tauriApi.exportAllBackups as any).mockResolvedValue({
      data: { bundleData: btoa('bundle-data') },
    });
    (save as any).mockResolvedValue('/path/bundle.arcsign-bundle');
    (writeFile as any).mockResolvedValue(undefined);

    render(<ExportAllBackups {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('backup.enterPassword'), 'mypassword');
    await user.click(screen.getByText('backup.exportAllConfirm'));

    await waitFor(() => {
      expect(tauriApi.exportAllBackups).toHaveBeenCalledWith({
        password: 'mypassword',
        usb_path: '/dev/usb0',
      });
      expect(save).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(screen.getByText('backup.exportAllSuccess')).toBeInTheDocument();
    });
  });

  it('shows wrong password error', async () => {
    const user = userEvent.setup();
    (tauriApi.exportAllBackups as any).mockRejectedValue({ code: 'INVALID_PASSWORD' });

    render(<ExportAllBackups {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('backup.enterPassword'), 'wrong');
    await user.click(screen.getByText('backup.exportAllConfirm'));

    await waitFor(() => {
      expect(screen.getByText('backup.wrongPassword')).toBeInTheDocument();
    });
  });

  it('handles user cancelling save dialog', async () => {
    const user = userEvent.setup();
    (tauriApi.exportAllBackups as any).mockResolvedValue({
      data: { bundleData: btoa('data') },
    });
    (save as any).mockResolvedValue(null);

    render(<ExportAllBackups {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('backup.enterPassword'), 'pw');
    await user.click(screen.getByText('backup.exportAllConfirm'));

    await waitFor(() => {
      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  it('hides confirm button after success', async () => {
    const user = userEvent.setup();
    (tauriApi.exportAllBackups as any).mockResolvedValue({
      data: { bundleData: btoa('d') },
    });
    (save as any).mockResolvedValue('/path.arcsign-bundle');
    (writeFile as any).mockResolvedValue(undefined);

    render(<ExportAllBackups {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('backup.enterPassword'), 'pw');
    await user.click(screen.getByText('backup.exportAllConfirm'));

    await waitFor(() => {
      expect(screen.getByText('backup.exportAllSuccess')).toBeInTheDocument();
      expect(screen.queryByText('backup.exportAllConfirm')).not.toBeInTheDocument();
    });
  });
});
