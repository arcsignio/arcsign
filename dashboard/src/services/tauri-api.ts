/**
 * Tauri API service wrapper
 * Feature: User Dashboard for Wallet Management
 * Task: T021 - Create Tauri API service wrapper
 * Generated: 2025-10-17
 */

import { invoke } from "@tauri-apps/api";
import type {
  Wallet,
  WalletCreateResponse,
  WalletImportResponse,
  WalletCreateParams,
  WalletImportParams,
  LoadAddressesParams,
  RenameWalletParams,
} from "@/types/wallet";
import type { AddressListResponse } from "@/types/address";
import type {
  TokenBalancesResponse,
  GetTokenBalancesParams,
} from "@/types/tokens";

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
  // Handle string errors (might be JSON or plain text)
  if (typeof error === "string") {
    try {
      // Try to parse as JSON error
      const parsed = JSON.parse(error);
      return {
        code: parsed.code || "UNKNOWN_ERROR",
        message: parsed.message || error,
        details: parsed.details,
      };
    } catch {
      // Plain string error
      return {
        code: "UNKNOWN_ERROR",
        message: error,
      };
    }
  }

  // Handle object errors (already parsed)
  if (error && typeof error === "object") {
    const err = error as any;
    return {
      code: err.code || "UNKNOWN_ERROR",
      message: err.message || "An unexpected error occurred",
      details: err.details,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unexpected error occurred",
  };
}

/**
 * USB Detection
 */
export async function detectUsb(): Promise<UsbDevice[]> {
  try {
    return await invoke<UsbDevice[]>("detect_usb");
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * Wallet Management
 */

// T064: Create wallet using Tauri command with camelCase parameters
export async function createWallet(
  params: WalletCreateParams
): Promise<WalletCreateResponse> {
  try {
    return await invoke<WalletCreateResponse>("create_wallet", {
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

export async function importWallet(
  params: WalletImportParams
): Promise<WalletImportResponse> {
  try {
    return await invoke<WalletImportResponse>("import_wallet", {
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
    return await invoke<Wallet[]>("list_wallets", { usbPath });
  } catch (error) {
    throw parseError(error);
  }
}

export async function renameWallet(
  params: RenameWalletParams
): Promise<Wallet> {
  try {
    return await invoke<Wallet>("rename_wallet", {
      walletId: params.wallet_id,
      newName: params.new_name,
      usbPath: params.usb_path,
    });
  } catch (error) {
    throw parseError(error);
  }
}

export async function deleteWallet(params: {
  wallet_id: string;
  password: string;
  usb_path: string;
}): Promise<void> {
  try {
    await invoke<void>("delete_wallet", {
      walletId: params.wallet_id,
      password: params.password,
      usbPath: params.usb_path,
    });
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * Address Management
 */

export async function loadAddresses(
  params: LoadAddressesParams
): Promise<AddressListResponse> {
  try {
    return await invoke<AddressListResponse>("load_addresses", {
      walletId: params.wallet_id,
      password: params.password,
      usbPath: params.usb_path,
    });
  } catch (error) {
    throw parseError(error);
  }
}

export async function getTokenBalances(
  params: GetTokenBalancesParams
): Promise<TokenBalancesResponse> {
  try {
    return await invoke<TokenBalancesResponse>("get_token_balances", {
      walletId: params.walletId,
      password: params.password,
      usbPath: params.usbPath,
      appPassword: params.appPassword,
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
    await invoke("enable_screenshot_protection");
  } catch (error) {
    throw parseError(error);
  }
}

export async function disableScreenshotProtection(): Promise<void> {
  try {
    await invoke("disable_screenshot_protection");
  } catch (error) {
    throw parseError(error);
  }
}

export async function clearSensitiveMemory(): Promise<void> {
  try {
    await invoke("clear_sensitive_memory");
  } catch (error) {
    throw parseError(error);
  }
}

/**
 * Asset Transfers (Transaction History)
 */

export interface AssetTransfer {
  blockNum: string;
  uniqueId: string;
  hash: string;
  from: string;
  to: string;
  value: number;
  asset: string;
  category: "external" | "internal" | "erc20" | "erc721" | "erc1155";
  erc721TokenId?: string | null;
  erc1155Metadata?: Array<{ tokenId: string; value: string }>;
  tokenId?: string | null;
  rawContract: {
    value: string;
    address?: string | null;
    decimal: string;
  };
  metadata?: {
    blockTimestamp: string;
  };
}

export interface AssetTransfersResponse {
  transfers: AssetTransfer[];
  pageKey: string;
  address: string;
  network: string;
  count: number;
}

export interface GetAssetTransfersParams {
  address: string;
  network?: string; // Default: "eth-mainnet"
  maxCount?: number; // Default: 50
  pageKey?: string;
  password: string;
  usbPath: string;
}

export async function getAssetTransfers(
  params: GetAssetTransfersParams
): Promise<AssetTransfersResponse> {
  console.log("🟢 [tauri-api] getAssetTransfers called with:", {
    address: params.address,
    network: params.network || "eth-mainnet",
    maxCount: params.maxCount || 50,
    pageKey: params.pageKey || "",
    hasPassword: !!params.password,
    usbPath: params.usbPath,
  });

  try {
    const result = await invoke<AssetTransfersResponse>("get_asset_transfers", {
      input: {
        address: params.address,
        network: params.network || "eth-mainnet",
        maxCount: params.maxCount || 50,
        pageKey: params.pageKey || "",
        password: params.password,
        usbPath: params.usbPath,
      },
    });
    console.log("🟢 [tauri-api] getAssetTransfers response:", {
      transfersCount: result.transfers?.length || 0,
      pageKey: result.pageKey,
    });
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] getAssetTransfers error:", error);
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
    console.log("[tauri-api] isFirstTimeSetup called with usbPath:", usbPath);
    // Tauri command returns bool directly, not {isFirstTime: bool}
    const result = await invoke<boolean>("is_first_time_setup", {
      usbPath,
    });
    console.log("[tauri-api] isFirstTimeSetup result:", result);
    return result;
  } catch (error) {
    console.error("[tauri-api] isFirstTimeSetup error:", error);
    throw parseError(error);
  }
}

export async function initializeApp(
  password: string,
  usbPath: string
): Promise<string> {
  try {
    return await invoke<string>("initialize_app", {
      input: {
        password,
        usbPath,
      },
    });
  } catch (error) {
    throw parseError(error);
  }
}

export async function unlockApp(
  password: string,
  usbPath: string
): Promise<AppConfig> {
  try {
    return await invoke<AppConfig>("unlock_app", {
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
  deleteWallet,

  // Address
  loadAddresses,
  getTokenBalances,

  // Transaction History
  getAssetTransfers,

  // Security
  enableScreenshotProtection,
  disableScreenshotProtection,
  clearSensitiveMemory,
};

export default tauriApi;
