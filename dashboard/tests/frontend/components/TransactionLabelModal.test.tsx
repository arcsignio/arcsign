import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionLabelModal } from '@/components/TransactionLabelModal';
import type { TxLabelEntry } from '@/types/txLabel';

const mockOnSave = vi.fn();
const mockOnDelete = vi.fn();
const mockOnClose = vi.fn();

const defaultProps = {
  network: 'eth-mainnet',
  txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  onSave: mockOnSave,
  onDelete: mockOnDelete,
  onClose: mockOnClose,
};

const existingLabel: TxLabelEntry = {
  network: 'eth-mainnet',
  txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  label: {
    name: 'Buy USDC',
    category: 'swap',
    notes: 'Good price',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
};

describe('TransactionLabelModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(true);
    mockOnDelete.mockResolvedValue(true);
  });

  it('renders in add mode when no existingLabel', () => {
    render(<TransactionLabelModal {...defaultProps} />);
    expect(screen.getByText('txLabel.addLabel')).toBeInTheDocument();
    expect(screen.getByText('eth-mainnet')).toBeInTheDocument();
  });

  it('renders in edit mode with existingLabel', () => {
    render(<TransactionLabelModal {...defaultProps} existingLabel={existingLabel} />);
    expect(screen.getByText('txLabel.editLabel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Buy USDC')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Good price')).toBeInTheDocument();
  });

  it('shortens long tx hash display', () => {
    render(<TransactionLabelModal {...defaultProps} />);
    expect(screen.getByText('0xabcdef...567890')).toBeInTheDocument();
  });

  it('shows delete button only in edit mode', () => {
    const { rerender } = render(<TransactionLabelModal {...defaultProps} />);
    expect(screen.queryByText('txLabel.deleteLabel')).not.toBeInTheDocument();

    rerender(<TransactionLabelModal {...defaultProps} existingLabel={existingLabel} />);
    expect(screen.getByText('txLabel.deleteLabel')).toBeInTheDocument();
  });

  it('validates name is required on save', () => {
    render(<TransactionLabelModal {...defaultProps} />);
    const saveBtn = screen.getByText('txLabel.save');
    expect(saveBtn).toBeDisabled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('calls onSave with correct params', async () => {
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('txLabel.namePlaceholder'), 'Test Label');
    await user.click(screen.getByText('txLabel.categories.transfer'));
    await user.type(screen.getByPlaceholderText('txLabel.notesPlaceholder'), 'Some notes');

    await user.click(screen.getByText('txLabel.save'));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('Test Label', 'transfer', 'Some notes');
    });
  });

  it('closes modal after successful save', async () => {
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('txLabel.namePlaceholder'), 'Label');
    await user.click(screen.getByText('txLabel.save'));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows error when save fails', async () => {
    mockOnSave.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('txLabel.namePlaceholder'), 'Label');
    await user.click(screen.getByText('txLabel.save'));

    await waitFor(() => {
      expect(screen.getByText('txLabel.saveFailed')).toBeInTheDocument();
    });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('calls onDelete and closes on success', async () => {
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} existingLabel={existingLabel} />);

    await user.click(screen.getByText('txLabel.deleteLabel'));

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('shows error when delete fails', async () => {
    mockOnDelete.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} existingLabel={existingLabel} />);

    await user.click(screen.getByText('txLabel.deleteLabel'));

    await waitFor(() => {
      expect(screen.getByText('txLabel.deleteFailed')).toBeInTheDocument();
    });
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<TransactionLabelModal {...defaultProps} />);
    const overlay = container.querySelector('.txlabel-overlay')!;
    await user.click(overlay);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} />);
    await user.click(screen.getByText('×'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} />);
    await user.click(screen.getByText('common.cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders all 6 category buttons', () => {
    render(<TransactionLabelModal {...defaultProps} />);
    const categories = ['swap', 'transfer', 'stake', 'nft', 'approval', 'other'];
    categories.forEach((cat) => {
      expect(screen.getByText(`txLabel.categories.${cat}`)).toBeInTheDocument();
    });
  });

  it('selects category when clicking a category button', async () => {
    const user = userEvent.setup();
    render(<TransactionLabelModal {...defaultProps} />);

    const swapBtn = screen.getByText('txLabel.categories.swap');
    await user.click(swapBtn);
    expect(swapBtn.className).toContain('active');
  });
});
