import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportBackup } from '@/components/ImportBackup';

vi.mock('@/services/tauri-api', () => ({
  default: {
    importBackup: vi.fn(),
  },
}));

import tauriApi from '@/services/tauri-api';
import { open } from '@tauri-apps/api/dialog';
import { readBinaryFile } from '@tauri-apps/api/fs';

const defaultProps = {
  usbPath: '/dev/usb0',
  onSuccess: vi.fn(),
  onBack: vi.fn(),
};

// Helper to click the file select button (not the label)
const clickFileButton = async (user: ReturnType<typeof userEvent.setup>) => {
  const fileBtn = screen.getByRole('button', { name: /backup.selectFile/ });
  await user.click(fileBtn);
};

describe('ImportBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with title and file select', () => {
    render(<ImportBackup {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'backup.importTitle' })).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const user = userEvent.setup();
    render(<ImportBackup {...defaultProps} />);
    await user.click(screen.getByText('settings.backToWallets'));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('import button disabled without file and password', () => {
    render(<ImportBackup {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: 'backup.importTitle' });
    expect(submitBtn).toBeDisabled();
  });

  it('selects file via dialog', async () => {
    const user = userEvent.setup();
    const fakeBytes = new Uint8Array([65, 66, 67]);
    (open as any).mockResolvedValue('/path/to/wallet.arcsign');
    (readBinaryFile as any).mockResolvedValue(fakeBytes);

    render(<ImportBackup {...defaultProps} />);
    await clickFileButton(user);

    await waitFor(() => {
      expect(open).toHaveBeenCalled();
      expect(readBinaryFile).toHaveBeenCalledWith('/path/to/wallet.arcsign');
      expect(screen.getByText('wallet.arcsign')).toBeInTheDocument();
    });
  });

  it('imports successfully with file and password', async () => {
    const user = userEvent.setup();
    const fakeBytes = new Uint8Array([65, 66]);
    (open as any).mockResolvedValue('/path/wallet.arcsign');
    (readBinaryFile as any).mockResolvedValue(fakeBytes);
    (tauriApi.importBackup as any).mockResolvedValue({ success: true });

    render(<ImportBackup {...defaultProps} />);

    await clickFileButton(user);
    await waitFor(() => expect(screen.getByText('wallet.arcsign')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('backup.enterPassword'), 'mypassword');

    const submitBtn = screen.getByRole('button', { name: 'backup.importTitle' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(tauriApi.importBackup).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'mypassword',
          usb_path: '/dev/usb0',
        })
      );
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('shows wrong password error', async () => {
    const user = userEvent.setup();
    (open as any).mockResolvedValue('/path/w.arcsign');
    (readBinaryFile as any).mockResolvedValue(new Uint8Array([1]));
    (tauriApi.importBackup as any).mockRejectedValue({ code: 'INVALID_PASSWORD' });

    render(<ImportBackup {...defaultProps} />);
    await clickFileButton(user);
    await waitFor(() => expect(readBinaryFile).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('backup.enterPassword'), 'wrong');

    const submitBtn = screen.getByRole('button', { name: 'backup.importTitle' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('backup.wrongPassword')).toBeInTheDocument();
    });
  });

  it('shows invalid file error', async () => {
    const user = userEvent.setup();
    (open as any).mockResolvedValue('/path/bad.arcsign');
    (readBinaryFile as any).mockResolvedValue(new Uint8Array([1]));
    (tauriApi.importBackup as any).mockRejectedValue({ code: 'BACKUP_INVALID' });

    render(<ImportBackup {...defaultProps} />);
    await clickFileButton(user);
    await waitFor(() => expect(readBinaryFile).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('backup.enterPassword'), 'pw');

    const submitBtn = screen.getByRole('button', { name: 'backup.importTitle' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('backup.invalidFile')).toBeInTheDocument();
    });
  });
});
