import type { Abi } from "viem";

export interface AbiResult {
  abi: Abi;
  matchLevel: "full" | "partial";
}

// In-memory cache. Maps "{chainId}:{address-lowercase}" → result OR null (negative
// cache, so a miss is not re-fetched every time the same contract is signed).
const cache = new Map<string, AbiResult | null>();

const SOURCIFY_BASE = "https://sourcify.dev/server/files/any";
const TIMEOUT_MS = 5000;

// Test hook — reset the in-memory cache between tests.
export function _clearAbiCache(): void {
  cache.clear();
}

/**
 * Fetch a contract's verified ABI from Sourcify (decentralized, no API key).
 * Returns { abi, matchLevel } or null (not verified / fetch failed / timeout).
 * Never throws. Caches both hits and misses in memory.
 */
export async function fetchContractAbi(chainId: number, address: string): Promise<AbiResult | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${SOURCIFY_BASE}/${chainId}/${address}`, { signal: controller.signal });
    if (!resp.ok) {
      cache.set(key, null);
      return null;
    }
    const body = await resp.json();
    const matchLevel: "full" | "partial" = body?.status === "partial" ? "partial" : "full";
    const metaFile = Array.isArray(body?.files)
      ? body.files.find((f: { name?: string }) => f?.name === "metadata.json")
      : undefined;
    if (!metaFile?.content) {
      cache.set(key, null);
      return null;
    }
    const meta = JSON.parse(metaFile.content);
    const abi = meta?.output?.abi;
    if (!Array.isArray(abi) || abi.length === 0) {
      cache.set(key, null);
      return null;
    }
    const result: AbiResult = { abi: abi as Abi, matchLevel };
    cache.set(key, result);
    return result;
  } catch {
    // Any failure (timeout/AbortError, network error, JSON parse error) → null.
    // Never throw: a decode failure must not break signing.
    cache.set(key, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
