package clearsign

import "testing"

// TestFormatUnitsNegativeIsWellFormed guards the malformed-output bug where
// big.Int.QuoRem's dividend-signed remainder produced "-1.-5" and "0.0000-1".
// The latter is the dangerous one: at a glance it reads as a tiny POSITIVE
// amount on a signing screen.
func TestFormatUnitsNegativeIsWellFormed(t *testing.T) {
	cases := []struct{ raw string; dp int; want string }{
		{"-1500000", 6, "-1.5"},
		{"-1", 6, "-0.000001"},
		{"-2000000", 6, "-2"},
		{"-1", 18, "-0.000000000000000001"},
		{"1500000", 6, "1.5"},
		{"0", 6, "0"},
	}
	for _, c := range cases {
		if got := formatUnits(c.raw, c.dp); got != c.want {
			t.Errorf("formatUnits(%q, %d) = %q, want %q", c.raw, c.dp, got, c.want)
		}
	}
}

// TestFormatUnitsRejectsHexInput guards against hex being silently read as
// decimal: "0x1234" is 4660, not 1234. Returning it verbatim shows the user
// raw data instead of a confidently wrong amount.
func TestFormatUnitsRejectsHexInput(t *testing.T) {
	for _, raw := range []string{"0x1234", "0xdeadbeef", "0xABC"} {
		if got := formatUnits(raw, 6); got != raw {
			t.Errorf("formatUnits(%q, 6) = %q, want the input returned verbatim", raw, got)
		}
	}
}
