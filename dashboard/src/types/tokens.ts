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

export interface TokenBalancesResponse {
  tokens: TokenBalance[];
  totalUsd: number;
  addressCount: number;
  networkCount: number;
}

export interface GetTokenBalancesParams {
  walletId: string;
  password: string; // Wallet password (for wallet decryption)
  usbPath: string;
  sessionToken?: string; // PREFERRED: Session token for app-level auth
  appPassword: string; // DEPRECATED: Still needed for provider_config decryption
  includeTestnets?: boolean; // Include testnet networks (dev mode)
}
