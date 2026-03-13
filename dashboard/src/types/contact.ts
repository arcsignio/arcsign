/**
 * Contact types for Address Book feature (v1.3)
 */

export interface Contact {
  id: string;
  name: string;
  address: string;
  symbol: string;
  coinName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddContactParams {
  name: string;
  address: string;
  symbol: string;
  coinName: string;
  notes?: string;
}

export interface UpdateContactParams {
  contactId: string;
  name: string;
  address: string;
  symbol: string;
  coinName: string;
  notes?: string;
}
