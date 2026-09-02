/**
 * Kept as a re-export so existing imports keep resolving. The implementations
 * moved to `formatAmount.ts` when six divergent copies of this logic were
 * collapsed into one — see that module for why truncation and a pinned locale
 * are correctness properties rather than preferences.
 */
export { formatAmount as formatBalance, formatUSD } from "./formatAmount";
