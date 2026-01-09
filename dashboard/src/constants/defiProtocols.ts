/**
 * DeFi Protocol White-list Registry
 * Feature: Verified DeFi protocols for secure integration
 *
 * Only protocols that have been:
 * 1. Audited by reputable firms
 * 2. Verified by our team
 * 3. Have significant TVL and track record
 *
 * are included in this registry.
 */

import type { DefiProtocol } from "@/types/defi";

/**
 * Lido - Ethereum Liquid Staking
 * https://lido.fi
 *
 * Lido is the largest liquid staking protocol with $32B+ TVL.
 * Users stake ETH and receive stETH (rebasing token) in return.
 * stETH accrues staking rewards automatically.
 */
export const LIDO_ETH: DefiProtocol = {
  id: "lido-eth",
  name: "Lido",
  category: "staking",
  description: "Stake ETH and receive stETH liquid staking tokens",
  website: "https://lido.fi",
  logoUrl: "https://stake.lido.fi/favicon.ico",

  contracts: [
    {
      network: "ethereum",
      address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",  // Main Lido contract
      tokenAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",  // stETH (same as Lido contract)
      tokenSymbol: "stETH",
      tokenDecimals: 18,
    },
  ],

  audits: [
    { auditor: "Certora", date: "2024" },
    { auditor: "ChainSecurity", date: "2024" },
    { auditor: "Hexens", date: "2024" },
    { auditor: "StateMind", date: "2024" },
  ],

  verified: true,
  tvlUsd: 32_500_000_000,  // ~$32.5B as of 2025
  apy: 3.3,               // ~3.3% APY
  minAmount: "0",         // No minimum
  features: [
    "liquid_staking",
    "daily_rebasing",
    "defi_compatible",
    "no_minimum",
  ],
};

/**
 * Lido wstETH - Wrapped stETH
 * Non-rebasing wrapper for stETH, better for DeFi integration
 */
export const LIDO_WSTETH: DefiProtocol = {
  id: "lido-wsteth",
  name: "Lido (wstETH)",
  category: "staking",
  description: "Wrap stETH to wstETH for DeFi compatibility",
  website: "https://lido.fi",
  logoUrl: "https://stake.lido.fi/favicon.ico",

  contracts: [
    {
      network: "ethereum",
      address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",  // wstETH contract
      tokenAddress: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
      tokenSymbol: "wstETH",
      tokenDecimals: 18,
    },
  ],

  audits: [
    { auditor: "Certora", date: "2024" },
    { auditor: "ChainSecurity", date: "2024" },
  ],

  verified: true,
  features: [
    "non_rebasing",
    "defi_compatible",
    "lending_friendly",
  ],
};

/**
 * Registry of all verified DeFi protocols
 */
export const DEFI_PROTOCOLS: DefiProtocol[] = [
  LIDO_ETH,
  LIDO_WSTETH,
];

/**
 * Get protocol by ID
 */
export function getProtocolById(id: string): DefiProtocol | undefined {
  return DEFI_PROTOCOLS.find(p => p.id === id);
}

/**
 * Get protocols by category
 */
export function getProtocolsByCategory(category: string): DefiProtocol[] {
  return DEFI_PROTOCOLS.filter(p => p.category === category);
}

/**
 * Get staking protocols only
 */
export function getStakingProtocols(): DefiProtocol[] {
  return getProtocolsByCategory("staking");
}

/**
 * Get protocols available on a specific network
 */
export function getProtocolsByNetwork(network: string): DefiProtocol[] {
  return DEFI_PROTOCOLS.filter(p =>
    p.contracts.some(c => c.network === network)
  );
}

/**
 * Lido contract ABI for submit() function
 * Only include functions we need to minimize bundle size
 */
export const LIDO_SUBMIT_ABI = [
  {
    name: "submit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_referral", type: "address" }
    ],
    outputs: [
      { name: "", type: "uint256" }
    ],
  },
] as const;

/**
 * Encode Lido submit() call data
 * @param referral - Referral address (use zero address if none)
 * @returns Hex-encoded call data
 */
export function encodeLidoSubmit(referral: string = "0x0000000000000000000000000000000000000000"): string {
  // Function selector: keccak256("submit(address)")[:4] = 0xa1903eab
  const selector = "a1903eab";

  // Pad address to 32 bytes
  const paddedAddress = referral.toLowerCase().replace("0x", "").padStart(64, "0");

  return "0x" + selector + paddedAddress;
}
