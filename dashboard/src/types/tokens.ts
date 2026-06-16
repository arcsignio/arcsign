/**
 * Token balance types for multi-chain asset queries
 * Feature: Asset-first wallet view with Alchemy API integration
 */

export interface TokenBalance {
  address: string;
  network: string;
  networkLabel: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenLogo: string;
  balance: string;
  rawBalance: string;
  decimals: number;
  usdValue: number;
  priceUsd: number;
  error?: string;
}

export interface ProviderUnavailable {
  provider: string; // "alchemy" / "nodereal"
  reason: string; // "missing_key" / "query_failed"
}

export interface TokenBalancesResponse {
  tokens: TokenBalance[];
  totalUsd: number;
  addressCount: number;
  networkCount: number;
  /** Providers that could not be queried (missing key / failure), so the UI
   *  can distinguish "no balance" from "not fetched". */
  unavailableProviders?: ProviderUnavailable[];
}

export interface GetTokenBalancesParams {
  walletId: string;
  password: string; // Wallet password (for wallet decryption)
  usbPath: string;
  sessionToken?: string; // Session token for app-level auth
  appPassword?: string; // DEPRECATED: Only for backward compatibility with old sessions
  includeTestnets?: boolean; // Include testnet networks (dev mode)
}
