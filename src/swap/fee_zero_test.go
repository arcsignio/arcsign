package swap

import (
	"os"
	"regexp"
	"testing"
)

// TestFeeRateAndFeeAmountAssignedLiteralZero 守住「零抽成」承諾的第二道防線：
// 就算有人不動 QuoteParams 的欄位，改把抽成寫進 SwapQuote.FeeRate / FeeAmount
// （例如某條路徑塞 "0.1" 而不是 "0"），這個測試會抓到。
//
// 這兩個欄位只在 getBestRouteQuote / buildBestRouteTransaction 成功取得真實
// DEX 報價後才會被賦值（見 aggregator.go），需要真的打 OpenOcean/KyberSwap
// API 才能跑到那條路徑，無法離線用行為測試覆蓋、也沒有可注入的 base URL
// hook（Aggregator 的 openoceanClient/kyberswapClient baseURL 是另一個
// package 的非匯出欄位）。因此退而求其次：靜態掃描原始碼，斷言 aggregator.go
// 裡每一處 FeeRate/FeeAmount 賦值的右手邊都是字面量 "0"。
func TestFeeRateAndFeeAmountAssignedLiteralZero(t *testing.T) {
	src, err := os.ReadFile("aggregator.go")
	if err != nil {
		t.Fatalf("failed to read aggregator.go: %v", err)
	}

	assignRe := regexp.MustCompile(`\.(FeeRate|FeeAmount)\s*=\s*(.+)`)
	matches := assignRe.FindAllSubmatch(src, -1)

	if len(matches) == 0 {
		t.Fatal("aggregator.go 中找不到任何 FeeRate/FeeAmount 賦值 —— 測試本身可能已經跟程式碼脫節，需要人工確認")
	}

	for _, m := range matches {
		field := string(m[1])
		rhs := string(m[2])
		if rhs != `"0"` {
			t.Errorf("aggregator.go 中 %s 被賦值為 %s，不是字面量 \"0\" —— ArcSign 不對使用者抽成，任何非零 FeeRate/FeeAmount 都是抽成機制復活的訊號", field, rhs)
		}
	}
}
