import type { AbiFunction, AbiParameter } from "viem";
import type { SwapShape } from "./decodeCalldata";

// Community synonym table for swap field roles. Lowercased comparison.
const FROM_TOKEN = ["inputtoken", "srctoken", "tokenin", "fromtoken", "tokenfrom", "selltoken"];
const TO_TOKEN = ["outputtoken", "dsttoken", "tokenout", "totoken", "tokento", "buytoken"];
const MIN_OUT = ["minoutputamount", "minreturnamount", "amountoutminimum", "minout", "minreturn", "amountoutmin"];
const RECIPIENT = ["recipient", "dstreceiver", "receiver", "to"];
const AMOUNT_IN = ["amountin", "inputamount", "amount", "srcamount"];

const SWAP_NAME = /swap|exchange|trade/i;

interface Field {
  name: string;
  type: string;
  value: unknown;
}

// Flatten function params + one level of tuple/struct into name→{type,value}.
function flattenFields(inputs: readonly AbiParameter[], args: readonly unknown[]): Field[] {
  const out: Field[] = [];
  inputs.forEach((input, i) => {
    const arg = args[i];
    // One struct level only. A tuple[] (array-of-struct) arg is not an object, so its
    // component lookups yield undefined → fields don't match → null (safe by design).
    if (input.type.startsWith("tuple") && "components" in input && Array.isArray(input.components)) {
      const obj = (arg ?? {}) as Record<string, unknown>;
      for (const c of input.components) {
        out.push({ name: c.name ?? "", type: c.type, value: obj[c.name ?? ""] });
      }
    } else {
      out.push({ name: input.name ?? "", type: input.type, value: arg });
    }
  });
  return out;
}

// Unique-match: null if zero OR more than one distinct field matches (ambiguous).
function findUnique(fields: Field[], synonyms: string[]): Field | null {
  const hits = fields.filter((f) => synonyms.includes(f.name.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}

function isAddress(type: string): boolean {
  return type === "address";
}
function isUint(type: string): boolean {
  return /^uint\d*$/.test(type);
}

/**
 * Conservatively detect a swap from an arbitrary verified ABI function by parameter
 * structure. Returns a SwapShape only when ALL four conditions hold (name, from+to
 * address fields, minOut uint field, top-level-or-one-struct). Any ambiguity / missing
 * field / wrong type → null. Honest: never fake a swap.
 */
export function detectSwapFromAbi(
  functionName: string,
  fnAbi: AbiFunction,
  args: readonly unknown[],
): SwapShape | null {
  if (!SWAP_NAME.test(functionName)) return null;

  const fields = flattenFields(fnAbi.inputs ?? [], args);

  const from = findUnique(fields, FROM_TOKEN);
  const to = findUnique(fields, TO_TOKEN);
  if (!from || !to || !isAddress(from.type) || !isAddress(to.type)) return null;
  if (typeof from.value !== "string" || typeof to.value !== "string") return null;

  const minOut = findUnique(fields, MIN_OUT);
  if (!minOut || !isUint(minOut.type) || typeof minOut.value !== "bigint") return null;

  const recip = findUnique(fields, RECIPIENT);
  const amountIn = findUnique(fields, AMOUNT_IN);

  return {
    fromToken: from.value,
    toToken: to.value,
    amountIn: amountIn && isUint(amountIn.type) && typeof amountIn.value === "bigint" ? amountIn.value : undefined,
    minAmountOut: minOut.value,
    // recipient is optional: use the matched synonym if present + valid, else "".
    // We never fabricate a recipient (showing the toToken or sender would mislead).
    recipient: recip && isAddress(recip.type) && typeof recip.value === "string" ? recip.value : "",
    venue: "Detected swap",
  };
}
