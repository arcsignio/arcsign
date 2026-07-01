import {
  getSwapTokens,
  getSwapQuote,
  type GetSwapTokensResponse,
  type SwapQuoteResponse,
} from "@/services/tauri-api";

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
