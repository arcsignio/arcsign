/**
 * wallet_switchEthereumChain Handler
 * Feature: Chain switching for WalletConnect
 * Created: 2026-01-15
 *
 * Handles:
 * - wallet_switchEthereumChain: Switch to a different chain
 *
 * Validation:
 * - Only allows switching to chains in the session's authorized namespaces
 * - Returns 4902 for unrecognized/unsupported chains
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
 * Parse wallet_switchEthereumChain parameters
 * Format: [{ chainId: "0x1" }]
 */
function parseParams(params: unknown[]): { chainId: number } | null {
  if (!Array.isArray(params) || params.length < 1) {
    return null;
  }

  const param = params[0] as { chainId?: string };
  if (!param || typeof param !== 'object' || !param.chainId) {
    return null;
  }

  // Parse hex chain ID
  try {
    const chainId = parseInt(param.chainId, 16);
    if (isNaN(chainId) || chainId <= 0) {
      return null;
    }
    return { chainId };
  } catch {
    return null;
  }
}

/**
 * Get authorized chains from session namespaces
 */
function getAuthorizedChains(session: SessionTypes.Struct): number[] {
  const chains: number[] = [];

  // Check eip155 namespace
  const eip155 = session.namespaces?.eip155;
  if (eip155?.chains) {
    for (const chain of eip155.chains) {
      // Format: "eip155:1"
      const parts = chain.split(':');
      if (parts.length === 2 && parts[0] === 'eip155') {
        const chainId = parseInt(parts[1], 10);
        if (!isNaN(chainId)) {
          chains.push(chainId);
        }
      }
    }
  }

  // Also check accounts for chains (format: eip155:1:0x...)
  if (eip155?.accounts) {
    for (const account of eip155.accounts) {
      const parts = account.split(':');
      if (parts.length >= 2 && parts[0] === 'eip155') {
        const chainId = parseInt(parts[1], 10);
        if (!isNaN(chainId) && !chains.includes(chainId)) {
          chains.push(chainId);
        }
      }
    }
  }

  return chains;
}

/**
 * wallet_switchEthereumChain handler
 */
const switchChainHandler: RequestHandler = async (
  request: WCRequest,
  session: SessionTypes.Struct,
  _context: HandlerContext
): Promise<WCResponse> => {
  const { id } = request;
  const { params } = request.params.request;

  console.log('[wallet_switchEthereumChain] Processing request:', { id, params });

  // Parse parameters
  const parsed = parseParams(params as unknown[]);
  if (!parsed) {
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.INVALID_PARAMS,
      'Invalid parameters: expected [{ chainId: "0x..." }]'
    );
  }

  const { chainId } = parsed;
  const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;

  console.log('[wallet_switchEthereumChain] Requested chain:', { chainId, chainName });

  // Check if chain is supported by ArcSign
  if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
    console.log('[wallet_switchEthereumChain] Chain not supported by ArcSign:', chainId);
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.UNRECOGNIZED_CHAIN,
      `Chain ${chainId} (${chainName}) is not supported by ArcSign. Supported chains: Ethereum, BSC, Polygon, Arbitrum, Optimism, Base.`
    );
  }

  // Check if chain is authorized in the session
  const authorizedChains = getAuthorizedChains(session);
  console.log('[wallet_switchEthereumChain] Authorized chains:', authorizedChains);

  if (!authorizedChains.includes(chainId)) {
    console.log('[wallet_switchEthereumChain] Chain not authorized in session:', chainId);
    return createErrorResponse(
      id,
      RPC_ERROR_CODES.UNAUTHORIZED,
      `Chain ${chainId} (${chainName}) is not authorized in this session. Please reconnect with the required chain.`
    );
  }

  // Chain switch is valid
  // Note: In WalletConnect v2, the actual chain state is managed by the dApp
  // We just need to validate and return success
  console.log('[wallet_switchEthereumChain] Chain switch approved:', chainName);

  // Return null on success (per EIP-3326 spec)
  return createSuccessResponse(id, null);
};

// Register handler
registerHandler('wallet_switchEthereumChain', switchChainHandler, { category: 'chain' });

export { switchChainHandler };
