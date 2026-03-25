import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressBook } from '@/components/AddressBook';

// Mock useContacts hook
const mockLoadContacts = vi.fn();
const mockAddContact = vi.fn();
const mockUpdateContact = vi.fn();
const mockDeleteContact = vi.fn();

vi.mock('@/hooks/useContacts', () => ({
  useContacts: vi.fn(),
}));

import { useContacts } from '@/hooks/useContacts';

const defaultProps = {
  usbPath: '/dev/usb0',
  sessionToken: 'test-token',
  onBack: vi.fn(),
};

const mockContacts = [
  {
    id: 'c1',
    name: 'Alice',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    symbol: 'ETH',
    coinName: 'Ethereum',
    notes: 'Friend',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    name: 'Bob',
    address: '0xabcdef1234567890abcdef1234567890abcdef12',
    symbol: 'BNB',
    coinName: 'BNB Chain',
    notes: '',
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

describe('AddressBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadContacts.mockResolvedValue(undefined);
    mockAddContact.mockResolvedValue(true);
    mockUpdateContact.mockResolvedValue(true);
    mockDeleteContact.mockResolvedValue(true);
    (useContacts as any).mockReturnValue({
      contacts: [],
      isLoading: false,
      error: null,
      loadContacts: mockLoadContacts,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
    });
  });

  it('renders and loads contacts on mount', () => {
    render(<AddressBook {...defaultProps} />);
    expect(screen.getByText('addressBook.title')).toBeInTheDocument();
    expect(mockLoadContacts).toHaveBeenCalled();
  });

  it('calls onBack when back button clicked', async () => {
    const user = userEvent.setup();
    render(<AddressBook {...defaultProps} />);
    await user.click(screen.getByText('addressBook.back'));
    expect(defaultProps.onBack).toHaveBeenCalled();
  });

  it('shows empty state when no contacts', () => {
    render(<AddressBook {...defaultProps} />);
    expect(screen.getByText('addressBook.emptyTitle')).toBeInTheDocument();
  });

  it('displays contact list', () => {
    (useContacts as any).mockReturnValue({
      contacts: mockContacts,
      isLoading: false,
      error: null,
      loadContacts: mockLoadContacts,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
    });

    render(<AddressBook {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('search filter works', async () => {
    const user = userEvent.setup();
    (useContacts as any).mockReturnValue({
      contacts: mockContacts,
      isLoading: false,
      error: null,
      loadContacts: mockLoadContacts,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
    });

    render(<AddressBook {...defaultProps} />);
    await user.type(screen.getByPlaceholderText('addressBook.searchPlaceholder'), 'Alice');

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('chain filter works', async () => {
    const user = userEvent.setup();
    (useContacts as any).mockReturnValue({
      contacts: mockContacts,
      isLoading: false,
      error: null,
      loadContacts: mockLoadContacts,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
    });

    render(<AddressBook {...defaultProps} />);
    // Chain filter is a <select> dropdown
    await user.selectOptions(screen.getByRole('combobox'), 'ETH');

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('opens add contact modal', async () => {
    const user = userEvent.setup();
    render(<AddressBook {...defaultProps} />);
    await user.click(screen.getByText(/addressBook\.addContact/));
    // Modal title in add mode uses the same key "addressBook.addContact"
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('submits add contact form', async () => {
    const user = userEvent.setup();
    render(<AddressBook {...defaultProps} />);

    await user.click(screen.getByText(/addressBook\.addContact/));

    await user.type(screen.getByPlaceholderText('addressBook.placeholderName'), 'Charlie');
    await user.type(screen.getByPlaceholderText('addressBook.placeholderAddress'), '0xcharlie123');

    // Save button in add mode shows "addressBook.addContact"
    const saveBtn = screen.getByRole('button', { name: 'addressBook.addContact' });
    // There are two buttons with this text (header + modal save), click the modal one
    const modalBtns = screen.getAllByText(/addressBook\.addContact/);
    await user.click(modalBtns[modalBtns.length - 1]);

    await waitFor(() => {
      expect(mockAddContact).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Charlie',
          address: '0xcharlie123',
        })
      );
    });
  });

  it('shows error state', () => {
    (useContacts as any).mockReturnValue({
      contacts: [],
      isLoading: false,
      error: 'Failed to load',
      loadContacts: mockLoadContacts,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
    });

    render(<AddressBook {...defaultProps} />);
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('calls onSelectAddress in picker mode', async () => {
    const user = userEvent.setup();
    const mockOnSelect = vi.fn();
    (useContacts as any).mockReturnValue({
      contacts: mockContacts,
      isLoading: false,
      error: null,
      loadContacts: mockLoadContacts,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
    });

    render(<AddressBook {...defaultProps} onSelectAddress={mockOnSelect} />);

    // Click select button for Alice
    const selectBtns = screen.getAllByText('addressBook.select');
    await user.click(selectBtns[0]);

    expect(mockOnSelect).toHaveBeenCalledWith(
      '0x1234567890abcdef1234567890abcdef12345678',
      'ETH'
    );
  });

  it('shows loading state', () => {
    (useContacts as any).mockReturnValue({
      contacts: [],
      isLoading: true,
      error: null,
      loadContacts: mockLoadContacts,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
    });

    render(<AddressBook {...defaultProps} />);
    expect(screen.getByText('addressBook.loading')).toBeInTheDocument();
  });
});
