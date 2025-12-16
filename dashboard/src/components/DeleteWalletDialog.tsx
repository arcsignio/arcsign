/**
 * Delete Wallet Confirmation Dialog
 * Shows warning and requires password confirmation before deleting a wallet
 */

import { useState } from "react";
import type { Wallet } from "@/types/wallet";

interface DeleteWalletDialogProps {
  wallet: Wallet | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

export function DeleteWalletDialog({
  wallet,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  error,
}: DeleteWalletDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  if (!isOpen || !wallet) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.toUpperCase() === "DELETE" && password) {
      await onConfirm(password);
      // Reset form on success
      if (!error) {
        setPassword("");
        setConfirmText("");
      }
    }
  };

  const canDelete =
    password.length >= 12 && confirmText.toUpperCase() === "DELETE";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-red-600 mb-4">
          ⚠️ Delete Wallet
        </h2>

        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800 font-semibold mb-2">
            Warning: This action cannot be undone!
          </p>
          <p className="text-sm text-red-700 mb-2">
            You are about to permanently delete:
          </p>
          <p className="text-sm font-mono bg-white px-3 py-2 rounded border border-red-300">
            {wallet.name}
          </p>
          <p className="text-xs text-red-600 mt-2">ID: {wallet.id}</p>
        </div>

        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-md">
          <p className="text-sm text-yellow-900 font-semibold mb-2">
            📝 Before deleting:
          </p>
          <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
            <li>Make sure you have backed up your mnemonic phrase</li>
            <li>Verify you don't have any assets in this wallet</li>
            <li>All wallet data will be permanently deleted</li>
          </ul>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="delete-password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Enter Wallet Password
            </label>
            <input
              type="password"
              id="delete-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter wallet password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isDeleting}
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="delete-confirm"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Type <span className="font-mono font-bold">DELETE</span> to
              confirm
            </label>
            <input
              type="text"
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              disabled={isDeleting}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canDelete || isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isDeleting ? "Deleting..." : "Delete Wallet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
