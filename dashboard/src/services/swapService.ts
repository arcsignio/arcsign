import {
  getSwapTokens,
  getSwapQuote,
  buildSwapTransaction,
  checkSwapAllowance,
  type GetSwapTokensResponse,
  type SwapQuoteResponse,
  type BuildSwapTransactionResponse,
} from "@/services/tauri-api";
import type { SendableToken } from "@/components/SendTransaction";

export type SwapProgressStage = "signing" | "broadcasting";
export interface SwapProgress { onProgress?: (stage: SwapProgressStage) => void; }

export function fetchSwapTokens(p: {
  chainId: string; provider: string; usbPath: string; sessionToken: string;
}): Promise<GetSwapTokensResponse> {
  return getSwapTokens(p);
}

export function fetchQuote(p: {
  chainId: string; fromTokenAddress: string; toTokenAddress: string; amount: string;
  fromAddress: string; slippage: number; provider?: string; isPro: boolean;
  usbPath: string; sessionToken: string;
}): Promise<SwapQuoteResponse> {
  return getSwapQuote(p);
}

const NATIVE_SENTINEL = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export interface BuildSwapResult {
  swapTx: BuildSwapTransactionResponse;
  allowance: { needsApproval: boolean; current: string | null };
}

export async function buildSwap(p: {
  chainId: string;
  fromToken: SendableToken;
  toTokenAddress: string;
  amountWei: string;
  slippage: number;
  provider?: string;
  isPro: boolean;
  usbPath: string;
  sessionToken: string;
}): Promise<BuildSwapResult> {
  const fromAddr = p.fromToken.tokenAddress || NATIVE_SENTINEL;
  const isNative = !p.fromToken.tokenAddress || p.fromToken.tokenAddress === "";

  const swapTx = await buildSwapTransaction({
    chainId: p.chainId,
    fromTokenAddress: fromAddr,
    toTokenAddress: p.toTokenAddress,
    amount: p.amountWei,
    fromAddress: p.fromToken.fromAddress,
    slippage: p.slippage,
    provider: p.isPro ? undefined : p.provider,
    isPro: p.isPro,
    usbPath: p.usbPath,
    sessionToken: p.sessionToken,
  });

  if (isNative) {
    return { swapTx, allowance: { needsApproval: false, current: null } };
  }

  try {
    const allowanceResult = await checkSwapAllowance({
      chainId: p.chainId,
      tokenAddress: p.fromToken.tokenAddress,
      walletAddress: p.fromToken.fromAddress,
      provider: p.provider ?? "",
      usbPath: p.usbPath,
      sessionToken: p.sessionToken,
    });
    const needsApproval = BigInt(allowanceResult.allowance || "0") < BigInt(p.amountWei);
    return { swapTx, allowance: { needsApproval, current: allowanceResult.allowance } };
  } catch {
    return { swapTx, allowance: { needsApproval: true, current: null } };
  }
}
