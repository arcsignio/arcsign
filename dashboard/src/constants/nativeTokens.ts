/**
 * Native Token Metadata
 * For chains' native tokens that don't appear in token lists
 * Using local icons for reliability (no CDN dependency)
 */

export interface NativeTokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  chainId: number;
  chainName: string;
  network: string;
}

/**
 * Native tokens for each blockchain
 * These are the coins used for gas fees
 * Icons are stored locally in public/icons/tokens/
 */
export const NATIVE_TOKENS: Record<string, NativeTokenMetadata> = {
  // Ethereum
  "eth-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "/icons/tokens/eth.png",
    chainId: 1,
    chainName: "Ethereum",
    network: "eth-mainnet",
  },

  // BNB Chain (BSC)
  "bsc-mainnet": {
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    logoURI: "/icons/tokens/bnb.png",
    chainId: 56,
    chainName: "BNB Chain",
    network: "bsc-mainnet",
  },

  // Polygon
  "polygon-mainnet": {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
    logoURI: "/icons/tokens/matic.png",
    chainId: 137,
    chainName: "Polygon",
    network: "polygon-mainnet",
  },

  // Arbitrum One
  "arbitrum-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "/icons/tokens/eth.png",
    chainId: 42161,
    chainName: "Arbitrum One",
    network: "arbitrum-mainnet",
  },

  // Optimism
  "optimism-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "/icons/tokens/eth.png",
    chainId: 10,
    chainName: "Optimism",
    network: "optimism-mainnet",
  },

  // Base
  "base-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "/icons/tokens/eth.png",
    chainId: 8453,
    chainName: "Base",
    network: "base-mainnet",
  },

  // Avalanche
  "avalanche-mainnet": {
    symbol: "AVAX",
    name: "Avalanche",
    decimals: 18,
    logoURI: "/icons/chains/avax.png",
    chainId: 43114,
    chainName: "Avalanche",
    network: "avalanche-mainnet",
  },

  // Bitcoin
  "btc-mainnet": {
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
    logoURI: "/icons/tokens/btc.png",
    chainId: 0,
    chainName: "Bitcoin",
    network: "btc-mainnet",
  },

  // Testnets (for development)
  "eth-sepolia": {
    symbol: "ETH",
    name: "Sepolia ETH",
    decimals: 18,
    logoURI: "/icons/tokens/eth.png",
    chainId: 11155111,
    chainName: "Sepolia Testnet",
    network: "eth-sepolia",
  },
  "arbitrum-sepolia": {
    symbol: "ETH",
    name: "Arbitrum Sepolia ETH",
    decimals: 18,
    logoURI: "/icons/tokens/eth.png",
    chainId: 421614,
    chainName: "Arbitrum Sepolia",
    network: "arbitrum-sepolia",
  },
  "optimism-sepolia": {
    symbol: "ETH",
    name: "Optimism Sepolia ETH",
    decimals: 18,
    logoURI: "/icons/tokens/eth.png",
    chainId: 11155420,
    chainName: "Optimism Sepolia",
    network: "optimism-sepolia",
  },
};

/**
 * Get native token metadata for a chain
 */
export function getNativeToken(network: string): NativeTokenMetadata | null {
  return NATIVE_TOKENS[network] || null;
}

// The 0xEeee…EEeE sentinel many DEXs/aggregators use to mean "native coin".
const NATIVE_EEEE_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/**
 * Check if an address is a native-coin sentinel: zero address, empty, or the
 * common 0xEeee…EEeE placeholder (case-insensitive).
 */
export function isNativeTokenAddress(address: string): boolean {
  if (!address) return true;
  const a = address.toLowerCase();
  return (
    a === "0x0000000000000000000000000000000000000000" ||
    a === "0x0" ||
    a === NATIVE_EEEE_SENTINEL
  );
}

/**
 * Map network label to network key
 */
export const NETWORK_LABEL_TO_KEY: Record<string, string> = {
  // User-friendly labels
  Ethereum: "eth-mainnet",
  "BNB Chain": "bsc-mainnet",
  Polygon: "polygon-mainnet",
  "Polygon PoS": "polygon-mainnet",
  Arbitrum: "arbitrum-mainnet",
  "Arbitrum One": "arbitrum-mainnet",
  Optimism: "optimism-mainnet",
  Base: "base-mainnet",
  Avalanche: "avalanche-mainnet",
  "Avalanche C-Chain": "avalanche-mainnet",
  Bitcoin: "btc-mainnet",

  // Internal Network IDs (canonical format)
  // Backend API always returns these Internal IDs after adapter conversion
  "eth-mainnet": "eth-mainnet",
  "polygon-mainnet": "polygon-mainnet",
  "matic-mainnet": "polygon-mainnet",
  "arbitrum-mainnet": "arbitrum-mainnet",
  "arb-mainnet": "arbitrum-mainnet",
  "optimism-mainnet": "optimism-mainnet",
  "opt-mainnet": "optimism-mainnet",
  "base-mainnet": "base-mainnet",
  "avalanche-mainnet": "avalanche-mainnet",
  "avax-mainnet": "avalanche-mainnet",
  "bnb-mainnet": "bsc-mainnet",
  "bsc-mainnet": "bsc-mainnet",

  // Testnets
  "eth-sepolia": "eth-sepolia",
  "Sepolia": "eth-sepolia",
  "Sepolia Testnet": "eth-sepolia",
  "arbitrum-sepolia": "arbitrum-sepolia",
  "optimism-sepolia": "optimism-sepolia",
};

/**
 * Get network key from label (case-insensitive)
 */
export function getNetworkKey(networkLabel: string): string | null {
  // Try exact match first
  if (NETWORK_LABEL_TO_KEY[networkLabel]) {
    return NETWORK_LABEL_TO_KEY[networkLabel];
  }

  // Try case-insensitive match
  const lowerLabel = networkLabel.toLowerCase();
  for (const [key, value] of Object.entries(NETWORK_LABEL_TO_KEY)) {
    if (key.toLowerCase() === lowerLabel) {
      return value;
    }
  }

  // Try partial match for network id in string
  if (lowerLabel.includes("polygon") || lowerLabel.includes("matic")) {
    return "polygon-mainnet";
  }
  if (lowerLabel.includes("arbitrum")) {
    return "arbitrum-mainnet";
  }
  if (lowerLabel.includes("optimism")) {
    return "optimism-mainnet";
  }
  if (lowerLabel.includes("bnb") || lowerLabel.includes("bsc")) {
    return "bsc-mainnet";
  }
  // Check for Sepolia testnet before generic eth match
  if (lowerLabel.includes("sepolia")) {
    return "eth-sepolia";
  }
  if (lowerLabel.includes("eth") && !lowerLabel.includes("weth")) {
    return "eth-mainnet";
  }
  if (lowerLabel.includes("base")) {
    return "base-mainnet";
  }
  if (lowerLabel.includes("avax") || lowerLabel.includes("avalanche")) {
    return "avalanche-mainnet";
  }
  if (lowerLabel.includes("btc") || lowerLabel.includes("bitcoin")) {
    return "btc-mainnet";
  }

  return null;
}
