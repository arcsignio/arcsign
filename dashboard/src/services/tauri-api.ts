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
      includeTestnets: params.includeTestnets,
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

// ============================================================================
// Transaction Types (ChainAdapter)
// ============================================================================

export interface BuildTransactionParams {
  chainId: string; // "ethereum", "polygon", "arbitrum", etc.
  from: string;
  to: string;
  amount: string; // Amount in native token (e.g., "0.1" for 0.1 ETH)
  feeSpeed?: "slow" | "normal" | "fast";
  tokenAddress?: string; // ERC-20 token contract address (optional, empty for native)
  usbPath: string;
  appPassword: string;
}

/**
 * Build transaction response from Go backend
 * Note: Backend returns simplified format with just the essential fields
 */
export interface BuildTransactionResponse {
  id: string;              // Unique transaction ID
  chainId: string;         // Chain identifier
  from: string;            // Sender address
  to: string;              // Recipient address
  amount: string;          // Amount in Wei
  fee: string;             // Estimated fee in Wei
  signingPayload: string;  // Base64 encoded payload to sign
  humanReadable: string;   // JSON representation for audit
  buildTimestamp: string;  // ISO timestamp
}

export interface SignTransactionParams {
  chainId: string;
  walletId: string;
  password: string;
  passphrase?: string;  // BIP39 passphrase (required if wallet uses passphrase)
  fromAddress: string;
  unsignedTx: BuildTransactionResponse;  // The full BuildTransactionResponse object
  usbPath: string;
  appPassword: string;
}

// SignTransactionResponse matches Go FFI output format
export interface SignTransactionResponse {
  txHash: string;           // Transaction hash
  signature: string;        // Base64-encoded signature
  serializedTx: string;     // Base64-encoded signed transaction (raw bytes)
  signedBy: string;         // From address
  signTimestamp: string;    // ISO timestamp
}

export interface BroadcastTransactionParams {
  chainId: string;
  signedTx: SignTransactionResponse;  // Pass the entire signed transaction response
  usbPath: string;
  appPassword: string;
}

export interface BroadcastTransactionResponse {
  txHash: string;
  submittedAt: string;
  status: "pending" | "submitted";
  statusUrl?: string; // Etherscan/block explorer URL
}

export interface QueryTransactionStatusParams {
  chainId: string;
  txHash: string;
  usbPath: string;
  appPassword: string;
}

export interface QueryTransactionStatusResponse {
  txHash: string;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  blockHash?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  confirmations?: number;
}

export interface EstimateFeeParams {
  chainId: string;
  from: string;
  to: string;
  amount: string;
  usbPath: string;
  appPassword: string;
}

/**
 * Fee estimate response from Go backend
 * Note: Backend returns minFee/recommendedFee/maxFee format
 * We map this to slow/normal/fast for UI consistency
 */
export interface EstimateFeeResponse {
  chainId: string;
  minFee: string;           // Wei - maps to "slow"
  recommendedFee: string;   // Wei - maps to "normal"
  maxFee: string;           // Wei - maps to "fast"
  confidence: number;       // Confidence percentage (0-100)
  estimatedBlocks: number;  // Blocks until confirmation
  timestamp: string;        // ISO timestamp
}

// ============================================================================
// Transaction API Functions
// ============================================================================

export async function buildTransaction(
  params: BuildTransactionParams
): Promise<BuildTransactionResponse> {
  console.log("🔧 [tauri-api] buildTransaction called:", {
    chainId: params.chainId,
    from: params.from,
    to: params.to,
    amount: params.amount,
    feeSpeed: params.feeSpeed || "normal",
  });

  try {
    const result = await invoke<BuildTransactionResponse>("build_transaction", {
      input: {
        chainId: params.chainId,
        from: params.from,
        to: params.to,
        amount: params.amount,
        feeSpeed: params.feeSpeed || "normal",
        usbPath: params.usbPath,
        appPassword: params.appPassword,
      },
    });
    console.log("🔧 [tauri-api] buildTransaction response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] buildTransaction error:", error);
    throw parseError(error);
  }
}

export async function signTransaction(
  params: SignTransactionParams
): Promise<SignTransactionResponse> {
  console.log("✍️ [tauri-api] signTransaction called:", {
    chainId: params.chainId,
    walletId: params.walletId,
    fromAddress: params.fromAddress,
  });

  try {
    const result = await invoke<SignTransactionResponse>("sign_transaction", {
      input: {
        chainId: params.chainId,
        walletId: params.walletId,
        password: params.password,
        passphrase: params.passphrase || "",  // Empty string if no passphrase
        fromAddress: params.fromAddress,
        unsignedTx: params.unsignedTx,
        usbPath: params.usbPath,
        appPassword: params.appPassword,
      },
    });
    console.log("✍️ [tauri-api] signTransaction response:", {
      txHash: result.txHash,
    });
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] signTransaction error:", error);
    throw parseError(error);
  }
}

export async function broadcastTransaction(
  params: BroadcastTransactionParams
): Promise<BroadcastTransactionResponse> {
  console.log("📡 [tauri-api] broadcastTransaction called:", {
    chainId: params.chainId,
  });

  try {
    const result = await invoke<BroadcastTransactionResponse>(
      "broadcast_transaction",
      {
        input: {
          chainId: params.chainId,
          signedTx: params.signedTx,
          usbPath: params.usbPath,
          appPassword: params.appPassword,
        },
      }
    );
    console.log("📡 [tauri-api] broadcastTransaction response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] broadcastTransaction error:", error);
    throw parseError(error);
  }
}

export async function queryTransactionStatus(
  params: QueryTransactionStatusParams
): Promise<QueryTransactionStatusResponse> {
  console.log("🔍 [tauri-api] queryTransactionStatus called:", {
    chainId: params.chainId,
    txHash: params.txHash,
  });

  try {
    const result = await invoke<QueryTransactionStatusResponse>(
      "query_transaction_status",
      {
        input: {
          chainId: params.chainId,
          txHash: params.txHash,
          usbPath: params.usbPath,
          appPassword: params.appPassword,
        },
      }
    );
    console.log("🔍 [tauri-api] queryTransactionStatus response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] queryTransactionStatus error:", error);
    throw parseError(error);
  }
}

export async function estimateFee(
  params: EstimateFeeParams
): Promise<EstimateFeeResponse> {
  console.log("💰 [tauri-api] estimateFee called:", {
    chainId: params.chainId,
    from: params.from,
    to: params.to,
    amount: params.amount,
  });

  try {
    const result = await invoke<EstimateFeeResponse>("estimate_fee", {
      input: {
        chainId: params.chainId,
        from: params.from,
        to: params.to,
        amount: params.amount,
        usbPath: params.usbPath,
        appPassword: params.appPassword,
      },
    });
    console.log("💰 [tauri-api] estimateFee response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] estimateFee error:", error);
    throw parseError(error);
  }
}

// ============================================================================
// Passphrase Validation
// ============================================================================

export interface ValidatePassphraseParams {
  walletId: string;
  password: string;
  passphrase: string;
  usbPath: string;
}

export interface ValidatePassphraseResponse {
  valid: boolean;
  derivedAddress: string;
  expectedAddress: string;
}

export async function validatePassphrase(
  params: ValidatePassphraseParams
): Promise<ValidatePassphraseResponse> {
  console.log("🔐 [tauri-api] validatePassphrase called:", {
    walletId: params.walletId,
  });

  try {
    const result = await invoke<ValidatePassphraseResponse>("validate_passphrase", {
      walletId: params.walletId,
      password: params.password,
      passphrase: params.passphrase,
      usbPath: params.usbPath,
    });
    console.log("🔐 [tauri-api] validatePassphrase response:", {
      valid: result.valid,
    });
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] validatePassphrase error:", error);
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
  validatePassphrase,

  // Transaction History
  getAssetTransfers,

  // Transaction Operations (ChainAdapter)
  buildTransaction,
  signTransaction,
  broadcastTransaction,
  queryTransactionStatus,
  estimateFee,

  // Security
  enableScreenshotProtection,
  disableScreenshotProtection,
  clearSensitiveMemory,
};

export default tauriApi;
