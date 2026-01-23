/**
 * Wallet Lock Utility Functions
 * Feature: Check if wallet/address is locked due to membership limit
 *
 * Used by:
 * - WalletConnect signing methods (eth_sendTransaction, personal_sign, eth_signTypedData_v4)
 * - Send/Swap/Staking UI components
 * - WalletDetail action buttons
 */

import { useDashboardStore } from '@/stores/dashboardStore';

/**
 * Check if a wallet is locked by its ID
 * @param walletId - The wallet ID to check
 * @returns true if the wallet is locked
 */
export function isWalletLocked(walletId: string): boolean {
  const lockedIds = useDashboardStore.getState().membership.lockedWalletIds;
  return lockedIds.includes(walletId);
}

/**
 * Find wallet by address and check if it's locked
 * Used by WalletConnect methods which receive address, not walletId
 * @param address - The wallet address to check (case-insensitive)
 * @returns true if the wallet containing this address is locked
 */
export function isAddressLocked(address: string): boolean {
  const state = useDashboardStore.getState();
  const normalizedAddress = address.toLowerCase();

  // Find wallet that contains this address
  const wallet = state.wallets.find(w =>
    w.addresses?.some(a => a.address.toLowerCase() === normalizedAddress)
  );

  if (!wallet) {
    // If wallet not found, we can't determine lock status
    // Return false to allow the operation (backend will check again)
    console.warn(`[walletLock] Wallet not found for address: ${address}`);
    return false;
  }

  return state.membership.lockedWalletIds.includes(wallet.id);
}

/**
 * Get the wallet ID for a given address
 * @param address - The wallet address to look up
 * @returns The wallet ID or null if not found
 */
export function getWalletIdByAddress(address: string): string | null {
  const state = useDashboardStore.getState();
  const normalizedAddress = address.toLowerCase();

  const wallet = state.wallets.find(w =>
    w.addresses?.some(a => a.address.toLowerCase() === normalizedAddress)
  );

  return wallet?.id ?? null;
}
