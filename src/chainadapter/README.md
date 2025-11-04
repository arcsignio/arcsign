# ChainAdapter - 統一的跨鏈交易接口

ChainAdapter 提供了一個統一的介面來處理 Bitcoin 和 Ethereum 的交易操作，支援交易構建、簽名、廣播、狀態查詢和地址生成。

## 📦 專案結構

```
chainadapter/
├── adapter.go              # ChainAdapter 介面定義
├── error.go                # 錯誤分類和處理
├── keysource.go           # 金鑰來源抽象
├── bitcoin/               # Bitcoin 實現
│   ├── adapter.go         # Bitcoin ChainAdapter
│   ├── derive.go          # BIP44 地址生成
│   ├── rpc.go             # Bitcoin RPC helper
│   ├── builder.go         # UTXO 交易構建
│   ├── fee.go             # 費用估算
│   ├── signer.go          # 簽名實現
│   └── adapter_test.go    # 整合測試
├── ethereum/              # Ethereum 實現
│   ├── adapter.go         # Ethereum ChainAdapter
│   ├── derive.go          # BIP44 地址生成
│   ├── rpc.go             # Ethereum RPC helper
│   ├── builder.go         # EIP-1559 交易構建
│   ├── fee.go             # Gas 費用估算
│   ├── signer.go          # 簽名實現
│   └── adapter_test.go    # 整合測試
├── rpc/                   # RPC 客戶端抽象
│   └── client.go          # RPCClient 介面
├── storage/               # 交易狀態存儲
│   └── memory.go          # 記憶體存儲實現
├── examples/              # 使用範例
│   ├── bitcoin_example.go
│   └── ethereum_example.go
└── TESTING_GUIDE.md       # 測試指南
```

## 🚀 快速開始

### 安裝

```bash
go get github.com/arcsign/chainadapter
```

### Bitcoin 範例

```go
import (
    "context"
    "math/big"
    "github.com/arcsign/chainadapter"
    "github.com/arcsign/chainadapter/bitcoin"
)

// 1. 創建 adapter
rpcClient := NewBitcoinRPCClient("http://localhost:18332")
txStore := storage.NewMemoryTxStore()
adapter, _ := bitcoin.NewBitcoinAdapter(rpcClient, txStore, "testnet3")

// 2. 生成地址
ctx := context.Background()
address, _ := adapter.Derive(ctx, keySource, "m/44'/0'/0'/0/0")
// 結果: tb1q... (testnet P2WPKH)

// 3. 構建交易
req := &chainadapter.TransactionRequest{
    From:     address.Address,
    To:       "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7",
    Asset:    "BTC",
    Amount:   big.NewInt(50000), // 50,000 satoshis
    FeeSpeed: chainadapter.FeeSpeedNormal,
}
unsigned, _ := adapter.Build(ctx, req)

// 4. 簽名
signed, _ := adapter.Sign(ctx, unsigned, signer)

// 5. 廣播
receipt, _ := adapter.Broadcast(ctx, signed)
fmt.Printf("交易已廣播: %s\n", receipt.TxHash)

// 6. 監控狀態
statusChan, _ := adapter.SubscribeStatus(ctx, receipt.TxHash)
for status := range statusChan {
    fmt.Printf("狀態: %s, 確認數: %d\n", status.Status, status.Confirmations)
    if status.Status == chainadapter.TxStatusFinalized {
        break // 6+ 確認
    }
}
```

### Ethereum 範例

```go
import (
    "github.com/arcsign/chainadapter/ethereum"
)

// 1. 創建 adapter
rpcClient := NewEthereumRPCClient("https://sepolia.infura.io/v3/YOUR_KEY")
adapter, _ := ethereum.NewEthereumAdapter(rpcClient, txStore, 11155111) // Sepolia

// 2. 生成 EIP-55 地址
address, _ := adapter.Derive(ctx, keySource, "m/44'/60'/0'/0/0")
// 結果: 0xAbC... (checksummed)

// 3. 構建 EIP-1559 交易
req := &chainadapter.TransactionRequest{
    From:     address.Address,
    To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    Asset:    "ETH",
    Amount:   big.NewInt(1e18), // 1 ETH
    FeeSpeed: chainadapter.FeeSpeedNormal,
}
unsigned, _ := adapter.Build(ctx, req)

// 4-6. 簽名、廣播、監控（同 Bitcoin）
```

## 🎯 核心功能

### 1. ChainAdapter 介面

所有區塊鏈實現都遵循統一的 `ChainAdapter` 介面：

```go
type ChainAdapter interface {
    // 基本資訊
    ChainID() string
    Capabilities() *Capabilities

    // 交易生命週期
    Build(ctx context.Context, req *TransactionRequest) (*UnsignedTransaction, error)
    Estimate(ctx context.Context, req *TransactionRequest) (*FeeEstimate, error)
    Sign(ctx context.Context, unsigned *UnsignedTransaction, signer Signer) (*SignedTransaction, error)
    Broadcast(ctx context.Context, signed *SignedTransaction) (*BroadcastReceipt, error)

    // 地址生成
    Derive(ctx context.Context, keySource KeySource, path string) (*Address, error)

    // 狀態查詢
    QueryStatus(ctx context.Context, txHash string) (*TransactionStatus, error)
    SubscribeStatus(ctx context.Context, txHash string) (<-chan *TransactionStatus, error)
}
```

### 2. Bitcoin 特性

- ✅ **UTXO 模型**：自動選擇 UTXOs 並計算找零
- ✅ **P2WPKH 地址**：Native SegWit（bc1q...）
- ✅ **費用估算**：使用 `estimatesmartfee`
- ✅ **RBF 支援**：Replace-By-Fee (BIP 125)
- ✅ **多網絡**：mainnet, testnet3, regtest

### 3. Ethereum 特性

- ✅ **EIP-1559**：動態費用（baseFee + priorityFee）
- ✅ **EIP-55**：Checksummed 地址
- ✅ **EIP-155**：交易簽名（防重放攻擊）
- ✅ **Nonce 管理**：自動從 pending 狀態獲取
- ✅ **交易失敗檢測**：檢查 receipt.status
- ✅ **多網絡**：mainnet, goerli, sepolia

### 4. 地址生成（BIP44）

兩條鏈都支援 BIP44 標準的分層確定性地址生成：

| 鏈 | Coin Type | 路徑格式 | 地址範例 |
|---|-----------|----------|----------|
| Bitcoin | 0 | `m/44'/0'/0'/0/0` | bc1q... |
| Ethereum | 60 | `m/44'/60'/0'/0/0` | 0xAbC... |

### 5. 交易狀態

統一的交易狀態定義：

- **pending**: 在記憶池中，未確認
- **confirmed**: 已確認但未最終化
  - Bitcoin: 1-5 個確認
  - Ethereum: 1-11 個確認
- **finalized**: 已最終化，可安全確認
  - Bitcoin: 6+ 個確認
  - Ethereum: 12+ 個確認
- **failed**: 交易失敗（僅 Ethereum）

### 6. 錯誤處理

所有錯誤都被分類為三種類型：

```go
// Retryable - 可重試（暫時性錯誤）
- ERR_RPC_TIMEOUT
- ERR_RPC_UNAVAILABLE
- ERR_NETWORK_CONGESTION

// NonRetryable - 不可重試（永久性錯誤）
- ERR_INVALID_ADDRESS
- ERR_INSUFFICIENT_FUNDS
- ERR_INVALID_SIGNATURE

// UserIntervention - 需要用戶介入
- ERR_FEE_TOO_LOW
- ERR_RBF_REQUIRED
```

使用範例：

```go
if err != nil {
    if chainadapter.IsRetryable(err) {
        // 重試邏輯
        time.Sleep(5 * time.Second)
        return retry()
    } else if chainadapter.IsUserIntervention(err) {
        // 提示用戶
        return promptUser(err)
    } else {
        // 返回錯誤
        return err
    }
}
```

## 🧪 測試

### 單元測試

```bash
# 運行所有測試
go test ./... -v

# 生成覆蓋率報告
go test ./bitcoin ./ethereum -coverprofile=coverage.out
go tool cover -html=coverage.out
```

**測試結果：**
- ✅ Bitcoin: 31/31 測試通過
- ✅ Ethereum: 33/33 測試通過

### 使用範例

```bash
# 查看 Bitcoin 範例
go run examples/bitcoin_example.go

# 查看 Ethereum 範例
go run examples/ethereum_example.go
```

詳細的測試指南請參考 [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## 📖 API 文檔

### TransactionRequest

構建交易的請求參數：

```go
type TransactionRequest struct {
    From      string    // 來源地址
    To        string    // 目標地址
    Asset     string    // 資產類型（"BTC", "ETH"）
    Amount    *big.Int  // 金額（最小單位）
    Memo      string    // 備註（Bitcoin: OP_RETURN, Ethereum: data）
    MaxFee    *big.Int  // 最大可接受費用
    FeeSpeed  FeeSpeed  // 費用速度（slow/normal/fast）

    ChainSpecific map[string]interface{} // 鏈特定參數
}
```

### UnsignedTransaction

未簽名的交易：

```go
type UnsignedTransaction struct {
    ID             string
    ChainID        string
    From           string
    To             string
    Amount         *big.Int
    Fee            *big.Int
    Nonce          *uint64  // Ethereum only
    SigningPayload []byte   // 用於簽名的 payload
    HumanReadable  string   // 人類可讀的交易描述
    ChainSpecific  map[string]interface{}
    CreatedAt      time.Time
}
```

### TransactionStatus

交易狀態：

```go
type TransactionStatus struct {
    TxHash        string
    Status        TxStatus  // pending/confirmed/finalized/failed
    Confirmations int
    BlockNumber   *uint64
    BlockHash     *string
    UpdatedAt     time.Time
    Error         *ChainError  // 交易失敗時的錯誤
}
```

### Address

生成的地址：

```go
type Address struct {
    Address        string   // 鏈特定編碼（bc1q... 或 0x...）
    ChainID        string
    DerivationPath string   // BIP44 路徑
    PublicKey      []byte   // 公鑰 bytes
    Format         string   // 地址格式（P2WPKH 或 checksummed）
}
```

## 🔧 架構設計

### 設計原則

1. **介面隔離**：統一的 ChainAdapter 介面
2. **依賴注入**：RPC client 和 storage 可替換
3. **錯誤分類**：清晰的錯誤處理策略
4. **冪等性**：所有操作都是冪等的
5. **並發安全**：支援多 goroutine 並發調用

### 依賴關係

```
ChainAdapter
    ├── RPCClient (interface)
    │   └── HTTP/WebSocket 實現
    ├── TransactionStateStore (interface)
    │   └── Memory/Database 實現
    ├── TransactionBuilder
    │   ├── Bitcoin: UTXO selector
    │   └── Ethereum: EIP-1559 builder
    └── FeeEstimator
        ├── Bitcoin: estimatesmartfee
        └── Ethereum: baseFee + feeHistory
```

## 🛣️ Roadmap

### ✅ Phase 3 - 已完成

- [x] ChainAdapter 介面設計
- [x] Bitcoin 實現（UTXO, P2WPKH, RBF）
- [x] Ethereum 實現（EIP-1559, EIP-55, EIP-155）
- [x] BIP44 地址生成
- [x] 交易狀態監控（HTTP 輪詢）
- [x] 完整的單元測試
- [x] 使用範例和文檔

### 📋 Phase 4 - 計劃中

- [ ] HTTP RPC Client 實現
- [ ] WebSocket 支援（Ethereum）
- [ ] RPC Failover 機制
- [ ] 端對端整合測試
- [ ] 性能基準測試
- [ ] 交易重播保護
- [ ] 硬體錢包支援（Ledger/Trezor）

### 🚀 Phase 5 - 未來

- [ ] 更多鏈支援（Polygon, BSC, etc.）
- [ ] Lightning Network 支援
- [ ] Multi-sig 支援
- [ ] 智能合約部署
- [ ] GraphQL API

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

### 開發環境

```bash
# 安裝依賴
go mod download

# 運行測試
go test ./... -v

# 格式化代碼
go fmt ./...

# 靜態分析
go vet ./...
```

## 📄 授權

MIT License

## 📞 聯繫方式

- GitHub Issues: [問題追蹤](https://github.com/Jason-chen-taiwan/arcSignv2/issues)
- 文檔: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

**最後更新**: 2025-11-04
**版本**: 1.0.0
**狀態**: Phase 3 Complete ✅
