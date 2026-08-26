package clearsign

import (
	"regexp"
	"strconv"
	"strings"
)

// sliceExpr matches a byte-slice segment such as "[0:20]", "[-20:]", "[4:]".
var sliceExpr = regexp.MustCompile(`^\[(-?\d+)?:(-?\d+)?\]$`)

// ResolvePath evaluates an ERC-7730 field path against decoded calldata.
//
// Supported forms (chosen from the registry's actual distribution):
//   - flat:   "amount"
//   - nested: "params.recipient"
//   - slice:  "params.path.[0:20]", "params.path.[-20:]"  (byte slicing on hex)
//   - native: "@.value"                                    (transaction value)
//
// Anything else — including other "@" container expressions — returns false so
// the caller falls back to the existing calldata decoder rather than guessing.
func ResolvePath(decoded map[string]any, path string) (any, bool) {
	if strings.HasPrefix(path, "@") {
		v, ok := decoded[path]
		return v, ok
	}

	segments := strings.Split(path, ".")
	var cur any = decoded

	for _, seg := range segments {
		if m := sliceExpr.FindStringSubmatch(seg); m != nil {
			s, ok := sliceHex(cur, m[1], m[2])
			if !ok {
				return nil, false
			}
			cur = s
			continue
		}
		asMap, ok := cur.(map[string]any)
		if !ok {
			return nil, false
		}
		cur, ok = asMap[seg]
		if !ok {
			return nil, false
		}
	}
	return cur, true
}

// sliceHex applies a byte slice to a 0x-prefixed hex string. Indices count
// bytes, not hex characters, and may be negative (counting from the end).
func sliceHex(v any, fromStr, toStr string) (string, bool) {
	s, ok := v.(string)
	if !ok {
		return "", false
	}
	body := strings.TrimPrefix(s, "0x")
	if len(body)%2 != 0 {
		return "", false
	}
	n := len(body) / 2

	from, to := 0, n
	if fromStr != "" {
		i, err := strconv.Atoi(fromStr)
		if err != nil {
			return "", false
		}
		from = normalizeIndex(i, n)
	}
	if toStr != "" {
		i, err := strconv.Atoi(toStr)
		if err != nil {
			return "", false
		}
		to = normalizeIndex(i, n)
	}
	if from < 0 || to > n || from > to {
		return "", false
	}
	return "0x" + body[from*2:to*2], true
}

// normalizeIndex converts a possibly-negative byte index into an absolute one.
func normalizeIndex(i, n int) int {
	if i < 0 {
		return n + i
	}
	return i
}
