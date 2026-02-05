/**
 * Utility functions for ArcSign Hardhat Plugin
 */

/**
 * Explorer name type
 */
export type ExplorerName =
  | "etherscan"
  | "bscscan"
  | "polygonscan"
  | "arbiscan"
  | "optimism"
  | "basescan"
  | "snowtrace";

/**
 * Chain ID to explorer name mapping
 */
const CHAIN_ID_TO_EXPLORER: Record<number, ExplorerName> = {
  // Etherscan (Ethereum)
  1: "etherscan", // Ethereum Mainnet
  11155111: "etherscan", // Sepolia
  5: "etherscan", // Goerli (deprecated)

  // BSCScan
  56: "bscscan", // BSC Mainnet
  97: "bscscan", // BSC Testnet

  // Polygonscan
  137: "polygonscan", // Polygon Mainnet
  80001: "polygonscan", // Mumbai (deprecated)
  80002: "polygonscan", // Amoy

  // Arbiscan
  42161: "arbiscan", // Arbitrum One
  421614: "arbiscan", // Arbitrum Sepolia

  // Optimism Etherscan
  10: "optimism", // Optimism Mainnet
  11155420: "optimism", // Optimism Sepolia

  // Basescan
  8453: "basescan", // Base Mainnet
  84532: "basescan", // Base Sepolia

  // Snowtrace (Avalanche)
  43114: "snowtrace", // Avalanche C-Chain
  43113: "snowtrace", // Avalanche Fuji
};

/**
 * Get explorer name for a given chain ID
 *
 * @param chainId - The blockchain chain ID
 * @returns Explorer name or null if not supported
 */
export function getExplorerForChainId(chainId: number): ExplorerName | null {
  return CHAIN_ID_TO_EXPLORER[chainId] || null;
}

/**
 * Get chain ID for network name (common network names)
 *
 * @param networkName - Network name (e.g., "mainnet", "sepolia", "bscTestnet")
 * @returns Chain ID or null if not recognized
 */
export function getChainIdForNetwork(networkName: string): number | null {
  const NETWORK_TO_CHAIN_ID: Record<string, number> = {
    // Ethereum
    mainnet: 1,
    ethereum: 1,
    sepolia: 11155111,
    goerli: 5,

    // BSC
    bsc: 56,
    bscMainnet: 56,
    bscTestnet: 97,

    // Polygon
    polygon: 137,
    polygonMainnet: 137,
    mumbai: 80001,
    polygonAmoy: 80002,

    // Arbitrum
    arbitrum: 42161,
    arbitrumOne: 42161,
    arbitrumSepolia: 421614,

    // Optimism
    optimism: 10,
    optimismMainnet: 10,
    optimismSepolia: 11155420,

    // Base
    base: 8453,
    baseMainnet: 8453,
    baseSepolia: 84532,

    // Avalanche
    avalanche: 43114,
    avalancheMainnet: 43114,
    avalancheFuji: 43113,
    fuji: 43113,
  };

  return NETWORK_TO_CHAIN_ID[networkName] || null;
}

/**
 * Check if a chain ID is a testnet
 *
 * @param chainId - The blockchain chain ID
 * @returns True if testnet, false otherwise
 */
export function isTestnet(chainId: number): boolean {
  const TESTNET_CHAIN_IDS = [
    5, // Goerli
    11155111, // Sepolia
    97, // BSC Testnet
    80001, // Mumbai
    80002, // Amoy
    421614, // Arbitrum Sepolia
    11155420, // Optimism Sepolia
    84532, // Base Sepolia
    43113, // Avalanche Fuji
  ];

  return TESTNET_CHAIN_IDS.includes(chainId);
}
