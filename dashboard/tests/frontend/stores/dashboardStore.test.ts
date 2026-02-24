import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from '@/stores/dashboardStore';
import { Category } from '@/types/address';
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
