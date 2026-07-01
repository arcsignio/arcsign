import {
  getSwapTokens,
  getSwapQuote,
  buildSwapTransaction,
  checkSwapAllowance,
  getSwapApproval,
  buildTransaction,
  signTransaction,
  broadcastTransaction,
  queryTransactionStatus,
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

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function executeApproval(p: {
  chainId: string; walletId: string; fromToken: SendableToken; spenderAddress: string;
  approvalAmountWei: string; walletPassword: string; preValidatedPassphrase: string;
  usbPath: string; sessionToken: string;
}): Promise<string> {
  const approvalData = await getSwapApproval({
    chainId: p.chainId,
    tokenAddress: p.fromToken.tokenAddress,
    spenderAddress: p.spenderAddress,
    amount: p.approvalAmountWei, // "" = unlimited
    usbPath: p.usbPath,
    sessionToken: p.sessionToken,
  });

  const built = await buildTransaction({
    chainId: p.chainId,
    from: p.fromToken.fromAddress,
    to: approvalData.to,
    amount: "0",
    data: approvalData.data,
    feeSpeed: "fast",
    usbPath: p.usbPath,
    sessionToken: p.sessionToken,
  });

  const signed = await signTransaction({
    chainId: p.chainId,
    walletId: p.walletId,
    password: p.walletPassword,
    passphrase: p.preValidatedPassphrase || "",
    fromAddress: p.fromToken.fromAddress,
    unsignedTx: built,
    usbPath: p.usbPath,
    sessionToken: p.sessionToken,
  });

  const broadcast = await broadcastTransaction({
    chainId: p.chainId, signedTx: signed, usbPath: p.usbPath, sessionToken: p.sessionToken,
  });

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const st = await queryTransactionStatus({
        chainId: p.chainId, txHash: broadcast.txHash, usbPath: p.usbPath, sessionToken: p.sessionToken,
      });
      if (st.status === "confirmed") return broadcast.txHash;
      if (st.status === "failed") throw new Error("APPROVAL_FAILED");
    } catch (e) {
      if (e instanceof Error && e.message === "APPROVAL_FAILED") throw e;
      // transient status-check failure: keep polling (matches original)
    }
  }
  throw new Error("APPROVAL_TIMEOUT");
}
