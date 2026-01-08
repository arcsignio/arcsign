/**
 * WalletImport Component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T070-T074 - Wallet import UI with mnemonic validation
 * Generated: 2025-10-17
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  walletImportSchema,
  type WalletImportFormData,
  normalizeMnemonic,
} from "@/validation/mnemonic";
import tauriApi, { type AppError } from "@/services/tauri-api";
import { useDashboardStore, useWalletLimitInfo } from "@/stores/dashboardStore";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface WalletImportProps {
  usbPath: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * WalletImport component for importing existing wallets from mnemonic
 * Requirements: FR-006 (BIP39 import), FR-029 (validation), FR-031 (duplicate detection)
 */
export const WalletImport: React.FC<WalletImportProps> = ({
  usbPath,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [mnemonicValue, setMnemonicValue] = useState("");

  const { addWallet } = useDashboardStore();
  const walletLimitInfo = useWalletLimitInfo();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<WalletImportFormData>({
    resolver: zodResolver(walletImportSchema),
    mode: "onBlur",
  });

  const usePassphrase = watch("usePassphrase", false);

  /**
   * Handle mnemonic input change with normalization (FR-030)
   */
  const handleMnemonicChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMnemonicValue(value);
    setValue("mnemonic", value);
  };

  /**
   * Handle mnemonic blur with validation (FR-029)
   */
  const handleMnemonicBlur = () => {
    if (mnemonicValue) {
      const normalized = normalizeMnemonic(mnemonicValue);
      setMnemonicValue(normalized);
      setValue("mnemonic", normalized);
    }
  };

  /**
   * Handle form submission
   */
  const onSubmit = async (data: WalletImportFormData) => {
    // Check wallet limit before importing
    if (!walletLimitInfo.canCreate) {
      setShowUpgradePrompt(true);
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const response = await tauriApi.importWallet({
        mnemonic: data.mnemonic,
        password: data.password,
        usb_path: usbPath,
        passphrase: data.usePassphrase ? data.passphrase : undefined,
        name: data.name,
      });

      // Check for duplicate wallet (FR-031)
      if (response.is_duplicate) {
        setShowDuplicateDialog(true);
        return;
      }

      // Success: add wallet to store
      addWallet(response.wallet);

      // Clear sensitive data
      setMnemonicValue("");
      setValue("mnemonic", "");
      setValue("password", "");
      setValue("confirmPassword", "");
      setValue("passphrase", "");

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const error = err as AppError;

      // Handle duplicate wallet error (FR-031)
      if (error.code === "WALLET_ALREADY_EXISTS") {
        setShowDuplicateDialog(true);
      } else {
        setImportError(
          error.message || t('wallet.importFailed')
        );
      }
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Handle duplicate wallet dialog - cancel
   */
  const handleCancelDuplicate = () => {
    setShowDuplicateDialog(false);
    setIsImporting(false);
  };

  /**
   * Handle duplicate wallet dialog - overwrite
   * Note: Requires backend support for force import
   */
  const handleOverwriteDuplicate = async () => {
    setShowDuplicateDialog(false);
    setImportError(t('wallet.overwriteNotImplemented'));
    // TODO: Implement force import with overwrite flag
  };

  /**
   * Handle cancel button click (T093, FR-032)
   */
  const handleCancelClick = () => {
    if (isDirty || mnemonicValue.trim()) {
      // Show confirmation if form has unsaved changes
      setShowCancelConfirm(true);
    } else {
      // Navigate back immediately if no changes
      if (onCancel) {
        onCancel();
      }
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    if (onCancel) {
      onCancel();
    }
  };

  const cancelCancelAction = () => {
    setShowCancelConfirm(false);
  };

  return (
    <div className="wallet-import">
      <h2 className="text-2xl font-semibold mb-6">{t('wallet.importWallet')}</h2>

      {/* Wallet Limit Info */}
      <div style={{
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        borderRadius: '8px',
        backgroundColor: walletLimitInfo.canCreate ? '#e8f5e9' : '#fff3e0',
        border: `1px solid ${walletLimitInfo.canCreate ? '#4caf50' : '#ff9800'}`,
        fontSize: '0.9rem'
      }}>
        <span style={{ fontWeight: 500 }}>
          {walletLimitInfo.canCreate
            ? t('wallet.walletsCount', { current: walletLimitInfo.current, limit: walletLimitInfo.limit, tier: walletLimitInfo.isPro ? t('membership.pro') : t('membership.free') })
            : t('wallet.limitReachedCount', { current: walletLimitInfo.current, limit: walletLimitInfo.limit })
          }
        </span>
        {!walletLimitInfo.canCreate && (
          <button
            type="button"
            onClick={() => setShowUpgradePrompt(true)}
            style={{
              marginLeft: '1rem',
              padding: '0.25rem 0.75rem',
              backgroundColor: '#f0b90b',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {walletLimitInfo.isPro ? t('membership.getMoreNfts') : t('actions.upgrade')}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Mnemonic Input (T071, T072) */}
        <div>
          <label
            htmlFor="mnemonic"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t('mnemonic.recoveryPhrase')} *
          </label>
          <textarea
            id="mnemonic"
            {...register("mnemonic")}
            value={mnemonicValue}
            onChange={handleMnemonicChange}
            onBlur={handleMnemonicBlur}
            rows={3}
            className={`w-full px-4 py-3 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 ${
              errors.mnemonic
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            }`}
            placeholder={t('mnemonic.enterRecoveryPhrase')}
            disabled={isImporting}
          />
          {errors.mnemonic && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {errors.mnemonic.message}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {t('mnemonic.enterBip39Hint')}
          </p>
        </div>

        {/* Password Fields */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t('security.walletPassword')} *
          </label>
          <input
            type="password"
            id="password"
            {...register("password")}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.password
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            }`}
            placeholder={t('security.enterStrongPassword')}
            disabled={isImporting}
          />
          {errors.password && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t('security.confirmPassword')} *
          </label>
          <input
            type="password"
            id="confirmPassword"
            {...register("confirmPassword")}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.confirmPassword
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            }`}
            placeholder={t('security.reenterPassword')}
            disabled={isImporting}
          />
          {errors.confirmPassword && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Optional BIP39 Passphrase (T074) */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="usePassphrase"
              {...register("usePassphrase")}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={isImporting}
            />
            <label
              htmlFor="usePassphrase"
              className="ml-2 block text-sm text-gray-700"
            >
              {t('security.useBip39Passphrase')}
            </label>
          </div>

          {usePassphrase && (
            <div>
              <label
                htmlFor="passphrase"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t('security.passphrase')}
              </label>
              <input
                type="password"
                id="passphrase"
                {...register("passphrase")}
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  errors.passphrase
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:ring-blue-500"
                }`}
                placeholder={t('security.enterBip39Passphrase')}
                disabled={isImporting}
              />
              {errors.passphrase && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {errors.passphrase.message}
                </p>
              )}
              <p className="mt-2 text-xs text-yellow-600">
                {t('security.passphraseImportWarning')}
              </p>
            </div>
          )}
        </div>

        {/* Wallet Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t('wallet.walletName')}
          </label>
          <input
            type="text"
            id="name"
            {...register("name")}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              errors.name
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            }`}
            placeholder={t('wallet.myMainWallet')}
            disabled={isImporting}
            maxLength={50}
          />
          {errors.name && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Error Message */}
        {importError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{importError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isImporting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isImporting ? t('wallet.importing') : t('wallet.importWallet')}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isImporting}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      {/* Duplicate Wallet Warning Dialog (T073) */}
      {showDuplicateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-yellow-600 mb-4">
              {t('wallet.duplicateWalletTitle')}
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              {t('wallet.duplicateWalletMessage')}
            </p>
            <p className="text-sm text-gray-700 mb-6">
              {t('wallet.duplicateWalletConfirm')}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDuplicate}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleOverwriteDuplicate}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                {t('wallet.overwrite')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog (T093, FR-032) */}
      <ConfirmationDialog
        isOpen={showCancelConfirm}
        title={t('wallet.discardImport')}
        message={t('wallet.discardImportMessage')}
        confirmLabel={t('wallet.discardChanges')}
        cancelLabel={t('wallet.continueEditing')}
        confirmVariant="danger"
        onConfirm={confirmCancel}
        onCancel={cancelCancelAction}
      />

      {/* Upgrade to Pro Prompt Dialog */}
      <ConfirmationDialog
        isOpen={showUpgradePrompt}
        title={t('wallet.walletLimitReached')}
        message={t('wallet.upgradePromptMessage', {
          current: walletLimitInfo.current,
          limit: walletLimitInfo.limit,
          suggestion: walletLimitInfo.isPro ? t('wallet.purchaseMoreNfts') : t('wallet.upgradeToPro')
        })}
        confirmLabel={t('actions.learnMore')}
        cancelLabel={t('actions.close')}
        confirmVariant="primary"
        onConfirm={() => {
          setShowUpgradePrompt(false);
          window.open('https://arcsign.io/mint', '_blank');
        }}
        onCancel={() => setShowUpgradePrompt(false)}
      />
    </div>
  );
};

export default WalletImport;
