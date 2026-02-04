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

import { extendConfig, extendEnvironment } from "hardhat/config";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types";
import { ArcSignProvider } from "./ArcSignProvider";

// Type guard to check if network uses ArcSign
function isArcSignEnabled(config: unknown): boolean {
  return typeof config === "object" && config !== null && (config as { arcsign?: boolean }).arcsign === true;
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
  // Create ArcSign provider
  const arcsignProvider = new ArcSignProvider(DEFAULT_WS_URL);

  // Add arcsign namespace to hre
  (hre as any).arcsign = {
    provider: arcsignProvider,
    isConnected: () => arcsignProvider.isConnected(),
    getAccounts: () => arcsignProvider.getAccounts(),
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

// Export types and classes
export { ArcSignProvider } from "./ArcSignProvider";
export { ArcSignSigner } from "./ArcSignSigner";
export { ArcSignClient } from "./ArcSignClient";
