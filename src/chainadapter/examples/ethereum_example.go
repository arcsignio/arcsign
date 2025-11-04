// Package examples - Ethereum ChainAdapter usage examples
package main

import (
	"fmt"
	"log"
	"math/big"
	"time"

	"github.com/arcsign/chainadapter"
)

// Example 1: 從 BIP44 路徑生成 Ethereum 地址
func ExampleDeriveEthereumAddress() {
	fmt.Println("=== Example 1: 從 BIP44 路徑生成 Ethereum 地址 ===")

	fmt.Println("用途：從 BIP44 路徑生成以太坊地址")
	fmt.Println("路徑格式：m/44'/60'/0'/0/0")
	fmt.Println("輸出：0x... (EIP-55 checksummed 地址)")
	fmt.Println()
	fmt.Println("特點：")
	fmt.Println("  - coin type = 60 (Ethereum)")
	fmt.Println("  - 混合大小寫的校驗和地址")
	fmt.Println("  - 支援壓縮和非壓縮公鑰")
	fmt.Println()
}

// Example 2: 構建 EIP-1559 交易
func ExampleBuildEIP1559Transaction() {
	fmt.Println("=== Example 2: 構建 EIP-1559 交易 ===")

	req := &chainadapter.TransactionRequest{
		From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
		To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
		Asset:    "ETH",
		Amount:   big.NewInt(1e18), // 1 ETH
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	fmt.Printf("交易詳情：\n")
	fmt.Printf("  從地址: %s\n", req.From)
	fmt.Printf("  到地址: %s\n", req.To)
	fmt.Printf("  金額: %s wei (1 ETH)\n", req.Amount.String())
	fmt.Printf("  費用速度: %s\n", req.FeeSpeed)
	fmt.Println()
	fmt.Println("EIP-1559 動態費用：")
	fmt.Println("  - Fast: 3x baseFee + 2x priorityFee")
	fmt.Println("  - Normal: 2x baseFee + priorityFee")
	fmt.Println("  - Slow: 1x baseFee + priorityFee")
	fmt.Println()
}

// Example 3: 查詢 Ethereum 交易狀態
func ExampleQueryEthereumStatus() {
	fmt.Println("=== Example 3: 查詢以太坊交易狀態 ===")

	txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	fmt.Printf("查詢交易: %s\n", txHash)
	fmt.Println()
	fmt.Println("使用的 RPC 方法：")
	fmt.Println("  1. eth_getTransactionByHash - 獲取交易詳情")
	fmt.Println("  2. eth_getTransactionReceipt - 獲取交易收據")
	fmt.Println("  3. eth_blockNumber - 計算確認數")
	fmt.Println()
	fmt.Println("狀態判斷：")
	fmt.Println("  - 無收據 → pending")
	fmt.Println("  - 收據 status=0x0 → failed")
	fmt.Println("  - 1-11 確認 → confirmed")
	fmt.Println("  - 12+ 確認 → finalized")
	fmt.Println()
}

// Example 4: 交易失敗檢測
func ExampleDetectFailedTransaction() {
	fmt.Println("=== Example 4: 以太坊交易失敗檢測 ===")

	fmt.Println("檢測機制：")
	fmt.Println("  - 查看 receipt.status 欄位")
	fmt.Println("  - status = \"0x1\" → 成功")
	fmt.Println("  - status = \"0x0\" → 失敗（revert）")
	fmt.Println()
	fmt.Println("失敗交易的處理：")
	fmt.Println("  - 狀態標記為 TxStatusFailed")
	fmt.Println("  - Error 欄位包含錯誤資訊")
	fmt.Println("  - 不會繼續等待確認")
	fmt.Println()
}

// Example 5: Gas 估算
func ExampleEstimateGas() {
	fmt.Println("=== Example 5: Gas 估算 ===")

	fmt.Println("Gas 估算流程：")
	fmt.Println("  1. eth_estimateGas - 估算 gasLimit")
	fmt.Println("  2. eth_getBlockByNumber - 獲取 baseFeePerGas")
	fmt.Println("  3. eth_feeHistory - 獲取歷史 priority fee")
	fmt.Println("  4. 計算 maxFeePerGas 和 maxPriorityFeePerGas")
	fmt.Println()
	fmt.Println("費用計算公式：")
	fmt.Println("  maxFeePerGas = baseFee * multiplier + priorityFee")
	fmt.Println("  實際費用 = min(maxFeePerGas, baseFee + maxPriorityFeePerGas)")
	fmt.Println()
}

// Example 6: Nonce 管理
func ExampleNonceManagement() {
	fmt.Println("=== Example 6: Nonce 管理 ===")

	fmt.Println("Nonce 獲取：")
	fmt.Println("  - 使用 eth_getTransactionCount")
	fmt.Println("  - 參數：\"pending\" 獲取包含待處理交易的 nonce")
	fmt.Println()
	fmt.Println("Nonce 衝突處理：")
	fmt.Println("  - 如果 nonce 太低，返回 Retryable 錯誤")
	fmt.Println("  - 可以手動指定 nonce 進行 replacement")
	fmt.Println("  - 需要提高 gas price 才能替換交易")
	fmt.Println()
}

// Example 7: 與智能合約互動
func ExampleSmartContractInteraction() {
	fmt.Println("=== Example 7: 與智能合約互動 ===")

	fmt.Println("構建合約調用交易：")
	fmt.Println("```go")
	fmt.Println("req := &chainadapter.TransactionRequest{")
	fmt.Println("    From:   \"0x...\",")
	fmt.Println("    To:     \"0x...contract...\",")
	fmt.Println("    Amount: big.NewInt(0), // 非 payable 函數設為 0")
	fmt.Println("    Memo:   \"0x...encoded function call...\",")
	fmt.Println("}")
	fmt.Println("```")
	fmt.Println()
	fmt.Println("Memo 欄位：")
	fmt.Println("  - 包含 ABI 編碼的函數調用")
	fmt.Println("  - 例如：transfer(address,uint256)")
	fmt.Println("  - 可以使用 go-ethereum/accounts/abi 編碼")
	fmt.Println()
}

// Example 8: 訂閱狀態更新（WebSocket vs HTTP）
func ExampleSubscribeWithPolling() {
	fmt.Println("=== Example 8: 訂閱狀態更新 ===")

	fmt.Println("當前實現：HTTP 輪詢")
	fmt.Println("  - 每 12 秒輪詢一次（對應區塊時間）")
	fmt.Println("  - 只在狀態變化時發送更新")
	fmt.Println("  - 錯誤時指數退避（3s → 6s → 12s → 60s）")
	fmt.Println()
	fmt.Println("未來優化：WebSocket")
	fmt.Println("  - 使用 eth_subscribe")
	fmt.Println("  - 訂閱 newHeads 事件")
	fmt.Println("  - 即時獲取狀態更新")
	fmt.Println()
}

func main() {
	log.SetFlags(0)

	fmt.Println("====================================")
	fmt.Println("Ethereum ChainAdapter 使用範例")
	fmt.Println("====================================")
	fmt.Println()

	ExampleDeriveEthereumAddress()
	time.Sleep(500 * time.Millisecond)

	ExampleBuildEIP1559Transaction()
	time.Sleep(500 * time.Millisecond)

	ExampleQueryEthereumStatus()
	time.Sleep(500 * time.Millisecond)

	ExampleDetectFailedTransaction()
	time.Sleep(500 * time.Millisecond)

	ExampleEstimateGas()
	time.Sleep(500 * time.Millisecond)

	ExampleNonceManagement()
	time.Sleep(500 * time.Millisecond)

	ExampleSmartContractInteraction()
	time.Sleep(500 * time.Millisecond)

	ExampleSubscribeWithPolling()

	fmt.Println("====================================")
	fmt.Println("網絡支援：")
	fmt.Println("====================================")
	fmt.Println()
	fmt.Println("支援的以太坊網絡：")
	fmt.Println("  - Mainnet (networkID = 1, chainID = \"ethereum\")")
	fmt.Println("  - Goerli (networkID = 5, chainID = \"ethereum-goerli\")")
	fmt.Println("  - Sepolia (networkID = 11155111, chainID = \"ethereum-sepolia\")")
	fmt.Println()
	fmt.Println("測試方式：")
	fmt.Println("  1. 單元測試：go test ./ethereum -v")
	fmt.Println("  2. Sepolia 測試網：使用免費 RPC 端點")
	fmt.Println("  3. 本地 Hardhat/Ganache：用於開發")
	fmt.Println()
}
