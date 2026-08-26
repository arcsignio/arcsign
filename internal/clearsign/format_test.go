package clearsign

import "testing"

func stubLookup(addr string) (TokenInfo, bool) {
	switch addr {
	case "0x1111111111111111111111111111111111111111":
		return TokenInfo{Symbol: "USDC", Decimals: 6}, true
	}
	return TokenInfo{}, false
}

func noResolve(string) (any, bool) { return nil, false }

func TestFormatRaw(t *testing.T) {
	got, ok := FormatValue("0xdeadbeef", "raw", nil, noResolve, stubLookup)
	if !ok || got != "0xdeadbeef" {
		t.Errorf("raw = %q, %v", got, ok)
	}
}

func TestFormatNoFormatFallsBackToString(t *testing.T) {
	// format 缺席（實測最常見）：直接字串化，仍算成功
	got, ok := FormatValue("0xabc", "", nil, noResolve, stubLookup)
	if !ok || got != "0xabc" {
		t.Errorf("empty format = %q, %v", got, ok)
	}
}

func TestFormatAddressName(t *testing.T) {
	got, ok := FormatValue("0xAbC0000000000000000000000000000000000001", "addressName", nil, noResolve, stubLookup)
	if !ok {
		t.Fatal("addressName should format")
	}
	// 縮寫顯示，保留頭尾以便肉眼比對
	if got != "0xAbC0...0001" {
		t.Errorf("addressName = %q", got)
	}
}

func TestFormatTokenAmountWithKnownToken(t *testing.T) {
	params := map[string]any{"tokenPath": "params.path.[0:20]"}
	resolve := func(p string) (any, bool) {
		if p == "params.path.[0:20]" {
			return "0x1111111111111111111111111111111111111111", true
		}
		return nil, false
	}
	got, ok := FormatValue("1500000", "tokenAmount", params, resolve, stubLookup)
	if !ok {
		t.Fatal("tokenAmount should format")
	}
	if got != "1.5 USDC" {
		t.Errorf("tokenAmount = %q, want 1.5 USDC", got)
	}
}

func TestFormatTokenAmountUnknownTokenStillShowsNumber(t *testing.T) {
	params := map[string]any{"tokenPath": "params.path.[0:20]"}
	resolve := func(string) (any, bool) {
		return "0x9999999999999999999999999999999999999999", true
	}
	got, ok := FormatValue("1500000", "tokenAmount", params, resolve, stubLookup)
	if !ok {
		t.Fatal("unknown token should still render the raw number")
	}
	if got != "1500000 (unknown token)" {
		t.Errorf("unknown tokenAmount = %q", got)
	}
}

func TestFormatDate(t *testing.T) {
	// unix timestamp 秒
	got, ok := FormatValue("1700000000", "date", nil, noResolve, stubLookup)
	if !ok {
		t.Fatal("date should format")
	}
	if got != "2023-11-14 22:13:20 UTC" {
		t.Errorf("date = %q", got)
	}
}

func TestFormatEnum(t *testing.T) {
	params := map[string]any{"1": "Buy", "2": "Sell"}
	got, ok := FormatValue("2", "enum", params, noResolve, stubLookup)
	if !ok || got != "Sell" {
		t.Errorf("enum = %q, %v", got, ok)
	}
}

func TestFormatUnsupportedReturnsFalse(t *testing.T) {
	if _, ok := FormatValue("x", "nftName", nil, noResolve, stubLookup); ok {
		t.Error("nftName is unsupported and must return false")
	}
}

// --- 邊界測試：金額換算最容易出錯的地方 ---

func TestFormatUnitsZeroValue(t *testing.T) {
	got, ok := FormatValue("0", "tokenAmount", map[string]any{"tokenPath": "p"}, func(string) (any, bool) {
		return "0x1111111111111111111111111111111111111111", true
	}, stubLookup)
	if !ok || got != "0 USDC" {
		t.Errorf("zero value = %q, %v, want \"0 USDC\"", got, ok)
	}
}

func TestFormatUnitsZeroDecimals(t *testing.T) {
	lookup := func(addr string) (TokenInfo, bool) {
		return TokenInfo{Symbol: "NFT0", Decimals: 0}, true
	}
	got, ok := FormatValue("42", "tokenAmount", map[string]any{"tokenPath": "p"}, func(string) (any, bool) {
		return "0xabc", true
	}, lookup)
	if !ok || got != "42 NFT0" {
		t.Errorf("decimals=0 = %q, %v, want \"42 NFT0\"", got, ok)
	}
}

func TestFormatUnitsHugeValue(t *testing.T) {
	// max uint256, far beyond int64 range — must use big.Int, not float64.
	huge := "115792089237316195423570985008687907853269984665640564039457584007913129639935"
	lookup := func(addr string) (TokenInfo, bool) {
		return TokenInfo{Symbol: "TOK", Decimals: 18}, true
	}
	got, ok := FormatValue(huge, "tokenAmount", map[string]any{"tokenPath": "p"}, func(string) (any, bool) {
		return "0xabc", true
	}, lookup)
	want := "115792089237316195423570985008687907853269984665640564039457.584007913129639935 TOK"
	if !ok || got != want {
		t.Errorf("huge value = %q, %v, want %q", got, ok, want)
	}
}

func TestFormatUnitsSubOneValue(t *testing.T) {
	// 1 wei with 18 decimals — must not round to 0.
	lookup := func(addr string) (TokenInfo, bool) {
		return TokenInfo{Symbol: "ETH", Decimals: 18}, true
	}
	got, ok := FormatValue("1", "tokenAmount", map[string]any{"tokenPath": "p"}, func(string) (any, bool) {
		return "0xabc", true
	}, lookup)
	want := "0.000000000000000001 ETH"
	if !ok || got != want {
		t.Errorf("sub-one value = %q, %v, want %q", got, ok, want)
	}
}
