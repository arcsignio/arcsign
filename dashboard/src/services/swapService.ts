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
  addTouchedToken,
  type GetSwapTokensResponse,
  type SwapQuoteResponse,
  type BuildSwapTransactionResponse,
  type GetSwapApprovalResponse,
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
  fromAddress: string; slippage: number; provider?: string;
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
  usbPath: string;
  sessionToken: string;
}): Promise<BuildSwapResult> {
  const fromAddr = p.fromToken.tokenAddress || NATIVE_SENTINEL;
  const isNative = !p.fromToken.tokenAddress || p.fromToken.tokenAddress === "";

  // Everyone gets the best route now — provider is always backend-picked.
  const swapTx = await buildSwapTransaction({
    chainId: p.chainId,
    fromTokenAddress: fromAddr,
    toTokenAddress: p.toTokenAddress,
    amount: p.amountWei,
    fromAddress: p.fromToken.fromAddress,
    slippage: p.slippage,
    provider: undefined,
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

/**
 * Fetch the ERC-20 approve() calldata for a given spender/amount.
 *
 * Split out from executeApproval so the caller (useSwapFlow) can fetch this
 * once the user has committed to an approval amount, hand it to the sign
 * review screen, and reuse the SAME result when actually signing — the
 * reviewed calldata and the signed calldata must be identical, not just
 * "recomputed the same way twice".
 */
export function fetchApproval(p: {
  chainId: string; tokenAddress: string; spenderAddress: string;
  approvalAmountWei: string; usbPath: string; sessionToken: string;
}): Promise<GetSwapApprovalResponse> {
  return getSwapApproval({
    chainId: p.chainId,
    tokenAddress: p.tokenAddress,
    spenderAddress: p.spenderAddress,
    amount: p.approvalAmountWei, // "" = unlimited
    usbPath: p.usbPath,
    sessionToken: p.sessionToken,
  });
}

export async function executeApproval(p: {
  chainId: string; walletId: string; fromToken: SendableToken;
  approvalData: GetSwapApprovalResponse;
  walletPassword: string; preValidatedPassphrase: string;
  usbPath: string; sessionToken: string;
}): Promise<string> {
  const { approvalData } = p;

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

export async function executeSwap(p: {
  chainId: string; walletId: string; fromToken: SendableToken;
  toToken: { address: string; symbol: string; decimals: number; network?: string } | null;
  swapTx: BuildSwapTransactionResponse; walletPassword: string; preValidatedPassphrase: string;
  acknowledgedRisk: boolean; usbPath: string; sessionToken: string;
}, opts?: SwapProgress): Promise<string> {
  const txValue = p.swapTx.txData.value || "0";

  const built = await buildTransaction({
    chainId: p.chainId,
    from: p.fromToken.fromAddress,
    to: p.swapTx.txData.to,
    amount: txValue,
    data: p.swapTx.txData.data || "",
    feeSpeed: "fast",
    usbPath: p.usbPath,
    sessionToken: p.sessionToken,
  });

  opts?.onProgress?.("signing");

  const signed = await signTransaction({
    chainId: p.chainId,
    walletId: p.walletId,
    password: p.walletPassword,
    passphrase: p.preValidatedPassphrase || "",
    fromAddress: p.fromToken.fromAddress,
    unsignedTx: built,
    usbPath: p.usbPath,
    sessionToken: p.sessionToken,
    acknowledgedRisk: p.acknowledgedRisk,
  });

  opts?.onProgress?.("broadcasting");

  const broadcast = await broadcastTransaction({
    chainId: p.chainId, signedTx: signed, usbPath: p.usbPath, sessionToken: p.sessionToken,
  });

  // Best-effort: record the output token into table B. Failure must not affect the swap.
  const ownerAddr = p.fromToken.fromAddress;
  const outNetwork = p.toToken?.network;
  if (ownerAddr && outNetwork && p.toToken?.address) {
    addTouchedToken({
      usbPath: p.usbPath,
      userAddress: ownerAddr,
      tokenAddress: p.toToken.address,
      network: outNetwork,
      symbol: p.toToken.symbol,
      decimals: p.toToken.decimals,
      sessionToken: p.sessionToken,
    }).catch((e) => console.warn("[Swap] failed to record output token into table B:", e));
  }

  return broadcast.txHash;
}
