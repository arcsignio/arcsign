/**
 * WalletConnect v2 Type Definitions
 * Feature: Type-safe WalletConnect integration
 * Updated: 2026-01-23
 */

import type { SessionTypes, SignClientTypes, ProposalTypes } from '@walletconnect/types';

// Supported EVM chains (CAIP-2 format)
export const SUPPORTED_CHAINS = {
  ETHEREUM: 'eip155:1',
  BSC: 'eip155:56',
  POLYGON: 'eip155:137',
  ARBITRUM: 'eip155:42161',
  OPTIMISM: 'eip155:10',
  BASE: 'eip155:8453',
  AVALANCHE: 'eip155:43114',
} as const;

export type SupportedChain = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

// Chain ID mapping
export const CHAIN_ID_MAP: Record<number, SupportedChain> = {
  1: SUPPORTED_CHAINS.ETHEREUM,
  56: SUPPORTED_CHAINS.BSC,
  137: SUPPORTED_CHAINS.POLYGON,
  42161: SUPPORTED_CHAINS.ARBITRUM,
  10: SUPPORTED_CHAINS.OPTIMISM,
  8453: SUPPORTED_CHAINS.BASE,
  43114: SUPPORTED_CHAINS.AVALANCHE,
};

// Reverse mapping
export const SUPPORTED_CHAIN_IDS = [1, 56, 137, 42161, 10, 8453, 43114] as const;

// Supported methods
// Note: Read-only methods (eth_getBalance, eth_call, etc.) are NOT supported.
// dApps should use their own RPC providers for these queries.
// Account info is provided via session namespaces during connection.
export const SUPPORTED_METHODS = [
  // Signing methods (require password)
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData_v4',

  // Chain management
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
] as const;

export type SupportedMethod = typeof SUPPORTED_METHODS[number];

// Supported events
export const SUPPORTED_EVENTS = [
  'chainChanged',
  'accountsChanged',
] as const;

export type SupportedEvent = typeof SUPPORTED_EVENTS[number];

// WalletConnect Client Configuration
export interface WalletConnectConfig {
  projectId: string;
  relayUrl?: string;
  metadata: SignClientTypes.Metadata;
}

// Session request parameters
export interface SessionRequestParams {
  topic: string;
  chainId: string;
  request: {
    method: string;
    params: unknown[];
  };
}

// Relay protocol (WalletConnect relay configuration)
export interface RelayProtocol {
  protocol: string;
  data?: string;
}

// Persisted session data
export interface PersistedSession {
  topic: string;
  pairingTopic?: string;
  relay: RelayProtocol;
  expiry: number;
  acknowledged: boolean;
  controller: string;
  namespaces: Record<string, SessionTypes.Namespace>;
  requiredNamespaces: ProposalTypes.RequiredNamespaces;
  optionalNamespaces?: ProposalTypes.OptionalNamespaces;
  sessionProperties?: Record<string, string>;
  peer: {
    publicKey: string;
    metadata: SignClientTypes.Metadata;
  };
  self: {
    publicKey: string;
    metadata: SignClientTypes.Metadata;
  };
  lastUsed: number; // Unix timestamp
}

// Error codes (EIP-1193 + WalletConnect)
export enum WalletConnectErrorCode {
  // User action errors
  USER_REJECTED = 4001,
  UNAUTHORIZED = 4100,
  UNSUPPORTED_METHOD = 4200,

  // Connection errors
  DISCONNECTED = 4900,
  CHAIN_DISCONNECTED = 4901,
  UNRECOGNIZED_CHAIN = 4902,

  // JSON-RPC errors
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

export class WalletConnectError extends Error {
  constructor(
    public code: WalletConnectErrorCode,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'WalletConnectError';
  }

  toJsonRpcError() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

// dApp metadata display
export interface DAppMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
}

// Session approval UI props
export interface SessionApprovalRequest {
  id: number;
  params: {
    id: number;
    pairingTopic: string;
    expiry: number;
    requiredNamespaces: ProposalTypes.RequiredNamespaces;
    optionalNamespaces?: ProposalTypes.OptionalNamespaces;
    relays: RelayProtocol[];
    proposer: {
      publicKey: string;
      metadata: DAppMetadata;
    };
  };
}

// Active session display
export interface ActiveSession {
  topic: string;
  dApp: DAppMetadata;
  chains: string[];
  methods: string[];
  lastUsed: Date;
  expiry: Date;
}
