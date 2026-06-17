/**
 * Maps an EVM chainId to ArcSign's internal network id (used by clear-signing's
 * decodeCalldata / tokenLabel). Unknown chainIds fall back to "eth-mainnet"
 * (decode still works; token labels just won't resolve).
 *
 * Single source of truth — shared by TransactionSignDialog and the
 * WalletConnect eth_sendTransaction handler.
 */

const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  1: "eth-mainnet",
  137: "polygon-mainnet",
  42161: "arb-mainnet",
  10: "opt-mainnet",
  8453: "base-mainnet",
  56: "bnb-mainnet",
  97: "bnb-mainnet",
  43114: "avalanche-mainnet",
};

/**
 * Convert a numeric, decimal-string, or hex-string chainId to the ArcSign
 * internal network id.  Examples: 1, "1", "0x1" → "eth-mainnet".
 * Unknown / undefined values fall back to "eth-mainnet".
 */
export function chainIdToNetwork(chainId: number | string | undefined): string {
  if (chainId === undefined || chainId === null) return "eth-mainnet";
  const id =
    typeof chainId === "string"
      ? chainId.startsWith("0x")
        ? parseInt(chainId, 16)
        : parseInt(chainId, 10)
      : chainId;
  return CHAIN_ID_TO_NETWORK[id] ?? "eth-mainnet";
}
