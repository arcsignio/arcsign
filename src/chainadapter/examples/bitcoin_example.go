// Package examples - Bitcoin ChainAdapter usage examples
package main

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/arcsign/chainadapter"
)

// Example 1: 從 BIP44 路徑生成 Bitcoin 地址
func ExampleDeriveAddress() {
	fmt.Println("=== Example 1: 從 BIP44 路徑生成 Bitcoin 地址 ===")

	// 這裡需要實現一個 KeySource（從助記詞或硬體錢包）
	// 示範用途，這裡省略實際的 KeySource 實現

	fmt.Println("用途：從 BIP44 路徑生成比特幣地址")
	fmt.Println("路徑格式：m/44'/0'/0'/0/0")
	fmt.Println("輸出：bc1q... (mainnet) 或 tb1q... (testnet)")
	fmt.Println()
}

// Example 2: 構建未簽名交易
func ExampleBuildTransaction() {
	fmt.Println("=== Example 2: 構建未簽名的比特幣交易 ===")

	ctx := context.Background()

	// 注意：這需要連接到真實的 Bitcoin 節點
	// 實際使用時需要實現 RPCClient

	fmt.Println("步驟：")
	fmt.Println("1. 創建 Bitcoin adapter")
	fmt.Println("2. 準備交易請求（from, to, amount, fee speed）")
	fmt.Println("3. 調用 Build() 獲取未簽名交易")
	fmt.Println()

	// 交易請求示例
	req := &chainadapter.TransactionRequest{
		From:     "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
		To:       "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
		Asset:    "BTC",
		Amount:   big.NewInt(50000), // 50,000 satoshis = 0.0005 BTC
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	fmt.Printf("交易詳情：\n")
	fmt.Printf("  從地址: %s\n", req.From)
	fmt.Printf("  到地址: %s\n", req.To)
	fmt.Printf("  金額: %s satoshis\n", req.Amount.String())
	fmt.Printf("  費用速度: %s\n", req.FeeSpeed)
	fmt.Println()

	_ = ctx // 避免 unused variable 警告
}

// Example 3: 簽名並廣播交易
func ExampleSignAndBroadcast() {
	fmt.Println("=== Example 3: 簽名並廣播交易 ===")

	fmt.Println("完整流程：")
	fmt.Println("1. Build() - 構建未簽名交易")
	fmt.Println("2. Sign() - 使用私鑰簽名")
	fmt.Println("3. Broadcast() - 廣播到網絡")
	fmt.Println("4. QueryStatus() - 查詢交易狀態")
	fmt.Println("5. SubscribeStatus() - 訂閱實時更新")
	fmt.Println()
}

// Example 4: 查詢交易狀態
func ExampleQueryTransactionStatus() {
	fmt.Println("=== Example 4: 查詢交易狀態 ===")

	txHash := "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	fmt.Printf("查詢交易: %s\n", txHash)
	fmt.Println()
	fmt.Println("可能的狀態：")
	fmt.Println("  - pending: 在記憶池中，未確認")
	fmt.Println("  - confirmed: 已確認，但未達到最終性（1-5 個確認）")
	fmt.Println("  - finalized: 已最終化（6+ 個確認）")
	fmt.Println()
}

// Example 5: 訂閱交易狀態更新
func ExampleSubscribeTransactionStatus() {
	fmt.Println("=== Example 5: 訂閱交易狀態實時更新 ===")

	fmt.Println("使用方式：")
	fmt.Println("```go")
	fmt.Println("ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)")
	fmt.Println("defer cancel()")
	fmt.Println()
	fmt.Println("statusChan, err := adapter.SubscribeStatus(ctx, txHash)")
	fmt.Println("if err != nil {")
	fmt.Println("    log.Fatal(err)")
	fmt.Println("}")
	fmt.Println()
	fmt.Println("for status := range statusChan {")
	fmt.Println("    fmt.Printf(\"狀態: %s, 確認數: %d\\n\", status.Status, status.Confirmations)")
	fmt.Println("    ")
	fmt.Println("    if status.Status == chainadapter.TxStatusFinalized {")
	fmt.Println("        break")
	fmt.Println("    }")
	fmt.Println("}")
	fmt.Println("```")
	fmt.Println()
	fmt.Println("特點：")
	fmt.Println("  - 每 10 秒輪詢一次")
	fmt.Println("  - 只在狀態變化時發送更新")
	fmt.Println("  - 支援 context 取消")
	fmt.Println("  - 錯誤時指數退避")
	fmt.Println()
}

// Example 6: 費用估算
func ExampleEstimateFee() {
	fmt.Println("=== Example 6: 估算交易費用 ===")

	fmt.Println("費用速度選項：")
	fmt.Println("  - FeeSpeedFast: 1 個區塊內確認（~10 分鐘）")
	fmt.Println("  - FeeSpeedNormal: 3 個區塊內確認（~30 分鐘）")
	fmt.Println("  - FeeSpeedSlow: 6 個區塊內確認（~1 小時）")
	fmt.Println()
	fmt.Println("返回結果包含：")
	fmt.Println("  - MinFee: 最低費用")
	fmt.Println("  - MaxFee: 最高費用")
	fmt.Println("  - Recommended: 建議費用")
	fmt.Println("  - Confidence: 信心指數（0-100%）")
	fmt.Println()
}

// Example 7: 錯誤處理
func ExampleErrorHandling() {
	fmt.Println("=== Example 7: 錯誤處理 ===")

	fmt.Println("錯誤分類：")
	fmt.Println()
	fmt.Println("1. Retryable（可重試）：")
	fmt.Println("   - ERR_RPC_TIMEOUT: RPC 超時")
	fmt.Println("   - ERR_RPC_UNAVAILABLE: RPC 不可用")
	fmt.Println("   - ERR_NETWORK_CONGESTION: 網絡擁塞")
	fmt.Println()
	fmt.Println("2. NonRetryable（不可重試）：")
	fmt.Println("   - ERR_INVALID_ADDRESS: 地址格式錯誤")
	fmt.Println("   - ERR_INSUFFICIENT_FUNDS: 餘額不足")
	fmt.Println("   - ERR_INVALID_SIGNATURE: 簽名錯誤")
	fmt.Println()
	fmt.Println("3. UserIntervention（需要用戶介入）：")
	fmt.Println("   - ERR_FEE_TOO_LOW: 費用過低")
	fmt.Println("   - ERR_RBF_REQUIRED: 需要 Replace-by-Fee")
	fmt.Println()
	fmt.Println("處理方式：")
	fmt.Println("```go")
	fmt.Println("if err != nil {")
	fmt.Println("    if chainadapter.IsRetryable(err) {")
	fmt.Println("        // 可以重試")
	fmt.Println("        time.Sleep(5 * time.Second)")
	fmt.Println("        return retry()")
	fmt.Println("    } else if chainadapter.IsUserIntervention(err) {")
	fmt.Println("        // 提示用戶採取行動")
	fmt.Println("        return promptUser(err)")
	fmt.Println("    } else {")
	fmt.Println("        // 不可重試，返回錯誤")
	fmt.Println("        return err")
	fmt.Println("    }")
	fmt.Println("}")
	fmt.Println("```")
	fmt.Println()
}

func main() {
	log.SetFlags(0)

	fmt.Println("====================================")
	fmt.Println("Bitcoin ChainAdapter 使用範例")
	fmt.Println("====================================")
	fmt.Println()

	ExampleDeriveAddress()
	time.Sleep(500 * time.Millisecond)

	ExampleBuildTransaction()
	time.Sleep(500 * time.Millisecond)

	ExampleSignAndBroadcast()
	time.Sleep(500 * time.Millisecond)

	ExampleQueryTransactionStatus()
	time.Sleep(500 * time.Millisecond)

	ExampleSubscribeTransactionStatus()
	time.Sleep(500 * time.Millisecond)

	ExampleEstimateFee()
	time.Sleep(500 * time.Millisecond)

	ExampleErrorHandling()

	fmt.Println("====================================")
	fmt.Println("測試方式：")
	fmt.Println("====================================")
	fmt.Println()
	fmt.Println("1. 單元測試（已實現）：")
	fmt.Println("   go test ./bitcoin -v")
	fmt.Println()
	fmt.Println("2. 整合測試（需要 Bitcoin 節點）：")
	fmt.Println("   - 安裝 Bitcoin Core")
	fmt.Println("   - 設定 bitcoin.conf 啟用 RPC")
	fmt.Println("   - 運行 bitcoind -testnet")
	fmt.Println("   - 實現 HTTP RPC client")
	fmt.Println("   - 執行端對端測試")
	fmt.Println()
	fmt.Println("3. 模擬測試（本地開發）：")
	fmt.Println("   - 使用 Mock RPC client")
	fmt.Println("   - 測試所有業務邏輯")
	fmt.Println("   - 無需真實節點")
	fmt.Println()
}
