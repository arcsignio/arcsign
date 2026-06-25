package txguard

import "testing"

func TestIsCanonicalAddress(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool
	}{
		{"valid lowercase", "0x1111111254eeb25477b68fb85ed929f73a960582", true},
		{"valid mixed case", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", true},
		{"empty is canonical (no verifyingContract)", "", true},
		{"decimal numeric bypass", "996101235222674412020337938588541139382869425796", false},
		{"missing 0x prefix", "1111111254eeb25477b68fb85ed929f73a960582", false},
		{"too short", "0x1234", false},
		{"too long", "0x1111111254eeb25477b68fb85ed929f73a96058200", false},
		{"non-hex chars", "0x1111111254eeb25477b68fb85ed929f73a96zzzz", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isCanonicalAddress(c.in); got != c.want {
				t.Fatalf("isCanonicalAddress(%q) = %v, want %v", c.in, got, c.want)
			}
		})
	}
}
