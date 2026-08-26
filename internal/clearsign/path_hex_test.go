package clearsign

import "testing"

func TestSliceHexRejectsNonHex(t *testing.T) {
	d := map[string]any{
		"noPrefix": "1111111111111111111111111111111111111111",
		"notHex":   "0xGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrst",
	}
	if v, ok := ResolvePath(d, "noPrefix.[0:5]"); ok {
		t.Errorf("missing 0x prefix must fail, got %v", v)
	}
	if v, ok := ResolvePath(d, "notHex.[0:5]"); ok {
		t.Errorf("non-hex chars must fail, got %v", v)
	}
}
