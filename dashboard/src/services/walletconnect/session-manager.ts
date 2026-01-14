/**
 * WalletConnect Session Manager
 * Feature: Session pairing, approval, and namespace negotiation
 * Updated: 2026-01-14
 */

import type { ProposalTypes, SessionTypes } from '@walletconnect/types';
import {
  SUPPORTED_CHAINS,
  SUPPORTED_METHODS,
  SUPPORTED_EVENTS,
  WalletConnectError,
  WalletConnectErrorCode,
  type SupportedChain,
} from './types';

/**
 * Generate wallet namespaces for session approval
 * Implements namespace negotiation: required + optional intersection
 */
export function generateNamespaces(
  address: string,
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  optionalNamespaces?: ProposalTypes.OptionalNamespaces
): Record<string, SessionTypes.Namespace> {
  console.log('[WC] Generating namespaces:', { address, requiredNamespaces, optionalNamespaces });

  const supportedChains = Object.values(SUPPORTED_CHAINS);
  const supportedMethods = [...SUPPORTED_METHODS];
  const supportedEvents = [...SUPPORTED_EVENTS];

  const namespaces: Record<string, SessionTypes.Namespace> = {};

  // Process required namespaces (must 100% satisfy)
  for (const [key, namespace] of Object.entries(requiredNamespaces)) {
    if (key !== 'eip155') {
      throw new WalletConnectError(
        WalletConnectErrorCode.UNSUPPORTED_METHOD,
        `Namespace '${key}' not supported. Only eip155 (EVM) is supported.`
      );
    }

    // Validate chains
    const requestedChains = namespace.chains || [];
    const unsupportedChains = requestedChains.filter(chain => !supportedChains.includes(chain as SupportedChain));

    if (unsupportedChains.length > 0) {
      throw new WalletConnectError(
        WalletConnectErrorCode.UNRECOGNIZED_CHAIN,
        `Unsupported chains requested: ${unsupportedChains.join(', ')}. Wallet supports: ${supportedChains.join(', ')}`
      );
    }

    // Validate methods
    const requestedMethods = namespace.methods || [];
    const unsupportedMethods = requestedMethods.filter(method => !supportedMethods.includes(method as any));

    if (unsupportedMethods.length > 0) {
      throw new WalletConnectError(
        WalletConnectErrorCode.UNSUPPORTED_METHOD,
        `Unsupported methods requested: ${unsupportedMethods.join(', ')}`
      );
    }

    // Validate events
    const requestedEvents = namespace.events || [];
    const unsupportedEvents = requestedEvents.filter(event => !supportedEvents.includes(event as any));

    if (unsupportedEvents.length > 0) {
      throw new WalletConnectError(
        WalletConnectErrorCode.UNSUPPORTED_METHOD,
        `Unsupported events requested: ${unsupportedEvents.join(', ')}`
      );
    }

    // Generate CAIP-10 accounts for approved chains
    const accounts = requestedChains.map(chain => `${chain}:${address}`);

    namespaces[key] = {
      chains: requestedChains,
      methods: requestedMethods,
      events: requestedEvents,
      accounts,
    };
  }

  // Process optional namespaces (best-effort, grant what we can)
  if (optionalNamespaces) {
    for (const [key, namespace] of Object.entries(optionalNamespaces)) {
      if (key !== 'eip155') {
        console.warn('[WC] Skipping unsupported optional namespace:', key);
        continue;
      }

      // Already handled in required, merge additional capabilities
      if (namespaces[key]) {
        const existing = namespaces[key];

        // Add optional chains we support
        const optionalChains = (namespace.chains || []).filter(chain =>
          supportedChains.includes(chain as SupportedChain)
        );
        const additionalChains = optionalChains.filter(chain => !existing.chains?.includes(chain));

        if (additionalChains.length > 0) {
          existing.chains = [...(existing.chains || []), ...additionalChains];
          existing.accounts = [
            ...(existing.accounts || []),
            ...additionalChains.map(chain => `${chain}:${address}`),
          ];
        }

        // Add optional methods we support
        const optionalMethods = (namespace.methods || []).filter(method =>
          supportedMethods.includes(method as any)
        );
        const additionalMethods = optionalMethods.filter(method => !existing.methods?.includes(method));

        if (additionalMethods.length > 0) {
          existing.methods = [...(existing.methods || []), ...additionalMethods];
        }

        // Add optional events we support
        const optionalEvents = (namespace.events || []).filter(event =>
          supportedEvents.includes(event as any)
        );
        const additionalEvents = optionalEvents.filter(event => !existing.events?.includes(event));

        if (additionalEvents.length > 0) {
          existing.events = [...(existing.events || []), ...additionalEvents];
        }
      } else {
        // No required namespace, grant optional capabilities we support
        const grantedChains = (namespace.chains || []).filter(chain =>
          supportedChains.includes(chain as SupportedChain)
        );

        if (grantedChains.length > 0) {
          const grantedMethods = (namespace.methods || []).filter(method =>
            supportedMethods.includes(method as any)
          );
          const grantedEvents = (namespace.events || []).filter(event =>
            supportedEvents.includes(event as any)
          );
          const accounts = grantedChains.map(chain => `${chain}:${address}`);

          namespaces[key] = {
            chains: grantedChains,
            methods: grantedMethods,
            events: grantedEvents,
            accounts,
          };
        }
      }
    }
  }

  // If no eip155 namespace generated, provide default for all supported chains
  if (!namespaces.eip155) {
    console.log('[WC] No eip155 namespace requested, granting default');
    namespaces.eip155 = {
      chains: supportedChains,
      methods: supportedMethods,
      events: supportedEvents,
      accounts: supportedChains.map(chain => `${chain}:${address}`),
    };
  }

  console.log('[WC] Generated namespaces:', namespaces);
  return namespaces;
}

/**
 * Validate if a method is supported for a given session
 */
export function isMethodSupported(
  session: SessionTypes.Struct,
  method: string,
  chainId: string
): boolean {
  const namespace = session.namespaces['eip155'];
  if (!namespace) {
    return false;
  }

  // Check if chain is in session
  const chainSupported = namespace.chains?.includes(chainId) || false;
  if (!chainSupported) {
    return false;
  }

  // Check if method is in session
  const methodSupported = namespace.methods?.includes(method) || false;
  return methodSupported;
}

/**
 * Get accounts for a specific chain from session
 */
export function getAccountsForChain(
  session: SessionTypes.Struct,
  chainId: string
): string[] {
  const namespace = session.namespaces['eip155'];
  if (!namespace) {
    return [];
  }

  // Filter accounts for the specified chain
  const accounts = (namespace.accounts || [])
    .filter(account => account.startsWith(`${chainId}:`))
    .map(account => account.split(':')[2]); // Extract address from CAIP-10

  return accounts;
}

/**
 * Validate session request parameters
 */
export function validateSessionRequest(
  session: SessionTypes.Struct,
  chainId: string,
  method: string
): { valid: boolean; error?: WalletConnectError } {
  // Check if chain is supported in session
  const namespace = session.namespaces['eip155'];
  if (!namespace) {
    return {
      valid: false,
      error: new WalletConnectError(
        WalletConnectErrorCode.UNAUTHORIZED,
        'Session does not have eip155 namespace'
      ),
    };
  }

  const chainSupported = namespace.chains?.includes(chainId) || false;
  if (!chainSupported) {
    return {
      valid: false,
      error: new WalletConnectError(
        WalletConnectErrorCode.UNRECOGNIZED_CHAIN,
        `Chain ${chainId} not authorized in this session`
      ),
    };
  }

  // Check if method is supported in session
  const methodSupported = namespace.methods?.includes(method) || false;
  if (!methodSupported) {
    return {
      valid: false,
      error: new WalletConnectError(
        WalletConnectErrorCode.UNSUPPORTED_METHOD,
        `Method ${method} not authorized in this session`
      ),
    };
  }

  return { valid: true };
}

/**
 * Extract chain ID from CAIP-2 format (eip155:1 -> 1)
 */
export function extractChainId(caipChainId: string): number {
  const parts = caipChainId.split(':');
  if (parts.length !== 2 || parts[0] !== 'eip155') {
    throw new Error(`Invalid CAIP-2 chain ID: ${caipChainId}`);
  }
  return parseInt(parts[1], 10);
}

/**
 * Convert chain ID to CAIP-2 format (1 -> eip155:1)
 */
export function toCAIP2ChainId(chainId: number): string {
  return `eip155:${chainId}`;
}
