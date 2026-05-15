import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportAllBackups } from '@/components/ImportAllBackups';

vi.mock('@/services/tauri-api', () => ({
  default: {
    importAllBackups: vi.fn(),
  },
}));

import tauriApi from '@/services/tauri-api';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';

const defaultProps = {
  usbPath: '/dev/usb0',
  onSuccess: vi.fn(),
  onBack: vi.fn(),
};

const clickFileButton = async (user: ReturnType<typeof userEvent.setup>) => {
  const fileBtn = screen.getByRole('button', { name: /backup.selectBundleFile/ });
  await user.click(fileBtn);
};

describe('ImportAllBackups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('renders with title and file select', () => {
    render(<ImportAllBackups {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'backup.importAllTitle' })).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const user = userEvent.setup();
    render(<ImportAllBackups {...defaultProps} />);
    await user.click(screen.getByText('settings.backToWallets'));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('import button disabled without file and password', () => {
    render(<ImportAllBackups {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: 'backup.importAllTitle' });
    expect(submitBtn).toBeDisabled();
  });

  it('selects bundle file', async () => {
    const user = userEvent.setup();
    (open as any).mockResolvedValue('/path/all.arcsign-bundle');
    (readFile as any).mockResolvedValue(new Uint8Array([1, 2, 3]));

    render(<ImportAllBackups {...defaultProps} />);
    await clickFileButton(user);

    await waitFor(() => {
      expect(screen.getByText('all.arcsign-bundle')).toBeInTheDocument();
    });
  });

  it('imports successfully', async () => {
    const user = userEvent.setup();
    (open as any).mockResolvedValue('/path/all.arcsign-bundle');
    (readFile as any).mockResolvedValue(new Uint8Array([1]));
    (tauriApi.importAllBackups as any).mockResolvedValue({
      data: { importedCount: 3 },
    });

    render(<ImportAllBackups {...defaultProps} />);
    await clickFileButton(user);
    await waitFor(() => expect(readFile).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('backup.enterBundlePassword'), 'pw');

    const submitBtn = screen.getByRole('button', { name: 'backup.importAllTitle' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(tauriApi.importAllBackups).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'pw',
          usb_path: '/dev/usb0',
        })
      );
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('shows wrong password error', async () => {
    const user = userEvent.setup();
    (open as any).mockResolvedValue('/path/a.arcsign-bundle');
    (readFile as any).mockResolvedValue(new Uint8Array([1]));
    (tauriApi.importAllBackups as any).mockRejectedValue({ code: 'INVALID_PASSWORD' });

    render(<ImportAllBackups {...defaultProps} />);
    await clickFileButton(user);
    await waitFor(() => expect(readFile).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('backup.enterBundlePassword'), 'wrong');
    const submitBtn = screen.getByRole('button', { name: 'backup.importAllTitle' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('backup.wrongPassword')).toBeInTheDocument();
    });
  });

  it('shows invalid bundle error', async () => {
    const user = userEvent.setup();
    (open as any).mockResolvedValue('/path/bad.arcsign-bundle');
    (readFile as any).mockResolvedValue(new Uint8Array([1]));
    (tauriApi.importAllBackups as any).mockRejectedValue({
      code: 'BUNDLE_INVALID',
      message: 'invalid bundle',
    });

    render(<ImportAllBackups {...defaultProps} />);
    await clickFileButton(user);
    await waitFor(() => expect(readFile).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('backup.enterBundlePassword'), 'pw');
    const submitBtn = screen.getByRole('button', { name: 'backup.importAllTitle' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('backup.invalidBundle')).toBeInTheDocument();
    });
  });

  it('shows corrupted bundle error', async () => {
    const user = userEvent.setup();
    (open as any).mockResolvedValue('/path/c.arcsign-bundle');
    (readFile as any).mockResolvedValue(new Uint8Array([1]));
    (tauriApi.importAllBackups as any).mockRejectedValue({ code: 'BUNDLE_CORRUPTED' });

    render(<ImportAllBackups {...defaultProps} />);
    await clickFileButton(user);
    await waitFor(() => expect(readFile).toHaveBeenCalled());

    await user.type(screen.getByPlaceholderText('backup.enterBundlePassword'), 'pw');
    const submitBtn = screen.getByRole('button', { name: 'backup.importAllTitle' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('backup.bundleCorrupted')).toBeInTheDocument();
    });
  });
});
