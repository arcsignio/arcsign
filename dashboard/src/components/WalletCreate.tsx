/**
 * Wallet creation form component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T034, T035, T042 - WalletCreate component with form validation and error handling
 * Generated: 2025-10-17
 * Updated: Force reload to use snake_case API parameters
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoke } from '@tauri-apps/api';
import { walletCreateSchema, type WalletCreateFormData } from '@/validation/password';
import { useDashboardStore } from '@/stores/dashboardStore';
import tauriApi, { type UsbDevice, type AppError } from '@/services/tauri-api';
import type { WalletCreateResponse } from '@/types/wallet';
import { MnemonicDisplay } from './MnemonicDisplay';
import { ConfirmationDialog } from './ConfirmationDialog';

interface WalletCreateProps {
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function WalletCreate({ onCancel, onSuccess }: WalletCreateProps = {}) {
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [isLoadingUsb, setIsLoadingUsb] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdWallet, setCreatedWallet] = useState<{
    wallet: any;
    mnemonic: string;
  } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { addWallet } = useDashboardStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
  } = useForm<WalletCreateFormData>({
    resolver: zodResolver(walletCreateSchema),
    mode: 'onChange',
  });

  // Load USB devices on mount
  useEffect(() => {
    const loadUsbDevices = async () => {
      try {
        const devices = await tauriApi.detectUsb();
        setUsbDevices(devices);

        // Auto-select if only one USB device
        if (devices.length === 1) {
          setValue('usbPath', devices[0].path, { shouldValidate: true });
        }
      } catch (err) {
        const error = err as AppError;
        setError(error.message || 'Failed to detect USB devices');
      } finally {
        setIsLoadingUsb(false);
      }
    };

    loadUsbDevices();
  }, [setValue]);

  const onSubmit = async (data: WalletCreateFormData) => {
    setIsCreating(true);
    setError(null);

    try {
      console.log('Creating wallet with params:', {
        password: '***',
        usbPath: data.usbPath,
        name: data.walletName || undefined,
        passphrase: data.passphrase ? '***' : undefined,
        mnemonicLength: data.mnemonicLength,
      });

      // Direct invoke call - using camelCase to match Rust function parameters
      const response = await invoke<WalletCreateResponse>('create_wallet', {
        password: data.password,
        usbPath: data.usbPath,
        name: data.walletName || undefined,
        passphrase: data.passphrase || undefined,
        mnemonicLength: data.mnemonicLength,
      });

      console.log('Wallet created successfully:', response.wallet.id);

      // Set created wallet for mnemonic display
      setCreatedWallet(response);

      // Add to dashboard store
      addWallet(response.wallet);
    } catch (err) {
      console.error('Error creating wallet:', err);
      console.error('Error type:', typeof err);
      console.error('Error details:', JSON.stringify(err, null, 2));

      const error = err as AppError;
      const errorMessage = error.message || (typeof err === 'string' ? err : 'Failed to create wallet');
      console.error('Display error message:', errorMessage);

      setError(errorMessage);
      setIsCreating(false);
    }
  };

  const handleMnemonicConfirm = () => {
    // Navigate back to dashboard or wallet list
    setCreatedWallet(null);
    setIsCreating(false);

    // Call onSuccess callback if provided
    if (onSuccess) {
      onSuccess();
    } else if (onCancel) {
      // Fallback to onCancel if onSuccess not provided
      onCancel();
    }
  };

  // Handle cancel button click (T093, FR-032)
  const handleCancelClick = () => {
    if (isDirty) {
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

  const cancelCancel = () => {
    setShowCancelConfirm(false);
  };

  // Show mnemonic display if wallet was created
  if (createdWallet) {
    return (
      <MnemonicDisplay
        mnemonic={createdWallet.mnemonic}
        onConfirm={handleMnemonicConfirm}
      />
    );
  }

  return (
    <div className="wallet-create">
      <h2>Create New Wallet</h2>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* USB Drive Selection */}
        <div className="form-group">
          <label htmlFor="usbPath">USB Drive *</label>
          {isLoadingUsb ? (
            <p>Detecting USB drives...</p>
          ) : usbDevices.length === 0 ? (
            <p className="error">No USB drives detected. Please insert a USB drive.</p>
          ) : (
            <select id="usbPath" {...register('usbPath')}>
              <option value="">Select USB drive</option>
              {usbDevices.map((device) => (
                <option key={device.path} value={device.path}>
                  {device.name} ({device.path}) - {Math.round(device.available_space / 1024 / 1024)}MB free
                </option>
              ))}
            </select>
          )}
          {errors.usbPath && <span className="error">{errors.usbPath.message}</span>}
        </div>

        {/* Wallet Name */}
        <div className="form-group">
          <label htmlFor="walletName">Wallet Name (Optional)</label>
          <input
            id="walletName"
            type="text"
            placeholder="My Wallet"
            {...register('walletName')}
          />
          {errors.walletName && <span className="error">{errors.walletName.message}</span>}
        </div>

        {/* Password */}
        <div className="form-group">
          <label htmlFor="password">Password *</label>
          <input
            id="password"
            type="password"
            placeholder="At least 12 characters"
            {...register('password')}
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
          <small>Must contain uppercase, lowercase, and number</small>
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password *</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder="Re-enter password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <span className="error">{errors.confirmPassword.message}</span>
          )}
        </div>

        {/* BIP39 Passphrase (Optional) */}
        <div className="form-group">
          <label htmlFor="passphrase">BIP39 Passphrase (Optional - 25th word)</label>
          <input
            id="passphrase"
            type="password"
            placeholder="Leave empty if not using passphrase"
            {...register('passphrase')}
          />
          <small>Advanced feature: Adds an extra word to your mnemonic for additional security</small>
        </div>

        {/* Mnemonic Length */}
        <div className="form-group">
          <label htmlFor="mnemonicLength">Mnemonic Length</label>
          <select id="mnemonicLength" {...register('mnemonicLength')}>
            <option value={24}>24 words (Recommended)</option>
            <option value={12}>12 words</option>
          </select>
        </div>

        {/* Debug Info - Remove after fixing */}
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
          <strong>Debug Info:</strong>
          <div>isValid: {isValid ? '✅ true' : '❌ false'}</div>
          <div>isDirty: {isDirty ? '✅ true' : '❌ false'}</div>
          <div>isCreating: {isCreating ? '❌ true' : '✅ false'}</div>
          <div>usbDevices.length: {usbDevices.length}</div>
          <div>Form Values:</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            usbPath: {watch('usbPath') || '(empty)'}
            password: {watch('password') ? '***' + watch('password').substring(watch('password').length - 3) : '(empty)'}
            confirmPassword: {watch('confirmPassword') ? '***' + watch('confirmPassword').substring(watch('confirmPassword').length - 3) : '(empty)'}
            walletName: {watch('walletName') || '(empty)'}
            passphrase: {watch('passphrase') ? '***' : '(empty)'}
            mnemonicLength: {watch('mnemonicLength')}
          </pre>
          <div>Has Errors: {Object.keys(errors).length > 0 ? '❌ YES' : '✅ NO'}</div>
          {Object.keys(errors).length > 0 && (
            <div>Error Fields: {Object.keys(errors).join(', ')}</div>
          )}
        </div>

        {/* Action Buttons (T093, FR-032) */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={!isValid || isCreating || usbDevices.length === 0}
            className="primary-button"
          >
            {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isCreating}
              className="secondary-button"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Security Notice */}
      <div className="security-notice">
        <strong>Security Notice:</strong>
        <ul>
          <li>Your wallet will be encrypted with your password</li>
          <li>You will receive a mnemonic phrase - write it down and keep it safe</li>
          <li>Without your mnemonic, you cannot recover your wallet</li>
        </ul>
      </div>

      {/* Cancellation Confirmation Dialog (T093, FR-032) */}
      <ConfirmationDialog
        isOpen={showCancelConfirm}
        title="Discard Wallet Creation?"
        message="You have unsaved changes. Are you sure you want to cancel? All entered information will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Continue Editing"
        confirmVariant="danger"
        onConfirm={confirmCancel}
        onCancel={cancelCancel}
      />
    </div>
  );
}
