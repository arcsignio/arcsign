/**
 * ERC-8213 — signature and calldata digest computation.
 *
 * A digest is a short, reproducible fingerprint of exactly the bytes about to
 * be signed. Its purpose is cross-device verification: compute the same digest
 * on a separate machine and compare. ArcSign has no second physical screen the
 * way a Ledger does, so this is what lets a user verify the bytes independently.
 *
 * SECURITY: a digest is a statement of fact, not a verdict. Nothing here feeds
 * the blacklist, requiresAcknowledge, or any signing gate, and the UI must not
 * colour it as safe or dangerous — the app cannot verify it for you; that is
 * the whole point.
 *
 * Spec: keccak256( uint256(len(calldata)) ‖ calldata ). The length prefix stops
 * different-length calldata from colliding; chainId is deliberately excluded so
 * the same bytes fingerprint identically on every chain.
 */

import { keccak256, concat, toHex, pad, hashTypedData, hashDomain, hashStruct } from "viem";

/** Loose shape of an EIP-712 payload, matching decodeTypedData's input. */
export interface TypedDataLike {
  domain?: {
    name?: string;
    version?: string;
    chainId?: number | string;
    verifyingContract?: string;
  };
  primaryType?: string;
  types?: Record<string, unknown>;
  message?: Record<string, unknown>;
}

/**
 * ERC-8213 calldata digest.
 *
 * Never throws and never returns null: this is the fallback layer that must
 * work when every other decoding path has failed. Malformed input is hashed as
 * empty calldata rather than rejected.
 */
export function calldataDigest(data: string): string {
  const hex = normalizeHex(data);
  const byteLength = hex.length / 2;
  return keccak256(
    concat([pad(toHex(byteLength), { size: 32 }), `0x${hex}` as `0x${string}`]),
  );
}

/** The EIP-712 digest actually signed: keccak256(0x1901 ‖ domain ‖ message). */
export function eip712Digest(typed: TypedDataLike): string | null {
  if (!isUsableTypedData(typed)) return null;
  try {
    return hashTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: typed.primaryType,
      message: typed.message,
    } as Parameters<typeof hashTypedData>[0]);
  } catch {
    return null;
  }
}

/** hashStruct(eip712Domain) — which half of the payload the domain contributes. */
export function domainHash(typed: TypedDataLike): string | null {
  if (!isUsableTypedData(typed) || !typed.domain) return null;
  try {
    return hashDomain({
      domain: typed.domain as never,
      // viem requires an explicit EIP712Domain type list, built from the
      // fields the domain actually carries, in EIP-712's prescribed order.
      types: { EIP712Domain: domainTypeFields(typed.domain) } as never,
    });
  } catch {
    return null;
  }
}

/** hashStruct(message) — which half of the payload the message contributes. */
export function messageHash(typed: TypedDataLike): string | null {
  if (!isUsableTypedData(typed)) return null;
  try {
    return hashStruct({
      data: typed.message as never,
      primaryType: typed.primaryType as never,
      types: typed.types as never,
    });
  } catch {
    return null;
  }
}

/**
 * Group a 0x-prefixed 32-byte hash into 16 blocks of 4 hex characters.
 *
 * Digests exist to be compared by eye against another device. An unbroken
 * 64-character run invites skimming the ends and missing the middle, so this
 * follows the GPG/SSH fingerprint convention of fixed-width groups. Truncation
 * is deliberately NOT offered: comparing only the ends would drop the work of
 * forging a match from 2^256 to something feasible.
 */
export function formatDigest(hex: string): string {
  if (typeof hex !== "string") return "";
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (body.length !== 64) return hex; // unexpected shape: show it unaltered
  return (body.match(/.{4}/g) ?? []).join(" ");
}

/**
 * Strip 0x and pad to an even length, preserving every character.
 *
 * Malformed input is hashed as UTF-8 bytes rather than having its stray
 * characters silently removed. Stripping them would make "a9-05-9c-bb" and
 * "0xa9059cbb" produce the SAME digest — and a fingerprint whose whole purpose
 * is "exactly the bytes about to be signed" must not report corrupted input as
 * identical to clean input. A garbled string still yields a digest (this is the
 * fallback layer and must never fail), just a visibly different one.
 */
function normalizeHex(data: unknown): string {
  if (typeof data !== "string") return "";
  const body = data.startsWith("0x") ? data.slice(2) : data;
  if (/^[0-9a-fA-F]*$/.test(body)) {
    return body.length % 2 === 0 ? body : `0${body}`;
  }
  // Not hex: hash the raw characters so the digest reflects what was actually
  // received instead of a cleaned-up version of it.
  return Array.from(new TextEncoder().encode(body))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isUsableTypedData(typed: unknown): typed is Required<TypedDataLike> {
  if (!typed || typeof typed !== "object") return false;
  const t = typed as TypedDataLike;
  return Boolean(t.primaryType && t.types && t.message);
}

/** EIP712Domain field list in the order EIP-712 prescribes. */
function domainTypeFields(domain: NonNullable<TypedDataLike["domain"]>) {
  const fields: Array<{ name: string; type: string }> = [];
  if (domain.name !== undefined) fields.push({ name: "name", type: "string" });
  if (domain.version !== undefined) fields.push({ name: "version", type: "string" });
  if (domain.chainId !== undefined) fields.push({ name: "chainId", type: "uint256" });
  if (domain.verifyingContract !== undefined)
    fields.push({ name: "verifyingContract", type: "address" });
  return fields;
}
