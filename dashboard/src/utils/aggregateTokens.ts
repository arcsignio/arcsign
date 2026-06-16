import type { TokenBalance } from "@/types/tokens";
import { getNetworkKey, isNativeTokenAddress } from "@/constants/nativeTokens";

/**
 * A token row for the assets list. Native coins (ETH/BNB/AVAX/...) are merged
 * across chains into a single row; ERC-20 tokens stay per-chain (a USDC on
 * Ethereum and a USDC on Polygon are different contracts with independent value).
 */
export interface AggregatedToken {
  /** Stable key for React lists. */
  key: string;
  symbol: string;
  name: string;
  logo: string;
  /** Summed USD value across all included chains. */
  totalUsdValue: number;
  /** Summed human-readable balance across all included chains. */
  totalBalance: number;
  /** True when this row merges more than one chain (native coins only). */
  isMultiChain: boolean;
  /** Canonical network keys this row spans (e.g. ["eth-mainnet","base-mainnet"]). */
  networks: string[];
  /** The underlying per-(token×chain) rows that were merged into this one. */
  sources: TokenBalance[];
}

/**
 * Normalize a token's network to a canonical key so the same chain reported with
 * different strings by different providers (e.g. "ethereum" vs "eth-mainnet",
 * "matic-mainnet" vs "polygon-mainnet") collapses to one network.
 */
export function canonicalNetwork(token: TokenBalance): string {
  return (
    getNetworkKey(token.network) ||
    getNetworkKey(token.networkLabel) ||
    token.network ||
    token.networkLabel ||
    "unknown"
  );
}

function isNative(token: TokenBalance): boolean {
  return isNativeTokenAddress(token.tokenAddress);
}

function toNumber(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Aggregate a flat (token × chain) balance list into the assets-list view.
 * Strategy: native coins merge across chains by symbol; ERC-20 tokens stay
 * per-chain (keyed by canonical network + contract address). Rows are sorted by
 * total USD value descending.
 */
/**
 * isKnownToken decides whether an ERC-20 (canonical network, contract address)
 * is on the trusted token whitelist. Only whitelisted ERC-20s are merged across
 * chains by symbol — this keeps a same-named fake token (e.g. a scam "USDC") out
 * of the real asset's row. When omitted, all ERC-20s stay per-chain (safe default).
 */
export type IsKnownToken = (canonicalNet: string, tokenAddress: string) => boolean;

export function aggregateTokens(
  tokens: TokenBalance[],
  isKnownToken?: IsKnownToken,
): AggregatedToken[] {
  const groups = new Map<string, AggregatedToken>();

  for (const token of tokens) {
    const net = canonicalNetwork(token);
    // Grouping strategy:
    //   native           → one row per symbol (cross-chain)
    //   ERC-20 (known)    → one row per symbol (cross-chain, e.g. USDC/USDT)
    //   ERC-20 (unknown)  → one row per (network, contract) — keeps fakes apart
    let groupKey: string;
    if (isNative(token)) {
      groupKey = `native:${token.tokenSymbol.toUpperCase()}`;
    } else if (isKnownToken && isKnownToken(net, token.tokenAddress)) {
      groupKey = `erc20:${token.tokenSymbol.toUpperCase()}`;
    } else {
      groupKey = `erc20:${net}:${token.tokenAddress.toLowerCase()}`;
    }

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        symbol: token.tokenSymbol,
        name: token.tokenName,
        logo: token.tokenLogo,
        totalUsdValue: 0,
        totalBalance: 0,
        isMultiChain: false,
        networks: [],
        sources: [],
      };
      groups.set(groupKey, group);
    }

    group.totalUsdValue += token.usdValue || 0;
    group.totalBalance += toNumber(token.balance);
    group.sources.push(token);
    if (!group.networks.includes(net)) {
      group.networks.push(net);
    }
    group.isMultiChain = group.networks.length > 1;
    // Prefer a non-empty logo/name if the first source lacked one.
    if (!group.logo && token.tokenLogo) group.logo = token.tokenLogo;
    if (!group.name && token.tokenName) group.name = token.tokenName;
  }

  return Array.from(groups.values()).sort((a, b) => b.totalUsdValue - a.totalUsdValue);
}
