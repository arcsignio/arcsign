import { getChainIconUrl, getChainFallbackIcon } from "@/utils/chainIcons";

/**
 * One slice of the allocation: a chain and how much of the asset sits on it.
 * Provider-neutral so any current or future chain flows in automatically.
 */
export interface ChainAllocationSlice {
  /** Canonical/internal network id (e.g. "eth-mainnet"), used for the icon. */
  network: string;
  /** Human-readable chain label (e.g. "Ethereum"). */
  networkLabel: string;
  /** Weight used for the proportion — USD value, or balance when no price. */
  weight: number;
}

/**
 * Build allocation slices from a token's per-chain sources. Falls back to
 * balance when USD value is unavailable (e.g. NodeReal/Glacier without price),
 * so the treemap still reflects relative holdings. Zero-weight chains are
 * dropped. NEW CHAINS REQUIRE NO CHANGES HERE — they appear as soon as the
 * token has a source on them.
 */
export function buildChainAllocation(
  sources: { network: string; networkLabel: string; usdValue?: number; balance?: string }[],
): ChainAllocationSlice[] {
  // Merge by canonical network (a token could, in theory, have two source rows
  // on the same chain) and sum the weights.
  const byNetwork = new Map<string, ChainAllocationSlice>();
  for (const s of sources) {
    const usd = s.usdValue || 0;
    const bal = parseFloat(s.balance || "0") || 0;
    const weight = usd > 0 ? usd : bal;
    if (weight <= 0) continue;
    const existing = byNetwork.get(s.network);
    if (existing) {
      existing.weight += weight;
    } else {
      byNetwork.set(s.network, { network: s.network, networkLabel: s.networkLabel, weight });
    }
  }
  return Array.from(byNetwork.values()).sort((a, b) => b.weight - a.weight);
}

// A small palette cycled by index so each chip/slice is visually distinct
// without hard-coding any chain → color mapping.
const SLICE_SHADES = [
  "#0d9488", "#0891b2", "#7c3aed", "#db2777", "#ea580c",
  "#16a34a", "#2563eb", "#ca8a04", "#dc2626", "#475569",
];

/**
 * Proportional allocation bar: each chain gets a segment sized to its share of
 * the asset, labelled with chain + percentage. Driven entirely by the slices
 * passed in, so adding a chain anywhere upstream draws it automatically.
 */
export function ChainAllocationTreemap({ slices }: { slices: ChainAllocationSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.weight, 0);
  if (total <= 0 || slices.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: 64,
        borderRadius: 10,
        overflow: "hidden",
        gap: 2,
      }}
    >
      {slices.map((s, i) => {
        const pct = (s.weight / total) * 100;
        const color = SLICE_SHADES[i % SLICE_SHADES.length];
        // Hide the inline label on very thin slices to avoid overflow.
        const showLabel = pct >= 8;
        return (
          <div
            key={s.network}
            title={`${s.networkLabel}: ${pct.toFixed(1)}%`}
            style={{
              flexGrow: s.weight,
              flexBasis: 0,
              minWidth: 4,
              background: `${color}22`,
              borderTop: `3px solid ${color}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              padding: showLabel ? "0 0.5rem" : 0,
              overflow: "hidden",
            }}
          >
            {showLabel && (
              <>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color }}>{pct.toFixed(1)}%</span>
                <span style={{ fontSize: "0.625rem", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                  {s.networkLabel}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Re-export icon helpers so callers can build per-chain rows consistently. */
export { getChainIconUrl, getChainFallbackIcon };
