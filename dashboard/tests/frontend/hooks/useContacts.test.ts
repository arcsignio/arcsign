import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContacts } from '@/hooks/useContacts';
import type { Contact } from '@/types/contact';

// Mock the tauri-api module
vi.mock('@/services/tauri-api', () => ({
  listContacts: vi.fn(),
  addContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

import * as tauriApi from '@/services/tauri-api';

const mockContact: Contact = {
  id: 'c1',
  name: 'Alice',
  address: '0x1234',
  symbol: 'ETH',
  coinName: 'Ethereum',
  notes: 'Test contact',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

const USB_PATH = '/dev/usb0';
const SESSION_TOKEN = 'test-token';

describe('useContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with empty contacts', () => {
      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));
      expect(result.current.contacts).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('loadContacts', () => {
    it('loads contacts successfully', async () => {
      (tauriApi.listContacts as any).mockResolvedValue({
        contacts: [mockContact],
      });

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadContacts();
      });

      expect(result.current.contacts).toHaveLength(1);
      expect(result.current.contacts[0].name).toBe('Alice');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles load error', async () => {
      (tauriApi.listContacts as any).mockRejectedValue(new Error('USB disconnected'));

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadContacts();
      });

      expect(result.current.contacts).toEqual([]);
      expect(result.current.error).toBe('USB disconnected');
      expect(result.current.isLoading).toBe(false);
    });

    it('handles null contacts in response', async () => {
      (tauriApi.listContacts as any).mockResolvedValue({ contacts: null });

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadContacts();
      });

      expect(result.current.contacts).toEqual([]);
    });
  });

  describe('addContact', () => {
    it('adds a contact and appends to list', async () => {
      (tauriApi.addContact as any).mockResolvedValue({ contact: mockContact });

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      let newContact: Contact | null = null;
      await act(async () => {
        newContact = await result.current.addContact({
          name: 'Alice',
          address: '0x1234',
          symbol: 'ETH',
          coinName: 'Ethereum',
        });
      });

      expect(newContact).toEqual(mockContact);
      expect(result.current.contacts).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('returns null on error', async () => {
      (tauriApi.addContact as any).mockRejectedValue(new Error('Duplicate'));

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      let newContact: Contact | null = null;
      await act(async () => {
        newContact = await result.current.addContact({
          name: 'Alice',
          address: '0x1234',
          symbol: 'ETH',
          coinName: 'Ethereum',
        });
      });

      expect(newContact).toBeNull();
      expect(result.current.error).toBe('Duplicate');
    });
  });

  describe('updateContact', () => {
    it('updates a contact in the list', async () => {
      (tauriApi.listContacts as any).mockResolvedValue({
        contacts: [mockContact],
      });

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadContacts();
      });

      const updated = { ...mockContact, name: 'Bob' };
      (tauriApi.updateContact as any).mockResolvedValue({ contact: updated });

      let updatedContact: Contact | null = null;
      await act(async () => {
        updatedContact = await result.current.updateContact({
          contactId: 'c1',
          name: 'Bob',
          address: '0x1234',
          symbol: 'ETH',
          coinName: 'Ethereum',
        });
      });

      expect(updatedContact!.name).toBe('Bob');
      expect(result.current.contacts[0].name).toBe('Bob');
    });

    it('returns null on error', async () => {
      (tauriApi.updateContact as any).mockRejectedValue(new Error('Not found'));

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      let updated: Contact | null = null;
      await act(async () => {
        updated = await result.current.updateContact({
          contactId: 'c1',
          name: 'Bob',
          address: '0x1234',
          symbol: 'ETH',
          coinName: 'Ethereum',
        });
      });

      expect(updated).toBeNull();
      expect(result.current.error).toBe('Not found');
    });
  });

  describe('deleteContact', () => {
    it('removes contact from list', async () => {
      (tauriApi.listContacts as any).mockResolvedValue({
        contacts: [mockContact],
      });

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      await act(async () => {
        await result.current.loadContacts();
      });

      (tauriApi.deleteContact as any).mockResolvedValue(undefined);

      let success = false;
      await act(async () => {
        success = await result.current.deleteContact('c1');
      });

      expect(success).toBe(true);
      expect(result.current.contacts).toHaveLength(0);
    });

    it('returns false on error', async () => {
      (tauriApi.deleteContact as any).mockRejectedValue(new Error('Forbidden'));

      const { result } = renderHook(() => useContacts(USB_PATH, SESSION_TOKEN));

      let success = false;
      await act(async () => {
        success = await result.current.deleteContact('c1');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Forbidden');
    });
  });
});
