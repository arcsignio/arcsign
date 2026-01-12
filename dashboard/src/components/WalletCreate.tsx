/**
 * Wallet creation form component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T034, T035, T042 - WalletCreate component with form validation and error handling
 * Generated: 2025-10-17
 * Updated: Force reload to use snake_case API parameters
 */

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { invoke } from '@tauri-apps/api';
import { createWalletCreateSchema, type WalletCreateFormData } from '@/validation/password';
import { useDashboardStore, useWalletLimitInfo } from '@/stores/dashboardStore';
import tauriApi, { type UsbDevice, type AppError, type DeviceMembershipStatus } from '@/services/tauri-api';
import type { WalletCreateResponse } from '@/types/wallet';
import { MnemonicDisplay } from './MnemonicDisplay';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useSessionStore } from '@/stores/sessionStore';

interface WalletCreateProps {
  onCancel?: () => void;
  onSuccess?: () => void;
  // ✅ REMOVED: appPassword prop - use session token instead
}

export function WalletCreate({ onCancel, onSuccess }: WalletCreateProps = {}) {
  const { t, i18n } = useTranslation();
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [isLoadingUsb, setIsLoadingUsb] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdWallet, setCreatedWallet] = useState<{
    wallet: any;
    mnemonic: string;
  } | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [_deviceStatus, setDeviceStatus] = useState<DeviceMembershipStatus | null>(null);
  void _deviceStatus; // Reserved for future use (display device membership info)
  const [isCheckingDevice, setIsCheckingDevice] = useState(false);

  const { addWallet } = useDashboardStore();
  const walletLimitInfo = useWalletLimitInfo();
  const { getToken } = useSessionStore();

  // Create i18n-aware validation schema
  const walletCreateSchema = useMemo(() => createWalletCreateSchema(t), [t, i18n.language]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch: _watch,  // Reserved for debug mode
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
        setError(error.message || t('usb.detectFailed'));
      } finally {
        setIsLoadingUsb(false);
      }
    };

    loadUsbDevices();
  }, [setValue]);

  const onSubmit = async (data: WalletCreateFormData) => {
    // Check wallet limit (chain-based membership)
    if (!walletLimitInfo.canCreate) {
      setShowUpgradePrompt(true);
      return;
    }

    // Check device membership limit using session token
    const sessionToken = getToken();
    if (sessionToken && data.usbPath) {
      setIsCheckingDevice(true);
      try {
        const deviceMembership = await tauriApi.getDeviceMembershipStatusWithToken({
          token: sessionToken, // ✅ Use session token
        });

        setDeviceStatus(deviceMembership);

        // Device-level wallet limit check
        if (!deviceMembership.canCreateWallet) {
          setError(
            t('wallet.deviceLimitReached', {
              current: deviceMembership.walletCount,
              limit: deviceMembership.walletLimit
            })
          );
          setIsCheckingDevice(false);
          return;
        }
      } catch (err) {
        console.error('Failed to check device membership:', err);
        // Continue with wallet creation even if device check fails
        // (fallback to chain-based membership check)
      } finally {
        setIsCheckingDevice(false);
      }
    }

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
      const errorMessage = error.message || (typeof err === 'string' ? err : t('wallet.createFailed'));
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
      <h2>{t('wallet.createWallet')}</h2>

      {/* Wallet Limit Info */}
      <div className="wallet-limit-info" style={{
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

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* USB Drive Selection */}
        <div className="form-group">
          <label htmlFor="usbPath">{t('usb.usbDrive')} *</label>
          {isLoadingUsb ? (
            <p>{t('usb.detecting')}</p>
          ) : usbDevices.length === 0 ? (
            <p className="error">{t('usb.noUsbDetected')}</p>
          ) : (
            <select id="usbPath" {...register('usbPath')}>
              <option value="">{t('usb.selectUsb')}</option>
              {usbDevices.map((device) => (
                <option key={device.path} value={device.path}>
                  {device.name} ({device.path}) - {Math.round(device.available_space / 1024 / 1024)}MB {t('usb.free')}
                </option>
              ))}
            </select>
          )}
          {errors.usbPath && <span className="error">{errors.usbPath.message}</span>}
        </div>

        {/* Wallet Name */}
        <div className="form-group">
          <label htmlFor="walletName">{t('wallet.walletName')} ({t('common.optional')})</label>
          <input
            id="walletName"
            type="text"
            placeholder={t('wallet.myWallet')}
            {...register('walletName')}
          />
          {errors.walletName && <span className="error">{errors.walletName.message}</span>}
        </div>

        {/* Password */}
        <div className="form-group">
          <label htmlFor="password">{t('security.password')} *</label>
          <input
            id="password"
            type="password"
            placeholder={t('security.atLeast12Chars')}
            {...register('password')}
          />
          {errors.password && <span className="error">{errors.password.message}</span>}
          <small>{t('security.passwordHint')}</small>
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label htmlFor="confirmPassword">{t('security.confirmPassword')} *</label>
          <input
            id="confirmPassword"
            type="password"
            placeholder={t('security.reenterPassword')}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <span className="error">{errors.confirmPassword.message}</span>
          )}
        </div>

        {/* BIP39 Passphrase (Optional) */}
        <div className="form-group">
          <label htmlFor="passphrase">{t('security.bip39Passphrase')}</label>
          <input
            id="passphrase"
            type="password"
            placeholder={t('security.passphraseOptional')}
            {...register('passphrase')}
          />
          <small>{t('security.passphraseHint')}</small>
        </div>

        {/* Mnemonic Length */}
        <div className="form-group">
          <label htmlFor="mnemonicLength">{t('mnemonic.wordCount')}</label>
          <select id="mnemonicLength" {...register('mnemonicLength')}>
            <option value={24}>{t('mnemonic.24words')}</option>
            <option value={12}>{t('mnemonic.12words')}</option>
          </select>
        </div>

        {/* Debug Info - Commented out after debugging complete
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
          <strong>{t('debug.debugInfo')}:</strong>
          <div>{t('debug.formValid')}: {isValid ? '✅ true' : '❌ false'}</div>
          <div>{t('debug.formDirty')}: {isDirty ? '✅ true' : '❌ false'}</div>
          <div>{t('debug.isCreating')}: {isCreating ? '❌ true' : '✅ false'}</div>
          <div>{t('debug.usbDevicesCount')}: {usbDevices.length}</div>
          <div>{t('debug.formValues')}:</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            usbPath: {_watch('usbPath') || t('debug.empty')}
            password: {_watch('password') ? '***' + _watch('password').substring(_watch('password').length - 3) : t('debug.empty')}
            confirmPassword: {_watch('confirmPassword') ? '***' + _watch('confirmPassword').substring(_watch('confirmPassword').length - 3) : t('debug.empty')}
            walletName: {_watch('walletName') || t('debug.empty')}
            passphrase: {_watch('passphrase') ? '***' : t('debug.empty')}
            mnemonicLength: {_watch('mnemonicLength')}
          </pre>
          <div>{t('debug.hasErrors')}: {Object.keys(errors).length > 0 ? '❌ YES' : '✅ NO'}</div>
          {Object.keys(errors).length > 0 && (
            <div>{t('debug.errorFields')}: {Object.keys(errors).join(', ')}</div>
          )}
        </div>
        */}

        {/* Action Buttons (T093, FR-032) */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={!isValid || isCreating || isCheckingDevice || usbDevices.length === 0}
            className="primary-button"
          >
            {isCheckingDevice
              ? t('wallet.checkingDeviceLimit')
              : isCreating
              ? t('wallet.creatingWallet')
              : t('wallet.createWallet')
            }
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isCreating || isCheckingDevice}
              className="secondary-button"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      {/* Security Notice */}
      <div className="security-notice">
        <strong>{t('security.securityNotice')}:</strong>
        <ul>
          <li>{t('security.walletEncrypted')}</li>
          <li>{t('security.mnemonicNotice')}</li>
          <li>{t('security.mnemonicWarning')}</li>
        </ul>
      </div>

      {/* Cancellation Confirmation Dialog (T093, FR-032) */}
      <ConfirmationDialog
        isOpen={showCancelConfirm}
        title={t('wallet.discardCreation')}
        message={t('wallet.discardCreationMessage')}
        confirmLabel={t('wallet.discardChanges')}
        cancelLabel={t('wallet.continueEditing')}
        confirmVariant="danger"
        onConfirm={confirmCancel}
        onCancel={cancelCancel}
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
          // Open mint page in browser
          window.open('https://arcsign.io/mint', '_blank');
        }}
        onCancel={() => setShowUpgradePrompt(false)}
      />
    </div>
  );
}
