/**
 * WalletSelector Component
 * Feature: User Dashboard for Wallet Management
 * Task: T083 - Create WalletSelector component
 * Generated: 2025-10-17
 */

import React, { useState } from 'react';
import type { Wallet } from '@/types/wallet';
import tauriApi, { type AppError } from '@/services/tauri-api';
import { useDashboardStore } from '@/stores/dashboardStore';

interface WalletSelectorProps {
  wallets: Wallet[];
  selectedWalletId?: string | null;
  usbPath: string;
  onSelect?: (walletId: string) => void;
  onRename?: (walletId: string, newName: string) => void;
}

/**
 * WalletSelector component for displaying and managing multiple wallets
 * Requirements: FR-016 (List wallets), FR-018 (Display metadata), FR-019 (Rename)
 */
export const WalletSelector: React.FC<WalletSelectorProps> = ({
  wallets,
  selectedWalletId,
  usbPath,
  onSelect,
  onRename,
}) => {
  const [renamingWalletId, setRenamingWalletId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const { updateWallet } = useDashboardStore();

  /**
   * Handle wallet selection
   */
  const handleSelect = (walletId: string) => {
    if (onSelect) {
      onSelect(walletId);
    }
  };

  /**
   * Start renaming a wallet
   */
  const startRename = (wallet: Wallet) => {
    setRenamingWalletId(wallet.id);
    setNewName(wallet.name);
    setRenameError(null);
  };

  /**
   * Cancel rename operation
   */
  const cancelRename = () => {
    setRenamingWalletId(null);
    setNewName('');
    setRenameError(null);
  };

  /**
   * Submit rename operation
   */
  const submitRename = async (walletId: string) => {
    if (!newName.trim()) {
      setRenameError('Wallet name cannot be empty');
      return;
    }

    if (newName.trim().length > 50) {
      setRenameError('Wallet name must be 50 characters or less');
      return;
    }

    setIsRenaming(true);
    setRenameError(null);

    try {
      const updatedWallet = await tauriApi.renameWallet({
        wallet_id: walletId,
        new_name: newName.trim(),
        usb_path: usbPath,
      });

      // Update local store
      updateWallet(walletId, {
        name: updatedWallet.name,
        updated_at: updatedWallet.updated_at,
      });

      // Call parent callback if provided
      if (onRename) {
        onRename(walletId, updatedWallet.name);
      }

      // Close rename dialog
      setRenamingWalletId(null);
      setNewName('');
    } catch (err) {
      const error = err as AppError;
      setRenameError(error.message || 'Failed to rename wallet');
    } finally {
      setIsRenaming(false);
    }
  };

  /**
   * Format date for display
   */
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Empty state
  if (wallets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No wallets found on this USB drive.</p>
        <p className="text-sm text-gray-500 mt-2">Create or import a wallet to get started.</p>
      </div>
    );
  }

  // Wallet limit warning (A-005)
  const walletLimitWarning = wallets.length >= 9 ? (
    <div className={`p-3 mb-4 rounded-md ${wallets.length >= 10 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
      <p className={`text-sm ${wallets.length >= 10 ? 'text-red-800' : 'text-yellow-800'}`}>
        {wallets.length >= 10
          ? '⚠️ Maximum wallet limit reached (10 wallets). Please delete a wallet before creating a new one.'
          : `⚠️ Approaching wallet limit: ${wallets.length} of 10 wallets created.`}
      </p>
    </div>
  ) : null;

  return (
    <div className="wallet-selector">
      {walletLimitWarning}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`wallet-card border rounded-lg p-4 cursor-pointer transition-all ${
              selectedWalletId === wallet.id
                ? 'border-blue-500 bg-blue-50 selected'
                : 'border-gray-300 hover:border-gray-400 hover:shadow-md'
            }`}
            onClick={() => handleSelect(wallet.id)}
            data-testid="wallet-card"
          >
            {/* Wallet Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                {renamingWalletId === wallet.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          submitRename(wallet.id);
                        } else if (e.key === 'Escape') {
                          cancelRename();
                        }
                      }}
                      className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={50}
                      autoFocus
                      disabled={isRenaming}
                    />
                    {renameError && (
                      <p className="text-xs text-red-600">{renameError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitRename(wallet.id)}
                        disabled={isRenaming}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isRenaming ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelRename}
                        disabled={isRenaming}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <h3 className="text-lg font-semibold text-gray-900 truncate" title={wallet.name}>
                    {wallet.name}
                  </h3>
                )}
              </div>

              {renamingWalletId !== wallet.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(wallet);
                  }}
                  className="ml-2 p-1 text-gray-500 hover:text-blue-600 rounded hover:bg-gray-100 transition-colors"
                  title="Rename wallet"
                  aria-label="Rename"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Wallet Metadata (FR-018) */}
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Created:</span>
                <span className="font-medium">{formatDate(wallet.created_at)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span>Addresses:</span>
                <span className="font-medium">{wallet.address_count}</span>
              </div>

              {wallet.has_passphrase && (
                <div className="flex items-center gap-1 text-xs text-purple-600 mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Protected with Passphrase</span>
                </div>
              )}
            </div>

            {/* Wallet ID (truncated) */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-400 font-mono truncate" title={wallet.id}>
                ID: {wallet.id.substring(0, 16)}...
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WalletSelector;
