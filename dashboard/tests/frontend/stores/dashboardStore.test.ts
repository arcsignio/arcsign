import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useDashboardStore,
  useSelectedWallet,
  useFilteredAddresses,
  useAddressCounts,
  useHasWallets,
  useHasAddresses,
  useMembershipStatus,
  useIsPro,
  useCanCreateWallet,
  useWalletLimitInfo,
  useAddressNftCounts,
  useLockedWalletIds,
  useIsWalletLocked,
} from '@/stores/dashboardStore';
import { Category, KeyType } from '@/types/address';
import type { Wallet } from '@/types/wallet';
import type { Address } from '@/types/address';

const makeWallet = (id: string, name: string): Wallet => ({
  id,
  name,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  has_passphrase: false,
  address_count: 54,
});

const makeAddress = (symbol: string, category: Category, name?: string): Address => ({
  wallet_id: 'wallet-1',
  rank: 1,
  symbol,
  name: name || symbol,
  coin_type: 0,
  derivation_path: "m/44'/0'/0'/0/0",
  address: `0x${symbol}addr`,
  category,
  key_type: 'secp256k1' as any,
});

describe('dashboardStore', () => {
  beforeEach(() => {
    useDashboardStore.getState().reset();
  });

  describe('Initial State', () => {
    it('starts with empty wallets', () => {
      expect(useDashboardStore.getState().wallets).toEqual([]);
    });

    it('starts with no selected wallet', () => {
      expect(useDashboardStore.getState().selectedWalletId).toBeNull();
    });

    it('starts with empty addresses', () => {
      expect(useDashboardStore.getState().addresses).toEqual([]);
    });

    it('starts not loading', () => {
      const state = useDashboardStore.getState();
      expect(state.isLoadingWallets).toBe(false);
      expect(state.isLoadingAddresses).toBe(false);
    });

    it('starts with free tier membership', () => {
      const { membership } = useDashboardStore.getState();
      expect(membership.isPro).toBe(false);
      expect(membership.walletLimit).toBe(1); // WALLET_LIMIT_FREE
    });
  });

  describe('Wallet Management', () => {
    it('sets wallets', () => {
      const wallets = [makeWallet('w1', 'Wallet 1'), makeWallet('w2', 'Wallet 2')];
      useDashboardStore.getState().setWallets(wallets);
      expect(useDashboardStore.getState().wallets).toHaveLength(2);
    });

    it('selects a wallet and clears addresses', () => {
      const addresses = [makeAddress('BTC', Category.BASE)];
      useDashboardStore.setState({ addresses });

      useDashboardStore.getState().selectWallet('w1');

      expect(useDashboardStore.getState().selectedWalletId).toBe('w1');
      expect(useDashboardStore.getState().addresses).toEqual([]);
    });

    it('adds a wallet and selects it', () => {
      const wallet = makeWallet('w1', 'New Wallet');
      useDashboardStore.getState().addWallet(wallet);

      expect(useDashboardStore.getState().wallets).toHaveLength(1);
      expect(useDashboardStore.getState().selectedWalletId).toBe('w1');
    });

    it('updates wallet metadata', () => {
      useDashboardStore.getState().setWallets([makeWallet('w1', 'Old Name')]);
      useDashboardStore.getState().updateWallet('w1', { name: 'New Name' });

      const wallet = useDashboardStore.getState().wallets[0];
      expect(wallet.name).toBe('New Name');
    });

    it('does not update non-matching wallet', () => {
      useDashboardStore.getState().setWallets([makeWallet('w1', 'Name')]);
      useDashboardStore.getState().updateWallet('w999', { name: 'Changed' });

      expect(useDashboardStore.getState().wallets[0].name).toBe('Name');
    });
  });

  describe('Address Management', () => {
    it('sets addresses', () => {
      const addresses = [
        makeAddress('BTC', Category.BASE),
        makeAddress('ETH', Category.BASE),
      ];
      useDashboardStore.getState().setAddresses(addresses);
      expect(useDashboardStore.getState().addresses).toHaveLength(2);
    });
  });

  describe('Filter', () => {
    it('sets filter', () => {
      useDashboardStore.getState().setFilter({ category: Category.BASE });
      expect(useDashboardStore.getState().filter.category).toBe(Category.BASE);
    });

    it('merges filter updates', () => {
      useDashboardStore.getState().setFilter({ category: Category.BASE });
      useDashboardStore.getState().setFilter({ testnet_only: true });

      const filter = useDashboardStore.getState().filter;
      expect(filter.category).toBe(Category.BASE);
      expect(filter.testnet_only).toBe(true);
    });

    it('clears filter', () => {
      useDashboardStore.getState().setFilter({ category: Category.BASE });
      useDashboardStore.getState().clearFilter();
      expect(useDashboardStore.getState().filter).toEqual({});
    });
  });

  describe('Search', () => {
    it('sets search query', () => {
      useDashboardStore.getState().setSearchQuery('bitcoin');
      expect(useDashboardStore.getState().searchQuery).toBe('bitcoin');
    });
  });

  describe('USB Path', () => {
    it('sets USB path', () => {
      useDashboardStore.getState().setUsbPath('/dev/usb0');
      expect(useDashboardStore.getState().usbPath).toBe('/dev/usb0');
    });

    it('sets USB path to null', () => {
      useDashboardStore.getState().setUsbPath('/dev/usb0');
      useDashboardStore.getState().setUsbPath(null);
      expect(useDashboardStore.getState().usbPath).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('sets loading wallets', () => {
      useDashboardStore.getState().setLoadingWallets(true);
      expect(useDashboardStore.getState().isLoadingWallets).toBe(true);
    });

    it('sets loading addresses', () => {
      useDashboardStore.getState().setLoadingAddresses(true);
      expect(useDashboardStore.getState().isLoadingAddresses).toBe(true);
    });
  });

  describe('Error State', () => {
    it('sets error', () => {
      useDashboardStore.getState().setError('Something went wrong');
      expect(useDashboardStore.getState().error).toBe('Something went wrong');
    });

    it('clears error', () => {
      useDashboardStore.getState().setError('error');
      useDashboardStore.getState().setError(null);
      expect(useDashboardStore.getState().error).toBeNull();
    });
  });

  describe('Membership', () => {
    it('updates membership', () => {
      useDashboardStore.getState().setMembership({
        isPro: true,
        nftCount: 2,
        walletLimit: 7,
      });

      const { membership } = useDashboardStore.getState();
      expect(membership.isPro).toBe(true);
      expect(membership.nftCount).toBe(2);
      expect(membership.walletLimit).toBe(7);
    });

    it('merges membership updates', () => {
      useDashboardStore.getState().setMembership({ isPro: true, nftCount: 1 });
      useDashboardStore.getState().setMembership({ daysRemaining: 300 });

      const { membership } = useDashboardStore.getState();
      expect(membership.isPro).toBe(true);
      expect(membership.daysRemaining).toBe(300);
    });
  });

  describe('canCreateWallet', () => {
    it('allows creation when under limit', () => {
      useDashboardStore.getState().setWallets([]);
      useDashboardStore.getState().setMembership({ walletLimit: 3 });

      expect(useDashboardStore.getState().canCreateWallet()).toBe(true);
    });

    it('disallows creation when at limit', () => {
      useDashboardStore.getState().setWallets([
        makeWallet('w1', 'W1'),
        makeWallet('w2', 'W2'),
        makeWallet('w3', 'W3'),
      ]);
      useDashboardStore.getState().setMembership({ walletLimit: 3 });

      expect(useDashboardStore.getState().canCreateWallet()).toBe(false);
    });

    it('respects wallet limit formula', () => {
      // With 2 NFTs: limit = 1 + (2 * 3) = 7
      useDashboardStore.getState().setMembership({ walletLimit: 7 });
      useDashboardStore.getState().setWallets(
        Array.from({ length: 6 }, (_, i) => makeWallet(`w${i}`, `W${i}`))
      );

      expect(useDashboardStore.getState().canCreateWallet()).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets all state to initial', () => {
      useDashboardStore.getState().setWallets([makeWallet('w1', 'W1')]);
      useDashboardStore.getState().selectWallet('w1');
      useDashboardStore.getState().setError('error');
      useDashboardStore.getState().setUsbPath('/dev/usb0');

      useDashboardStore.getState().reset();

      const state = useDashboardStore.getState();
      expect(state.wallets).toEqual([]);
      expect(state.selectedWalletId).toBeNull();
      expect(state.error).toBeNull();
      expect(state.usbPath).toBeNull();
    });
  });
});

describe('dashboardStore - computed selectors', () => {
  beforeEach(() => {
    useDashboardStore.getState().reset();
  });

  describe('useSelectedWallet', () => {
    it('returns null when no wallet selected', () => {
      const { result } = renderHook(() => useSelectedWallet());
      expect(result.current).toBeNull();
    });

    it('returns null when selected ID does not match any wallet', () => {
      useDashboardStore.setState({
        wallets: [makeWallet('w1', 'Wallet 1')],
        selectedWalletId: 'nonexistent',
      });
      const { result } = renderHook(() => useSelectedWallet());
      expect(result.current).toBeNull();
    });

    it('returns the selected wallet', () => {
      const wallet = makeWallet('w1', 'Wallet 1');
      useDashboardStore.setState({
        wallets: [wallet, makeWallet('w2', 'Wallet 2')],
        selectedWalletId: 'w1',
      });
      const { result } = renderHook(() => useSelectedWallet());
      expect(result.current).not.toBeNull();
      expect(result.current!.id).toBe('w1');
      expect(result.current!.name).toBe('Wallet 1');
    });
  });

  describe('useFilteredAddresses', () => {
    const btcAddr = makeAddress('BTC', Category.BASE, 'Bitcoin');
    const ethAddr = makeAddress('ETH', Category.BASE, 'Ethereum');
    const solAddr: Address = {
      ...makeAddress('SOL', Category.SPECIALIZED, 'Solana'),
      key_type: KeyType.ED25519,
    };
    const testAddr: Address = {
      ...makeAddress('tBTC', Category.BASE, 'Testnet Bitcoin'),
      is_testnet: true,
    };

    it('returns all addresses when no filter and no search', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, ethAddr, solAddr],
        filter: {},
        searchQuery: '',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(3);
    });

    it('filters by category', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, ethAddr, solAddr],
        filter: { category: Category.BASE },
        searchQuery: '',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(2);
      expect(result.current.every(a => a.category === Category.BASE)).toBe(true);
    });

    it('filters by key_type', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, ethAddr, solAddr],
        filter: { key_type: KeyType.ED25519 },
        searchQuery: '',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].symbol).toBe('SOL');
    });

    it('filters by testnet_only', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, testAddr],
        filter: { testnet_only: true },
        searchQuery: '',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].symbol).toBe('tBTC');
    });

    it('filters by search query on symbol', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, ethAddr, solAddr],
        filter: {},
        searchQuery: 'btc',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].symbol).toBe('BTC');
    });

    it('filters by search query on name', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, ethAddr, solAddr],
        filter: {},
        searchQuery: 'ethereum',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('Ethereum');
    });

    it('combines category filter with search query', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, ethAddr, solAddr],
        filter: { category: Category.BASE },
        searchQuery: 'bit',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].symbol).toBe('BTC');
    });

    it('returns empty when search matches nothing', () => {
      useDashboardStore.setState({
        addresses: [btcAddr, ethAddr],
        filter: {},
        searchQuery: 'zzz',
      });
      const { result } = renderHook(() => useFilteredAddresses());
      expect(result.current).toHaveLength(0);
    });
  });

  describe('useAddressCounts', () => {
    it('counts addresses by category', () => {
      useDashboardStore.setState({
        addresses: [
          makeAddress('BTC', Category.BASE),
          makeAddress('ETH', Category.BASE),
          makeAddress('SOL', Category.SPECIALIZED),
          makeAddress('ATOM', Category.COSMOS),
        ],
      });
      const { result } = renderHook(() => useAddressCounts());
      expect(result.current[Category.BASE]).toBe(2);
      expect(result.current[Category.SPECIALIZED]).toBe(1);
      expect(result.current[Category.COSMOS]).toBe(1);
      expect(result.current[Category.LAYER2]).toBe(0);
      expect(result.current[Category.REGIONAL]).toBe(0);
      expect(result.current[Category.ALT_EVM]).toBe(0);
    });

    it('returns all zeros with no addresses', () => {
      useDashboardStore.setState({ addresses: [] });
      const { result } = renderHook(() => useAddressCounts());
      Object.values(result.current).forEach(count => {
        expect(count).toBe(0);
      });
    });
  });

  describe('useHasWallets', () => {
    it('returns false when no wallets', () => {
      const { result } = renderHook(() => useHasWallets());
      expect(result.current).toBe(false);
    });

    it('returns true when wallets exist', () => {
      useDashboardStore.setState({ wallets: [makeWallet('w1', 'W1')] });
      const { result } = renderHook(() => useHasWallets());
      expect(result.current).toBe(true);
    });
  });

  describe('useHasAddresses', () => {
    it('returns false when no addresses', () => {
      const { result } = renderHook(() => useHasAddresses());
      expect(result.current).toBe(false);
    });

    it('returns true when addresses exist', () => {
      useDashboardStore.setState({
        addresses: [makeAddress('BTC', Category.BASE)],
      });
      const { result } = renderHook(() => useHasAddresses());
      expect(result.current).toBe(true);
    });
  });

  describe('useMembershipStatus', () => {
    it('returns default membership state', () => {
      const { result } = renderHook(() => useMembershipStatus());
      expect(result.current.isPro).toBe(false);
      expect(result.current.nftCount).toBe(0);
    });

    it('reflects updated membership', () => {
      useDashboardStore.getState().setMembership({ isPro: true, nftCount: 5 });
      const { result } = renderHook(() => useMembershipStatus());
      expect(result.current.isPro).toBe(true);
      expect(result.current.nftCount).toBe(5);
    });
  });

  describe('useIsPro', () => {
    it('returns false by default', () => {
      const { result } = renderHook(() => useIsPro());
      expect(result.current).toBe(false);
    });

    it('returns true when membership is Pro', () => {
      useDashboardStore.getState().setMembership({ isPro: true });
      const { result } = renderHook(() => useIsPro());
      expect(result.current).toBe(true);
    });
  });

  describe('useCanCreateWallet (selector)', () => {
    it('returns true when under limit', () => {
      useDashboardStore.getState().setMembership({ walletLimit: 3 });
      const { result } = renderHook(() => useCanCreateWallet());
      expect(result.current).toBe(true);
    });

    it('returns false when at limit', () => {
      useDashboardStore.getState().setWallets([
        makeWallet('w1', 'W1'),
        makeWallet('w2', 'W2'),
        makeWallet('w3', 'W3'),
      ]);
      useDashboardStore.getState().setMembership({ walletLimit: 3 });
      const { result } = renderHook(() => useCanCreateWallet());
      expect(result.current).toBe(false);
    });
  });

  describe('useWalletLimitInfo', () => {
    it('returns correct wallet limit info', () => {
      useDashboardStore.getState().setWallets([makeWallet('w1', 'W1')]);
      useDashboardStore.getState().setMembership({ isPro: true, walletLimit: 7 });

      const { result } = renderHook(() => useWalletLimitInfo());
      expect(result.current.current).toBe(1);
      expect(result.current.limit).toBe(7);
      expect(result.current.isPro).toBe(true);
      expect(result.current.canCreate).toBe(true);
    });

    it('canCreate is false when at limit', () => {
      useDashboardStore.getState().setWallets([makeWallet('w1', 'W1'), makeWallet('w2', 'W2')]);
      useDashboardStore.getState().setMembership({ walletLimit: 2 });

      const { result } = renderHook(() => useWalletLimitInfo());
      expect(result.current.canCreate).toBe(false);
    });
  });

  describe('useAddressNftCounts', () => {
    it('returns empty array by default', () => {
      const { result } = renderHook(() => useAddressNftCounts());
      expect(result.current).toEqual([]);
    });

    it('returns address NFT counts when set', () => {
      useDashboardStore.getState().setMembership({
        addressNftCounts: [
          { address: '0x1', nftCount: 2, boundCount: 1, tokens: [] },
        ],
      });
      const { result } = renderHook(() => useAddressNftCounts());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].nftCount).toBe(2);
    });
  });

  describe('useLockedWalletIds', () => {
    it('returns empty array by default', () => {
      const { result } = renderHook(() => useLockedWalletIds());
      expect(result.current).toEqual([]);
    });

    it('returns locked IDs when set', () => {
      useDashboardStore.getState().setMembership({
        lockedWalletIds: ['w2', 'w3'],
      });
      const { result } = renderHook(() => useLockedWalletIds());
      expect(result.current).toEqual(['w2', 'w3']);
    });
  });

  describe('useIsWalletLocked', () => {
    it('returns false for unlocked wallet', () => {
      useDashboardStore.getState().setMembership({ lockedWalletIds: ['w2'] });
      const { result } = renderHook(() => useIsWalletLocked('w1'));
      expect(result.current).toBe(false);
    });

    it('returns true for locked wallet', () => {
      useDashboardStore.getState().setMembership({ lockedWalletIds: ['w1', 'w2'] });
      const { result } = renderHook(() => useIsWalletLocked('w1'));
      expect(result.current).toBe(true);
    });
  });
});
