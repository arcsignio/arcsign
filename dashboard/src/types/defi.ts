/**
 * DeFi Protocol Types
 * Feature: DeFi Integration with White-list Protocol Registry
 * Supports: Multi-chain Staking, Lending, and other verified DeFi protocols
 */

/**
 * Supported DeFi protocol categories
 */
export type DefiCategory =
  | "staking"      // Liquid staking (Lido, Rocket Pool)
  | "lending"      // Lending/Borrowing (Aave, Compound)
  | "dex"          // Decentralized exchanges
  | "yield"        // Yield farming/vaults
  | "bridge";      // Cross-chain bridges

/**
 * Supported blockchain networks for DeFi
 */
export type DefiNetwork =
  | "ethereum"
  | "bsc"          // BNB Chain
  | "polygon"
  | "arbitrum"
  | "optimism"
  | "base";

/**
 * Stakable asset definition
 * Represents a native token that can be staked on a specific chain
 */
export interface StakableAsset {
  symbol: string;           // "ETH", "BNB", "MATIC"
  name: string;             // "Ethereum", "BNB Chain", "Polygon"
  chainId: string;          // Internal chain ID for API calls
  network: DefiNetwork;     // Network type
  decimals: number;
  logoUrl: string;
  providers: StakingProvider[];
}

/**
 * Staking provider definition
 * Represents a liquid staking protocol for a specific asset
 */
export interface StakingProvider {
  id: string;               // "lido-eth", "ether-fi-eth", "ankr-bnb"
  name: string;             // "Lido", "Ether.fi", "Ankr"
  description: string;
  website: string;
  logoUrl: string;

  // Output token info
  outputToken: string;      // "stETH", "eETH", "aBNBc"
  outputTokenAddress: string;
  outputTokenDecimals: number;

  // Protocol metrics (APY to be filled later via API)
  apy?: number;
  tvlUsd?: number;
  minAmount: string;        // Minimum stake amount in wei/smallest unit

  // Security
  verified: boolean;
  audits: { auditor: string; date: string }[];

  // Contract info
  contractAddress: string;

  // Method to encode call data for this provider
  // Each provider may have different function signatures
  methodSignature: string;  // e.g., "submit(address)" or "deposit()"
}

/**
 * DeFi protocol security audit status
 */
export interface ProtocolAudit {
  auditor: string;
  date: string;
  reportUrl?: string;
}

/**
 * DeFi Protocol Definition (White-list Registry Entry)
 */
export interface DefiProtocol {
  id: string;                      // Unique identifier (e.g., "lido-eth")
  name: string;                    // Display name (e.g., "Lido")
  category: DefiCategory;
  description: string;
  website: string;
  logoUrl: string;

  // Supported networks and contract addresses
  contracts: {
    network: DefiNetwork;
    address: string;               // Main contract address
    tokenAddress?: string;         // Reward/receipt token address (e.g., stETH)
    tokenSymbol?: string;          // Token symbol
    tokenDecimals?: number;
  }[];

  // Security & verification
  audits: ProtocolAudit[];
  verified: boolean;               // Verified by our team
  tvlUsd?: number;                 // Total Value Locked

  // Protocol-specific metadata
  apy?: number;                    // Current APY (if applicable)
  minAmount?: string;              // Minimum stake/deposit amount
  features?: string[];             // Special features
}

/**
 * Staking-specific types
 */

export type StakingStep =
  | "selectOption"      // Select staking option (flat list of all provider+asset combinations)
  | "input"             // Enter amount
  | "review"            // Review transaction
  | "password"          // Enter wallet password
  | "signing"           // Signing in progress
  | "broadcasting"      // Broadcasting in progress
  | "success"           // Transaction submitted
  | "error";            // Error occurred

export interface StakingQuote {
  protocol: string;
  inputToken: string;
  inputAmount: string;
  outputToken: string;
  estimatedOutput: string;
  exchangeRate: string;
  apy: number;
  fee?: string;
  gasEstimate?: string;
}

export interface StakingTransactionData {
  to: string;
  value: string;
  data: string;
  gasLimit?: string;
}

/**
 * Staking position (user's staked balance)
 */
export interface StakingPosition {
  protocol: string;
  protocolName: string;
  network: DefiNetwork;
  stakedToken: string;
  stakedAmount: string;
  rewardToken: string;
  rewardAmount: string;
  apy: number;
  valueUsd?: number;
}
