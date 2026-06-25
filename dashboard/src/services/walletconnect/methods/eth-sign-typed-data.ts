/**
 * eth_signTypedData_v4 Handler
 * Feature: EIP-712 structured data signing for WalletConnect
 * Updated: 2026-01-15
 *
 * Handles:
 * - eth_signTypedData_v4: Standard EIP-712 signing
 * - eth_signTypedData_v3: Legacy version (same handler)
 * - eth_signTypedData: Basic version
 *
 * EIP-712 structure:
 * - domain: Contract/app identification
 * - types: Type definitions
 * - primaryType: Main type being signed
 * - message: Actual data to sign
 */

import { invoke } from '@tauri-apps/api/core';
import { decodeTypedData } from '@/services/clearsign/decodeTypedData';
import { checkTypedDataSecurity } from '@/services/tauri-api';
import {
  type WCRequest,
  type WCResponse,
  type RequestHandler,
  type HandlerContext,
  type EIP712TypedData,
  RPC_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  getDappMetadata,
  parseChainId,
  registerHandler,
} from '../request-handler';
import { isAddressLocked } from '@/utils/walletLock';
import type { SessionTypes } from '@walletconnect/types';
import { isValidAddress, extractSignature } from '../utils/validators';

/**
 * Parse eth_signTypedData_v4 parameters
 * Format: [address, typedDataJson]
 */
function parseParams(params: unknown[]): { address: string; typedData: EIP712TypedData } | null {
  if (!Array.isArray(params) || params.length < 2) {
    return null;
  }

  const [first, second] = params;

  // Standard format: [address, typedDataJson]
  let address: string;
  let typedDataInput: string | EIP712TypedData;

  if (typeof first === 'string' && isValidAddress(first)) {
    address = first.toLowerCase();
    typedDataInput = second as string | EIP712TypedData;
  } else if (typeof second === 'string' && isValidAddress(second)) {
    // Some implementations swap the order
    address = second.toLowerCase();
    typedDataInput = first as string | EIP712TypedData;
  } else {
    return null;
  }

  // Parse typed data if it's a string
  let typedData: EIP712TypedData;
  if (typeof typedDataInput === 'string') {
    try {
      typedData = JSON.parse(typedDataInput);
    } catch {
      return null;
    }
  } else {
    typedData = typedDataInput;
  }

  // Validate required EIP-712 fields
  if (!typedData.domain || !typedData.types || !typedData.primaryType || !typedData.message) {
    return null;
  }

  // Ensure EIP712Domain exists in types
  if (!typedData.types.EIP712Domain) {
    // Add default EIP712Domain if missing
    typedData.types.EIP712Domain = [];
    if (typedData.domain.name) typedData.types.EIP712Domain.push({ name: 'name', type: 'string' });
    if (typedData.domain.version) typedData.types.EIP712Domain.push({ name: 'version', type: 'string' });
    if (typedData.domain.chainId !== undefined) typedData.types.EIP712Domain.push({ name: 'chainId', type: 'uint256' });
    if (typedData.domain.verifyingContract) typedData.types.EIP712Domain.push({ name: 'verifyingContract', type: 'address' });
    if (typedData.domain.salt) typedData.types.EIP712Domain.push({ name: 'salt', type: 'bytes32' });
  }

  return { address, typedData };
}

/**
 * Format typed data for display
 */
function formatTypedDataForDisplay(typedData: EIP712TypedData): string {
  const lines: string[] = [];

  // Domain info
  if (typedData.domain.name) {
    lines.push(`Domain: ${typedData.domain.name}`);
  }
  if (typedData.domain.verifyingContract) {
    lines.push(`Contract: ${typedData.domain.verifyingContract}`);
  }

  // Primary type
  lines.push(`Type: ${typedData.primaryType}`);

  // Message summary (top-level keys only)
  lines.push('');
  lines.push('Message:');
  for (const [key, value] of Object.entries(typedData.message)) {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const truncated = valueStr.length > 50 ? valueStr.slice(0, 47) + '...' : valueStr;
    lines.push(`  ${key}: ${truncated}`);
  }

  return lines.join('\n');
}

/**
 * eth_signTypedData_v4 handler
 */
const signTypedDataHandler: RequestHandler = async (
  request: WCRequest,
  session: SessionTypes.Struct,
  context: HandlerContext
): Promise<WCResponse> => {
  const { id } = request;
  const { params } = request.params.request;

  console.log('[eth_signTypedData_v4] Processing request:', { id, paramsLength: (params as unknown[])?.length });

  // Parse parameters
  const parsed = parseParams(params as unknown[]);
  if (!parsed) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INVALID_PARAMS,
      'Invalid parameters: expected [address, typedDataJson]'
    );
  }

  const { address, typedData } = parsed;

  // Check if wallet is locked due to membership limit
  if (isAddressLocked(address)) {
    console.log('[eth_signTypedData_v4] Wallet is locked - membership limit exceeded');
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.UNAUTHORIZED,
      'Wallet is locked due to membership limit. Please upgrade to unlock this wallet.'
    );
  }

  // Verify address matches session
  if (address.toLowerCase() !== context.address.toLowerCase()) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.UNAUTHORIZED,
      `Address mismatch: requested ${address}, wallet has ${context.address}`
    );
  }

  // Validate primaryType exists in types
  if (!typedData.types[typedData.primaryType]) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INVALID_PARAMS,
      `Invalid typed data: primaryType "${typedData.primaryType}" not found in types`
    );
  }

  // Get dApp metadata
  const dapp = getDappMetadata(session);
  const chainId = parseChainId(request.params.chainId);

  // Decode typed data for clear-signing display
  const intent = decodeTypedData(typedData as any);
  const summaryLine = intent.readable
    ? `${intent.title}${intent.risks.length ? '  ⚠️ ' + intent.risks.join(', ') : ''}`
    : '⚠️ Unreadable signature — verify the dApp is trusted';

  // Build full display message: clear-signing summary first, then structured detail
  const displayMessage = [
    summaryLine,
    '',
    formatTypedDataForDisplay(typedData),
  ].join('\n');

  // EIP-712 JSON string — the canonical payload sent to the backend security
  // check AND the sign command, so both judge exactly what gets signed.
  const typedDataJson = JSON.stringify(typedData);

  // Fetch security report — advisory only, never blocks signing. Mirrors the
  // eth_sendTransaction handler: the backend (Go txguard) computes
  // requiresAcknowledge; the dialog renders it and gathers informed consent.
  let security;
  try {
    security = await checkTypedDataSecurity(typedDataJson);
  } catch {
    security = undefined;
  }

  // Request user approval with password
  console.log('[eth_signTypedData_v4] Requesting user approval...');
  const approval = await context.requestSignature({
    type: 'eth_signTypedData_v4',
    dappName: dapp.name,
    dappUrl: dapp.url,
    dappIcon: dapp.icon,
    chainId,
    typedData,
    message: displayMessage,
    rawMessage: JSON.stringify(typedData, null, 2),
    security,
  });

  if (!approval.approved || !approval.password) {
    console.log('[eth_signTypedData_v4] User rejected');
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.USER_REJECTED,
      'User rejected the signature request'
    );
  }

  // Sign the typed data
  console.log('[eth_signTypedData_v4] Signing typed data...');
  console.log('[eth_signTypedData_v4] Context:', {
    walletId: context.walletId,
    usbPath: context.usbPath,
    address: context.address,
  });

  try {
    // Note: Tauri command expects parameters wrapped in 'input' object
    // with camelCase field names matching Rust struct (serde rename_all = "camelCase")
    // Result format from Go FFI via Rust: { signature, messageHash, signedBy }
    // (The success/data wrapper is stripped by Rust layer)
    const result = await invoke<{ signature: string; messageHash: string; signedBy: string } | string>('sign_typed_data', {
      input: {
        walletId: context.walletId,
        password: approval.password,
        passphrase: context.passphrase,
        usbPath: context.usbPath,
        address: context.address,
        typedData: typedDataJson,
        // Knowing-consent flag — forwarded to the Go backend gate, which
        // refuses to sign a blacklisted/high-risk target unless this is true.
        acknowledgedRisk: approval.acknowledged ?? false,
      }
    });

    console.log('[eth_signTypedData_v4] Raw result from Tauri:', JSON.stringify(result));

    // Extract signature using shared utility
    const signature = extractSignature(result);

    console.log('[eth_signTypedData_v4] Signature created:', signature.slice(0, 20) + '...');
    return createSuccessResponse(id, signature);
  } catch (error) {
    console.error('[eth_signTypedData_v4] Signing failed:', error);
    // Log more details about the error
    if (error && typeof error === 'object') {
      console.error('[eth_signTypedData_v4] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Signing failed'
    );
  }
};

// Register handlers for all typed data versions
registerHandler('eth_signTypedData_v4', signTypedDataHandler);
registerHandler('eth_signTypedData_v3', signTypedDataHandler);
registerHandler('eth_signTypedData', signTypedDataHandler);

export { signTypedDataHandler };
