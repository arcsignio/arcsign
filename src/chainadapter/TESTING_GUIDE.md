# ChainAdapter 測試指南

本文檔說明如何測試已實現的 ChainAdapter 功能。

## 目錄

1. [單元測試（已實現）](#1-單元測試已實現)
2. [使用範例](#2-使用範例)
3. [整合測試（連接真實節點）](#3-整合測試連接真實節點)
4. [測試覆蓋率](#4-測試覆蓋率)

---

## 1. 單元測試（已實現）

### 運行所有測試

```bash
cd /Users/jnr350/Desktop/Yansiang/arcSignv2/src/chainadapter

# 運行 Bitcoin 測試
go test ./bitcoin -v

# 運行 Ethereum 測試
go test ./ethereum -v

# 運行所有測試
go test ./... -v
```

### Bitcoin 測試覆蓋

✅ **8/8 核心功能測試**

- `TestBitcoinAdapter_Build` - 構建未簽名交易
- `TestBitcoinAdapter_Build_InsufficientFunds` - 餘額不足錯誤處理
- `TestBitcoinAdapter_Derive` - BIP44 地址生成（5 個子測試）
- `TestBitcoinAdapter_Derive_Testnet` - 測試網地址生成
- `TestBitcoinAdapter_QueryStatus` - 交易狀態查詢（5 個子測試）
- `TestBitcoinAdapter_Capabilities` - 功能檢測
- `TestBitcoinAdapter_SubscribeStatus` - 狀態訂閱
- `TestBitcoinAdapter_Broadcast` - 廣播與冪等性

✅ **額外的廣播測試**（10 個測試）

- 成功廣播
- 冪等性檢查
- 重試計數
- 錯誤處理
- 已知交易處理

✅ **簽名測試**（13 個測試）

- WIF 私鑰導入
- 簽名生成與驗證
- 地址匹配檢查
- 確定性簽名

### Ethereum 測試覆蓋

✅ **6/6 核心功能測試**

- `TestEthereumAdapter_Build` - EIP-1559 交易構建
- `TestEthereumAdapter_Derive` - BIP44 地址生成（5 個子測試）
- `TestEthereumAdapter_QueryStatus` - 交易狀態查詢（4 個子測試）
  - pending, confirmed, finalized, failed
- `TestEthereumAdapter_Capabilities` - 功能檢測
- `TestEthereumAdapter_SubscribeStatus` - 狀態訂閱
- `TestEthereumAdapter_Broadcast` - 廣播與冪等性

✅ **額外的廣播測試**（14 個測試）

- 成功廣播
- 冪等性檢查
- Hash 大小寫不敏感
- Sepolia 網絡支援
- Hex 格式化

✅ **簽名測試**（13 個測試）

- 私鑰導入（hex）
- EIP-155 簽名
- 地址生成
- ChainID 隔離

---

## 2. 使用範例

### 查看 Bitcoin 使用範例

```bash
cd /Users/jnr350/Desktop/Yansiang/arcSignv2/src/chainadapter
go run examples/bitcoin_example.go
```

**輸出內容：**
- 地址生成示例
- 交易構建流程
- 狀態查詢方法
- 費用估算
- 錯誤處理

### 查看 Ethereum 使用範例

```bash
go run examples/ethereum_example.go
```

**輸出內容：**
- EIP-55 地址生成
- EIP-1559 交易構建
- Gas 估算
- Nonce 管理
- 智能合約互動

---

## 3. 整合測試（連接真實節點）

### 方案 A：使用公開測試網

#### Bitcoin Testnet

1. **使用公開 RPC 端點**（不推薦用於生產）
   ```go
   // 需要實現 HTTP RPC client
   rpcClient := NewHTTPRPCClient("https://blockstream.info/testnet/api")
   adapter, _ := bitcoin.NewBitcoinAdapter(rpcClient, txStore, "testnet3")
   ```

2. **獲取測試幣**
   - https://testnet-faucet.mempool.co/
   - https://coinfaucet.eu/en/btc-testnet/

3. **測試完整流程**
   ```go
   // 1. 生成地址
   address, _ := adapter.Derive(ctx, keySource, "m/44'/0'/0'/0/0")

   // 2. 構建交易
   req := &TransactionRequest{
       From: address.Address,
       To: "tb1q...",
       Amount: big.NewInt(10000),
       FeeSpeed: FeeSpeedNormal,
   }
   unsigned, _ := adapter.Build(ctx, req)

   // 3. 簽名
   signed, _ := adapter.Sign(ctx, unsigned, signer)

   // 4. 廣播
   receipt, _ := adapter.Broadcast(ctx, signed)

   // 5. 監控狀態
   statusChan, _ := adapter.SubscribeStatus(ctx, receipt.TxHash)
   for status := range statusChan {
       fmt.Printf("Status: %s, Confirmations: %d\n",
           status.Status, status.Confirmations)
   }
   ```

#### Ethereum Sepolia

1. **使用免費 RPC**
   ```go
   // Alchemy, Infura, 或其他免費服務
   rpcClient := NewHTTPRPCClient("https://sepolia.infura.io/v3/YOUR_KEY")
   adapter, _ := ethereum.NewEthereumAdapter(rpcClient, txStore, 11155111)
   ```

2. **獲取測試 ETH**
   - https://sepoliafaucet.com/
   - https://www.alchemy.com/faucets/ethereum-sepolia

3. **測試完整流程**（同 Bitcoin）

### 方案 B：本地節點

#### Bitcoin Core（推薦用於開發）

1. **安裝 Bitcoin Core**
   ```bash
   # macOS
   brew install bitcoin

   # Ubuntu
   sudo apt-get install bitcoind
   ```

2. **配置 bitcoin.conf**
   ```ini
   # ~/.bitcoin/bitcoin.conf
   testnet=1
   server=1
   rpcuser=your_username
   rpcpassword=your_password
   rpcallowip=127.0.0.1
   rpcport=18332
   ```

3. **啟動節點**
   ```bash
   bitcoind -testnet -daemon
   ```

4. **實現 RPC Client**
   ```go
   type BitcoinRPCClient struct {
       endpoint string
       username string
       password string
   }

   func (c *BitcoinRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
       // HTTP Basic Auth + JSON-RPC 2.0
       // POST to http://localhost:18332
   }
   ```

#### Ethereum (Hardhat/Ganache)

1. **安裝 Hardhat**
   ```bash
   npm install --save-dev hardhat
   npx hardhat node
   ```

2. **連接本地節點**
   ```go
   rpcClient := NewHTTPRPCClient("http://localhost:8545")
   adapter, _ := ethereum.NewEthereumAdapter(rpcClient, txStore, 31337) // Hardhat chainID
   ```

3. **特點**
   - 即時挖礦
   - 預載測試帳戶
   - 完整的除錯工具

---

## 4. 測試覆蓋率

### 當前測試狀態

| 功能 | Bitcoin | Ethereum | 狀態 |
|------|---------|----------|------|
| ChainID() | ✅ | ✅ | 完成 |
| Capabilities() | ✅ | ✅ | 完成 |
| Build() | ✅ | ✅ | 完成 |
| Estimate() | ⚠️ | ⚠️ | 部分測試 |
| Sign() | ✅ | ✅ | 完成 |
| Broadcast() | ✅ | ✅ | 完成 |
| Derive() | ✅ | ✅ | 完成 |
| QueryStatus() | ✅ | ✅ | 完成 |
| SubscribeStatus() | ✅ | ✅ | 完成 |

**總計測試：**
- Bitcoin: 31 個測試全部通過 ✅
- Ethereum: 33 個測試全部通過 ✅

### 運行覆蓋率報告

```bash
# 生成覆蓋率報告
go test ./bitcoin ./ethereum -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html

# 查看覆蓋率百分比
go test ./bitcoin ./ethereum -cover
```

---

## 5. 快速測試清單

### ✅ 單元測試（無需外部依賴）

```bash
# 運行所有測試
go test ./... -v

# 只測試特定功能
go test ./bitcoin -run TestDeriveAddress -v
go test ./ethereum -run TestBuild -v
```

### ✅ 查看使用範例

```bash
# Bitcoin 範例
go run examples/bitcoin_example.go

# Ethereum 範例
go run examples/ethereum_example.go
```

### ⚠️ 整合測試（需要節點）

```bash
# 1. 啟動本地節點
bitcoind -testnet -daemon
# 或
npx hardhat node

# 2. 實現 RPC client（見上方範例）

# 3. 運行端對端測試
go test ./integration -v
```

---

## 6. 故障排除

### 測試失敗

1. **檢查依賴**
   ```bash
   go mod tidy
   go mod verify
   ```

2. **清理緩存**
   ```bash
   go clean -testcache
   go test ./... -v
   ```

### RPC 連接問題

1. **檢查節點狀態**
   ```bash
   # Bitcoin
   bitcoin-cli -testnet getblockchaininfo

   # Ethereum
   curl -X POST http://localhost:8545 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

2. **驗證 RPC 配置**
   - 檢查用戶名/密碼
   - 檢查 IP 白名單
   - 檢查端口是否開放

---

## 7. 下一步

1. **實現 RPC Client**
   - HTTP client with retry logic
   - WebSocket support
   - Failover between multiple endpoints

2. **端對端測試**
   - 創建 integration_test.go
   - 測試完整的交易流程
   - 測試錯誤恢復

3. **性能測試**
   - Benchmark Build/Sign/Broadcast
   - 測試並發請求
   - 測試 RPC failover

---

## 總結

✅ **已完成**
- 完整的單元測試套件
- Mock RPC client
- 所有核心功能測試
- 使用範例文檔

📋 **待完成**
- HTTP RPC client 實現
- 端對端整合測試
- 性能基準測試

**測試覆蓋率：** 所有核心功能已有完整的單元測試，可以在不連接真實節點的情況下驗證所有業務邏輯。
