/**
 * Tauri API service wrapper
 * Feature: User Dashboard for Wallet Management
 * Task: T021 - Create Tauri API service wrapper
 * Generated: 2025-10-17
 */

import { invoke } from '@tauri-apps/api';
import type {
  Wallet,
  WalletCreateResponse,
  WalletImportResponse,
  WalletCreateParams,
  WalletImportParams,
  LoadAddressesParams,
  RenameWalletParams,
} from '@/types/wallet';
import type {
  AddressListResponse,
} from '@/types/address';

/**
 * USB Device information
 */
export interface UsbDevice {
  path: string;
  name: string;
  is_writable: boolean;
  available_space: number;
}

/**
 * Application error from Tauri backend
 */
export interface AppError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Parse error from Tauri response
 */
function parseError(error: unknown): AppError {
  if (typeof error === 'string') {
    try {
      // Try to parse as JSON error
      const parsed = JSON.parse(error);
      return {
        code: parsed.code || 'UNKNOWN_ERROR',
        message: parsed.message || error,
        details: parsed.details,
      };
    } catch {
      // Plain string error
      return {
        code: 'UNKNOWN_ERROR',
        message: error,
      };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
}

/**
 * USB Detection
 */
export async function detectUsb(): Promise<UsbDevice[]> {
  try {
    return await invoke<UsbDevice[]>('detect_usb');
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * Wallet Management
 */

// T064: Create wallet using Tauri command with camelCase parameters
export async function createWallet(params: WalletCreateParams): Promise<WalletCreateResponse> {
  try {
    return await invoke<WalletCreateResponse>('create_wallet', {
      password: params.password,
      usbPath: params.usb_path, // Note: params use snake_case, Tauri expects camelCase
      name: params.name,
      passphrase: params.passphrase,
      mnemonicLength: params.mnemonic_length,
    });
  } catch (error) {
    throw parseError(error);
  }
}

export async function importWallet(params: WalletImportParams): Promise<WalletImportResponse> {
  try {
    return await invoke<WalletImportResponse>('import_wallet', {
      mnemonic: params.mnemonic,
      password: params.password,
      usbPath: params.usb_path,
      passphrase: params.passphrase,
      name: params.name,
    });
  } catch (error) {
    throw parseError(error);
  }
}

export async function listWallets(usbPath: string): Promise<Wallet[]> {
  try {
    return await invoke<Wallet[]>('list_wallets', { usbPath });
  } catch (error) {
    throw parseError(error);
  }
}

export async function renameWallet(params: RenameWalletParams): Promise<Wallet> {
  try {
    return await invoke<Wallet>('rename_wallet', {
      walletId: params.wallet_id,
      newName: params.new_name,
      usbPath: params.usb_path,
    });
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * Address Management
 */

export async function loadAddresses(params: LoadAddressesParams): Promise<AddressListResponse> {
  try {
    return await invoke<AddressListResponse>('load_addresses', {
      walletId: params.wallet_id,
      password: params.password,
      usbPath: params.usb_path,
    });
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * Security Commands
 */

export async function enableScreenshotProtection(): Promise<void> {
  try {
    await invoke('enable_screenshot_protection');
  } catch (error) {
    throw parseError(error);
  }
}

export async function disableScreenshotProtection(): Promise<void> {
  try {
    await invoke('disable_screenshot_protection');
  } catch (error) {
    throw parseError(error);
  }
}

export async function clearSensitiveMemory(): Promise<void> {
  try {
    await invoke('clear_sensitive_memory');
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * App-level Authentication
 */

export interface AppConfig {
  version: string;
  createdAt: string;
  updatedAt: string;
  wallets: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  providers: Array<{
    providerType: string;
    apiKey: string;
    priority: number;
    enabled: boolean;
  }>;
  settings: {
    autoLockMinutes: number;
    requirePasswordOnStart: boolean;
  };
}

export async function isFirstTimeSetup(usbPath: string): Promise<boolean> {
  try {
    const result = await invoke<{ isFirstTime: boolean }>('is_first_time_setup', {
      usbPath,
    });
    return result.isFirstTime;
  } catch (error) {
    throw parseError(error);
  }
}

export async function initializeApp(password: string, usbPath: string): Promise<string> {
  try {
    return await invoke<string>('initialize_app', {
      input: {
        password,
        usbPath,
      },
    });
  } catch (error) {
    throw parseError(error);
  }
}

export async function unlockApp(password: string, usbPath: string): Promise<AppConfig> {
  try {
    return await invoke<AppConfig>('unlock_app', {
      input: {
        password,
        usbPath,
      },
    });
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * Typed Tauri API wrapper
 * Provides type-safe access to all Tauri commands
 */
export const tauriApi = {
  // USB
  detectUsb,

  // App Authentication
  isFirstTimeSetup,
  initializeApp,
  unlockApp,

  // Wallet
  createWallet,
  importWallet,
  listWallets,
  renameWallet,

  // Address
  loadAddresses,

  // Security
  enableScreenshotProtection,
  disableScreenshotProtection,
  clearSensitiveMemory,
};

export default tauriApi;
