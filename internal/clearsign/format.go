package clearsign

import (
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"
)

// TokenInfo is the minimum needed to render a token amount.
type TokenInfo struct {
	Symbol   string
	Decimals int
}

// TokenLookup resolves a token contract address to its symbol and decimals.
// Injected so this package stays pure and offline-testable — it never issues
// RPC calls itself.
type TokenLookup func(address string) (TokenInfo, bool)

// FormatValue renders one decoded value according to an ERC-7730 field format.
//
// Returns false for formats this engine does not implement, so the caller can
// fall back to the existing calldata decoder instead of showing a wrong or
// half-rendered value.
func FormatValue(
	v any,
	format string,
	params map[string]any,
	resolve func(string) (any, bool),
	lookup TokenLookup,
) (string, bool) {
	switch format {
	case "", "raw":
		return fmt.Sprintf("%v", v), true

	case "addressName":
		s := fmt.Sprintf("%v", v)
		return shortenAddress(s), true

	case "amount":
		// Native-currency amount: 18 decimals, no symbol available here.
		return formatUnits(fmt.Sprintf("%v", v), 18), true

	case "tokenAmount":
		return formatTokenAmount(v, params, resolve, lookup)

	case "date":
		return formatDate(fmt.Sprintf("%v", v))

	case "enum":
		key := fmt.Sprintf("%v", v)
		if params != nil {
			if label, ok := params[key]; ok {
				return fmt.Sprintf("%v", label), true
			}
		}
		return "", false

	default:
		// nftName / unit / calldata and anything new: not implemented.
		return "", false
	}
}

// shortenAddress keeps the first 6 and last 4 characters so the user can still
// eyeball-compare against an expected address.
func shortenAddress(s string) string {
	if len(s) <= 12 {
		return s
	}
	return s[:6] + "..." + s[len(s)-4:]
}

func formatTokenAmount(
	v any,
	params map[string]any,
	resolve func(string) (any, bool),
	lookup TokenLookup,
) (string, bool) {
	amountStr := fmt.Sprintf("%v", v)

	// A nil lookup is a legitimate way for a caller to say "no token metadata
	// available"; treat it as an unknown token rather than dereferencing it.
	if lookup == nil {
		return amountStr + " (unknown token)", true
	}

	tokenPath, _ := params["tokenPath"].(string)
	if tokenPath == "" {
		return amountStr + " (unknown token)", true
	}
	tokenAny, ok := resolve(tokenPath)
	if !ok {
		return amountStr + " (unknown token)", true
	}
	info, ok := lookup(strings.ToLower(fmt.Sprintf("%v", tokenAny)))
	if !ok {
		return amountStr + " (unknown token)", true
	}
	return formatUnits(amountStr, info.Decimals) + " " + info.Symbol, true
}

// formatUnits renders a base-unit integer string with the given decimals,
// trimming trailing zeros ("1.500000" -> "1.5", "2.000000" -> "2"). Uses
// math/big exclusively — float64 would lose precision on amounts beyond
// 2^53 and silently misrender large token balances.
func formatUnits(raw string, decimals int) string {
	// Parse strictly as decimal. A "0x" prefix is NOT stripped: hex would be
	// silently misread as decimal ("0x1234" -> 1234 instead of 4660), quietly
	// showing the wrong amount on the signing screen. Unparseable input is
	// returned verbatim so the caller sees raw data rather than a wrong number.
	n, ok := new(big.Int).SetString(raw, 10)
	if !ok {
		return raw
	}
	if decimals <= 0 {
		return n.String()
	}

	// Work on the magnitude and re-attach the sign. big.Int.QuoRem gives a
	// remainder with the DIVIDEND's sign, so signing the parts separately
	// produces malformed output ("-1.-5", or "0.0000-1" — which reads as a
	// tiny positive amount at a glance).
	sign := ""
	if n.Sign() < 0 {
		sign = "-"
	}
	abs := new(big.Int).Abs(n)

	denom := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	q, r := new(big.Int).QuoRem(abs, denom, new(big.Int))
	if r.Sign() == 0 {
		return sign + q.String()
	}
	frac := strings.TrimRight(fmt.Sprintf("%0*s", decimals, r.String()), "0")
	return sign + q.String() + "." + frac
}

func formatDate(raw string) (string, bool) {
	sec, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return "", false
	}
	return time.Unix(sec, 0).UTC().Format("2006-01-02 15:04:05") + " UTC", true
}
