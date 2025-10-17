/**
 * Zustand store for dashboard state management
 * Feature: User Dashboard for Wallet Management
 * Generated: 2025-10-17
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Wallet } from '@/types/wallet';
import type { Address, AddressFilter, Category, KeyType } from '@/types/address';

/**
 * Dashboard application state
 * SECURITY: Never store sensitive data (mnemonics, passwords) in this store
 */
interface DashboardState {
  // Wallet management
  /** List of all wallets loaded from USB */
  wallets: Wallet[];

  /** Currently selected wallet ID */
  selectedWalletId: string | null;

  /** Addresses for currently selected wallet */
  addresses: Address[];

  // UI state
  /** Address filter criteria */
  filter: AddressFilter;

  /** Search query for address list */
  searchQuery: string;

  /** Loading states */
  isLoadingWallets: boolean;
  isLoadingAddresses: boolean;

  /** Error states */
  error: string | null;

  // USB state
  /** Currently detected USB path */
  usbPath: string | null;

  // Actions
  /** Set list of wallets */
  setWallets: (wallets: Wallet[]) => void;

  /** Select a wallet by ID */
  selectWallet: (walletId: string) => void;

  /** Add newly created wallet to list */
  addWallet: (wallet: Wallet) => void;

  /** Update wallet metadata (e.g., after rename) */
  updateWallet: (walletId: string, updates: Partial<Wallet>) => void;

  /** Set addresses for current wallet */
  setAddresses: (addresses: Address[]) => void;

  /** Set address filter */
  setFilter: (filter: Partial<AddressFilter>) => void;

  /** Clear address filter */
  clearFilter: () => void;

  /** Set search query */
  setSearchQuery: (query: string) => void;

  /** Set USB path */
  setUsbPath: (path: string | null) => void;

  /** Set loading state for wallets */
  setLoadingWallets: (loading: boolean) => void;

  /** Set loading state for addresses */
  setLoadingAddresses: (loading: boolean) => void;

  /** Set error message */
  setError: (error: string | null) => void;

  /** Clear all state (logout) */
  reset: () => void;
}

const initialState = {
  wallets: [],
  selectedWalletId: null,
  addresses: [],
  filter: {},
  searchQuery: '',
  isLoadingWallets: false,
  isLoadingAddresses: false,
  error: null,
  usbPath: null,
};

/**
 * Dashboard store with persistence
 * Persists: selected wallet, filter preferences, USB path
 * Does NOT persist: wallets list, addresses (reload on mount)
 */
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setWallets: (wallets) => set({ wallets }),

      selectWallet: (walletId) => {
        set({ selectedWalletId: walletId, addresses: [] });
      },

      addWallet: (wallet) => {
        const { wallets } = get();
        set({ wallets: [...wallets, wallet], selectedWalletId: wallet.id });
      },

      updateWallet: (walletId, updates) => {
        const { wallets } = get();
        const updatedWallets = wallets.map((wallet) =>
          wallet.id === walletId ? { ...wallet, ...updates } : wallet
        );
        set({ wallets: updatedWallets });
      },

      setAddresses: (addresses) => set({ addresses }),

      setFilter: (filterUpdates) => {
        const { filter } = get();
        set({ filter: { ...filter, ...filterUpdates } });
      },

      clearFilter: () => set({ filter: {} }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setUsbPath: (path) => set({ usbPath: path }),

      setLoadingWallets: (loading) => set({ isLoadingWallets: loading }),

      setLoadingAddresses: (loading) => set({ isLoadingAddresses: loading }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'arcsign-dashboard',
      partialize: (state) => ({
        // Persist only UI preferences, not data
        selectedWalletId: state.selectedWalletId,
        filter: state.filter,
        searchQuery: state.searchQuery,
        usbPath: state.usbPath,
      }),
    }
  )
);

/**
 * Computed selectors for derived state
 */

/** Get currently selected wallet */
export const useSelectedWallet = () =>
  useDashboardStore((state) => {
    const { wallets, selectedWalletId } = state;
    return wallets.find((w) => w.id === selectedWalletId) ?? null;
  });

/** Get filtered addresses based on current filter and search */
export const useFilteredAddresses = () =>
  useDashboardStore((state) => {
    const { addresses, filter, searchQuery } = state;

    let filtered = addresses;

    // Filter by category
    if (filter.category) {
      filtered = filtered.filter((addr) => addr.category === filter.category);
    }

    // Filter by key type
    if (filter.key_type) {
      filtered = filtered.filter((addr) => addr.key_type === filter.key_type);
    }

    // Filter by testnet
    if (filter.testnet_only !== undefined) {
      filtered = filtered.filter((addr) => addr.is_testnet === filter.testnet_only);
    }

    // Search by symbol or name (case-insensitive)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (addr) =>
          addr.symbol.toLowerCase().includes(query) ||
          addr.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

/** Get address count by category */
export const useAddressCounts = () =>
  useDashboardStore((state) => {
    const { addresses } = state;
    const counts: Record<Category, number> = {
      [Category.BASE]: 0,
      [Category.LAYER2]: 0,
      [Category.REGIONAL]: 0,
      [Category.COSMOS]: 0,
      [Category.ALT_EVM]: 0,
      [Category.SPECIALIZED]: 0,
    };

    addresses.forEach((addr) => {
      counts[addr.category] = (counts[addr.category] || 0) + 1;
    });

    return counts;
  });

/** Check if any wallet is available */
export const useHasWallets = () =>
  useDashboardStore((state) => state.wallets.length > 0);

/** Check if addresses are loaded for selected wallet */
export const useHasAddresses = () =>
  useDashboardStore((state) => state.addresses.length > 0);
