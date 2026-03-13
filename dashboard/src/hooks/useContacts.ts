/**
 * useContacts hook — manages Address Book contacts state + CRUD operations
 * Feature: Address Book (v1.3)
 */

import { useState, useCallback } from "react";
import type { Contact, AddContactParams, UpdateContactParams } from "@/types/contact";
import * as tauriApi from "@/services/tauri-api";

interface UseContactsReturn {
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  loadContacts: () => Promise<void>;
  addContact: (params: AddContactParams) => Promise<Contact | null>;
  updateContact: (params: UpdateContactParams) => Promise<Contact | null>;
  deleteContact: (contactId: string) => Promise<boolean>;
}

export function useContacts(
  usbPath: string,
  sessionToken?: string,
): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await tauriApi.listContacts(usbPath, sessionToken);
      setContacts(result.contacts ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [usbPath, sessionToken]);

  const addContact = useCallback(async (params: AddContactParams): Promise<Contact | null> => {
    setError(null);
    try {
      const result = await tauriApi.addContact({
        ...params,
        usbPath,
        sessionToken,
      });
      const newContact = result.contact;
      setContacts(prev => [...prev, newContact]);
      return newContact;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    }
  }, [usbPath, sessionToken]);

  const updateContact = useCallback(async (params: UpdateContactParams): Promise<Contact | null> => {
    setError(null);
    try {
      const result = await tauriApi.updateContact({
        ...params,
        usbPath,
        sessionToken,
      });
      const updated = result.contact;
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    }
  }, [usbPath, sessionToken]);

  const deleteContact = useCallback(async (contactId: string): Promise<boolean> => {
    setError(null);
    try {
      await tauriApi.deleteContact(contactId, usbPath, sessionToken);
      setContacts(prev => prev.filter(c => c.id !== contactId));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return false;
    }
  }, [usbPath, sessionToken]);

  return {
    contacts,
    isLoading,
    error,
    loadContacts,
    addContact,
    updateContact,
    deleteContact,
  };
}
