import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { DescriptorSettings } from '@/components/DescriptorSettings';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => mockInvoke.mockReset());

const props = { usbPath: '/Volumes/arcsign', sessionToken: 'tok', onBack: vi.fn() };

describe('DescriptorSettings', () => {
  it('shows the active version and description count', async () => {
    mockInvoke.mockResolvedValue({ version: '2026-08-26', count: 229 });
    render(<DescriptorSettings {...props} />);

    await waitFor(() => expect(screen.getByText('2026-08-26')).toBeInTheDocument());
    expect(screen.getByText('229')).toBeInTheDocument();
  });

  it('tells the user that updating goes to the network', async () => {
    mockInvoke.mockResolvedValue({ version: '2026-08-26', count: 1 });
    render(<DescriptorSettings {...props} />);

    // The only networked action in the descriptor flow must carry a notice.
    // The test i18n mock renders keys, so assert the key is present — the
    // English/zh-TW copy for it lives in locales/*/common.json.
    await waitFor(() =>
      expect(screen.getByText('descriptors.networkNotice')).toBeInTheDocument(),
    );
  });

  it('updates and reports the new count', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({ version: '2026-08-01', count: 100 }) // initial status
      .mockResolvedValueOnce({ version: '2026-08-26', count: 229 }); // after update

    render(<DescriptorSettings {...props} />);
    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'descriptors.update' }));

    await waitFor(() => expect(screen.getByText('229')).toBeInTheDocument());
    expect(mockInvoke).toHaveBeenCalledWith('update_descriptors', expect.anything());
  });

  it('surfaces a failed update instead of failing silently', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({ version: '2026-08-01', count: 100 })
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'));

    render(<DescriptorSettings {...props} />);
    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'descriptors.update' }));

    await waitFor(() => expect(screen.getByText(/NETWORK_ERROR/)).toBeInTheDocument());
    // The previously known count must survive a failed update.
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('still renders when the backend cannot report a status', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('nope'));
    render(<DescriptorSettings {...props} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'descriptors.update' })).toBeInTheDocument());
  });
});
