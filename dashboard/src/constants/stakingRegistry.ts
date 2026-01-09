/**
 * Multi-Chain Staking Registry
 * Feature: White-list verified staking providers across multiple chains
 *
 * Currently supported:
 * - ETH: Lido (stETH), Ankr (ankrETH), ether.fi (eETH)
 * - BNB: Ankr (ankrBNB)
 */

import type { StakableAsset, StakingProvider } from "@/types/defi";

// =============================================================================
// Call Data Encoders
// =============================================================================

/**
 * Encode Lido submit(address _referral) call data
 * Used for: ETH staking on Lido
 */
export function encodeLidoSubmit(referral: string = "0x0000000000000000000000000000000000000000"): string {
  // Function selector: keccak256("submit(address)")[:4] = 0xa1903eab
  const selector = "a1903eab";
  const paddedAddress = referral.toLowerCase().replace("0x", "").padStart(64, "0");
  return "0x" + selector + paddedAddress;
}

/**
 * Encode Ankr stakeAndClaimCerts() call data for BNB
 * Used for: BNB staking on Ankr
 */
export function encodeAnkrBnbStake(): string {
  // Function selector: keccak256("stakeAndClaimCerts()")[:4]
  return "0x6e553f65";
}

/**
 * Encode Ankr stakeAndClaimAethC() call data for ETH
 * Used for: ETH staking on Ankr GlobalPool
 * Contract: 0x84db6eE82b7Cf3b47E8F19270abdE5718B936670
 */
export function encodeAnkrEthStake(): string {
  // Function selector: keccak256("stakeAndClaimAethC()")[:4]
  return "0xc70a9e82";
}

/**
 * Encode ether.fi deposit(address _referral) call data for ETH
 * Used for: ETH staking on ether.fi LiquidityPool
 * Contract: 0x308861A430be4cce5502d0A12724771Fc6DaF216
 */
export function encodeEtherfiDeposit(referral: string = "0x0000000000000000000000000000000000000000"): string {
  // Function selector: keccak256("deposit(address)")[:4] = 0xf340fa01
  const selector = "f340fa01";
  const paddedAddress = referral.toLowerCase().replace("0x", "").padStart(64, "0");
  return "0x" + selector + paddedAddress;
}

/**
 * Get encoder function for a provider
 */
export function getCallDataEncoder(providerId: string): (amount?: string, referral?: string) => string {
  switch (providerId) {
    case "lido-eth":
      return (_amount?: string, referral?: string) => encodeLidoSubmit(referral);
    case "ankr-eth":
      return () => encodeAnkrEthStake();
    case "etherfi-eth":
      return (_amount?: string, referral?: string) => encodeEtherfiDeposit(referral);
    case "ankr-bnb":
      return () => encodeAnkrBnbStake();
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

// =============================================================================
// ETH Staking Providers
// =============================================================================

const LIDO_ETH: StakingProvider = {
  id: "lido-eth",
  name: "Lido",
  description: "Stake ETH and receive stETH liquid staking tokens",
  website: "https://lido.fi",
  logoUrl: "https://coin-images.coingecko.com/coins/images/13442/small/steth_logo.png",

  outputToken: "stETH",
  outputTokenAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  outputTokenDecimals: 18,

  apy: undefined,  // Fetched from Lido API at runtime
  tvlUsd: undefined,  // Fetched from DeFiLlama API at runtime
  minAmount: "0",

  verified: true,
  audits: [
    { auditor: "Certora", date: "2024" },
    { auditor: "ChainSecurity", date: "2024" },
  ],

  contractAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
  methodSignature: "submit(address)",
};

const ANKR_ETH: StakingProvider = {
  id: "ankr-eth",
  name: "Ankr",
  description: "Stake ETH and receive ankrETH liquid staking tokens",
  website: "https://ankr.com",
  logoUrl: "https://coin-images.coingecko.com/coins/images/13403/small/ankr.png",

  outputToken: "ankrETH",
  outputTokenAddress: "0xE95A203B1a91a908F9B9CE46459d101078c2c3cb",
  outputTokenDecimals: 18,

  apy: undefined,  // Fetched from Ankr API at runtime
  tvlUsd: undefined,  // Fetched from Ankr API at runtime
  minAmount: "0",  // No minimum stake amount

  verified: true,
  audits: [
    { auditor: "Beosin", date: "2023" },
  ],

  contractAddress: "0x84db6eE82b7Cf3b47E8F19270abdE5718B936670", // Ankr GlobalPool Proxy
  methodSignature: "stakeAndClaimAethC()",
};

const ETHERFI_ETH: StakingProvider = {
  id: "etherfi-eth",
  name: "ether.fi",
  description: "Stake ETH and receive eETH liquid staking tokens with native restaking",
  website: "https://ether.fi",
  logoUrl: "https://coin-images.coingecko.com/coins/images/33049/small/ether.fi_eETH.png",

  outputToken: "eETH",
  outputTokenAddress: "0x35fA164735182de50811E8e2E824cFb9B6118ac2",
  outputTokenDecimals: 18,

  apy: undefined,  // Fetched from DeFiLlama API at runtime
  tvlUsd: undefined,  // Fetched from DeFiLlama API at runtime
  minAmount: "0",  // No minimum stake amount

  verified: true,
  audits: [
    { auditor: "Certora", date: "2024" },
    { auditor: "Nethermind", date: "2024" },
  ],

  contractAddress: "0x308861A430be4cce5502d0A12724771Fc6DaF216", // ether.fi LiquidityPool
  methodSignature: "deposit(address)",
};

// =============================================================================
// BNB Staking Providers
// =============================================================================

const ANKR_BNB: StakingProvider = {
  id: "ankr-bnb",
  name: "Ankr",
  description: "Stake BNB and receive ankrBNB",
  website: "https://ankr.com",
  logoUrl: "https://coin-images.coingecko.com/coins/images/28451/small/ankrBNB.png",

  outputToken: "ankrBNB",
  outputTokenAddress: "0x52F24a5e03aee338Da5fd9Df68D2b6FAe1178827",
  outputTokenDecimals: 18,

  apy: undefined,  // Fetched from Ankr API at runtime
  tvlUsd: undefined,  // Fetched from Ankr API at runtime
  minAmount: "100000000000000000", // 0.1 BNB

  verified: true,
  audits: [
    { auditor: "Beosin", date: "2023" },
  ],

  contractAddress: "0x9e347Af362059bf2E55839002c699F7A5BaFE86E", // Ankr BNB Staking
  methodSignature: "stakeAndClaimCerts()",
};

// =============================================================================
// Stakable Assets Registry
// =============================================================================

export const STAKABLE_ASSETS: StakableAsset[] = [
  {
    symbol: "ETH",
    name: "Ethereum",
    chainId: "ethereum",
    network: "ethereum",
    decimals: 18,
    logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    providers: [LIDO_ETH, ANKR_ETH, ETHERFI_ETH],
  },
  {
    symbol: "BNB",
    name: "BNB Chain",
    chainId: "bsc",
    network: "bsc",
    decimals: 18,
    logoUrl: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    providers: [ANKR_BNB],
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all stakable assets
 */
export function getStakableAssets(): StakableAsset[] {
  return STAKABLE_ASSETS;
}

/**
 * Get stakable asset by symbol
 */
export function getStakableAssetBySymbol(symbol: string): StakableAsset | undefined {
  return STAKABLE_ASSETS.find(a => a.symbol.toLowerCase() === symbol.toLowerCase());
}

/**
 * Get stakable asset by chain ID
 */
export function getStakableAssetByChainId(chainId: string): StakableAsset | undefined {
  return STAKABLE_ASSETS.find(a => a.chainId === chainId);
}

/**
 * Get staking provider by ID
 */
export function getStakingProviderById(providerId: string): StakingProvider | undefined {
  for (const asset of STAKABLE_ASSETS) {
    const provider = asset.providers.find(p => p.id === providerId);
    if (provider) return provider;
  }
  return undefined;
}

/**
 * Get providers for a specific asset
 */
export function getProvidersForAsset(symbol: string): StakingProvider[] {
  const asset = getStakableAssetBySymbol(symbol);
  return asset?.providers || [];
}

/**
 * Check if an asset is stakable
 */
export function isAssetStakable(symbol: string): boolean {
  return STAKABLE_ASSETS.some(a => a.symbol.toLowerCase() === symbol.toLowerCase());
}

/**
 * Get block explorer URL for transaction
 */
export function getExplorerTxUrl(chainId: string, txHash: string): string {
  const explorers: Record<string, string> = {
    ethereum: `https://etherscan.io/tx/${txHash}`,
    bsc: `https://bscscan.com/tx/${txHash}`,
    polygon: `https://polygonscan.com/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
    optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
    base: `https://basescan.org/tx/${txHash}`,
  };
  return explorers[chainId] || `https://etherscan.io/tx/${txHash}`;
}

// =============================================================================
// TVL Fetching Service
// =============================================================================

/**
 * Fetch TVL from DeFiLlama API for a protocol
 * API: https://api.llama.fi/tvl/{protocol_slug}
 * Free, no API key required
 */
async function fetchDefiLlamaTvl(protocolSlug: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.llama.fi/tvl/${protocolSlug}`);
    if (!response.ok) return null;

    const tvl = await response.json();
    // API returns a number directly (e.g., 27706467771.499653)
    return typeof tvl === "number" ? tvl : null;
  } catch (error) {
    console.error(`Failed to fetch TVL for ${protocolSlug}:`, error);
    return null;
  }
}

/**
 * Fetch Ankr TVL from official Ankr Staking Metrics API
 * API: https://api.staking.ankr.com/v1alpha/metrics
 * Returns totalStakedUsd for each service (ETH, BNB, etc.)
 */
async function fetchAnkrTvls(): Promise<Map<string, number>> {
  const ankrTvlMap = new Map<string, number>();

  try {
    const response = await fetch("https://api.staking.ankr.com/v1alpha/metrics");
    if (!response.ok) return ankrTvlMap;

    const data = await response.json();
    const services = Array.isArray(data) ? data : data.services || [];

    // Map service names to provider IDs
    const serviceToProvider: Record<string, string> = {
      eth: "ankr-eth",
      bnb: "ankr-bnb",
    };

    for (const service of services) {
      const serviceName = service.serviceName?.toLowerCase();
      const providerId = serviceToProvider[serviceName];

      if (providerId && service.totalStakedUsd) {
        // API returns totalStakedUsd as string (e.g., "28775808.61")
        const tvl = parseFloat(service.totalStakedUsd.replace(/[$,]/g, ""));
        if (!isNaN(tvl)) {
          ankrTvlMap.set(providerId, tvl);
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch Ankr TVLs:", error);
  }

  return ankrTvlMap;
}

/**
 * Fetch TVL data for all supported staking providers
 * Sources:
 * - Lido: DeFiLlama (https://api.llama.fi/tvl/lido)
 * - ether.fi: DeFiLlama (https://api.llama.fi/tvl/ether.fi)
 * - Ankr: Official API (https://api.staking.ankr.com/v1alpha/metrics)
 */
export async function fetchAllStakingTvls(): Promise<Map<string, number>> {
  const tvlMap = new Map<string, number>();

  const [lidoTvl, etherfiTvl, ankrTvls] = await Promise.all([
    fetchDefiLlamaTvl("lido"),
    fetchDefiLlamaTvl("ether.fi"),
    fetchAnkrTvls(),
  ]);

  if (lidoTvl !== null) {
    tvlMap.set("lido-eth", lidoTvl);
  }

  if (etherfiTvl !== null) {
    tvlMap.set("etherfi-eth", etherfiTvl);
  }

  // Merge Ankr TVLs (ETH, BNB)
  for (const [providerId, tvl] of ankrTvls) {
    tvlMap.set(providerId, tvl);
  }

  return tvlMap;
}

// =============================================================================
// APY Fetching Service
// =============================================================================

export interface StakingApyData {
  providerId: string;
  apy: number;
  updatedAt: number;
}

/**
 * Fetch Lido stETH APR from official API
 * API: https://eth-api.lido.fi/v1/protocol/steth/apr/last
 */
async function fetchLidoApy(): Promise<number | null> {
  try {
    const response = await fetch("https://eth-api.lido.fi/v1/protocol/steth/apr/last");
    if (!response.ok) return null;

    const data = await response.json();
    // API returns APR as percentage (e.g., 2.512 for 2.512%)
    return data?.data?.apr ?? null;
  } catch (error) {
    console.error("Failed to fetch Lido APY:", error);
    return null;
  }
}

/**
 * Fetch all Ankr staking APYs from official Ankr Staking Metrics API
 * API: https://api.staking.ankr.com/v1alpha/metrics
 * Returns APY for all supported Ankr staking services (ETH, BNB, etc.)
 */
async function fetchAnkrApys(): Promise<Map<string, number>> {
  const ankrApyMap = new Map<string, number>();

  try {
    const response = await fetch("https://api.staking.ankr.com/v1alpha/metrics");
    if (!response.ok) return ankrApyMap;

    const data = await response.json();
    // API returns an array of services
    const services = Array.isArray(data) ? data : data.services || [];

    // Map service names to provider IDs
    const serviceToProvider: Record<string, string> = {
      eth: "ankr-eth",
      bnb: "ankr-bnb",
    };

    for (const service of services) {
      const serviceName = service.serviceName?.toLowerCase();
      const providerId = serviceToProvider[serviceName];

      if (providerId && service.apy) {
        // API returns APY as string (e.g., "5.741214848742271" for 5.74%)
        ankrApyMap.set(providerId, parseFloat(service.apy));
      }
    }
  } catch (error) {
    console.error("Failed to fetch Ankr APYs:", error);
  }

  return ankrApyMap;
}

/**
 * Fetch ether.fi eETH APY from DeFiLlama Yields API
 * API: https://yields.llama.fi/pools
 * Returns APY for ether.fi eETH staking
 *
 * Note: DeFiLlama project slug is "ether.fi-stake" for liquid staking
 * Fallback to estimated value if API fails
 */
async function fetchEtherfiApy(): Promise<number | null> {
  try {
    const response = await fetch("https://yields.llama.fi/pools");
    if (!response.ok) {
      // Fallback to estimated APY (similar to Lido)
      return 3.0;
    }

    const data = await response.json();
    // Find ether.fi eETH pool on Ethereum
    // DeFiLlama uses various project names: "ether.fi", "ether.fi-stake", "etherfi"
    const pools = data?.data || [];
    const etherfiPool = pools.find(
      (p: { project?: string; symbol?: string; chain?: string }) =>
        (p.project === "ether.fi" ||
         p.project === "ether.fi-stake" ||
         p.project === "etherfi") &&
        (p.symbol?.toLowerCase().includes("eeth") ||
         p.symbol?.toLowerCase() === "eth") &&
        p.chain === "Ethereum"
    );

    if (etherfiPool?.apy) {
      return etherfiPool.apy;
    }

    // Fallback: ether.fi APY is typically similar to base ETH staking (~3%)
    return 3.0;
  } catch (error) {
    console.error("Failed to fetch ether.fi APY:", error);
    // Return estimated APY on error
    return 3.0;
  }
}

/**
 * Fetch APY data for all supported staking providers
 */
export async function fetchAllStakingApys(): Promise<Map<string, number>> {
  const apyMap = new Map<string, number>();

  const [lidoApy, ankrApys, etherfiApy] = await Promise.all([
    fetchLidoApy(),
    fetchAnkrApys(),
    fetchEtherfiApy(),
  ]);

  if (lidoApy !== null) {
    apyMap.set("lido-eth", lidoApy);
  }

  // Merge Ankr APYs (ETH, BNB, etc.)
  for (const [providerId, apy] of ankrApys) {
    apyMap.set(providerId, apy);
  }

  if (etherfiApy !== null) {
    apyMap.set("etherfi-eth", etherfiApy);
  }

  return apyMap;
}

/**
 * Get stakable assets with APY data populated
 */
export async function getStakableAssetsWithApy(): Promise<StakableAsset[]> {
  const apyMap = await fetchAllStakingApys();

  return STAKABLE_ASSETS.map(asset => ({
    ...asset,
    providers: asset.providers.map(provider => ({
      ...provider,
      apy: apyMap.get(provider.id) ?? provider.apy,
    })),
  }));
}

/**
 * Get stakable assets with both APY and TVL data populated
 * Fetches data from multiple sources in parallel:
 * - APY: Lido API, Ankr API, DeFiLlama Yields
 * - TVL: DeFiLlama Protocol API, Ankr Staking Metrics API
 */
export async function getStakableAssetsWithMetrics(): Promise<StakableAsset[]> {
  const [apyMap, tvlMap] = await Promise.all([
    fetchAllStakingApys(),
    fetchAllStakingTvls(),
  ]);

  return STAKABLE_ASSETS.map(asset => ({
    ...asset,
    providers: asset.providers.map(provider => ({
      ...provider,
      apy: apyMap.get(provider.id) ?? provider.apy,
      tvlUsd: tvlMap.get(provider.id) ?? provider.tvlUsd,
    })),
  }));
}
