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
 *       accounts: "arcsign",  // Use ArcSign wallet
 *     },
 *   },
 * };
 * ```
 */

import { extendConfig, extendEnvironment } from "hardhat/config";
import { HardhatConfig, HardhatUserConfig, HttpNetworkUserConfig } from "hardhat/types";
import { ArcSignProvider } from "./ArcSignProvider";

// Extend Hardhat's config types
declare module "hardhat/types/config" {
  interface HttpNetworkUserConfig {
    accounts?: "arcsign" | string[] | { mnemonic: string; path?: string; initialIndex?: number; count?: number };
  }

  interface HttpNetworkConfig {
    accounts: "arcsign" | string[] | { mnemonic: string; path?: string; initialIndex?: number; count?: number };
  }
}

// Extend Hardhat runtime environment
declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    arcsign: {
      provider: ArcSignProvider;
      isConnected: () => Promise<boolean>;
      getAccounts: () => Promise<string[]>;
    };
  }
}

// Default WebSocket configuration
const DEFAULT_WS_URL = "ws://127.0.0.1:9527";

// Extend config to handle "arcsign" accounts
extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  // Process each network config
  for (const networkName of Object.keys(userConfig.networks || {})) {
    const networkConfig = userConfig.networks?.[networkName] as HttpNetworkUserConfig | undefined;

    if (networkConfig?.accounts === "arcsign") {
      // Mark this network as using ArcSign
      // The actual signer will be created at runtime
      console.log(`[ArcSign] Network "${networkName}" will use ArcSign wallet for signing`);
    }
  }
});

// Extend the Hardhat Runtime Environment
extendEnvironment((hre) => {
  // Create ArcSign provider
  const arcsignProvider = new ArcSignProvider(DEFAULT_WS_URL);

  // Add arcsign namespace to hre
  hre.arcsign = {
    provider: arcsignProvider,
    isConnected: () => arcsignProvider.isConnected(),
    getAccounts: () => arcsignProvider.getAccounts(),
  };

  // Override getSigners for networks using ArcSign
  const originalGetSigners = hre.ethers.getSigners.bind(hre.ethers);

  hre.ethers.getSigners = async () => {
    const networkConfig = hre.network.config as HttpNetworkUserConfig;

    if (networkConfig.accounts === "arcsign") {
      // Connect to ArcSign if not already connected
      if (!(await arcsignProvider.isConnected())) {
        await arcsignProvider.connect();
      }

      // Get signers from ArcSign
      const signers = await arcsignProvider.getSigners(hre.ethers.provider);
      return signers;
    }

    // Fall back to default behavior
    return originalGetSigners();
  };
});

// Export types and classes
export { ArcSignProvider } from "./ArcSignProvider";
export { ArcSignSigner } from "./ArcSignSigner";
export { ArcSignClient } from "./ArcSignClient";
