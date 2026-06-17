import { findTokenByAddress, type ChainKey } from "@/services/tokenList";

export interface TokenLabel {
  symbol: string;   // token symbol, or a shortened address if unknown
  decimals: number; // token decimals, 18 if unknown
  known: boolean;   // true if resolved from the local token list
}

// Maps an internal/Alchemy network id to the token-list chain key. Mirrors the
// existing token-list usage; unknown networks fall through to "ethereum".
const NETWORK_TO_CHAIN: Record<string, ChainKey> = {
  "eth-mainnet": "ethereum",
  "polygon-mainnet": "polygon",
  "arbitrum-mainnet": "arbitrum",
  "arb-mainnet": "arbitrum",
  "optimism-mainnet": "optimism",
  "opt-mainnet": "optimism",
  "base-mainnet": "base",
  "bnb-mainnet": "bsc",
};

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

// Resolve a token contract to a human label using ONLY the local token list
// (public/token-lists/*.json). No external API — privacy preserving. Falls back
// to a shortened address (known=false) when not found or on error.
export async function resolveTokenLabel(network: string, address: string): Promise<TokenLabel> {
  const chain = (NETWORK_TO_CHAIN[network] ?? "ethereum") as ChainKey;
  try {
    // Note: findTokenByAddress(address, chain) — address is the first parameter
    const t = await findTokenByAddress(address, chain);
    if (t && t.symbol) {
      return {
        symbol: t.symbol,
        decimals: typeof t.decimals === "number" ? t.decimals : 18,
        known: true,
      };
    }
  } catch {
    // ignore — fall through to unknown
  }
  return { symbol: shortAddr(address), decimals: 18, known: false };
}
