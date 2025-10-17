/**
 * Wallet creation form component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T034, T035, T042 - WalletCreate component with form validation and error handling
 * Generated: 2025-10-17
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { walletCreateSchema, type WalletCreateFormData } from '@/validation/password';
import { useDashboardStore } from '@/stores/dashboardStore';
import tauriApi, { type UsbDevice, type AppError } from '@/services/tauri-api';
import { MnemonicDisplay } from './MnemonicDisplay';

export function WalletCreate() {
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [isLoadingUsb, setIsLoadingUsb] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdWallet, setCreatedWallet] = useState<{
    wallet: any;
    mnemonic: string;
  } | null>(null);

  const { addWallet } = useDashboardStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
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
      } catch (err) {
        const error = err as AppError;
        setError(error.message || 'Failed to detect USB devices');
      } finally {
        setIsLoadingUsb(false);
      }
    };

    loadUsbDevices();
  }, []);

  const onSubmit = async (data: WalletCreateFormData) => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await tauriApi.createWallet({
        password: data.password,
        usb_path: data.usbPath,
        name: data.walletName,
        passphrase: data.passphrase || undefined,
        mnemonic_length: data.mnemonicLength,
      });

      // Set created wallet for mnemonic display
      setCreatedWallet(response);

      // Add to dashboard store
      addWallet(response.wallet);
    } catch (err) {
      const error = err as AppError;
      setError(error.message || 'Failed to create wallet');
      setIsCreating(false);
    }
  };

  const handleMnemonicConfirm = () => {
    // Navigate back to dashboard or wallet list
    setCreatedWallet(null);
    setIsCreating(false);
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || isCreating || usbDevices.length === 0}
        >
          {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
        </button>
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
    </div>
  );
}
