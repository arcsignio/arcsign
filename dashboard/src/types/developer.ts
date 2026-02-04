/**
 * Developer Mode Types
 *
 * Type definitions for developer mode signing requests and sessions.
 *
 * Created: 2026-02-04
 */

/**
 * Developer signing request from Hardhat/Foundry scripts
 */
export interface DevSignRequest {
  /** Unique request ID */
  id: string;

  /** Request type: deploy, call, or sign */
  type: 'deploy' | 'call' | 'sign';

  /** Human-readable description */
  description?: string;

  /** Sender address */
  from: string;

  /** Target contract address (null for deployments) */
  to?: string;

  /** Transaction data (hex encoded) */
  data?: string;

  /** Value in wei (hex encoded) */
  value?: string;

  /** Estimated gas cost in wei */
  estimatedGas?: string;

  /** Network identifier (e.g., 'ethereum', 'bsc', 'sepolia') */
  network: string;

  /** Chain ID */
  chainId: number;

  /** Source script name */
  scriptName?: string;

  /** Project path */
  projectPath?: string;

  /** Decoded calldata information */
  decodedCalldata?: {
    /** Method name (e.g., 'transfer', 'approve') */
    method: string;
    /** Decoded parameters */
    params?: Record<string, unknown>;
  };

  /** Request status */
  status?: 'pending' | 'approved' | 'rejected';

  /** Timestamp when request was created */
  timestamp?: number;

  /** Transaction hash (after signing) */
  txHash?: string;
}

/**
 * Developer session for auto-signing
 */
export interface DevSession {
  /** Whether session is enabled */
  enabled: boolean;

  /** Wallet ID associated with session */
  walletId?: string;

  /** Session creation timestamp */
  createdAt: number;

  /** Session expiration timestamp */
  expiresAt: number;

  /** Networks that auto-sign is enabled for */
  trustedNetworks: string[];

  /** Maximum gas limit for auto-signing (wei) */
  maxGasLimit?: string;

  /** Total gas spent in this session */
  totalSpentGas?: string;

  /** Number of signatures in this session */
  signCount: number;
}

/**
 * Developer context sent with signing requests
 */
export interface DevContext {
  /** Source script name */
  scriptName?: string;

  /** Project directory path */
  projectPath?: string;

  /** Description of the operation */
  description?: string;

  /** Whether using a dedicated dev wallet */
  isDevWallet: boolean;
}

/**
 * WebSocket methods for developer mode
 */
export type DevWsMethod =
  | 'dev_sign_transaction'
  | 'personal_sign'
  | 'eth_signTypedData_v4'
  | 'dev_get_session'
  | 'dev_create_session'
  | 'dev_end_session';

/**
 * Developer mode WebSocket request
 */
export interface DevWsRequest {
  id: number;
  method: DevWsMethod;
  params: {
    context?: DevContext;
    [key: string]: unknown;
  };
}

/**
 * Developer mode WebSocket response
 */
export interface DevWsResponse {
  id: number;
  success: boolean;
  result?: unknown;
  error?: string;
}
