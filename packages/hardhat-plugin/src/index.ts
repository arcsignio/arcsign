/**
 * @arcsign/hardhat-plugin
 *
 * Hardhat plugin for secure transaction signing with ArcSign wallet.
 * Eliminates the need for private keys in .env files.
 *
 * Usage in hardhat.config.ts:
 *
 * ```typescript
 * import "@arcsign/hardhat-plugin";
 *
 * export default {
 *   networks: {
 *     mainnet: {
 *       url: process.env.RPC_URL,
 *       accounts: [],     // Empty - ArcSign provides signers
 *       arcsign: true,    // Enable ArcSign for this network
 *     },
 *   },
 * };
 * ```
 */

import { extendConfig, extendEnvironment, task } from "hardhat/config";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types";
import { ArcSignProvider } from "./ArcSignProvider";
import { ArcSignClient } from "./ArcSignClient";
import { getExplorerForChainId } from "./utils";

// Type guard to check if network uses ArcSign
function isArcSignEnabled(config: unknown): boolean {
  return typeof config === "object" && config !== null && (config as { arcsign?: boolean }).arcsign === true;
}

// Extend Hardhat runtime environment
declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    arcsign: {
      provider: ArcSignProvider;
      client: ArcSignClient;
      isConnected: () => Promise<boolean>;
      getAccounts: () => Promise<string[]>;
      getExplorerApiKey: (explorer: string) => Promise<string | null>;
    };
  }
}

// Extend Hardhat config for etherscan (from @nomicfoundation/hardhat-verify)
declare module "hardhat/types/config" {
  interface HardhatConfig {
    etherscan?: {
      apiKey?: string | Record<string, string>;
      customChains?: unknown[];
    };
  }
}

// Default WebSocket configuration
const DEFAULT_WS_URL = "ws://127.0.0.1:9527";

// Extend config to handle arcsign networks
extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  // Process each network config
  for (const networkName of Object.keys(userConfig.networks || {})) {
    const networkConfig = userConfig.networks?.[networkName];

    if (isArcSignEnabled(networkConfig)) {
      // Mark this network as using ArcSign
      // The actual signer will be created at runtime
      console.log(`[ArcSign] Network "${networkName}" will use ArcSign wallet for signing`);
    }
  }
});

// Extend the Hardhat Runtime Environment
extendEnvironment((hre) => {
  // Create ArcSign provider and client
  const arcsignProvider = new ArcSignProvider(DEFAULT_WS_URL);
  const arcsignClient = new ArcSignClient(DEFAULT_WS_URL);

  // Add arcsign namespace to hre
  (hre as any).arcsign = {
    provider: arcsignProvider,
    client: arcsignClient,
    isConnected: () => arcsignProvider.isConnected(),
    getAccounts: () => arcsignProvider.getAccounts(),
    getExplorerApiKey: async (explorer: string) => {
      try {
        if (!arcsignClient.isConnected()) {
          await arcsignClient.connect();
        }
        return await arcsignClient.getExplorerApiKey(explorer);
      } catch (err) {
        console.error(`[ArcSign] Failed to get API key for ${explorer}:`, err);
        return null;
      }
    },
  };

  // Override getSigners for networks using ArcSign
  // This requires @nomicfoundation/hardhat-ethers to be installed
  const hreAny = hre as any;
  if (hreAny.ethers && typeof hreAny.ethers.getSigners === "function") {
    const originalGetSigners = hreAny.ethers.getSigners.bind(hreAny.ethers);

    hreAny.ethers.getSigners = async () => {
      const networkConfig = hre.network.config;

      if (isArcSignEnabled(networkConfig)) {
        // Connect to ArcSign if not already connected
        if (!(await arcsignProvider.isConnected())) {
          await arcsignProvider.connect();
        }

        // Get signers from ArcSign
        const signers = await arcsignProvider.getSigners(hreAny.ethers.provider);
        return signers;
      }

      // Fall back to default behavior
      return originalGetSigners();
    };
  }
});

// Override the verify task to auto-inject API keys from ArcSign
task("verify", async (taskArgs, hre, runSuper) => {
  // Get the current network's chain ID
  const chainId = hre.network.config.chainId;

  if (chainId) {
    const explorer = getExplorerForChainId(chainId);

    if (explorer) {
      console.log(`[ArcSign] Checking for ${explorer} API key...`);

      try {
        const apiKey = await (hre as any).arcsign.getExplorerApiKey(explorer);

        if (apiKey) {
          console.log(`[ArcSign] Found ${explorer} API key, injecting into config...`);

          // Inject the API key into the config
          // This works with both @nomiclabs/hardhat-etherscan and @nomicfoundation/hardhat-verify
          const config = hre.config as any;
          if (!config.etherscan) {
            config.etherscan = { apiKey: {} };
          }

          const etherscanConfig = config.etherscan;

          // Handle both single string and object format for apiKey
          if (typeof etherscanConfig.apiKey === "string") {
            // If it's already a string, keep it (user configured)
            console.log(`[ArcSign] API key already configured, using existing...`);
          } else if (!etherscanConfig.apiKey) {
            // Set as single API key if none exists
            etherscanConfig.apiKey = apiKey;
          } else {
            // It's an object, set for the specific network
            const networkKey = getEtherscanNetworkKey(chainId);
            if (networkKey) {
              (etherscanConfig.apiKey as Record<string, string>)[networkKey] = apiKey;
            }
          }
        } else {
          console.log(`[ArcSign] No ${explorer} API key found in ArcSign settings`);
          console.log(`[ArcSign] You can configure it in Developer Mode > Settings`);
        }
      } catch (err) {
        // Not a critical error, continue with verification
        console.log(`[ArcSign] Could not fetch API key (is Dashboard running?)`);
      }
    }
  }

  // Continue with the original verify task
  return runSuper(taskArgs);
});

/**
 * Get the etherscan config network key for a chain ID
 */
function getEtherscanNetworkKey(chainId: number): string | null {
  const mapping: Record<number, string> = {
    // Ethereum
    1: "mainnet",
    11155111: "sepolia",
    5: "goerli",
    // BSC
    56: "bsc",
    97: "bscTestnet",
    // Polygon
    137: "polygon",
    80001: "polygonMumbai",
    80002: "polygonAmoy",
    // Arbitrum
    42161: "arbitrumOne",
    421614: "arbitrumSepolia",
    // Optimism
    10: "optimisticEthereum",
    11155420: "optimisticSepolia",
    // Base
    8453: "base",
    84532: "baseSepolia",
    // Avalanche
    43114: "avalanche",
    43113: "avalancheFujiTestnet",
  };
  return mapping[chainId] || null;
}

// Export types and classes
export { ArcSignProvider } from "./ArcSignProvider";
export { ArcSignSigner } from "./ArcSignSigner";
export { ArcSignClient } from "./ArcSignClient";
export { getExplorerForChainId, isTestnet, getChainIdForNetwork } from "./utils";
