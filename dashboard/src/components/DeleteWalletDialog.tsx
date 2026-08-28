/**
 * Delete Wallet Confirmation Dialog
 * Shows warning and requires password confirmation before deleting a wallet
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Wallet } from "@/types/wallet";
import { PasswordInput } from "@/components/PasswordInput";

interface DeleteWalletDialogProps {
  wallet: Wallet | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  /**
   * Delete using the app password, for a wallet whose own password is lost.
   * The confirmation string here is the wallet NAME, not "DELETE" — the
   * backend compares it against stored data, so it has to be the real name.
   */
  onForceConfirm: (appPassword: string, confirmName: string) => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

export function DeleteWalletDialog({
  wallet,
  isOpen,
  onClose,
  onConfirm,
  onForceConfirm,
  isDeleting,
  error,
}: DeleteWalletDialogProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [forceMode, setForceMode] = useState(false);

  if (!isOpen || !wallet) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;

    if (forceMode) {
      await onForceConfirm(password, confirmText);
    } else {
      await onConfirm(password);
    }
    // Reset form on success
    if (!error) {
      setPassword("");
      setConfirmText("");
    }
  };

  // Switching modes clears both fields: the confirmation string means
  // something different in each ("DELETE" vs the wallet name), and a password
  // typed for one is not the password the other wants.
  const switchMode = (force: boolean) => {
    setForceMode(force);
    setPassword("");
    setConfirmText("");
  };

  // UX only. The backend re-checks the app password and the typed name, so a
  // user who bypasses this button still cannot delete the wrong wallet.
  const canDelete = forceMode
    ? password.length > 0 && confirmText === wallet.name
    : password.length >= 12 && confirmText.toUpperCase() === "DELETE";

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

        {forceMode && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-300 rounded-md">
            <p className="text-sm text-orange-900 font-semibold mb-2">
              {t('deleteWallet.forceModeTitle')}
            </p>
            <p className="text-sm text-orange-800">
              {t('deleteWallet.forceModeAssetsLost')}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="delete-password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              {forceMode
                ? t('deleteWallet.enterAppPassword')
                : t('deleteWallet.enterPassword')}
            </label>
            <PasswordInput
              id="delete-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                forceMode
                  ? t('deleteWallet.appPasswordPlaceholder')
                  : t('deleteWallet.passwordPlaceholder')
              }
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
              {forceMode ? (
                <>
                  {t('deleteWallet.typeToConfirm')}{' '}
                  <span className="font-mono font-bold">{wallet.name}</span>{' '}
                  {t('deleteWallet.toConfirm')}
                </>
              ) : (
                <>
                  {t('deleteWallet.typeToConfirm')}{' '}
                  <span className="font-mono font-bold">DELETE</span>{' '}
                  {t('deleteWallet.toConfirm')}
                </>
              )}
            </label>
            <input
              type="text"
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={
                forceMode ? wallet.name : t('deleteWallet.typePlaceholder')
              }
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

          {/* The way out of a forgotten wallet password. Offered only after the
              user is already here, so the normal password path stays the
              obvious one and nobody reaches for the app password by default. */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => switchMode(!forceMode)}
              disabled={isDeleting}
              className="text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {forceMode
                ? t('deleteWallet.useWalletPassword')
                : t('deleteWallet.forgotPassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
