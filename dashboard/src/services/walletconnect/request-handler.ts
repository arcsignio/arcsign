/**
 * WalletConnect Request Handler
 * Feature: Route incoming dApp requests to appropriate handlers
 * Updated: 2026-01-15
 *
 * Supported methods:
 * - Signing (requires password): personal_sign, eth_signTypedData_v4, eth_sendTransaction
 * - Chain switching: wallet_switchEthereumChain, wallet_addEthereumChain
 * - Read-only (RPC passthrough): eth_chainId, eth_accounts, eth_getBalance, etc.
 */

import type { SessionTypes } from '@walletconnect/types';

// JSON-RPC Error Codes (EIP-1193 / EIP-1474)
export const RPC_ERROR_CODES = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,
  UNRECOGNIZED_CHAIN: 4902,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  METHOD_NOT_FOUND: -32601,
} as const;

// Request types
export interface WCRequest {
  id: number;
  topic: string;
  params: {
    request: {
      method: string;
      params: unknown[];
    };
    chainId: string; // e.g., "eip155:1"
  };
}

export interface WCResponse {
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: string;
  };
}

// Handler function type
export type RequestHandler = (
  request: WCRequest,
  session: SessionTypes.Struct,
  context: HandlerContext
) => Promise<WCResponse>;

// Context passed to handlers
export interface HandlerContext {
  // Current wallet address
  address: string;
  // Wallet ID for signing operations
  walletId: string;
  // USB storage path
  usbPath: string;
  // BIP39 passphrase (empty string if not used)
  passphrase: string;
  // Session token for provider config decryption
  sessionToken: string;
  // Function to show sign dialog and get user approval + password
  requestSignature: (params: SignatureRequestParams) => Promise<SignatureResult>;
  // Function to get RPC provider URL for a chain
  getRpcUrl: (chainId: number) => string | null;
}

export interface SignatureRequestParams {
  type: 'personal_sign' | 'eth_signTypedData_v4' | 'eth_sendTransaction';
  dappName: string;
  dappUrl: string;
  dappIcon?: string;
  chainId: number;
  // For personal_sign
  message?: string;
  rawMessage?: string; // hex encoded
  // For eth_signTypedData_v4
  typedData?: EIP712TypedData;
  // For eth_sendTransaction
  transaction?: TransactionParams;
}

export interface SignatureResult {
  approved: boolean;
  password?: string; // Wallet password if approved
}

export interface EIP712TypedData {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
    salt?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface TransactionParams {
  from: string;
  to?: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
}

// Method categories
export type MethodCategory = 'signing' | 'chain' | 'readonly';

// Handler metadata
export interface HandlerMetadata {
  category: MethodCategory;
  description?: string;
}

// Handler registry with metadata
interface RegisteredHandler {
  handler: RequestHandler;
  metadata: HandlerMetadata;
}

const handlers: Map<string, RegisteredHandler> = new Map();

// Default supported methods (for backwards compatibility and RPC passthrough)
const DEFAULT_READONLY_METHODS = [
  'eth_chainId',
  'eth_accounts',
  'eth_requestAccounts',
  'eth_getBalance',
  'eth_getTransactionCount',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_feeHistory',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getCode',
  'eth_getLogs',
  'net_version',
];

const DEFAULT_CHAIN_METHODS = [
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];

/**
 * Register a handler for a specific method
 * @param method - The RPC method name (e.g., 'personal_sign')
 * @param handler - The handler function
 * @param metadata - Optional metadata (defaults to signing category)
 */
export function registerHandler(
  method: string,
  handler: RequestHandler,
  metadata?: HandlerMetadata
): void {
  handlers.set(method, {
    handler,
    metadata: metadata || { category: 'signing' },
  });
  console.log(`[WC RequestHandler] Registered handler: ${method} (${metadata?.category || 'signing'})`);
}

/**
 * Get all registered methods by category
 */
export function getMethodsByCategory(category: MethodCategory): string[] {
  const methods: string[] = [];
  handlers.forEach((registered, method) => {
    if (registered.metadata.category === category) {
      methods.push(method);
    }
  });
  return methods;
}

/**
 * Check if a method is supported
 */
export function isMethodSupported(method: string): boolean {
  // Check if handler is registered
  if (handlers.has(method)) {
    return true;
  }
  // Check default methods (for RPC passthrough)
  return (
    DEFAULT_CHAIN_METHODS.includes(method) ||
    DEFAULT_READONLY_METHODS.includes(method)
  );
}

/**
 * Check if a method requires user signature/approval
 */
export function requiresSignature(method: string): boolean {
  const registered = handlers.get(method);
  return registered?.metadata.category === 'signing';
}

/**
 * Check if a method is read-only (can be passed through to RPC)
 */
export function isReadOnly(method: string): boolean {
  const registered = handlers.get(method);
  if (registered) {
    return registered.metadata.category === 'readonly';
  }
  return DEFAULT_READONLY_METHODS.includes(method);
}

/**
 * Parse chain ID from CAIP-2 format
 * e.g., "eip155:1" -> 1
 */
export function parseChainId(caip2ChainId: string): number {
  const parts = caip2ChainId.split(':');
  if (parts.length !== 2 || parts[0] !== 'eip155') {
    throw new Error(`Invalid CAIP-2 chain ID: ${caip2ChainId}`);
  }
  return parseInt(parts[1], 10);
}

/**
 * Create an error response
 */
export function createErrorResponse(
  id: number,
  code: number,
  message: string,
  data?: string
): WCResponse {
  return {
    id,
    error: {
      code,
      message,
      ...(data && { data }),
    },
  };
}

/**
 * Create a success response
 */
export function createSuccessResponse(id: number, result: unknown): WCResponse {
  return {
    id,
    result,
  };
}

/**
 * Main request handler - routes requests to appropriate handlers
 */
export async function handleRequest(
  request: WCRequest,
  session: SessionTypes.Struct,
  context: HandlerContext
): Promise<WCResponse> {
  const { method } = request.params.request;

  console.log(`[WC RequestHandler] Handling request: ${method}`);

  // Check if method is supported
  if (!isMethodSupported(method)) {
    console.warn(`[WC RequestHandler] Unsupported method: ${method}`);
    return createErrorResponse(
      request.id,
      RPC_ERROR_CODES.UNSUPPORTED_METHOD,
      `Method not supported: ${method}`
    );
  }

  // Get registered handler
  const registered = handlers.get(method);

  if (!registered) {
    // If no handler registered but method is read-only, we might want to pass through
    if (isReadOnly(method)) {
      console.log(`[WC RequestHandler] Read-only method without handler: ${method}`);
      return createErrorResponse(
        request.id,
        RPC_ERROR_CODES.INTERNAL_ERROR,
        `Handler not implemented: ${method}`
      );
    }

    console.error(`[WC RequestHandler] No handler for method: ${method}`);
    return createErrorResponse(
      request.id,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      `Handler not implemented: ${method}`
    );
  }

  try {
    return await registered.handler(request, session, context);
  } catch (error) {
    console.error(`[WC RequestHandler] Handler error:`, error);
    return createErrorResponse(
      request.id,
      RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Get dApp metadata from session
 */
export function getDappMetadata(session: SessionTypes.Struct): {
  name: string;
  url: string;
  icon?: string;
} {
  const metadata = session.peer?.metadata;
  return {
    name: metadata?.name || 'Unknown dApp',
    url: metadata?.url || '',
    icon: metadata?.icons?.[0],
  };
}
