import type { DecodedIntent, DecodedParam, ClearSignRisk } from "./types";
import { eip712Digest, domainHash, messageHash } from "./digest";

function shortAddr(a: string): string {
  return typeof a === "string" && a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : String(a);
}

interface TypedDataLike {
  domain?: { name?: string; chainId?: number | string; verifyingContract?: string };
  primaryType?: string;
  types?: Record<string, unknown>;
  message?: Record<string, unknown>;
}

// Make an EIP-712 typed-data message human-readable, fully locally. Permit2 /
// Permit (offline signature approvals — the highest-risk signatures) get an
// explicit warning. Malformed input → unreadable (caller warns + shows raw).
// Never throws.
export function decodeTypedData(typed: TypedDataLike): DecodedIntent {
  const raw = safeStringify(typed);
  if (!typed || typeof typed !== "object" || !typed.primaryType || !typed.message) {
    return withTypedDigest(
      { readable: false, title: "Unreadable signature", params: [], risks: [], raw },
      typed,
    );
  }

  const risks: ClearSignRisk[] = [];
  const params: DecodedParam[] = [];
  const domainName = typed.domain?.name ?? "Unknown app";
  params.push({ label: "App", value: domainName });
  params.push({ label: "Type", value: typed.primaryType });

  const isPermit = /permit/i.test(domainName) || /permit/i.test(typed.primaryType);
  let title = `Sign ${typed.primaryType} (${domainName})`;

  if (isPermit) {
    risks.push("permit-approval");
    const m = typed.message as Record<string, any>;
    const spender = m.spender ?? m.details?.spender;
    const token = m.details?.token ?? m.token;
    if (spender) params.push({ label: "Spender", value: shortAddr(String(spender)) });
    if (token) params.push({ label: "Token", value: shortAddr(String(token)) });
    title = `Approval signature (${domainName})`;
  }

  return withTypedDigest({ readable: true, title, params, risks, raw }, typed);
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2);
  } catch {
    return String(v);
  }
}

/**
 * Attach the ERC-8213 fingerprints. The EIP-712 digest is what is actually
 * signed; domain and message hashes are the two halves it is built from, kept
 * for users who need to localise a mismatch. Omitted entirely when the payload
 * cannot be hashed — a missing digest is better than a wrong one.
 */
function withTypedDigest(intent: DecodedIntent, typed: TypedDataLike): DecodedIntent {
  const primary = eip712Digest(typed);
  if (!primary) return intent;

  const dh = domainHash(typed);
  const mh = messageHash(typed);
  return {
    ...intent,
    digest: {
      kind: "eip712",
      primary,
      ...(dh && mh ? { detail: { domainHash: dh, messageHash: mh } } : {}),
    },
  };
}
