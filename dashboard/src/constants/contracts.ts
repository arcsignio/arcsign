/**
 * ArcSign Contract & Business Constants (Single Source of Truth)
 *
 * All contract addresses, chain config, and business rules should be imported from here.
 * Do NOT hardcode these values in other files.
 */

// ============================================================================
// Network Configuration
// ============================================================================

export const IS_TESTNET = false; // Production: BSC Mainnet

// Contract addresses
export const CONTRACTS = {
  mainnet: {
    nftContract: '0x02EA7B4870Aa0553EF357Af6475727f1E01c7b2F',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    chainId: 56,
    chainName: 'bnb',
    explorer: 'https://bscscan.com',
  },
  testnet: {
    nftContract: '0x6CB59d29BE5b618eeca9Bc5374648477256f109A',
    usdt: '0x7ef95a0fee0dd31b22626fa2e10ee6a223f8a684',
    chainId: 97,
    chainName: 'bnb-testnet',
    explorer: 'https://testnet.bscscan.com',
  },
} as const;

export const ACTIVE_NETWORK = IS_TESTNET ? CONTRACTS.testnet : CONTRACTS.mainnet;

// ============================================================================
// Business Constants
// ============================================================================

// Membership price in USDT (18 decimals)
export const MEMBERSHIP_PRICE = IS_TESTNET ? '5000000000000000000' : '30000000000000000000';

// Wallet limit formula: WALLET_LIMIT_FREE + (nftCount * WALLET_LIMIT_PER_NFT)
export const WALLET_LIMIT_FREE = 1;
export const WALLET_LIMIT_PER_NFT = 3;

/** Calculate wallet limit based on NFT count */
export function walletLimit(nftCount: number): number {
  return WALLET_LIMIT_FREE + (nftCount * WALLET_LIMIT_PER_NFT);
}

// ============================================================================
// Function Selectors (ABI)
// ============================================================================

export const APPROVE_SELECTOR = '0x095ea7b3';
export const MINT_SELECTOR = '0x1249c58b';
export const BIND_DEVICE_SELECTOR = '0x2754da0a';
