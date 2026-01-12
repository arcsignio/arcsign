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

/**
 * Update WebSocket server with BSC addresses for mint-page integration
 */
export async function updateWebsocketAccounts(accounts: string[]): Promise<void> {
  try {
    await invoke("update_websocket_accounts", { accounts });
  } catch (error) {
    console.error("Failed to update websocket accounts:", error);
    // Don't throw - this is a non-critical operation
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
      sessionToken: params.sessionToken, // PREFERRED: Session token
      appPassword: params.appPassword, // DEPRECATED: Still needed for provider_config
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
  data?: string; // Contract call data (hex-encoded, optional)
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
    tokenAddress: params.tokenAddress || "(native)",
    hasData: !!params.data,
  });

  try {
    const result = await invoke<BuildTransactionResponse>("build_transaction", {
      input: {
        chainId: params.chainId,
        from: params.from,
        to: params.to,
        amount: params.amount,
        feeSpeed: params.feeSpeed || "normal",
        tokenAddress: params.tokenAddress || "",  // ERC-20 token contract address
        data: params.data || "",  // Contract call data (hex-encoded)
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

// ============================================================================
// Swap Types (DEX Aggregator - 1inch)
// ============================================================================

export interface SwapTokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

export interface GetSwapQuoteParams {
  chainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string; // Amount in wei/smallest unit
  fromAddress: string;
  slippage?: number; // Default 0.5 (0.5%)
  provider?: string; // DEX provider: "openocean" | "kyberswap"
  usbPath: string;
  appPassword: string;
}

export interface SwapQuoteResponse {
  dex: string; // "1inch"
  fromToken: SwapTokenInfo;
  toToken: SwapTokenInfo;
  fromAmount: string; // Input amount (wei)
  toAmount: string; // Expected output (wei)
  toAmountMin: string; // Minimum output with slippage
  exchangeRate: string; // 1 FROM = ? TO
  priceImpact: string; // Price impact percentage
  estimatedGas: string; // Gas units
  gasCostETH: string; // Gas cost in ETH
  route: string[]; // Token path
  protocols: string[]; // DEXes used
  validUntil: number; // Quote expiry timestamp
  needsApproval: boolean; // Whether approve tx is needed
  approvalAddress: string; // Spender address for approval
}

export interface BuildSwapTransactionParams {
  chainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: string;
  fromAddress: string;
  slippage?: number;
  provider?: string; // DEX provider: "openocean" | "kyberswap"
  usbPath: string;
  appPassword: string;
}

export interface SwapTxData {
  from: string;
  to: string; // 1inch router contract
  data: string; // Encoded swap call
  value: string; // ETH value (for native token swaps)
  gas: number; // Gas limit
  gasPrice: string; // Legacy gas price
}

export interface BuildSwapTransactionResponse {
  quote: SwapQuoteResponse;
  txData: SwapTxData;
  chainId: number;
}

export interface GetSwapApprovalParams {
  chainId: string;
  tokenAddress: string;
  spenderAddress: string; // DEX router address (from quote.approvalAddress)
  amount?: string; // Amount to approve (empty = unlimited)
  usbPath: string;
  appPassword: string;
}

export interface GetSwapApprovalResponse {
  data: string; // Encoded approve call
  gasPrice: string;
  to: string; // Token contract address
  value: string; // Always "0"
}

export interface CheckSwapAllowanceParams {
  chainId: string;
  tokenAddress: string;
  walletAddress: string;
  usbPath: string;
  appPassword: string;
}

export interface CheckSwapAllowanceResponse {
  allowance: string;
  hasAllowance: boolean;
}

// ============================================================================
// Swap API Functions
// ============================================================================

export async function getSwapQuote(
  params: GetSwapQuoteParams
): Promise<SwapQuoteResponse> {
  console.log("🔄 [tauri-api] getSwapQuote called:", {
    chainId: params.chainId,
    fromToken: params.fromTokenAddress,
    toToken: params.toTokenAddress,
    amount: params.amount,
  });

  try {
    const result = await invoke<SwapQuoteResponse>("get_swap_quote", {
      input: {
        chainId: params.chainId,
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        amount: params.amount,
        fromAddress: params.fromAddress,
        slippage: params.slippage ?? 0.5,
        provider: params.provider || "openocean",
        usbPath: params.usbPath,
        appPassword: params.appPassword,
      },
    });
    console.log("🔄 [tauri-api] getSwapQuote response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] getSwapQuote error:", error);
    throw parseError(error);
  }
}

export async function buildSwapTransaction(
  params: BuildSwapTransactionParams
): Promise<BuildSwapTransactionResponse> {
  console.log("🔄 [tauri-api] buildSwapTransaction called:", {
    chainId: params.chainId,
    fromToken: params.fromTokenAddress,
    toToken: params.toTokenAddress,
    amount: params.amount,
  });

  try {
    const result = await invoke<BuildSwapTransactionResponse>(
      "build_swap_transaction",
      {
        input: {
          chainId: params.chainId,
          fromTokenAddress: params.fromTokenAddress,
          toTokenAddress: params.toTokenAddress,
          amount: params.amount,
          fromAddress: params.fromAddress,
          slippage: params.slippage ?? 0.5,
          provider: params.provider || "openocean",
          usbPath: params.usbPath,
          appPassword: params.appPassword,
        },
      }
    );
    console.log("🔄 [tauri-api] buildSwapTransaction response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] buildSwapTransaction error:", error);
    throw parseError(error);
  }
}

export async function getSwapApproval(
  params: GetSwapApprovalParams
): Promise<GetSwapApprovalResponse> {
  console.log("🔄 [tauri-api] getSwapApproval called:", {
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    spenderAddress: params.spenderAddress,
    amount: params.amount,
  });

  try {
    const result = await invoke<GetSwapApprovalResponse>("get_swap_approval", {
      input: {
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        spenderAddress: params.spenderAddress,
        amount: params.amount || "",
        usbPath: params.usbPath,
        appPassword: params.appPassword,
      },
    });
    console.log("🔄 [tauri-api] getSwapApproval response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] getSwapApproval error:", error);
    throw parseError(error);
  }
}

export async function checkSwapAllowance(
  params: CheckSwapAllowanceParams
): Promise<CheckSwapAllowanceResponse> {
  console.log("🔄 [tauri-api] checkSwapAllowance called:", {
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    walletAddress: params.walletAddress,
  });

  try {
    const result = await invoke<CheckSwapAllowanceResponse>(
      "check_swap_allowance",
      {
        input: {
          chainId: params.chainId,
          tokenAddress: params.tokenAddress,
          walletAddress: params.walletAddress,
          usbPath: params.usbPath,
          appPassword: params.appPassword,
        },
      }
    );
    console.log("🔄 [tauri-api] checkSwapAllowance response:", result);
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] checkSwapAllowance error:", error);
    throw parseError(error);
  }
}

export async function getNativeTokenAddress(): Promise<string> {
  try {
    const result = await invoke<{ address: string }>("get_native_token_address");
    return result.address;
  } catch (error) {
    console.error("🔴 [tauri-api] getNativeTokenAddress error:", error);
    throw parseError(error);
  }
}

export interface GetSwapTokensParams {
  chainId: string;
  provider?: string; // DEX provider: "openocean" | "kyberswap"
  usbPath: string;
  appPassword: string;
}

export interface GetSwapTokensResponse {
  tokens: SwapTokenInfo[];
}

export async function getSwapTokens(
  params: GetSwapTokensParams
): Promise<GetSwapTokensResponse> {
  console.log("🔄 [tauri-api] getSwapTokens called:", {
    chainId: params.chainId,
  });

  try {
    const result = await invoke<GetSwapTokensResponse>("get_swap_tokens", {
      input: {
        chainId: params.chainId,
        provider: params.provider || "openocean",
        usbPath: params.usbPath,
        appPassword: params.appPassword,
      },
    });
    console.log("🔄 [tauri-api] getSwapTokens response:", {
      tokenCount: result.tokens?.length || 0,
    });
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] getSwapTokens error:", error);
    throw parseError(error);
  }
}

// ============================================================================
// WebSocket Pending Transaction API (for mint-page integration)
// ============================================================================

export interface PendingTransactionInfo {
  request_id: number;
  from: string;
  to: string;
  data: string;
  value: string;
  chain_id: number;
  description: string;
  broadcast: boolean;
}

/**
 * Get pending transaction from mint-page (if any)
 * Dashboard should poll this to check for transactions waiting for confirmation
 */
export async function getPendingTransaction(): Promise<PendingTransactionInfo | null> {
  try {
    const result = await invoke<PendingTransactionInfo | null>("get_pending_transaction");
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] getPendingTransaction error:", error);
    throw parseError(error);
  }
}

/**
 * Respond to a pending transaction after user confirms/rejects
 */
export async function respondToTransaction(params: {
  requestId: number;
  success: boolean;
  txHash?: string;
  signedTx?: string;
  error?: string;
}): Promise<void> {
  console.log("📝 [tauri-api] respondToTransaction called:", {
    requestId: params.requestId,
    success: params.success,
    txHash: params.txHash,
  });

  try {
    await invoke("respond_to_transaction", {
      requestId: params.requestId,
      success: params.success,
      txHash: params.txHash || null,
      signedTx: params.signedTx || null,
      error: params.error || null,
    });
    console.log("📝 [tauri-api] respondToTransaction success");
  } catch (error) {
    console.error("🔴 [tauri-api] respondToTransaction error:", error);
    throw parseError(error);
  }
}

/**
 * Cancel the current pending transaction
 */
export async function cancelPendingTransaction(): Promise<void> {
  try {
    await invoke("cancel_pending_transaction");
    console.log("📝 [tauri-api] cancelPendingTransaction success");
  } catch (error) {
    console.error("🔴 [tauri-api] cancelPendingTransaction error:", error);
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
  updateWebsocketAccounts,

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

  // Swap Operations (DEX Aggregator)
  getSwapQuote,
  buildSwapTransaction,
  getSwapApproval,
  checkSwapAllowance,
  getNativeTokenAddress,
  getSwapTokens,

  // Security
  enableScreenshotProtection,
  disableScreenshotProtection,
  clearSensitiveMemory,

  // WebSocket Pending Transactions (mint-page integration)
  getPendingTransaction,
  respondToTransaction,
  cancelPendingTransaction,

  // Membership (NFT verification)
  checkAllMemberships,

  // USB Device Membership (Device Binding System)
  getDeviceMembershipStatus,
  getDeviceMembershipStatusWithToken,
  addDeviceMembershipBinding,
  removeDeviceMembershipBinding,

  // Session Management
  createSession,
  validateSession,
  revokeSession,

  // Wallet Session Management
  createWalletSession,
  validateWalletSession,
  revokeWalletSession,
};

/**
 * Aggregated membership status response
 */
export interface AggregatedMembershipStatus {
  totalNftCount: number;
  isPro: boolean;
  daysRemaining: number;
  walletLimit: number;
  addressNftCounts: { address: string; nftCount: number }[];
}

/**
 * Check membership NFT count across ALL BSC addresses
 */
export async function checkAllMemberships(addresses: string[]): Promise<AggregatedMembershipStatus> {
  try {
    return await invoke<AggregatedMembershipStatus>("check_all_memberships", {
      input: { addresses },
    });
  } catch (error) {
    throw parseError(error);
  }
}

// ============================================================================
// USB Device Membership (Device Binding System)
// ============================================================================

/**
 * NFT membership binding info for a specific token
 */
export interface MembershipBindingInfo {
  nftTokenId: string;
  nftContract: string;
  chainId: string;
  boundAddress: string;
  boundAt: number;
  isValid: boolean;
  lastVerified: number;
}

/**
 * Device membership status from USB storage
 */
export interface DeviceMembershipStatus {
  deviceId: string;           // Unique device ID (UUID) stored on USB
  deviceIdHash: string;       // keccak256(deviceId) for contract binding
  walletLimit: number;        // Maximum wallets allowed (3 free + 5 per NFT)
  walletCount: number;        // Current number of wallets
  canCreateWallet: boolean;   // Whether user can create more wallets
  memberships: MembershipBindingInfo[]; // List of NFT membership bindings
  lockedWalletIds: string[];  // IDs of wallets locked due to exceeding limit
}

/**
 * Get device membership status from USB storage
 * Returns device ID, device ID hash (for contract binding), wallet limits, and NFT bindings
 */
export async function getDeviceMembershipStatus(params: {
  usbPath: string;
  appPassword: string;
}): Promise<DeviceMembershipStatus> {
  console.log("🔐 [tauri-api] getDeviceMembershipStatus called");

  try {
    const result = await invoke<DeviceMembershipStatus>(
      "get_device_membership_status",
      {
        input: {
          usbPath: params.usbPath,
          appPassword: params.appPassword,
        },
      }
    );
    console.log("🔐 [tauri-api] getDeviceMembershipStatus response:", {
      deviceId: result.deviceId,
      walletLimit: result.walletLimit,
      walletCount: result.walletCount,
      bindingsCount: result.memberships.length,
    });
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] getDeviceMembershipStatus error:", error);
    throw parseError(error);
  }
}

/**
 * Get device membership status using session token
 * This is the preferred API - no password needed, uses session token
 */
export async function getDeviceMembershipStatusWithToken(params: {
  token: string;
}): Promise<DeviceMembershipStatus> {
  console.log("🔐 [tauri-api] getDeviceMembershipStatusWithToken called");

  try {
    const result = await invoke<DeviceMembershipStatus>(
      "get_device_membership_status_with_token",
      {
        input: {
          token: params.token,
        },
      }
    );
    console.log("🔐 [tauri-api] getDeviceMembershipStatusWithToken response:", {
      deviceId: result.deviceId,
      walletLimit: result.walletLimit,
      walletCount: result.walletCount,
      bindingsCount: result.memberships.length,
    });
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] getDeviceMembershipStatusWithToken error:", error);
    throw parseError(error);
  }
}

/**
 * Add NFT membership binding to USB device
 * Call this after user has bound deviceId on the NFT contract
 */
export async function addDeviceMembershipBinding(params: {
  usbPath: string;
  appPassword: string;
  nftTokenId: string;
  nftContract: string;
  chainId: string;
  boundAddress: string;
  signature: string;
}): Promise<void> {
  console.log("🔐 [tauri-api] addDeviceMembershipBinding called:", {
    nftTokenId: params.nftTokenId,
    nftContract: params.nftContract,
    chainId: params.chainId,
  });

  try {
    await invoke("add_device_membership_binding", {
      input: {
        usbPath: params.usbPath,
        appPassword: params.appPassword,
        nftTokenId: params.nftTokenId,
        nftContract: params.nftContract,
        chainId: params.chainId,
        boundAddress: params.boundAddress,
        signature: params.signature,
      },
    });
    console.log("🔐 [tauri-api] addDeviceMembershipBinding success");
  } catch (error) {
    console.error("🔴 [tauri-api] addDeviceMembershipBinding error:", error);
    throw parseError(error);
  }
}

/**
 * Remove NFT membership binding from USB device
 */
export async function removeDeviceMembershipBinding(params: {
  usbPath: string;
  appPassword: string;
  nftTokenId: string;
  nftContract: string;
}): Promise<void> {
  console.log("🔐 [tauri-api] removeDeviceMembershipBinding called:", {
    nftTokenId: params.nftTokenId,
    nftContract: params.nftContract,
  });

  try {
    await invoke("remove_device_membership_binding", {
      input: {
        usbPath: params.usbPath,
        appPassword: params.appPassword,
        nftTokenId: params.nftTokenId,
        nftContract: params.nftContract,
      },
    });
    console.log("🔐 [tauri-api] removeDeviceMembershipBinding success");
  } catch (error) {
    console.error("🔴 [tauri-api] removeDeviceMembershipBinding error:", error);
    throw parseError(error);
  }
}

// ============================================================
// Session Management API
// ============================================================

export interface SessionTokenResponse {
  token: string;
  expiresAt: number;
  usbPath: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  usbPath: string;
  expiresAt: number;
}

export interface RevokeTokenResponse {
  revoked: boolean;
}

/**
 * Create a session token after validating credentials
 */
export async function createSession(params: {
  usbPath: string;
  appPassword: string;
}): Promise<SessionTokenResponse> {
  console.log("🔐 [tauri-api] createSession called");
  try {
    const result = await invoke<SessionTokenResponse>("create_session", {
      input: {
        usbPath: params.usbPath,
        appPassword: params.appPassword,
      },
    });
    console.log("🔐 [tauri-api] createSession success");
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] createSession error:", error);
    throw parseError(error);
  }
}

/**
 * Validate a session token
 */
export async function validateSession(params: {
  token: string;
}): Promise<ValidateTokenResponse> {
  console.log("🔐 [tauri-api] validateSession called");
  try {
    const result = await invoke<ValidateTokenResponse>("validate_session", {
      input: {
        token: params.token,
      },
    });
    console.log("🔐 [tauri-api] validateSession success");
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] validateSession error:", error);
    throw parseError(error);
  }
}

/**
 * Revoke a session token
 */
export async function revokeSession(params: {
  token: string;
}): Promise<RevokeTokenResponse> {
  console.log("🔐 [tauri-api] revokeSession called");
  try {
    const result = await invoke<RevokeTokenResponse>("revoke_session", {
      input: {
        token: params.token,
      },
    });
    console.log("🔐 [tauri-api] revokeSession success");
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] revokeSession error:", error);
    throw parseError(error);
  }
}

// ============================================================================
// Wallet Session Management APIs
// ============================================================================

export interface WalletSessionTokenResponse {
  token: string;
  walletId: string;
  expiresAt: number;
  usbPath: string;
}

export interface ValidateWalletTokenResponse {
  valid: boolean;
  walletId: string;
  expiresAt: number;
  usbPath: string;
}

export interface RevokeWalletTokenResponse {
  revoked: boolean;
}

/**
 * Create a wallet session token by validating wallet password
 */
export async function createWalletSession(params: {
  walletId: string;
  password: string;
  usbPath: string;
}): Promise<WalletSessionTokenResponse> {
  console.log("🔐 [tauri-api] createWalletSession called for wallet:", params.walletId);
  try {
    const result = await invoke<WalletSessionTokenResponse>("create_wallet_session", {
      input: {
        walletId: params.walletId,
        password: params.password,
        usbPath: params.usbPath,
      },
    });
    console.log("🔐 [tauri-api] createWalletSession success");
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] createWalletSession error:", error);
    throw parseError(error);
  }
}

/**
 * Validate a wallet session token
 */
export async function validateWalletSession(params: {
  token: string;
}): Promise<ValidateWalletTokenResponse> {
  console.log("🔐 [tauri-api] validateWalletSession called");
  try {
    const result = await invoke<ValidateWalletTokenResponse>("validate_wallet_session", {
      input: {
        token: params.token,
      },
    });
    console.log("🔐 [tauri-api] validateWalletSession success");
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] validateWalletSession error:", error);
    throw parseError(error);
  }
}

/**
 * Revoke a wallet session token
 */
export async function revokeWalletSession(params: {
  token: string;
}): Promise<RevokeWalletTokenResponse> {
  console.log("🔐 [tauri-api] revokeWalletSession called");
  try {
    const result = await invoke<RevokeWalletTokenResponse>("revoke_wallet_session", {
      input: {
        token: params.token,
      },
    });
    console.log("🔐 [tauri-api] revokeWalletSession success");
    return result;
  } catch (error) {
    console.error("🔴 [tauri-api] revokeWalletSession error:", error);
    throw parseError(error);
  }
}

export default tauriApi;
