package swap

import (
	"reflect"
	"testing"
)

func TestQuoteParamsHasNoFeeFields(t *testing.T) {
	// 這個測試守住「不得有抽成」的產品承諾。
	// QuoteParams 若再度出現 fee/referrer/isPro 欄位，代表抽成機制被加回來。
	typ := reflect.TypeOf(QuoteParams{})
	forbidden := []string{"Fee", "IsPro", "ReferrerAddress", "ReferrerFee"}
	for _, name := range forbidden {
		if _, found := typ.FieldByName(name); found {
			t.Errorf("QuoteParams 不應有 %s 欄位 —— ArcSign 不對使用者抽成", name)
		}
	}
}
