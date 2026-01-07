/**
 * Zustand store for dashboard state management
 * Feature: User Dashboard for Wallet Management
 * Generated: 2025-10-17
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Wallet } from '@/types/wallet';
import type { Address, AddressFilter } from '@/types/address';
import { Category } from '@/types/address';

/**
 * Membership status for Pro tier verification
 * NFT count is aggregated across ALL BSC addresses in all wallets
 * Wallet limit formula: 3 + (totalNftCount * 5)
 */
interface MembershipState {
  /** Whether user is a Pro member (owns at least 1 NFT) */
  isPro: boolean;
  /** Total NFTs owned across all BSC addresses */
  nftCount: number;
  /** Days remaining until membership expires */
  daysRemaining: number;
  /** Wallet creation limit: 3 + (nftCount * 5) */
  walletLimit: number;
  /** NFT count breakdown by address */
  addressNftCounts: { address: string; nftCount: number }[];
  /** IDs of wallets that are locked due to exceeding the limit */
  lockedWalletIds: string[];
}

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

  // Membership state
  /** Current membership status */
  membership: MembershipState;

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

  /** Set membership status */
  setMembership: (membership: Partial<MembershipState>) => void;

  /** Check if wallet creation is allowed */
  canCreateWallet: () => boolean;

  /** Clear all state (logout) */
  reset: () => void;
}

const initialMembership: MembershipState = {
  isPro: false,
  nftCount: 0,
  daysRemaining: 0,
  walletLimit: 3, // Free tier default: 3 + (0 * 5) = 3
  addressNftCounts: [],
  lockedWalletIds: [],
};

const initialState = {
  wallets: [],
  selectedWalletId: null,
  addresses: [],
  membership: initialMembership,
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

      setMembership: (membershipUpdates) => {
        const { membership } = get();
        set({ membership: { ...membership, ...membershipUpdates } });
      },

      canCreateWallet: () => {
        const { wallets, membership } = get();
        // All users have a limit now: 3 + (nftCount * 3)
        // walletLimit is calculated by backend based on nftCount
        const limit = membership.walletLimit ?? 3;
        return wallets.length < limit;
      },

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
        // Membership is now calculated from all wallets, no need to persist address selection
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

/** Get current membership status */
export const useMembershipStatus = () =>
  useDashboardStore((state) => state.membership);

/** Check if user is Pro member */
export const useIsPro = () =>
  useDashboardStore((state) => state.membership.isPro);

/** Check if wallet creation is allowed */
export const useCanCreateWallet = () =>
  useDashboardStore((state) => state.canCreateWallet());

/** Get wallet count and limit info */
export const useWalletLimitInfo = () =>
  useDashboardStore((state) => ({
    current: state.wallets.length,
    limit: state.membership.walletLimit,
    isPro: state.membership.isPro,
    canCreate: state.canCreateWallet(),
  }));

/** Get NFT count breakdown by address */
export const useAddressNftCounts = () =>
  useDashboardStore((state) => state.membership.addressNftCounts);

/** Get locked wallet IDs */
export const useLockedWalletIds = () =>
  useDashboardStore((state) => state.membership.lockedWalletIds);

/** Check if a specific wallet is locked */
export const useIsWalletLocked = (walletId: string) =>
  useDashboardStore((state) => state.membership.lockedWalletIds.includes(walletId));
