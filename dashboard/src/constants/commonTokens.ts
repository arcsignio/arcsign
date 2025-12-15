/**
 * Common tokens configuration with CoinGecko Token Lists integration
 * Data sources:
 * - Token addresses: CoinGecko Token Lists (tokenlists.org)
 * - Icons: Embedded in token lists from CoinGecko
 * - Chain data: Multiple chains supported via token list service
 *
 * This file now acts as a lightweight wrapper around the tokenList service
 * for commonly used tokens and provides fallback configurations.
 */

import type { NormalizedToken } from "@/services/tokenList";

export interface CommonToken {
  symbol: string;
  name: string;
  decimals: number;
  logo: string; // URL or emoji fallback
  chains: {
    [chainId: string]: {
      address: string;
      chainName: string;
    };
  };
  coingeckoId?: string; // For price fetching
  category: "stablecoin" | "defi" | "exchange" | "layer1" | "layer2";
}

/**
 * Common tokens list - Using well-known contract addresses
 * All addresses are checksummed and verified
 */
export const COMMON_TOKENS: CommonToken[] = [
  // Stablecoins
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    category: "stablecoin",
    coingeckoId: "tether",
    chains: {
      "eth-mainnet": {
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        chainName: "Ethereum",
      },
      "polygon-mainnet": {
        address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        chainName: "Polygon",
      },
      "arbitrum-mainnet": {
        address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        chainName: "Arbitrum One",
      },
    },
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    category: "stablecoin",
    coingeckoId: "usd-coin",
    chains: {
      "eth-mainnet": {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        chainName: "Ethereum",
      },
      "polygon-mainnet": {
        address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        chainName: "Polygon",
      },
      "arbitrum-mainnet": {
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        chainName: "Arbitrum One",
      },
    },
  },
  // Native tokens (represented as wrapped versions for consistency)
  {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    category: "layer1",
    coingeckoId: "ethereum",
    chains: {
      "eth-mainnet": {
        address: "0x0000000000000000000000000000000000000000", // Native ETH
        chainName: "Ethereum",
      },
      "arbitrum-mainnet": {
        address: "0x0000000000000000000000000000000000000000",
        chainName: "Arbitrum One",
      },
    },
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    category: "defi",
    coingeckoId: "weth",
    chains: {
      "eth-mainnet": {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        chainName: "Ethereum",
      },
      "polygon-mainnet": {
        address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        chainName: "Polygon",
      },
    },
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
    logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    category: "layer1",
    coingeckoId: "bitcoin",
    chains: {
      "btc-mainnet": {
        address: "0x0000000000000000000000000000000000000000", // Native BTC
        chainName: "Bitcoin",
      },
    },
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    decimals: 8,
    logo: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
    category: "defi",
    coingeckoId: "wrapped-bitcoin",
    chains: {
      "eth-mainnet": {
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        chainName: "Ethereum",
      },
    },
  },
  // DeFi Tokens
  {
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/12504/small/uni.png",
    category: "defi",
    coingeckoId: "uniswap",
    chains: {
      "eth-mainnet": {
        address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        chainName: "Ethereum",
      },
    },
  },
  {
    symbol: "AAVE",
    name: "Aave",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/12645/small/aave.png",
    category: "defi",
    coingeckoId: "aave",
    chains: {
      "eth-mainnet": {
        address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
        chainName: "Ethereum",
      },
    },
  },
  // Layer 2 tokens
  {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
    category: "layer2",
    coingeckoId: "matic-network",
    chains: {
      "eth-mainnet": {
        address: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
        chainName: "Ethereum",
      },
      "polygon-mainnet": {
        address: "0x0000000000000000000000000000000000000000", // Native MATIC
        chainName: "Polygon",
      },
    },
  },
  {
    symbol: "OP",
    name: "Optimism",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
    category: "layer2",
    coingeckoId: "optimism",
    chains: {
      "optimism-mainnet": {
        address: "0x4200000000000000000000000000000000000042",
        chainName: "Optimism",
      },
    },
  },
  {
    symbol: "ARB",
    name: "Arbitrum",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
    category: "layer2",
    coingeckoId: "arbitrum",
    chains: {
      "arbitrum-mainnet": {
        address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        chainName: "Arbitrum One",
      },
    },
  },
  // Exchange tokens
  {
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    category: "exchange",
    coingeckoId: "binancecoin",
    chains: {
      "bsc-mainnet": {
        address: "0x0000000000000000000000000000000000000000", // Native BNB
        chainName: "BSC",
      },
    },
  },
  {
    symbol: "OKB",
    name: "OKB",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/4463/small/WeChat_Image_20220118095654.png",
    category: "exchange",
    coingeckoId: "okb",
    chains: {
      "eth-mainnet": {
        address: "0x75231F58b43240C9718Dd58B4967c5114342a86c",
        chainName: "Ethereum",
      },
    },
  },
];

/**
 * Emoji fallbacks for when token logos fail to load
 */
export const TOKEN_EMOJI_FALLBACKS: Record<string, string> = {
  USDT: "💵",
  USDC: "💵",
  DAI: "💵",
  BUSD: "💵",
  ETH: "💎",
  WETH: "💎",
  BTC: "₿",
  WBTC: "₿",
  UNI: "🦄",
  AAVE: "👻",
  MATIC: "🟣",
  WMATIC: "🟣",
  OP: "🔴",
  ARB: "🔵",
  BNB: "🟡",
  WBNB: "🟡",
  OKB: "⚫",
  LINK: "🔗",
  CRV: "🌊",
  MKR: "🎭",
  SNX: "⚡",
  COMP: "🏛️",
  SUSHI: "🍣",
  DEFAULT: "🪙",
};

/**
 * Priority tokens to display even with zero balance
 * Symbol-based lookup that works across chains
 */
export const PRIORITY_TOKEN_SYMBOLS = [
  // Stablecoins
  "USDT",
  "USDC",
  "DAI",
  "BUSD",
  // Native/Wrapped
  "ETH",
  "WETH",
  "BTC",
  "WBTC",
  "BNB",
  "WBNB",
  "MATIC",
  "WMATIC",
  // Top DeFi
  "UNI",
  "AAVE",
  "LINK",
  "CRV",
  "MKR",
  "SNX",
  "COMP",
  "SUSHI",
  // Layer 2
  "OP",
  "ARB",
  // Exchange
  "OKB",
] as const;

/**
 * Convert NormalizedToken to display format
 */
export function normalizeTokenForDisplay(token: NormalizedToken): {
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
} {
  return {
    address: "", // Will be filled when loaded with wallet addresses
    network: `chain-${token.chainId}`,
    networkLabel: token.chainName,
    tokenAddress: token.address,
    tokenSymbol: token.symbol,
    tokenName: token.name,
    tokenLogo: token.logoURI,
    balance: "0",
    rawBalance: "0",
    decimals: token.decimals,
    usdValue: 0,
    priceUsd: 0,
  };
}

/**
 * Get common tokens for a specific chain
 */
export function getCommonTokensForChain(chainId: string): CommonToken[] {
  return COMMON_TOKENS.filter((token) => token.chains[chainId]);
}

/**
 * Get token emoji fallback
 */
export function getTokenEmoji(symbol: string): string {
  return TOKEN_EMOJI_FALLBACKS[symbol] || TOKEN_EMOJI_FALLBACKS.DEFAULT;
}

/**
 * Chain ID mapping for easy reference
 */
export const CHAIN_IDS = {
  ETHEREUM: "eth-mainnet",
  POLYGON: "polygon-mainnet",
  ARBITRUM: "arbitrum-mainnet",
  OPTIMISM: "optimism-mainnet",
  BSC: "bsc-mainnet",
  BITCOIN: "btc-mainnet",
} as const;

/**
 * Get all unique token symbols (for display purposes)
 */
export function getAllTokenSymbols(): string[] {
  return Array.from(new Set(COMMON_TOKENS.map((t) => t.symbol)));
}
