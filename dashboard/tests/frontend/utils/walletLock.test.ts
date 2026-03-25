/**
 * Tests for src/utils/walletLock.ts
 * Verifies wallet/address lock status checking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from '@/stores/dashboardStore';
import {
  isWalletLocked,
  isAddressLocked,
  getWalletIdByAddress,
} from '@/utils/walletLock';

describe('walletLock utility', () => {
  beforeEach(() => {
    // Reset the store to clean state
    useDashboardStore.getState().reset();
  });

  // ==========================================================================
  // isWalletLocked
  // ==========================================================================
  describe('isWalletLocked', () => {
    it('returns false when no wallets are locked', () => {
      expect(isWalletLocked('wallet-1')).toBe(false);
    });

    it('returns true when wallet ID is in lockedWalletIds', () => {
      useDashboardStore.setState({
        membership: {
          ...useDashboardStore.getState().membership,
          lockedWalletIds: ['wallet-1', 'wallet-2'],
        },
      });

      expect(isWalletLocked('wallet-1')).toBe(true);
      expect(isWalletLocked('wallet-2')).toBe(true);
    });

    it('returns false when wallet ID is not in lockedWalletIds', () => {
      useDashboardStore.setState({
        membership: {
          ...useDashboardStore.getState().membership,
          lockedWalletIds: ['wallet-1'],
        },
      });

      expect(isWalletLocked('wallet-3')).toBe(false);
    });
  });

  // ==========================================================================
  // isAddressLocked
  // ==========================================================================
  describe('isAddressLocked', () => {
    it('returns false when wallet for address is not found', () => {
      expect(isAddressLocked('0xunknown')).toBe(false);
    });

    it('returns true when wallet containing the address is locked', () => {
      useDashboardStore.setState({
        wallets: [
          {
            id: 'wallet-1',
            name: 'Test Wallet',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            has_passphrase: false,
            address_count: 1,
            addresses: [
              {
                wallet_id: 'wallet-1',
                rank: 1,
                symbol: 'ETH',
                name: 'Ethereum',
                coin_type: 60,
                derivation_path: "m/44'/60'/0'/0/0",
                address: '0xABC123',
                category: 'EVM Mainnet',
                key_type: 'secp256k1',
              },
            ],
          },
        ] as any,
        membership: {
          ...useDashboardStore.getState().membership,
          lockedWalletIds: ['wallet-1'],
        },
      });

      // Case-insensitive match
      expect(isAddressLocked('0xabc123')).toBe(true);
    });

    it('returns false when wallet containing the address is not locked', () => {
      useDashboardStore.setState({
        wallets: [
          {
            id: 'wallet-1',
            name: 'Test Wallet',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            has_passphrase: false,
            address_count: 1,
            addresses: [
              {
                wallet_id: 'wallet-1',
                rank: 1,
                symbol: 'ETH',
                name: 'Ethereum',
                coin_type: 60,
                derivation_path: "m/44'/60'/0'/0/0",
                address: '0xABC123',
                category: 'EVM Mainnet',
                key_type: 'secp256k1',
              },
            ],
          },
        ] as any,
        membership: {
          ...useDashboardStore.getState().membership,
          lockedWalletIds: [],
        },
      });

      expect(isAddressLocked('0xabc123')).toBe(false);
    });
  });

  // ==========================================================================
  // getWalletIdByAddress
  // ==========================================================================
  describe('getWalletIdByAddress', () => {
    it('returns null when address is not found in any wallet', () => {
      expect(getWalletIdByAddress('0xnonexistent')).toBeNull();
    });

    it('returns wallet ID when address is found (case-insensitive)', () => {
      useDashboardStore.setState({
        wallets: [
          {
            id: 'wallet-1',
            name: 'My Wallet',
            created_at: '2025-01-01',
            updated_at: '2025-01-01',
            has_passphrase: false,
            address_count: 1,
            addresses: [
              {
                wallet_id: 'wallet-1',
                rank: 1,
                symbol: 'ETH',
                name: 'Ethereum',
                coin_type: 60,
                derivation_path: "m/44'/60'/0'/0/0",
                address: '0xDEF456',
                category: 'EVM Mainnet',
                key_type: 'secp256k1',
              },
            ],
          },
        ] as any,
      });

      expect(getWalletIdByAddress('0xdef456')).toBe('wallet-1');
      expect(getWalletIdByAddress('0xDEF456')).toBe('wallet-1');
    });
  });
});
