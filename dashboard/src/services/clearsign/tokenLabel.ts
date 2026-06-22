import { findTokenByAddress, type ChainKey } from "@/services/tokenList";
import { isNativeTokenAddress, getNativeToken, getNetworkKey } from "@/constants/nativeTokens";

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
  "avalanche-mainnet": "avalanche",
};

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

// Resolve a token contract to a human label using ONLY the local token list
// (public/token-lists/*.json). No external API — privacy preserving. Falls back
// to a shortened address (known=false) when not found or on error.
export async function resolveTokenLabel(network: string, address: string): Promise<TokenLabel> {
  // Native-coin sentinel (zero address / 0xEeee…) → the chain's native symbol
  // (e.g. a swap to BNB carries 0x0000…0000 as the "token", not an ERC-20).
  // Resolved locally, never hits the token list. getNetworkKey maps the
  // clearsign network id (bnb-mainnet) to the NATIVE_TOKENS key (bsc-mainnet).
  if (isNativeTokenAddress(address)) {
    const native = getNativeToken(getNetworkKey(network) ?? network);
    if (native) {
      return { symbol: native.symbol, decimals: native.decimals, known: true };
    }
  }

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
