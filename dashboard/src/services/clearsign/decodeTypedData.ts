import type { DecodedIntent, DecodedParam, ClearSignRisk } from "./types";

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
    return { readable: false, title: "Unreadable signature", params: [], risks: [], raw };
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

  return { readable: true, title, params, risks, raw };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val), 2);
  } catch {
    return String(v);
  }
}
