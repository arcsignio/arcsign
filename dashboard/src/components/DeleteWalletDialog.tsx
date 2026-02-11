/**
 * Delete Wallet Confirmation Dialog
 * Shows warning and requires password confirmation before deleting a wallet
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{t('deleteWallet.title')}
        </h2>

        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800 font-semibold mb-2">
            {t('deleteWallet.warningCannotUndo')}
          </p>
          <p className="text-sm text-red-700 mb-2">
            {t('deleteWallet.aboutToDelete')}
          </p>
          <p className="text-sm font-mono bg-white px-3 py-2 rounded border border-red-300">
            {wallet.name}
          </p>
          <p className="text-xs text-red-600 mt-2">{t('deleteWallet.id')}: {wallet.id}</p>
        </div>

        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-md">
          <p className="text-sm text-yellow-900 font-semibold mb-2">
            📝 {t('deleteWallet.beforeDeleting')}
          </p>
          <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
            <li>{t('deleteWallet.backupMnemonic')}</li>
            <li>{t('deleteWallet.verifyNoAssets')}</li>
            <li>{t('deleteWallet.dataWillBeDeleted')}</li>
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
              {t('deleteWallet.enterPassword')}
            </label>
            <input
              type="password"
              id="delete-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('deleteWallet.passwordPlaceholder')}
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
              {t('deleteWallet.typeToConfirm')} <span className="font-mono font-bold">DELETE</span> {t('deleteWallet.toConfirm')}
            </label>
            <input
              type="text"
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={t('deleteWallet.typePlaceholder')}
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
              {t('actions.cancel')}
            </button>
            <button
              type="submit"
              disabled={!canDelete || isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isDeleting ? t('deleteWallet.deleting') : t('deleteWallet.deleteButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
