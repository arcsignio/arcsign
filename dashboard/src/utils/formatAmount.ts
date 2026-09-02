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
 * Scales a raw on-chain integer to a plain decimal string.
 *
 * Returns a decimal string, not a display string, on purpose. An earlier shape
 * returned formatted output and then needed a parameter meaning "do not apply
 * your own decimal rule" so gas prices could stay at two places — a parameter
 * whose only job was to undo the function's opinion. Splitting scaling from
 * presentation removes the exception: balances hand the result to
 * formatAmount, Gwei calls .toFixed(2), each caller decides.
 *
 * The division never touches Number(). A near-unlimited ERC-20 allowance
 * exceeds 2^53 — and 2^53 wei is only 0.009 ETH, so float loses precision far
 * earlier than intuition suggests. Number(2^256-1) / Number(10^18) evaluates to
 * 1.157920892373162e+59: not a plausible-looking small number, an
 * unformattable one.
 */
export function toDecimalString(
  raw: string | bigint | null | undefined,
  decimals = 18,
): string {
  if (raw === null || raw === undefined || raw === "") return "0";

  // `10n ** BigInt(decimals)` throws for a negative, fractional, or NaN
  // exponent. decimals reaches here from backend simulation data and from
  // on-chain decimals() calls, and every caller renders inside JSX with no
  // error boundary — an uncaught throw would blank a whole signing review
  // rather than one row of it.
  if (!Number.isInteger(decimals) || decimals < 0) return "0";

  let value: bigint;
  try {
    value = typeof raw === "bigint" ? raw : BigInt(raw);
  } catch {
    return "0";
  }
  if (value === 0n) return "0";

  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = magnitude / scale;
  const remainder = magnitude % scale;

  const sign = negative ? "-" : "";
  if (remainder === 0n) return `${sign}${whole}`;

  // Pad to the full width, then drop trailing zeros: 1.50 -> 1.5
  const fraction = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${sign}${whole}.${fraction}`;
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
 *
 * `showDust` keeps the digits for values below the threshold. A balance under
 * 0.0001 is dust the user cannot act on, so collapsing it is right — but a
 * *fee* is legitimately that small: a BSC transfer costs about 0.00002 BNB, so
 * a fee selector that applied the balance rule showed "<0.0001 BNB" for slow,
 * normal, and fast alike, and conveyed nothing.
 */
export function formatAmount(
  balance: string | number | null | undefined,
  { showDust = false }: { showDust?: boolean } = {},
): string {
  const num = typeof balance === "number" ? balance : parseFloat(balance ?? "");

  // Non-numeric input renders as zero rather than the literal "NaN" several of
  // the previous implementations produced.
  if (!Number.isFinite(num)) return "0";
  if (num === 0) return "0";

  const magnitude = Math.abs(num);
  if (magnitude < DUST && !showDust) return `<${DUST}`;

  // Sub-dust values are only ever shown deliberately (showDust), and six
  // places would truncate 0.0000021 to 0.000002 — losing the digits that were
  // the reason for showing them. Trailing zeros are trimmed there: padding
  // 0.000021 out to nine places adds width without adding information.
  const subDust = magnitude < DUST;
  const decimals = subDust ? 9 : magnitude < 1000 ? 6 : 4;
  const [whole, rawFraction] = truncate(num, decimals).split(".");
  const fraction = subDust ? rawFraction?.replace(/0+$/, "") : rawFraction;
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

/**
 * Abbreviates a magnitude: 1500000 -> "1.5M".
 *
 * Intl does this, so this is an option bag rather than a threshold ladder. The
 * two hand-written ladders it replaces disagreed with each other — one
 * abbreviated from 1,000 and the other from 1,000,000 — and one rounded 1.5M
 * up to "2M", overstating a TVL figure by a third.
 *
 * Pinned to en-US for the same reason as everything else here.
 */
export function formatCompactNumber(value: number | null | undefined): string {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}
