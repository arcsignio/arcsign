/**
 * eth_sendTransaction Handler
 * Feature: Transaction signing and broadcasting for WalletConnect
 * Updated: 2026-01-15
 *
 * Three-stage flow:
 * 1. Validate/Normalize: Parse and complete transaction params
 * 2. Sign: Call sign_transaction with user password
 * 3. Broadcast: Send to RPC and return tx hash
 *
 * EIP-1559 support:
 * - Prefers maxFeePerGas/maxPriorityFeePerGas
 * - Falls back to gasPrice for legacy chains
 */

import { invoke } from '@tauri-apps/api/tauri';
import {
  type WCRequest,
  type WCResponse,
  type RequestHandler,
  type HandlerContext,
  type TransactionParams,
  RPC_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  getDappMetadata,
  parseChainId,
  registerHandler,
} from '../request-handler';
import type { SessionTypes } from '@walletconnect/types';

/**
 * Parse eth_sendTransaction parameters
 * Format: [transactionObject]
 */
function parseParams(params: unknown[]): TransactionParams | null {
  if (!Array.isArray(params) || params.length < 1) {
    return null;
  }

  const tx = params[0] as TransactionParams;

  if (!tx || typeof tx !== 'object') {
    return null;
  }

  // from is required
  if (!tx.from || typeof tx.from !== 'string') {
    return null;
  }

  return tx;
}

/**
 * Format value for display (wei to ETH)
 */
function formatValue(value?: string): string {
  if (!value || value === '0x0' || value === '0x') {
    return '0 ETH';
  }

  try {
    const wei = BigInt(value);
    const eth = Number(wei) / 1e18;
    if (eth < 0.0001 && eth > 0) {
      return `< 0.0001 ETH`;
    }
    return `${eth.toFixed(6)} ETH`;
  } catch {
    return value;
  }
}

/**
 * Get chain native token symbol
 */
function getNativeSymbol(chainId: number): string {
  const symbols: Record<number, string> = {
    1: 'ETH',
    56: 'BNB',
    137: 'MATIC',
    42161: 'ETH',
    10: 'ETH',
    8453: 'ETH',
  };
  return symbols[chainId] || 'ETH';
}

/**
 * eth_sendTransaction handler
 */
const sendTransactionHandler: RequestHandler = async (
  request: WCRequest,
  session: SessionTypes.Struct,
  context: HandlerContext
): Promise<WCResponse> => {
  const { id } = request;
  const { params } = request.params.request;

  console.log('[eth_sendTransaction] Processing request:', { id });

  // Parse parameters
  const tx = parseParams(params as unknown[]);
  if (!tx) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INVALID_PARAMS,
      'Invalid parameters: expected [transactionObject]'
    );
  }

  // Verify from address matches session
  if (tx.from.toLowerCase() !== context.address.toLowerCase()) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.UNAUTHORIZED,
      `Address mismatch: requested ${tx.from}, wallet has ${context.address}`
    );
  }

  // Get dApp metadata and chain info
  const dapp = getDappMetadata(session);
  const chainId = parseChainId(request.params.chainId);
  const nativeSymbol = getNativeSymbol(chainId);

  // Format transaction for display
  const displayValue = formatValue(tx.value);
  const displayTo = tx.to || '(Contract Creation)';
  const displayData = tx.data
    ? (tx.data.length > 66 ? `${tx.data.slice(0, 66)}...` : tx.data)
    : '(none)';

  const message = [
    `To: ${displayTo}`,
    `Value: ${displayValue.replace('ETH', nativeSymbol)}`,
    `Data: ${displayData}`,
  ].join('\n');

  // Request user approval with password
  console.log('[eth_sendTransaction] Requesting user approval...');
  const approval = await context.requestSignature({
    type: 'eth_sendTransaction',
    dappName: dapp.name,
    dappUrl: dapp.url,
    dappIcon: dapp.icon,
    chainId,
    transaction: tx,
    message,
    rawMessage: JSON.stringify(tx, null, 2),
  });

  if (!approval.approved || !approval.password) {
    console.log('[eth_sendTransaction] User rejected');
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.USER_REJECTED,
      'User rejected the transaction request'
    );
  }

  // Convert chainId to chain string for build_transaction
  const getChainString = (id: number): string => {
    const chainStrings: Record<number, string> = {
      1: 'ethereum',
      56: 'bsc',
      137: 'polygon',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base',
    };
    return chainStrings[id] || 'ethereum';
  };

  const chainString = getChainString(chainId);

  // Build unsigned transaction
  console.log('[eth_sendTransaction] Building transaction...');
  console.log('[eth_sendTransaction] Context:', {
    walletId: context.walletId,
    usbPath: context.usbPath,
    address: context.address,
    chainId,
    chainString,
  });

  let unsignedTx: unknown;
  try {
    // Convert wei value to ETH for build_transaction
    const weiValue = tx.value || '0x0';
    const weiAmount = BigInt(weiValue);
    const ethAmount = (Number(weiAmount) / 1e18).toString();

    // Note: Tauri commands expect parameters wrapped in 'input' object
    // BuildTransactionInput uses rename_all = "camelCase"
    const buildResult = await invoke<unknown>('build_transaction', {
      input: {
        chainId: chainString,
        from: context.address,
        to: tx.to || '',
        amount: ethAmount,
        feeSpeed: 'normal',
        data: tx.data || undefined,
        usbPath: context.usbPath,
        sessionToken: context.sessionToken,
      }
    });

    console.log('[eth_sendTransaction] Build result:', JSON.stringify(buildResult));

    // Handle different result formats (object or JSON string)
    let parsed = buildResult;
    if (typeof buildResult === 'string') {
      try {
        parsed = JSON.parse(buildResult);
      } catch {
        throw new Error(buildResult);
      }
    }

    // Extract unsignedTx from result
    if (parsed && typeof parsed === 'object' && 'unsignedTx' in parsed) {
      unsignedTx = (parsed as { unsignedTx: unknown }).unsignedTx;
    } else {
      unsignedTx = parsed;
    }
  } catch (error) {
    console.error('[eth_sendTransaction] Build failed:', error);
    if (error && typeof error === 'object') {
      console.error('[eth_sendTransaction] Build error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to build transaction'
    );
  }

  // Sign the transaction
  console.log('[eth_sendTransaction] Signing transaction...');
  let signedTx: unknown;
  try {
    // SignTransactionInput uses rename_all = "camelCase"
    const signResult = await invoke<unknown>('sign_transaction', {
      input: {
        chainId: chainString,
        walletId: context.walletId,
        password: approval.password,
        passphrase: context.passphrase,
        fromAddress: context.address,
        unsignedTx,
        usbPath: context.usbPath,
        sessionToken: context.sessionToken,
      }
    });

    console.log('[eth_sendTransaction] Sign result:', JSON.stringify(signResult));

    // Handle different result formats (object or JSON string)
    let parsed = signResult;
    if (typeof signResult === 'string') {
      try {
        parsed = JSON.parse(signResult);
      } catch {
        throw new Error(signResult);
      }
    }

    // Extract signedTx from result
    if (parsed && typeof parsed === 'object' && 'signedTx' in parsed) {
      signedTx = (parsed as { signedTx: unknown }).signedTx;
    } else {
      signedTx = parsed;
    }
  } catch (error) {
    console.error('[eth_sendTransaction] Sign failed:', error);
    if (error && typeof error === 'object') {
      console.error('[eth_sendTransaction] Sign error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to sign transaction'
    );
  }

  // Broadcast the transaction
  console.log('[eth_sendTransaction] Broadcasting transaction...');
  try {
    // BroadcastTransactionInput uses rename_all = "camelCase"
    const broadcastResult = await invoke<unknown>('broadcast_transaction', {
      input: {
        chainId: chainString,
        signedTx,
        usbPath: context.usbPath,
        sessionToken: context.sessionToken,
      }
    });

    console.log('[eth_sendTransaction] Broadcast result:', JSON.stringify(broadcastResult));

    // Handle different result formats (object or JSON string)
    let parsed = broadcastResult;
    if (typeof broadcastResult === 'string') {
      try {
        // Check if it's a JSON string
        parsed = JSON.parse(broadcastResult);
      } catch {
        // If not JSON, assume it's the txHash directly
        console.log('[eth_sendTransaction] Transaction sent:', broadcastResult);
        return createSuccessResponse(id, broadcastResult);
      }
    }

    // Extract txHash from result
    let txHash: string;
    if (parsed && typeof parsed === 'object' && 'txHash' in parsed) {
      txHash = (parsed as { txHash: string }).txHash;
    } else if (typeof parsed === 'string') {
      txHash = parsed;
    } else {
      throw new Error('Invalid broadcast result');
    }

    console.log('[eth_sendTransaction] Transaction sent:', txHash);
    return createSuccessResponse(id, txHash);
  } catch (error) {
    console.error('[eth_sendTransaction] Broadcast failed:', error);
    if (error && typeof error === 'object') {
      console.error('[eth_sendTransaction] Broadcast error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to broadcast transaction'
    );
  }
};

// Register handler
registerHandler('eth_sendTransaction', sendTransactionHandler);

export { sendTransactionHandler };
