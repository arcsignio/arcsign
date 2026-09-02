import { shortenAddress as sharedShorten } from "./formatAmount";
import type { SwapQuoteResponse } from "@/services/tauri-api";

/**
 * True when the built transaction's route differs from the quote the user first
 * saw (provider fell back, or fee changed). Missing first quote → not "changed".
 */
export function swapRouteChanged(
  firstQuote: SwapQuoteResponse | null,
  builtQuote: SwapQuoteResponse,
): boolean {
  if (!firstQuote) return false;
  return firstQuote.dex !== builtQuote.dex || firstQuote.feeRate !== builtQuote.feeRate;
}

// Map Internal Network ID to chainId for backend swap API.
export function networkToChainId(network: string): string {
  const mapping: Record<string, string> = {
    "eth-mainnet": "ethereum",
    "polygon-mainnet": "polygon",
    "arbitrum-mainnet": "arbitrum",
    "optimism-mainnet": "optimism",
    "base-mainnet": "base",
    "bnb-mainnet": "bnb",
  };
  return mapping[network] || network;
}

export function getExplorerUrl(network: string, txHash: string): string {
  const explorers: Record<string, string> = {
    "eth-mainnet": "https://etherscan.io/tx/",
    "polygon-mainnet": "https://polygonscan.com/tx/",
    "arbitrum-mainnet": "https://arbiscan.io/tx/",
    "optimism-mainnet": "https://optimistic.etherscan.io/tx/",
    "base-mainnet": "https://basescan.org/tx/",
    "bnb-mainnet": "https://bscscan.com/tx/",
  };
  return `${explorers[network] || "https://etherscan.io/tx/"}${txHash}`;
}

export function getNetworkIcon(network: string): string {
  const icons: Record<string, string> = {
    "eth-mainnet": "⟠",
    "polygon-mainnet": "⬡",
    "arbitrum-mainnet": "🔵",
    "optimism-mainnet": "🔴",
    "base-mainnet": "🔷",
    "bnb-mainnet": "🟡",
  };
  return icons[network] || "🔗";
}

export function toSmallestUnit(amount: string, decimals: number): string {
  if (!amount || isNaN(parseFloat(amount))) return "0";
  const parts = amount.split(".");
  const integerPart = parts[0] || "0";
  let decimalPart = parts[1] || "";
  if (decimalPart.length < decimals) {
    decimalPart = decimalPart.padEnd(decimals, "0");
  } else if (decimalPart.length > decimals) {
    decimalPart = decimalPart.slice(0, decimals);
  }
  const result = (integerPart + decimalPart).replace(/^0+/, "") || "0";
  return result;
}

export function fromSmallestUnit(amount: string, decimals: number): string {
  if (!amount || amount === "0") return "0";
  const dec = decimals || 18;
  const padded = amount.padStart(dec + 1, "0");
  const intPart = padded.slice(0, -dec) || "0";
  const decPart = padded.slice(-dec);
  const trimmed = decPart.slice(0, 8).replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}

export function getNativeTokenSymbol(network: string): string {
  const mapping: Record<string, string> = {
    "eth-mainnet": "ETH",
    "polygon-mainnet": "MATIC",
    "arbitrum-mainnet": "ETH",
    "optimism-mainnet": "ETH",
    "base-mainnet": "ETH",
    "bnb-mainnet": "BNB",
    "ethereum": "ETH",
    "polygon": "MATIC",
    "arbitrum": "ETH",
    "optimism": "ETH",
    "base": "ETH",
    "bsc": "BNB",
  };
  return mapping[network] || "ETH";
}

// 8/6 keeps the swap views' existing shape; the shared helper carries the
// missing-value guard and the single implementation.
export function shortenAddress(address: string): string {
  return sharedShorten(address, 8, 6);
}

export { formatAmount as formatBalance } from "./formatAmount";

// Supported chains for swap (Internal Network IDs from backend).
export const SUPPORTED_SWAP_CHAINS = [
  "eth-mainnet",
  "polygon-mainnet",
  "arbitrum-mainnet",
  "optimism-mainnet",
  "base-mainnet",
  "bnb-mainnet",
];

export type SwapProvider = "openocean" | "kyberswap";

export interface ProviderInfo {
  id: SwapProvider;
  name: string;
  description: string;
  logoUrl: string;
  website: string;
}

export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
  {
    id: "openocean",
    name: "OpenOcean",
    description: "Cross-chain DEX aggregator with best rates",
    logoUrl: "https://openocean.finance/favicon.ico",
    website: "https://openocean.finance",
  },
  {
    id: "kyberswap",
    name: "KyberSwap",
    description: "Multi-chain DEX aggregator by Kyber Network",
    logoUrl: "https://kyberswap.com/favicon.ico",
    website: "https://kyberswap.com",
  },
];
