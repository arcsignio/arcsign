/**
 * personal_sign Handler
 * Feature: EIP-191 message signing for WalletConnect
 * Updated: 2026-01-15
 *
 * Handles:
 * - personal_sign: Standard message signing
 * - eth_sign: Legacy message signing (same as personal_sign)
 *
 * Parameter order compatibility:
 * - Standard: [message, address]
 * - Legacy: [address, message]
 * - Auto-detect based on format (0x + 40 hex = address)
 */

import { invoke } from '@tauri-apps/api/tauri';
import {
  type WCRequest,
  type WCResponse,
  type RequestHandler,
  type HandlerContext,
  RPC_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  getDappMetadata,
  parseChainId,
  registerHandler,
} from '../request-handler';
import type { SessionTypes } from '@walletconnect/types';

/**
 * Check if a string is a valid Ethereum address
 */
function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Decode hex message to UTF-8 string if valid
 */
function decodeHexMessage(hex: string): string {
  if (!hex.startsWith('0x')) {
    return hex;
  }

  try {
    const bytes = hex.slice(2).match(/.{2}/g);
    if (!bytes) return hex;

    const decoded = bytes
      .map(byte => String.fromCharCode(parseInt(byte, 16)))
      .join('');

    // Check if result is printable ASCII/UTF-8
    if (/^[\x20-\x7E\u00A0-\uFFFF\n\r\t]*$/.test(decoded)) {
      return decoded;
    }
    return hex; // Return original if not printable
  } catch {
    return hex;
  }
}

/**
 * Parse personal_sign parameters
 * Handles both [message, address] and [address, message] order
 */
function parseParams(params: unknown[]): { message: string; address: string; rawMessage: string } | null {
  if (!Array.isArray(params) || params.length < 2) {
    return null;
  }

  const [first, second] = params as [string, string];

  // Detect which is the address
  if (isAddress(first) && !isAddress(second)) {
    // Legacy order: [address, message]
    return {
      address: first.toLowerCase(),
      rawMessage: second,
      message: decodeHexMessage(second),
    };
  } else if (isAddress(second) && !isAddress(first)) {
    // Standard order: [message, address]
    return {
      address: second.toLowerCase(),
      rawMessage: first,
      message: decodeHexMessage(first),
    };
  } else if (isAddress(first) && isAddress(second)) {
    // Both look like addresses - assume standard order
    return {
      address: second.toLowerCase(),
      rawMessage: first,
      message: decodeHexMessage(first),
    };
  }

  return null;
}

/**
 * personal_sign handler
 */
const personalSignHandler: RequestHandler = async (
  request: WCRequest,
  session: SessionTypes.Struct,
  context: HandlerContext
): Promise<WCResponse> => {
  const { id } = request;
  const { params } = request.params.request;

  console.log('[personal_sign] Processing request:', { id, params });

  // Parse parameters
  const parsed = parseParams(params as unknown[]);
  if (!parsed) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INVALID_PARAMS,
      'Invalid parameters: expected [message, address] or [address, message]'
    );
  }

  const { message, address, rawMessage } = parsed;

  // Verify address matches session
  if (address.toLowerCase() !== context.address.toLowerCase()) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.UNAUTHORIZED,
      `Address mismatch: requested ${address}, wallet has ${context.address}`
    );
  }

  // Get dApp metadata
  const dapp = getDappMetadata(session);
  const chainId = parseChainId(request.params.chainId);

  // Request user approval with password
  console.log('[personal_sign] Requesting user approval...');
  const approval = await context.requestSignature({
    type: 'personal_sign',
    dappName: dapp.name,
    dappUrl: dapp.url,
    dappIcon: dapp.icon,
    chainId,
    message,
    rawMessage,
  });

  if (!approval.approved || !approval.password) {
    console.log('[personal_sign] User rejected');
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.USER_REJECTED,
      'User rejected the signature request'
    );
  }

  // Sign the message
  console.log('[personal_sign] Signing message...');
  console.log('[personal_sign] Context:', {
    walletId: context.walletId,
    usbPath: context.usbPath,
    address: context.address,
    messageLength: rawMessage.length,
  });

  try {
    // Note: Tauri command expects parameters wrapped in 'input' object
    // with snake_case field names matching Rust struct
    // Result format from Go FFI via Rust: { signature, messageHash, signedBy }
    // (The success/data wrapper is stripped by Rust layer)
    const result = await invoke<{ signature: string; messageHash: string; signedBy: string } | string>('sign_message', {
      input: {
        wallet_id: context.walletId,
        password: approval.password,
        passphrase: context.passphrase,
        usb_path: context.usbPath,
        address: context.address,
        message: rawMessage,
      }
    });

    console.log('[personal_sign] Raw result from Tauri:', JSON.stringify(result));

    // Handle different result formats
    let signature: string;
    if (typeof result === 'string') {
      // Result might be a JSON string, try to parse
      try {
        const parsed = JSON.parse(result);
        signature = parsed.signature;
      } catch {
        throw new Error(result);
      }
    } else if (result && typeof result === 'object' && 'signature' in result) {
      // Direct object with signature
      signature = result.signature;
    } else {
      throw new Error('Invalid response format from sign_message');
    }

    if (!signature) {
      throw new Error('No signature in response');
    }

    console.log('[personal_sign] Signature created:', signature.slice(0, 20) + '...');
    return createSuccessResponse(id, signature);
  } catch (error) {
    console.error('[personal_sign] Signing failed:', error);
    // Log more details about the error
    if (error && typeof error === 'object') {
      console.error('[personal_sign] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Signing failed'
    );
  }
};

// Register handlers
registerHandler('personal_sign', personalSignHandler);
registerHandler('eth_sign', personalSignHandler); // eth_sign is same as personal_sign

export { personalSignHandler };
