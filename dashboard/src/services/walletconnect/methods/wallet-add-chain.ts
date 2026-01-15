/**
 * wallet_addEthereumChain Handler
 * Feature: Add chain request handling for WalletConnect
 * Created: 2026-01-15
 *
 * Handles:
 * - wallet_addEthereumChain: Request to add a new chain
 *
 * Implementation:
 * - If chain is in our supported list (6 EVM chains): Return success
 * - If chain is not supported: Return 4902 error
 *
 * Note: ArcSign only supports a fixed set of chains for security.
 * We don't allow dynamic chain addition.
 */

import {
  type WCRequest,
  type WCResponse,
  type RequestHandler,
  type HandlerContext,
  RPC_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
  registerHandler,
} from '../request-handler';
import type { SessionTypes } from '@walletconnect/types';

// Supported chain IDs (matching our 6 EVM chains)
const SUPPORTED_CHAIN_IDS = [
  1,     // Ethereum
  56,    // BSC
  137,   // Polygon
  42161, // Arbitrum
  10,    // Optimism
  8453,  // Base
];

// Chain names for display
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  56: 'BNB Smart Chain',
  137: 'Polygon',
  42161: 'Arbitrum One',
  10: 'Optimism',
  8453: 'Base',
};

/**
 * EIP-3085 AddEthereumChainParameter
 */
interface AddChainParams {
  chainId: string;
  chainName?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
}

/**
 * Parse wallet_addEthereumChain parameters
 * Format: [AddEthereumChainParameter]
 */
function parseParams(params: unknown[]): { chainId: number; chainName: string } | null {
  if (!Array.isArray(params) || params.length < 1) {
    return null;
  }

  const param = params[0] as AddChainParams;
  if (!param || typeof param !== 'object' || !param.chainId) {
    return null;
  }

  // Parse hex chain ID
  try {
    const chainId = parseInt(param.chainId, 16);
    if (isNaN(chainId) || chainId <= 0) {
      return null;
    }
    return {
      chainId,
      chainName: param.chainName || `Chain ${chainId}`,
    };
  } catch {
    return null;
  }
}

/**
 * wallet_addEthereumChain handler
 */
const addChainHandler: RequestHandler = async (
  request: WCRequest,
  _session: SessionTypes.Struct,
  _context: HandlerContext
): Promise<WCResponse> => {
  const { id } = request;
  const { params } = request.params.request;

  console.log('[wallet_addEthereumChain] Processing request:', { id, params });

  // Parse parameters
  const parsed = parseParams(params as unknown[]);
  if (!parsed) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INVALID_PARAMS,
      'Invalid parameters: expected [AddEthereumChainParameter]'
    );
  }

  const { chainId, chainName } = parsed;
  const supportedChainName = CHAIN_NAMES[chainId];

  console.log('[wallet_addEthereumChain] Requested chain:', { chainId, chainName, supportedChainName });

  // Check if chain is already supported
  if (SUPPORTED_CHAIN_IDS.includes(chainId)) {
    console.log('[wallet_addEthereumChain] Chain already supported:', supportedChainName);
    // Return null on success (chain is already available)
    return createSuccessResponse(id, null);
  }

  // Chain is not supported
  console.log('[wallet_addEthereumChain] Chain not supported:', chainId);
  return createErrorResponse(
    id,
    RPC_ERROR_CODES.UNRECOGNIZED_CHAIN,
    `ArcSign only supports a fixed set of chains for security: Ethereum, BSC, Polygon, Arbitrum, Optimism, and Base. Chain "${chainName}" (${chainId}) cannot be added.`
  );
};

// Register handler
registerHandler('wallet_addEthereumChain', addChainHandler, { category: 'chain' });

export { addChainHandler };
