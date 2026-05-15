import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportBackup } from '@/components/ExportBackup';

vi.mock('@/services/tauri-api', () => ({
  default: {
    exportBackup: vi.fn(),
  },
}));

import tauriApi from '@/services/tauri-api';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

const defaultProps = {
  walletId: 'w1',
  walletName: 'My Wallet',
  usbPath: '/dev/usb0',
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('ExportBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with wallet name', () => {
    render(<ExportBackup {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'backup.exportTitle' })).toBeInTheDocument();
    expect(screen.getByText('My Wallet')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    render(<ExportBackup {...defaultProps} />);
    await user.click(screen.getByText('common.cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('exports successfully', async () => {
    const user = userEvent.setup();
    (tauriApi.exportBackup as any).mockResolvedValue({ backupData: btoa('test-data') });
    (save as any).mockResolvedValue('/path/to/save.arcsign');
    (writeFile as any).mockResolvedValue(undefined);

    render(<ExportBackup {...defaultProps} />);
    // Click the confirm button (not the heading)
    await user.click(screen.getByRole('button', { name: 'backup.exportTitle' }));

    await waitFor(() => {
      expect(tauriApi.exportBackup).toHaveBeenCalledWith({
        wallet_id: 'w1',
        usb_path: '/dev/usb0',
      });
      expect(save).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(screen.getByText('backup.exportSuccess')).toBeInTheDocument();
    });
  });

  it('handles user cancelling save dialog', async () => {
    const user = userEvent.setup();
    (tauriApi.exportBackup as any).mockResolvedValue({ backupData: btoa('test-data') });
    (save as any).mockResolvedValue(null);

    render(<ExportBackup {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'backup.exportTitle' }));

    await waitFor(() => {
      expect(writeFile).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('backup.exportSuccess')).not.toBeInTheDocument();
  });

  it('shows error on API failure', async () => {
    const user = userEvent.setup();
    (tauriApi.exportBackup as any).mockRejectedValue(new Error('Export failed'));

    render(<ExportBackup {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'backup.exportTitle' }));

    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeInTheDocument();
    });
  });

  it('hides export button after success', async () => {
    const user = userEvent.setup();
    (tauriApi.exportBackup as any).mockResolvedValue({ backupData: btoa('test') });
    (save as any).mockResolvedValue('/path.arcsign');
    (writeFile as any).mockResolvedValue(undefined);

    render(<ExportBackup {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'backup.exportTitle' }));

    await waitFor(() => {
      expect(screen.getByText('backup.exportSuccess')).toBeInTheDocument();
      // Confirm button should be gone after success
      expect(screen.queryByRole('button', { name: 'backup.exportTitle' })).not.toBeInTheDocument();
    });
  });
});
