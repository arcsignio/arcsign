import { decodeFunctionData, formatUnits } from "viem";
import type { DecodedIntent, ClearSignRisk, DecodedParam } from "./types";
import { KNOWN_ABIS, MAX_UINT256, MAX_UINT160 } from "./knownAbis";
import { resolveTokenLabel } from "./tokenLabel";

function shortAddr(a: string): string {
  return a && a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

// V3 packed path: tokenIn(20) + fee(3) + tokenOut(20) [+ fee(3)+token(20) per hop].
// Returns [firstToken, lastToken] or null if the byte length is not 20 + 23*n (n>=1).
function decodePackedPath(path: string): [string, string] | null {
  const hex = path.startsWith("0x") ? path.slice(2) : path;
  const bytes = hex.length / 2;
  if (!Number.isInteger(bytes) || bytes < 43 || (bytes - 20) % 23 !== 0) return null;
  const first = "0x" + hex.slice(0, 40);
  const last = "0x" + hex.slice(hex.length - 40);
  return [first, last];
}

function unreadable(raw: string): DecodedIntent {
  return { readable: false, title: "Unreadable transaction", params: [], risks: [], raw };
}

interface SwapShape {
  fromToken: string;
  toToken: string;
  amountIn?: bigint;
  minAmountOut: bigint;
  recipient: string;
  venue: string;
}

// Shared swap presentation. Token names resolved locally (tokenLabel); unknown
// tokens show their short address (real info, not a guess). Never throws.
async function renderSwap(network: string, s: SwapShape, raw: string): Promise<DecodedIntent> {
  const fromT = await resolveTokenLabel(network, s.fromToken);
  const toT = await resolveTokenLabel(network, s.toToken);
  const fromLabel = fromT.known ? fromT.symbol : shortAddr(s.fromToken);
  const toLabel = toT.known ? toT.symbol : shortAddr(s.toToken);

  const params: DecodedParam[] = [];
  if (s.amountIn !== undefined) {
    params.push({ label: "Amount in", value: `${formatUnits(s.amountIn, fromT.decimals)} ${fromLabel}` });
  }
  params.push({ label: "Min received", value: `${formatUnits(s.minAmountOut, toT.decimals)} ${toLabel}` });
  params.push({ label: "Recipient", value: shortAddr(s.recipient) });

  return {
    readable: true,
    title: `Swap ${fromLabel} → ${toLabel} (${s.venue})`,
    params,
    risks: [],
    raw,
  };
}

// Decode a transaction's calldata into a human-readable intent using ONLY the
// curated local ABIs (viem, offline). Empty data + value → native send. Unknown
// selectors → unreadable (caller shows a warning + raw hex). Never throws.
export async function decodeCalldata(
  network: string,
  to: string,
  data: string | undefined,
  value: string | undefined,
): Promise<DecodedIntent> {
  const raw = data ?? "0x";

  if ((!data || data === "0x") && value && value !== "0x0" && value !== "0") {
    const eth = formatUnits(BigInt(value), 18);
    return { readable: true, title: `Send ${eth} (native)`, params: [{ label: "To", value: shortAddr(to) }], risks: [], raw };
  }
  if (!data || data === "0x") return unreadable(raw);

  for (const abi of KNOWN_ABIS) {
    try {
      const { functionName, args } = decodeFunctionData({ abi, data: data as `0x${string}` });
      return await buildIntent(network, to, functionName, args as readonly unknown[], raw);
    } catch {
      // try the next ABI
    }
  }
  return unreadable(raw);
}

async function buildIntent(
  network: string,
  to: string,
  fn: string,
  args: readonly unknown[],
  raw: string,
): Promise<DecodedIntent> {
  const risks: ClearSignRisk[] = [];
  const params: DecodedParam[] = [];

  switch (fn) {
    case "transfer": {
      const [dst, amount] = args as [string, bigint];
      const t = await resolveTokenLabel(network, to);
      params.push({ label: "To", value: shortAddr(dst) });
      return { readable: true, title: `Transfer ${formatUnits(amount, t.decimals)} ${t.symbol}`, params, risks, raw };
    }
    case "transferFrom": {
      const [src, dst, amount] = args as [string, string, bigint];
      const t = await resolveTokenLabel(network, to);
      params.push({ label: "From", value: shortAddr(src) }, { label: "To", value: shortAddr(dst) });
      return { readable: true, title: `Transfer ${formatUnits(amount, t.decimals)} ${t.symbol}`, params, risks, raw };
    }
    case "approve": {
      if (args.length === 4) {
        const [token, spender, amount, expiration] = args as [string, string, bigint, number];
        const t = await resolveTokenLabel(network, token);
        if (amount >= MAX_UINT160) risks.push("permit-approval", "unlimited-approval");
        else risks.push("permit-approval");
        params.push({ label: "Spender", value: shortAddr(spender) });
        params.push({ label: "Expiration", value: Number(expiration) === 0 ? "Never" : new Date(Number(expiration) * 1000).toISOString().slice(0, 10) });
        return { readable: true, title: `Permit2 approve ${t.symbol}`, params, risks, raw };
      }
      const [spender, amount] = args as [string, bigint];
      const t = await resolveTokenLabel(network, to);
      if (amount >= MAX_UINT256) risks.push("unlimited-approval");
      params.push({ label: "Spender", value: shortAddr(spender) });
      const amt = amount >= MAX_UINT256 ? "Unlimited" : `${formatUnits(amount, t.decimals)} ${t.symbol}`;
      return { readable: true, title: `Approve ${amt}`, params, risks, raw };
    }
    case "setApprovalForAll": {
      const [operator, approved] = args as [string, boolean];
      if (approved) risks.push("approve-all-nfts");
      params.push({ label: "Operator", value: shortAddr(operator) }, { label: "Approved", value: approved ? "Yes (ALL NFTs)" : "No (revoke)" });
      return { readable: true, title: approved ? "Approve ALL NFTs" : "Revoke NFT approval", params, risks, raw };
    }
    case "swapExactTokensForTokens":
    case "swapExactTokensForETH": {
      const [amountIn, amountOutMin, path, recipient] = args as [bigint, bigint, string[], string, bigint];
      return renderSwap(network, {
        fromToken: path[0],
        toToken: path[path.length - 1],
        amountIn,
        minAmountOut: amountOutMin,
        recipient,
        venue: "V2 Router",
      }, raw);
    }
    case "swapExactETHForTokens": {
      const [amountOutMin, path, recipient] = args as [bigint, string[], string, bigint];
      return renderSwap(network, {
        fromToken: path[0],
        toToken: path[path.length - 1],
        // ETH-in: amountIn is msg.value, not in calldata → omit
        minAmountOut: amountOutMin,
        recipient,
        venue: "V2 Router",
      }, raw);
    }
    case "exactInputSingle": {
      const p = args[0] as { tokenIn: string; tokenOut: string; recipient: string; amountIn: bigint; amountOutMinimum: bigint };
      return renderSwap(network, {
        fromToken: p.tokenIn,
        toToken: p.tokenOut,
        amountIn: p.amountIn,
        minAmountOut: p.amountOutMinimum,
        recipient: p.recipient,
        venue: "V3 Router",
      }, raw);
    }
    case "exactInput": {
      const p = args[0] as { path: string; recipient: string; amountIn: bigint; amountOutMinimum: bigint };
      const ends = decodePackedPath(p.path);
      if (!ends) return unreadable(raw);  // honest: malformed path → unreadable
      return renderSwap(network, {
        fromToken: ends[0],
        toToken: ends[1],
        amountIn: p.amountIn,
        minAmountOut: p.amountOutMinimum,
        recipient: p.recipient,
        venue: "V3 Router",
      }, raw);
    }
    default:
      return unreadable(raw);
  }
}
