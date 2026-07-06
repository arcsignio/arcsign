import type { TokenBalance } from "@/types/tokens";
import { getNativeToken, isNativeTokenAddress, getNetworkKey } from "@/constants/nativeTokens";

/**
 * 補齊 native token 的 symbol/name/logo（僅當原欄位為空）。
 * 就地修改並回傳同一陣列 —— 與 WalletDetail 原三處 enrich 迴圈行為逐字等價。
 */
export function enrichNativeTokens(tokens: TokenBalance[]): TokenBalance[] {
  if (!tokens || !Array.isArray(tokens)) return tokens;
  tokens.forEach((token) => {
    const networkKey = getNetworkKey(token.networkLabel || token.network);
    if (networkKey && isNativeTokenAddress(token.tokenAddress)) {
      const nativeToken = getNativeToken(networkKey);
      if (nativeToken && !token.tokenSymbol) {
        token.tokenSymbol = nativeToken.symbol;
        token.tokenName = nativeToken.name;
        token.tokenLogo = nativeToken.logoURI;
      }
    }
  });
  return tokens;
}
