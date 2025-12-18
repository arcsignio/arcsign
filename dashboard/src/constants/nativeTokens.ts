/**
 * Native Token Metadata
 * For chains' native tokens that don't appear in token lists
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
 */
export const NATIVE_TOKENS: Record<string, NativeTokenMetadata> = {
  // Ethereum
  "eth-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    chainId: 1,
    chainName: "Ethereum",
    network: "eth-mainnet",
  },

  // BNB Chain (BSC)
  "bsc-mainnet": {
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    logoURI:
      "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    chainId: 56,
    chainName: "BNB Chain",
    network: "bsc-mainnet",
  },

  // Polygon
  "polygon-mainnet": {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
    chainId: 137,
    chainName: "Polygon",
    network: "polygon-mainnet",
  },

  // Arbitrum One
  "arbitrum-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    chainId: 42161,
    chainName: "Arbitrum One",
    network: "arbitrum-mainnet",
  },

  // Optimism
  "optimism-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    chainId: 10,
    chainName: "Optimism",
    network: "optimism-mainnet",
  },

  // Base
  "base-mainnet": {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    chainId: 8453,
    chainName: "Base",
    network: "base-mainnet",
  },

  // Bitcoin
  "btc-mainnet": {
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
    logoURI: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    chainId: 0,
    chainName: "Bitcoin",
    network: "btc-mainnet",
  },

  // Testnets (for development)
  "eth-sepolia": {
    symbol: "ETH",
    name: "Sepolia ETH",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    chainId: 11155111,
    chainName: "Sepolia Testnet",
    network: "eth-sepolia",
  },
};

/**
 * Get native token metadata for a chain
 */
export function getNativeToken(network: string): NativeTokenMetadata | null {
  return NATIVE_TOKENS[network] || null;
}

/**
 * Check if an address is a native token (zero address or empty)
 */
export function isNativeTokenAddress(address: string): boolean {
  return (
    !address ||
    address === "0x0000000000000000000000000000000000000000" ||
    address === "0x0"
  );
}

/**
 * Map network label to network key
 */
export const NETWORK_LABEL_TO_KEY: Record<string, string> = {
  Ethereum: "eth-mainnet",
  "BNB Chain": "bsc-mainnet",
  Polygon: "polygon-mainnet",
  "Polygon PoS": "polygon-mainnet",
  "matic-mainnet": "polygon-mainnet",
  Arbitrum: "arbitrum-mainnet",
  "Arbitrum One": "arbitrum-mainnet",
  Optimism: "optimism-mainnet",
  Base: "base-mainnet",
  Bitcoin: "btc-mainnet",
  // Testnets (for development)
  "eth-sepolia": "eth-sepolia",
  "Sepolia": "eth-sepolia",
  "Sepolia Testnet": "eth-sepolia",
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
  if (lowerLabel.includes("btc") || lowerLabel.includes("bitcoin")) {
    return "btc-mainnet";
  }

  return null;
}
