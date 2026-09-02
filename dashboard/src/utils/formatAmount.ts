/**
 * The single place amounts become strings.
 *
 * Before this existed there were six `formatBalance` implementations and eight
 * address shorteners, and the same value rendered three different ways: a
 * balance of 1234.5678 showed as `1234.5678` on the wallet screen, `1234.57`
 * on staking, and `1,234.57` on DeFi positions.
 *
 * Two decisions are load-bearing:
 *
 * **Truncate, never round.** A wallet that rounds 1.49999 up to "1.5" invites
 * the user to type 1.5 into a send field they cannot cover. Truncation makes
 * the displayed figure a floor: what you see, you have.
 *
 * **The separator is pinned to en-US.** The old code called
 * `toLocaleString(undefined, …)`, so a German user saw `1.234,57` on one screen
 * and `1234.5678` on another — same app, two conventions, and `1.234` is
 * ambiguous between one thousand and one-point-two-three-four.
 */

/** Below this, a nonzero balance is shown as a threshold rather than a figure. */
const DUST = 0.0001;

const groupInt = (whole: string): string =>
  whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Truncates toward zero at `decimals` places.
 *
 * Uses toFixed(decimals + 2) rather than toFixed(20): the longer form exposes
 * the binary representation (1.49999 is stored as 1.49998999…), so slicing it
 * would truncate float noise instead of the value and turn 1.49999 into
 * 1.499989. Two guard digits are enough to round away the noise while leaving
 * the digits being kept untouched.
 */
function truncate(value: number, decimals: number): string {
  const [whole, fraction = ""] = value.toFixed(decimals + 2).split(".");
  return decimals > 0
    ? `${whole}.${fraction.slice(0, decimals).padEnd(decimals, "0")}`
    : whole;
}

/**
 * Formats a token balance for display.
 *
 * Precision scales with magnitude: small balances need digits to be meaningful
 * at all, large ones do not.
 *
 *   formatAmount("1234.5678")   -> "1,234.5678"
 *   formatAmount("1000000")     -> "1,000,000.0000"
 *   formatAmount("0.00000001")  -> "<0.0001"
 *   formatAmount("")            -> "0"
 */
export function formatAmount(balance: string | number | null | undefined): string {
  const num = typeof balance === "number" ? balance : parseFloat(balance ?? "");

  // Non-numeric input renders as zero rather than the literal "NaN" several of
  // the previous implementations produced.
  if (!Number.isFinite(num)) return "0";
  if (num === 0) return "0";

  const magnitude = Math.abs(num);
  if (magnitude < DUST) return `<${DUST}`;

  const decimals = magnitude < 1 ? 6 : magnitude < 1000 ? 6 : 4;
  const [whole, fraction] = truncate(num, decimals).split(".");
  return fraction ? `${groupInt(whole)}.${fraction}` : groupInt(whole);
}

/**
 * Formats a USD value.
 *
 * Pinned to en-US for the same reason as above, and centralised because
 * `.toFixed(2)` call sites had drifted alongside it — the same wallet screen
 * showed `$1,234.50` and `$1234.50` a hundred lines apart.
 */
export function formatUSD(value: number | null | undefined): string {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Shortens an address or hash for display.
 *
 * `lead` and `tail` are configurable because the screens genuinely differ: a
 * narrow list column fits 6/4, the swap views use 8/6, and AddressRow is wide
 * enough for 10/8. Forcing one shape would either crowd the narrow layouts or
 * discard characters the wide ones have room to show — and every extra
 * character shown is one more a user can check against what they expected.
 *
 * Returns "" for a missing value instead of throwing: several of the previous
 * implementations read `.length` unguarded, so one malformed row could blank an
 * entire list.
 */
export function shortenAddress(
  address?: string | null,
  lead = 6,
  tail = lead,
): string {
  if (!address) return "";
  if (address.length <= lead + tail + 2) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}
