package clearsign

import "testing"

func decodedFixture() map[string]any {
	return map[string]any{
		"amount": "1000",
		"params": map[string]any{
			"recipient": "0xabc",
			"amountIn":  "500",
			// 20-byte token A ++ 3-byte fee ++ 20-byte token B
			"path": "0x" +
				"1111111111111111111111111111111111111111" +
				"0001f4" +
				"2222222222222222222222222222222222222222",
		},
		"@.value": "12345",
	}
}

func TestResolvePathFlat(t *testing.T) {
	got, ok := ResolvePath(decodedFixture(), "amount")
	if !ok || got != "1000" {
		t.Errorf("flat path = %v, %v; want 1000, true", got, ok)
	}
}

func TestResolvePathNested(t *testing.T) {
	got, ok := ResolvePath(decodedFixture(), "params.recipient")
	if !ok || got != "0xabc" {
		t.Errorf("nested path = %v, %v; want 0xabc, true", got, ok)
	}
}

func TestResolvePathByteSlicePrefix(t *testing.T) {
	// [0:20] 取前 20 bytes = 第一個 token 地址
	got, ok := ResolvePath(decodedFixture(), "params.path.[0:20]")
	if !ok {
		t.Fatal("slice path not resolved")
	}
	if got != "0x1111111111111111111111111111111111111111" {
		t.Errorf("slice [0:20] = %v", got)
	}
}

func TestResolvePathByteSliceNegative(t *testing.T) {
	// [-20:] 取後 20 bytes = 最後一個 token 地址
	got, ok := ResolvePath(decodedFixture(), "params.path.[-20:]")
	if !ok {
		t.Fatal("negative slice not resolved")
	}
	if got != "0x2222222222222222222222222222222222222222" {
		t.Errorf("slice [-20:] = %v", got)
	}
}

func TestResolvePathNativeValue(t *testing.T) {
	got, ok := ResolvePath(decodedFixture(), "@.value")
	if !ok || got != "12345" {
		t.Errorf("@.value = %v, %v; want 12345, true", got, ok)
	}
}

func TestResolvePathMissingReturnsFalse(t *testing.T) {
	if _, ok := ResolvePath(decodedFixture(), "params.nope"); ok {
		t.Error("missing path should return false")
	}
	// 不支援的 @ 表達式必須明確回 false，讓呼叫端退回保底解碼
	if _, ok := ResolvePath(decodedFixture(), "@.unsupported"); ok {
		t.Error("unsupported @ expression should return false")
	}
}
