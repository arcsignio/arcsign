# ArcSign - 完整項目規格書

**Secure Hierarchical Deterministic (HD) Wallet with USB-Only Storage**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org/dl/)
[![Tests](https://img.shields.io/badge/tests-72%20passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)]()

## 目錄

- [項目概述](#項目概述)
- [核心功能](#核心功能)
- [快速開始](#快速開始)
- [ChainAdapter - 跨鏈交易接口](#chainadapter---跨鏈交易接口)
- [使用指南](#使用指南)
- [架構設計](#架構設計)
- [性能指標](#性能指標)
- [安全最佳實踐](#安全最佳實踐)
- [開發指南](#開發指南)
- [故障排除](#故障排除)
- [路線圖](#路線圖)

---

## 項目概述

ArcSign 是一個命令行加密貨幣錢包，實現了 BIP39/BIP44 標準進行安全密鑰管理。所有敏感數據專門存儲在 USB 驅動器上，永不存儲在計算機硬盤上，提供額外的安全防護層，防止惡意軟件和數據盜竊。

### 版本狀態

**當前版本**: v0.3.0 (2025-10-17)
**狀態**: ✅ 生產就緒
**測試覆蓋率**: 72/72 tests passing
- Bitcoin: 31/31 單元測試
- Ethereum: 33/33 單元測試
- Metrics: 8/8 單元測試
- Contract Tests: 11 個合約測試

### 設計原則

1. **安全至上**: USB專用存儲、軍事級加密、記憶體困難KDF
2. **標準合規**: BIP39/BIP32/BIP44/SLIP-44完全遵循
3. **多鏈支持**: 54條區塊鏈，7種簽名方案
4. **用戶體驗**: 互動式CLI、清晰的錯誤消息
5. **可測試性**: TDD開發、300+自動化測試

---

## 核心功能

### 1. 錢包管理

#### 創建錢包
- **助記詞生成**: 12或24詞BIP39助記詞
- **可選密碼**: BIP39第25個詞支持
- **強密碼要求**: 12+字符，複雜度規則
- **USB專用存儲**: 永不接觸硬盤

#### 恢復錢包
- **密碼保護**: AES-256-GCM解密
- **速率限制**: 每分鐘3次嘗試
- **審計日誌**: 完整操作追蹤

#### 地址生成
- **54條區塊鏈**: 支持主流加密貨幣
- **BIP44標準**: m/44'/coin'/account'/change/index
- **多賬戶**: 無限賬戶和地址

### 2. 支持的加密貨幣 (54條鏈)

#### 30條基礎鏈 (v0.2.0)
BTC, ETH, USDT, BNB, SOL, USDC, XRP, DOGE, ADA, TRX, AVAX, SHIB, DOT, LINK, MATIC, LTC, BCH, XLM, UNI, ATOM, ETC, XMR, FIL, HBAR, APT, VET, ALGO, NEAR, ZEC, DASH

#### 6條Layer 2網絡 (v0.3.0 Phase 1)
- **Arbitrum (ARB)** - Optimistic Rollup
- **Optimism (OP)** - Optimistic Rollup
- **Base (BASE)** - Coinbase L2
- **zkSync (ZKS)** - ZK Rollup
- **Linea (LINEA)** - zkEVM
- **Starknet (STRK)** - ZK Rollup with EIP-2645

#### 4條區域鏈 (v0.3.0 Phase 2)
- **Klaytn (KLAY)** - 韓國公鏈
- **Cronos (CRO)** - Crypto.com區塊鏈
- **HECO (HT)** - 火幣生態鏈
- **Harmony (ONE)** - 分片區塊鏈, Bech32編碼

#### 4條Cosmos生態 (v0.3.0 Phase 3)
- **Osmosis (OSMO)** - DEX區塊鏈
- **Juno (JUNO)** - 智能合約平台
- **Evmos (EVMOS)** - EVM兼容Cosmos
- **Secret Network (SCRT)** - 隱私智能合約

#### 6條替代EVM鏈 (v0.3.0 Phase 4)
- **Fantom (FTM)** - DAG + EVM
- **Celo (CELO)** - 移動優先EVM
- **Moonbeam (GLMR)** - Polkadot上的EVM
- **Metis (METIS)** - Optimistic Rollup
- **Gnosis (GNO)** - 預測市場
- **Wanchain (WAN)** - 跨鏈基礎設施

#### 4條專業鏈 (v0.3.0 Phase 5)
- **Kusama (KSM)** - sr25519簽名, SS58編碼
- **ICON (ICX)** - SHA3-256哈希, hx前綴
- **Tezos (XTZ)** - Ed25519 + SLIP-10, Blake2b
- **Zilliqa (ZIL)** - Schnorr簽名, Bech32編碼

### 3. 密碼學特性

#### 加密算法
- **AES-256-GCM**: 認證加密
- **Argon2id**: OWASP推薦參數
  - 迭代: 4次
  - 記憶體: 256 MiB
  - 並行度: 4線程
- **速率限制**: 防暴力破解 (3次/分鐘)
- **審計日誌**: NDJSON格式防篡改

#### 標準合規
- **BIP39**: 助記詞生成 (12或24詞)
- **BIP32**: 分層確定性密鑰派生
- **BIP44**: 多賬戶層次結構
- **SLIP-44**: 標準幣種類型註冊表
- **SLIP-10**: Ed25519 HD派生 (Tezos)
- **EIP-2645**: Starknet密鑰派生
- **Cosmos ADR-028**: Bech32編碼
- **Substrate BIP39**: sr25519簽名 (Kusama)

#### 地址格式支持
- **P2PKH**: Bitcoin及兼容鏈
- **Keccak256**: Ethereum/EVM鏈
- **Ed25519**: Solana, Tezos
- **Bech32**: Cosmos, Harmony, Zilliqa
- **SS58**: Kusama/Substrate
- **Base58Check**: Bitcoin, Stellar, Ripple, Tezos
- **SHA3-256**: ICON (hx前綴)
- **Schnorr**: Zilliqa簽名方案
- **sr25519**: Kusama簽名方案

### 4. 安全特性

- ✅ **USB專用存儲** - 所有錢包數據僅存儲在可移動USB驅動器
- ✅ **軍事級加密** - AES-256-GCM認證加密
- ✅ **記憶體困難KDF** - Argon2id抵禦GPU/ASIC攻擊
- ✅ **速率限制** - 防止暴力破解攻擊
- ✅ **審計日誌** - 完整的錢包操作審計追蹤
- ✅ **BIP39密碼** - 可選第25個詞提供額外安全層
- ✅ **原子文件操作** - 崩潰安全的文件寫入

---

## 快速開始

### 系統要求

- Go 1.21或更高版本
- USB驅動器 (最少10 MB可用空間)
- Windows, macOS, 或 Linux

### 安裝

#### 從源碼構建

```bash
# 克隆倉庫
git clone https://github.com/yourusername/arcsign.git
cd arcsign

# 安裝依賴
go mod download

# 構建二進制文件
go build -o arcsign ./cmd/arcsign

# 驗證安裝
./arcsign version
```

#### 運行測試

```bash
# 運行所有測試
go test ./tests/... -v

# 單元測試
go test ./tests/unit/... -v

# 集成測試
go test ./tests/integration/... -v

# ChainAdapter測試
cd src/chainadapter && make test-unit
```

### 基本用法

#### 1. 創建錢包

```bash
./arcsign create
```

**交互流程**:
1. 檢測USB驅動器
2. 輸入錢包名稱 (可選)
3. 選擇助記詞長度 (12或24詞)
4. 設置BIP39密碼 (可選, 高級)
5. 創建強加密密碼
6. 顯示恢復助記詞

**⚠️ 重要**: 將助記詞寫在紙上並安全離線存儲!

#### 2. 恢復錢包

```bash
./arcsign restore
```

**功能**:
- 從USB加載錢包元數據
- 解密並查看助記詞
- 驗證錢包信息

#### 3. 生成地址

```bash
./arcsign derive
```

**支持的幣種**:
- Bitcoin (BTC) - P2PKH地址
- Ethereum (ETH) - 原生地址
- 自定義賬戶和地址索引

#### 4. 生成所有54條鏈地址

```bash
./arcsign generate-all
```

**輸出格式**:
- JSON文件: 完整元數據
- CSV文件: 電子表格兼容
- 保存位置: USB/{wallet-id}/addresses/

**輸出示例** (addresses-20251017-143025.json):
```json
{
  "wallet_id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b",
  "wallet_name": "My Wallet",
  "generated_at": "2025-10-17T14:30:25+08:00",
  "total_chains": 54,
  "success_count": 54,
  "failed_count": 0,
  "addresses": [
    {
      "rank": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "coin_type": 0,
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "path": "m/44'/0'/0'/0/0",
      "category": "base",
      "key_type": "secp256k1"
    }
    // ... 53 more chains
  ]
}
```

---

## ChainAdapter - 跨鏈交易接口

**Version**: 1.0.0 | **Status**: Phase 9 Complete ✅

ChainAdapter 提供統一的介面來處理 Bitcoin 和 Ethereum 的交易操作，支援交易構建、簽名、廣播、狀態查詢和地址生成。

### 核心功能

#### 交易生命週期管理

**Build() - 構建未簽名交易**

Bitcoin實現:
```go
func (b *BitcoinAdapter) Build(ctx context.Context, req *TransactionRequest) (*UnsignedTransaction, error)
```
- 自動選擇UTXOs (貪心算法)
- 計算找零輸出
- 估算交易費用
- 生成簽名負載

Ethereum實現:
```go
func (e *EthereumAdapter) Build(ctx context.Context, req *TransactionRequest) (*UnsignedTransaction, error)
```
- 查詢nonce (eth_getTransactionCount)
- 估算gas (eth_estimateGas)
- 計算EIP-1559費用 (Fast/Normal/Slow三種模式)
- 生成簽名負載

**Sign() - 簽名交易 (支援離線簽名)**

```go
func (adapter *Adapter) Sign(ctx context.Context, unsigned *UnsignedTransaction, signer Signer) (*SignedTransaction, error)
```
- 驗證地址匹配 (From地址必須匹配簽名者)
- 生成簽名 (ECDSA for Bitcoin/Ethereum)
- 保留未簽名交易供審計
- 返回序列化交易

**Broadcast() - 廣播交易 (冪等，支援安全重試)**

```go
func (adapter *Adapter) Broadcast(ctx context.Context, signed *SignedTransaction) (*BroadcastReceipt, error)
```
- 冪等設計: 重複廣播同一交易不會失敗
- 狀態追蹤: 存儲到TransactionStateStore
- 重試安全: 支持網絡錯誤後重試
- 返回交易哈希和狀態

**QueryStatus() / SubscribeStatus() - 交易狀態監控**

```go
func (adapter *Adapter) QueryStatus(ctx context.Context, txHash string) (*TransactionStatus, error)
func (adapter *Adapter) SubscribeStatus(ctx context.Context, txHash string) (<-chan TransactionStatus, error)
```
- 查詢確認數
- 實時狀態更新 (WebSocket/輪詢)
- 狀態: Pending → Confirmed → Finalized

#### 地址生成

**Derive() - BIP44地址生成**

```go
func (adapter *Adapter) Derive(ctx context.Context, mnemonic string, path string) (string, error)
```
- Bitcoin: P2WPKH地址 (bc1q...)
- Ethereum: EIP-55 checksummed地址 (0x...)
- BIP44路徑: m/44'/coin'/account'/change/index

#### Phase 9: 可觀測指標

**可選的Prometheus指標整合**

```go
type ChainMetrics interface {
    RecordRPCCall(method string, duration time.Duration, success bool)
    RecordTransactionBuild(chainID string, duration time.Duration, success bool)
    RecordTransactionSign(chainID string, duration time.Duration, success bool)
    RecordTransactionBroadcast(chainID string, duration time.Duration, success bool)
    GetMetrics() *AggregatedMetrics
    GetRPCMetrics(method string) *MethodMetrics
    GetHealthStatus() HealthStatus
    Export() string
    Reset()
}
```

**功能**:
- RPC呼叫追蹤（方法、延遲、成功率）
- 交易操作指標（Build/Sign/Broadcast持續時間和成功率）
- 健康狀態檢查:
  - 成功率 < 90%
  - 平均延遲 > 5秒
  - 5分鐘內無成功呼叫
- Prometheus格式導出

**健康狀態**:
```go
type HealthStatus struct {
    Status  string    // "OK", "Degraded", or "Down"
    Message string
    CheckedAt time.Time
    LowSuccessRate    bool
    HighLatency       bool
    NoRecentSuccess   bool
}
```

### 快速使用示例

#### Bitcoin交易流程

```go
import (
    "github.com/arcsign/chainadapter/bitcoin"
    "github.com/arcsign/chainadapter/metrics"
)

// 創建帶指標的Bitcoin adapter
metricsRecorder := metrics.NewPrometheusMetrics()
btcAdapter, _ := bitcoin.NewBitcoinAdapter(rpcClient, txStore, "mainnet", metricsRecorder)

// 構建交易
req := &chainadapter.TransactionRequest{
    From:   "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    To:     "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    Amount: big.NewInt(50000), // 0.0005 BTC
}

unsigned, err := btcAdapter.Build(ctx, req)

// 簽名交易
signer := bitcoin.NewBTCDSigner(privateKeyWIF, "mainnet")
signed, err := btcAdapter.Sign(ctx, unsigned, signer)

// 廣播交易
receipt, err := btcAdapter.Broadcast(ctx, signed)
fmt.Printf("Transaction broadcasted: %s\n", receipt.TxHash)

// 監控狀態
statusChan, _ := btcAdapter.SubscribeStatus(ctx, receipt.TxHash)
for status := range statusChan {
    fmt.Printf("Confirmations: %d, Status: %s\n",
        status.Confirmations, status.Status)

    if status.Status == chainadapter.TxStatusFinalized {
        break // Bitcoin: 6+確認視為最終確認
    }
}
```

#### Ethereum交易流程 (EIP-1559)

```go
import (
    "github.com/arcsign/chainadapter/ethereum"
    "github.com/arcsign/chainadapter/metrics"
)

// 創建帶指標的Ethereum adapter
metricsRecorder := metrics.NewPrometheusMetrics()
ethAdapter, _ := ethereum.NewEthereumAdapter(rpcClient, txStore, 1, metricsRecorder)

// 構建交易
req := &chainadapter.TransactionRequest{
    From:   "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbd",
    To:     "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    Asset:  "ETH",
    Amount: big.NewInt(1000000000000000000), // 1 ETH
}

unsigned, err := ethAdapter.Build(ctx, req)

// 簽名交易
signer, _ := ethereum.NewEthereumSigner(privateKeyHex, 1)
signed, err := ethAdapter.Sign(ctx, unsigned, signer)

// 廣播交易
receipt, err := ethAdapter.Broadcast(ctx, signed)
fmt.Printf("Transaction broadcasted: %s\n", receipt.TxHash)

// 查詢狀態
status, _ := ethAdapter.QueryStatus(ctx, receipt.TxHash)
fmt.Printf("Status: %s, Confirmations: %d\n",
    status.Status, status.Confirmations)
```

#### 指標查詢

```go
// 查詢健康狀態
health := metricsRecorder.GetHealthStatus()
if health.Status == "Degraded" {
    log.Printf("警告: %s", health.Message)
    if health.HighLatency {
        log.Printf("RPC延遲過高")
    }
    if health.LowSuccessRate {
        log.Printf("RPC成功率過低")
    }
}

// 查詢特定方法指標
rpcMetrics := metricsRecorder.GetRPCMetrics("eth_getTransactionCount")
fmt.Printf("Method: %s, Total: %d, Success: %d, Avg Duration: %v\n",
    rpcMetrics.Method, rpcMetrics.TotalCalls,
    rpcMetrics.SuccessCount, rpcMetrics.AvgDuration)

// 導出Prometheus指標
fmt.Println(metricsRecorder.Export())
```

### 實現狀態

**已完成功能**:
- ✅ User Story 1: 統一的跨鏈交易構建 (Bitcoin UTXO + Ethereum EIP-1559)
- ✅ User Story 3: 冪等的交易廣播（支援安全重試）
- ✅ User Story 4: BIP44地址生成（Bitcoin coin 0, Ethereum coin 60）
- ✅ User Story 5: 功能檢測（EIP-1559、RBF、Memo等動態功能查詢）
- ✅ User Story 6: 離線簽名與審計追蹤
- ✅ User Story 7: 可觀測指標與健康監控（Prometheus）

**測試覆蓋率**: 72/72 tests passing
- Bitcoin: 31/31 單元測試
- Ethereum: 33/33 單元測試
- Metrics: 8/8 單元測試
- Contract Tests: 11個合約測試

**文檔位置**: `src/chainadapter/`

---

## 使用指南

### 創建錢包完整流程

```
$ ./arcsign create

=== ArcSign Wallet Creation ===

Step 1: Detecting USB storage...
✓ USB device detected: D:\

Step 2: Enter wallet name (optional, press Enter to skip): My Crypto Wallet

Step 3: Choose mnemonic length:
  1) 12 words (recommended for most users)
  2) 24 words (maximum security)
Enter choice (1 or 2): 1

Step 4: BIP39 passphrase (advanced)
A BIP39 passphrase adds an extra layer of security.
⚠️  Warning: If you forget the passphrase, you cannot recover your wallet!
Use BIP39 passphrase? (y/N): N

Step 5: Set encryption password
Requirements:
  - At least 12 characters
  - At least 3 of: uppercase, lowercase, numbers, special characters

Enter password: ************
Confirm password: ************

Step 6: Creating wallet...
✓ Wallet created successfully!

═══════════════════════════════════════════════════════════
                  ⚠️  BACKUP YOUR MNEMONIC  ⚠️
═══════════════════════════════════════════════════════════

Write down these words in order and store them safely:

  abandon ability able about above absent absorb abstract absurd abuse access accident

═══════════════════════════════════════════════════════════

Wallet Information:
  ID: 3c3e0aba-91e1-44d4-8b29-ec066d5acf0b
  Name: My Crypto Wallet
  Created: 2025-10-16 15:30:45
  Storage: D:\

Your wallet is now ready to use!
```

### 地址生成完整流程

```
$ ./arcsign derive

=== ArcSign Address Derivation ===

Step 1: Detecting USB storage...
✓ USB device detected: D:\

Step 2: Enter wallet ID: 3c3e0aba-91e1-44d4-8b29-ec066d5acf0b

Step 3: Loading wallet...
✓ Wallet found!

Step 4: Enter encryption password to unlock wallet
Enter password (attempt 1/3): ************

✓ Wallet unlocked successfully!

Step 5: Select cryptocurrency
  1) Bitcoin (BTC)
  2) Ethereum (ETH)
Enter choice (1 or 2): 1

Step 6: Enter account index (default 0): 0
Step 7: Enter address index (default 0): 0

Step 8: Deriving address...
✓ Address derived successfully!

═══════════════════════════════════════════════════════════
                    BITCOIN ADDRESS
═══════════════════════════════════════════════════════════

  Address: 16XiVQeqbDsVPRNcCUCtKwiGhNsfhz8J1c

  Derivation Path: m/44'/0'/0'/0/0
  Coin: Bitcoin
  Account: 0
  Index: 0

═══════════════════════════════════════════════════════════

You can use this address to receive funds.
```

### 常見使用場景

#### 場景1: 個人Bitcoin錢包

```bash
# 創建錢包
./arcsign create
# 選擇: 12詞，無密碼，名稱: "Personal BTC"

# 生成接收地址
./arcsign derive
# Bitcoin (1), Account 0, Address 0 → 分享給他人
# Bitcoin (1), Account 0, Address 1 → 另一個發送者
# Bitcoin (1), Account 0, Address 2 → 再一個發送者
```

#### 場景2: 多幣種投資組合

```bash
# 創建錢包
./arcsign create
# 選擇: 24詞，無密碼，名稱: "Crypto Portfolio"

# Bitcoin地址
./arcsign derive
# 選擇: 1 (Bitcoin), Account 0, Address 0

# Ethereum地址
./arcsign derive
# 選擇: 2 (Ethereum), Account 0, Address 0
```

#### 場景3: 業務分離賬戶

```bash
# 創建錢包
./arcsign create
# 選擇: 12詞，無密碼，名稱: "Business Wallet"

# 個人賬戶
./arcsign derive
# Bitcoin (1), Account 0, Address 0

# 業務賬戶
./arcsign derive
# Bitcoin (1), Account 1, Address 0

# 客戶存款
./arcsign derive
# Bitcoin (1), Account 2, Address 0
```

#### 場景4: 高安全性設置帶密碼

```bash
# 創建錢包
./arcsign create
# 選擇: 24詞，YES密碼，名稱: "High Security"
# 密碼: [記住的強密碼]

# 誘餌錢包 (無密碼)
./arcsign derive
# 使用空密碼，存入小額 ($100-500)

# 真實錢包 (帶密碼)
./arcsign derive
# 使用真實密碼，存入主要資金
```

### 理解派生路徑

#### BIP44路徑格式

```
m / purpose' / coin_type' / account' / change / address_index

示例: m/44'/0'/0'/0/0
     │  │   │    │   │  │
     │  │   │    │   │  └─ 地址索引 0 (0, 1, 2, ...)
     │  │   │    │   └──── 外部鏈 (0) 或 內部/找零 (1)
     │  │   │    └──────── 賬戶 0 (0, 1, 2, ...)
     │  │   └───────────── Bitcoin (0), Ethereum (60), 等
     │  └───────────────── BIP44標準
     └──────────────────── 主密鑰
```

#### 常見路徑

**Bitcoin**:
- 第一個地址: `m/44'/0'/0'/0/0`
- 第二個地址: `m/44'/0'/0'/0/1`
- 找零地址: `m/44'/0'/0'/1/0`
- 第二個賬戶: `m/44'/0'/1'/0/0`

**Ethereum**:
- 第一個地址: `m/44'/60'/0'/0/0`
- 第二個地址: `m/44'/60'/0'/0/1`

#### 撇號 (') 含義

- **帶撇號 (')**: 硬化派生
  - 更安全
  - 用於 purpose, coin_type, account
  - 不能從父公鑰派生子公鑰

- **無撇號**: 非硬化派生
  - 用於 change 和 address_index
  - 允許只讀錢包 (xpub)

---

## 架構設計

### 整體項目架構

本項目包含兩個主要組件:

1. **ChainAdapter 共享庫** (`src/chainadapter/`) - 統一的跨鏈交易接口 (SDK)
2. **ArcSign Wallet CLI** (`cmd/arcsign/`, `internal/`) - 使用 ChainAdapter 的示例應用

### ChainAdapter 共享庫架構 (主要組件)

ChainAdapter 是一個 **Go 共享庫/SDK**，提供統一的區塊鏈交易操作接口。應用程序通過 `import` 導入並使用:

```go
import "github.com/arcsign/chainadapter/bitcoin"
import "github.com/arcsign/chainadapter/ethereum"
```

```
┌─────────────────────────────────────────────────────────────┐
│                   應用層 (Application Layer)                  │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  用戶應用程式     │  │   ArcSign CLI    │                │
│  │  (User Apps)     │  │   (示例應用)      │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                           │
│           └─────────┬───────────┘                           │
│                     │                                       │
│                     │ import chainadapter                   │
└─────────────────────┼───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              ChainAdapter SDK (共享庫層)                      │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          ChainAdapter Interface (統一接口)             │  │
│  │  - Build()      構建未簽名交易                         │  │
│  │  - Sign()       簽名交易 (支援離線)                    │  │
│  │  - Broadcast()  廣播交易 (冪等)                       │  │
│  │  - QueryStatus() / SubscribeStatus()  狀態監控        │  │
│  │  - Derive()     BIP44地址生成                         │  │
│  │  - Capabilities() 功能檢測                            │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                       │
│          ┌───────────┴───────────┐                          │
│          │                       │                          │
│  ┌───────▼────────┐      ┌───────▼────────┐                │
│  │ BitcoinAdapter │      │EthereumAdapter │                │
│  │                │      │                │                │
│  │ - UTXO選擇     │      │ - EIP-1559費用 │                │
│  │ - RBF支持      │      │ - Nonce管理    │                │
│  │ - P2WPKH地址   │      │ - Gas估算      │                │
│  │ - 找零計算     │      │ - EIP-55校驗   │                │
│  └───────┬────────┘      └───────┬────────┘                │
│          │                       │                          │
└──────────┼───────────────────────┼──────────────────────────┘
           │                       │
┌──────────▼───────────────────────▼──────────────────────────┐
│               基礎設施層 (Infrastructure)                      │
│                                                              │
│  ┌────────────────┐      ┌────────────────┐                │
│  │   RPC Client   │      │   RPC Client   │                │
│  │ - Bitcoin Core │      │ - Geth/Infura  │                │
│  │ - 主備切換     │      │ - WebSocket    │                │
│  │ - 重試邏輯     │      │ - 批量調用     │                │
│  └────────────────┘      └────────────────┘                │
│                                                              │
│  ┌─────────────────────────────────────────┐                │
│  │   TransactionStateStore (交易狀態存儲)   │                │
│  │ - MemoryTxStore  (記憶體實現)           │                │
│  │ - FileTxStore    (文件持久化)           │                │
│  └─────────────────────────────────────────┘                │
│                                                              │
│  ┌─────────────────────────────────────────┐                │
│  │   ChainMetrics (可選的 Prometheus 指標)  │                │
│  │ - RPC 呼叫追蹤 (方法、延遲、成功率)      │                │
│  │ - 交易操作指標 (Build/Sign/Broadcast)   │                │
│  │ - 健康狀態檢查                          │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**使用方式**:

```go
// 1. 創建適配器 (帶可選指標)
metricsRecorder := metrics.NewPrometheusMetrics()  // 可選
btcAdapter, _ := bitcoin.NewBitcoinAdapter(
    rpcClient,
    txStore,
    "mainnet",
    metricsRecorder,
)

// 2. 構建交易
req := &chainadapter.TransactionRequest{...}
unsigned, _ := btcAdapter.Build(ctx, req)

// 3. 簽名交易
signer := bitcoin.NewBTCDSigner(privateKeyWIF, "mainnet")
signed, _ := btcAdapter.Sign(ctx, unsigned, signer)

// 4. 廣播交易
receipt, _ := btcAdapter.Broadcast(ctx, signed)

// 5. 監控狀態
status, _ := btcAdapter.QueryStatus(ctx, receipt.TxHash)
```

### ArcSign Wallet CLI 架構 (示例應用)

ArcSign Wallet CLI 是一個使用 ChainAdapter 共享庫的示例命令行應用程序,展示如何集成 ChainAdapter 進行錢包管理和地址生成:

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Layer (命令行層)                       │
│  (cmd/arcsign/main.go)                                      │
│  - 命令路由 (create, restore, derive, generate-all)         │
│  - 用戶交互 (提示輸入、顯示結果)                             │
│  - 輸入驗證                                                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                 Service Layer (服務層)                        │
│  (internal/services/)                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Wallet     │  │    BIP39     │  │   HD Key     │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  │  (錢包管理)   │  │  (助記詞)     │  │ (密鑰派生)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Address    │  │  Encryption  │  │   Storage    │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  │ (54鏈地址)   │  │ (AES-GCM)    │  │  (USB I/O)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Rate Limiter │  │ Audit Logger │  │ Coin Registry│      │
│  │ (速率限制)    │  │ (審計日誌)    │  │ (幣種註冊)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│            Infrastructure Layer (基礎設施層)                  │
│  - File I/O (USB drives, wallet.json, mnemonic.enc)        │
│  - Cryptographic primitives (Argon2id, AES-256-GCM)         │
│  - Platform-specific code (USB detection)                   │
└─────────────────────────────────────────────────────────────┘
```

**注意**: ArcSign Wallet CLI 主要用於密鑰管理和地址生成。如需交易功能,可以導入 ChainAdapter 庫來實現 Build/Sign/Broadcast 操作。

### 項目結構

```
arcSignv2/
├── cmd/
│   └── arcsign/              # CLI入口
│       └── main.go           # 命令路由和UI (612行)
│
├── internal/
│   ├── models/               # 數據模型
│   │   ├── models.go         # Wallet, Mnemonic (120行)
│   │   └── address.go        # DerivedAddress, AddressBook (70行)
│   │
│   ├── services/             # 業務邏輯
│   │   ├── address/          # 地址派生 (83行)
│   │   │   ├── bitcoin.go    # BTC系列格式化器 (164行)
│   │   │   ├── ripple.go     # XRP格式化器 (91行)
│   │   │   ├── stellar.go    # XLM格式化器 (47行)
│   │   │   ├── tron.go       # TRX格式化器 (67行)
│   │   │   ├── solana.go     # SOL格式化器 (43行)
│   │   │   └── cosmos.go     # ATOM格式化器 (47行)
│   │   │
│   │   ├── bip39service/     # 助記詞生成 (95行)
│   │   ├── encryption/       # AES-GCM + Argon2id (180行)
│   │   ├── hdkey/            # BIP32/BIP44 (133行)
│   │   ├── ratelimit/        # 速率限制 (85行)
│   │   ├── storage/          # USB I/O (250行)
│   │   ├── wallet/           # 錢包管理 (420行)
│   │   └── coinregistry/     # 幣種註冊表 (332行)
│   │
│   ├── lib/                  # 庫和工具
│   │   └── errors.go         # 錯誤類型 (122行)
│   │
│   └── utils/                # 工具和驗證器 (180行)
│       ├── errors.go         # 自定義錯誤類型
│       ├── validators.go     # 密碼、名稱驗證
│       └── audit.go          # 審計日誌
│
├── src/
│   └── chainadapter/         # 跨鏈交易接口
│       ├── adapter.go        # ChainAdapter接口定義
│       ├── bitcoin/          # Bitcoin實現
│       │   ├── adapter.go    # BitcoinAdapter (Build/Sign/Broadcast)
│       │   └── adapter_test.go
│       ├── ethereum/         # Ethereum實現
│       │   ├── adapter.go    # EthereumAdapter (EIP-1559)
│       │   └── adapter_test.go
│       ├── rpc/              # RPC客戶端
│       │   └── metrics_client.go  # 帶指標的RPC包裝器
│       ├── storage/          # 交易狀態存儲
│       ├── metrics/          # 可觀測指標
│       │   ├── metrics.go    # ChainMetrics接口
│       │   ├── prometheus.go # Prometheus實現
│       │   └── prometheus_test.go
│       └── tests/
│           ├── contract/     # 合約測試
│           └── mocks/        # 模擬對象
│
└── tests/
    ├── unit/                 # 單元測試 (270+)
    │   ├── bip32_test.go
    │   ├── bip39_test.go
    │   ├── encryption_test.go
    │   ├── password_test.go
    │   ├── ratelimit_test.go
    │   ├── storage_test.go
    │   ├── wallet_create_test.go
    │   ├── wallet_restore_test.go
    │   ├── coinregistry_test.go
    │   └── address_formatters_test.go
    │
    └── integration/          # 集成測試 (30+)
        ├── derive_address_test.go
        ├── wallet_lifecycle_test.go
        ├── performance_test.go
        └── backward_compatibility_test.go
```

### 存儲結構

```
USB_DRIVE/
└── {wallet-id}/
    ├── wallet.json         # 錢包元數據 (未加密)
    │   {
    │     "id": "3c3e0aba-...",
    │     "name": "My Wallet",
    │     "created_at": "2025-10-16T15:30:45Z",
    │     "word_count": 12,
    │     "uses_passphrase": false,
    │     "address_book": {...}  # v0.2.0+
    │   }
    │
    ├── mnemonic.enc        # 加密的助記詞
    │   [16字節salt] + [12字節nonce] + [密文+認證標籤]
    │
    ├── audit.log           # 審計追蹤 (NDJSON格式)
    │   {"timestamp":"...","event":"WALLET_CREATED",...}
    │   {"timestamp":"...","event":"RESTORE_SUCCESS",...}
    │
    └── addresses/          # 地址列表 (generate-all命令)
        ├── addresses-20251017-143025.json
        └── addresses-20251017-143025.csv
```

### 加密方案

#### 加密流程

```
1. 用戶密碼
    ↓
2. 生成16字節隨機鹽值
    ↓
3. Argon2id密鑰派生
   - 迭代: 4次
   - 記憶體: 256 MiB (262,144 KB)
   - 並行度: 4線程
   - 輸出: 32字節密鑰
    ↓
4. 生成12字節隨機nonce
    ↓
5. AES-256-GCM加密
   - 密鑰: 32字節
   - Nonce: 12字節
   - 輸出: 密文 + 16字節認證標籤
    ↓
6. 連接: salt || nonce || ciphertext+tag
    ↓
7. 寫入mnemonic.enc文件
```

#### 解密流程

```
1. 讀取mnemonic.enc文件
    ↓
2. 解析: salt (16字節) || nonce (12字節) || ciphertext+tag
    ↓
3. 使用密碼 + salt通過Argon2id派生密鑰
    ↓
4. AES-256-GCM解密
    ↓
5. 驗證認證標籤
    ↓
6. 返回明文助記詞
```

### 關鍵設計模式

#### 1. 策略模式 - 地址格式化器

```go
func (s *AddressService) DeriveAddress(
    key *hdkeychain.ExtendedKey,
    formatterID string,
) (string, error) {
    switch formatterID {
    case "bitcoin":   return s.DeriveBitcoinAddress(key)
    case "ethereum":  return s.DeriveEthereumAddress(key)
    case "stellar":   return s.DeriveStellarAddress(key)
    case "solana":    return s.DeriveSolanaAddress(key)
    // ... 54種格式化器
    }
}
```

#### 2. 倉庫模式 - 幣種註冊表

```go
type Registry struct {
    coins       map[string]CoinMetadata  // 按符號查找
    byCoinType  map[uint32]CoinMetadata  // 按SLIP-44類型查找
    sortedCoins []CoinMetadata           // 按市值排序
}

func (r *Registry) GetCoin(symbol string) (*CoinMetadata, error)
func (r *Registry) GetCoinByCoinType(coinType uint32) (*CoinMetadata, error)
func (r *Registry) ListCoins() []CoinMetadata
```

#### 3. 裝飾器模式 - 指標RPC客戶端

```go
type MetricsRPCClient struct {
    client  RPCClient
    metrics ChainMetrics
}

func (m *MetricsRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
    start := time.Now()
    result, err := m.client.Call(ctx, method, params)
    duration := time.Since(start)

    m.metrics.RecordRPCCall(method, duration, err == nil)
    return result, err
}
```

### 數據流

#### 創建錢包流程

```
用戶輸入
    ↓
CLI (handleCreateWallet)
    ↓
WalletService.CreateWallet()
    ├─→ Validators.ValidatePassword()
    ├─→ Validators.ValidateWalletName()
    ├─→ BIP39Service.GenerateMnemonic()
    ├─→ EncryptionService.Encrypt()
    ├─→ StorageService.WriteFile() (wallet.json)
    ├─→ StorageService.WriteFile() (mnemonic.enc)
    └─→ AuditLogger.LogEvent()
    ↓
返回錢包數據 + 助記詞給用戶
```

#### 地址派生流程

```
用戶輸入 (錢包ID, 密碼, 幣種, 賬戶, 索引)
    ↓
CLI (handleDeriveAddress)
    ↓
WalletService.LoadWallet()
    ↓
WalletService.RestoreWallet()
    ├─→ RateLimiter.AllowAttempt()
    ├─→ StorageService.ReadFile()
    ├─→ EncryptionService.Decrypt()
    └─→ RateLimiter.ResetAttempts() (成功時)
    ↓
BIP39Service.MnemonicToSeed()
    ↓
HDKeyService.NewMasterKey()
    ↓
HDKeyService.DerivePath()
    ↓
AddressService.DeriveAddress(formatterID)
    ↓
顯示地址給用戶
```

---

## 性能指標

### 操作時序

| 操作 | 目標 | 實際 | 狀態 |
|------|------|------|------|
| 錢包創建 | < 10s | 7-9s | ✅ 達標 |
| 錢包恢復 | < 10s | 7-9s | ✅ 達標 |
| 單幣種地址派生 | < 500ms | 200-300ms | ✅ 超越 |
| 地址查找 | < 100ms | < 1ms | ✅ 超越 |
| 24幣種地址生成 | - | 4-6s | ✅ 可接受 |
| 記憶體使用 | < 100MB | ~45MB | ✅ 達標 |

### ChainAdapter性能

| 操作 | Bitcoin | Ethereum | 備註 |
|------|---------|----------|------|
| Build() | 200-500ms | 100-300ms | 取決於RPC延遲 |
| Sign() | < 50ms | < 50ms | 離線操作 |
| Broadcast() | 100-500ms | 100-300ms | 網絡延遲 |
| QueryStatus() | 100-200ms | 100-200ms | 單次RPC調用 |

### 性能瓶頸分析

**錢包創建 (7-9秒)**:
1. 助記詞生成: ~100ms
2. 加密: ~1-2秒 (Argon2id設計為慢)
3. 地址生成: ~4-6秒 (24+ 幣種)
4. 元數據序列化: ~100ms

**優化機會**:
- 並行地址生成 (當前順序): 可減少到 2-3秒
- 緩存派生密鑰: 加速重複操作
- 批量RPC調用: 減少網絡往返

### 性能測試

#### 運行性能測試

```bash
# 錢包創建性能測試
go test -v -timeout 30s ./tests/integration/performance_test.go -run TestWalletCreationPerformance

# 地址查找性能測試
go test -v -timeout 30s ./tests/integration/performance_test.go -run TestAddressLookupPerformance

# 基準測試
go test -bench=. -benchtime=3x ./tests/integration/performance_test.go
```

#### 預期輸出

```
=== RUN   TestWalletCreationPerformance
    performance_test.go:50: ✓ Wallet creation completed in 7.2s
    performance_test.go:51: ✓ Generated 24 addresses
    performance_test.go:52: ✓ Average time per address: 300ms
--- PASS: TestWalletCreationPerformance (7.20s)

=== RUN   TestAddressLookupPerformance
    performance_test.go:148: ✓ Address lookup completed in 85µs
--- PASS: TestAddressLookupPerformance (0.01s)
```

---

## 安全最佳實踐

### 密碼要求

- ✅ 最少12個字符
- ✅ 至少包含以下3種:
  - 大寫字母 (A-Z)
  - 小寫字母 (a-z)
  - 數字 (0-9)
  - 特殊字符 (!@#$%^&*)

**好密碼示例**:
- `MyBitcoin@2025!` (16字符, 所有類型)
- `Crypto$Wallet99` (15字符, 所有類型)
- `ArcSign_Secure2024` (18字符, 所有類型)

**壞密碼示例**:
- `password123` (過於簡單)
- `12345678901` (僅數字)
- `MyWallet` (過短)

### 助記詞存儲

#### 正確做法 ✅

1. **寫在紙上**
   - 使用筆 (不是鉛筆 - 可能褪色)
   - 書寫清晰易讀
   - 給單詞編號 (1-12或1-24)
   - 仔細核對拼寫

2. **安全存儲**
   - 防火保險箱
   - 銀行保險箱
   - 多個位置 (家中 + 異地)

3. **考慮金屬備份**
   - 不鏽鋼板刻字
   - 耐火耐水
   - 長期保存

4. **測試備份**
   - 嘗試讀回單詞
   - 驗證順序正確
   - 檢查拼寫錯誤

#### 錯誤做法 ❌

- ❌ 拍照
- ❌ 存儲在文本文件
- ❌ 通過電子郵件或消息發送
- ❌ 在網站上輸入
- ❌ 與任何人分享

### USB驅動器安全

- ✅ 使用專用USB驅動器進行錢包存儲
- ✅ 將USB驅動器保存在安全位置
- ✅ 不在不受信任的計算機上插入USB驅動器
- ✅ 考慮使用硬件加密的USB驅動器
- ✅ 製作錢包文件的備份副本
- ❌ 不與他人共享USB驅動器
- ❌ 不在公共計算機上使用

### BIP39密碼 (高級)

BIP39密碼充當"第25個詞":
- 提供合理否認
- 從相同助記詞創建完全不同的錢包
- **必須記住** - 如果忘記, 錢包永久無法訪問
- 不存儲在任何地方 - 只有您知道

**使用場景**:
1. **合理否認**: 無密碼錢包存少量資金, 有密碼錢包存主要資金
2. **雙因素安全**: 助記詞存在保險箱 (因素1), 密碼僅記憶 (因素2)

### 威脅模型

#### 保護範圍內 ✅

1. **計算機上的惡意軟件**
   - 緩解: USB專用存儲, 無本地緩存

2. **硬盤取證**
   - 緩解: 硬盤上無錢包數據

3. **暴力破解攻擊**
   - 緩解: 速率限制, 強KDF

4. **密碼猜測**
   - 緩解: 強密碼要求, Argon2id

5. **數據篡改**
   - 緩解: 認證加密 (GCM)

6. **意外文件損壞**
   - 緩解: 原子文件操作, fsync

#### 保護範圍外 ⚠️

1. **物理訪問解鎖的USB**
   - 用戶責任: 保持USB安全

2. **受損系統上的鍵盤記錄器**
   - 用戶責任: 使用受信任的計算機

3. **屏幕錄製惡意軟件**
   - 用戶責任: 在安全環境中進行錢包操作

4. **丟失助記詞**
   - 用戶責任: 備份和保護助記詞

5. **忘記BIP39密碼**
   - 設計無法恢復

6. **社交工程**
   - 用戶責任: 永不分享助記詞或密碼

### 操作安全

**物理安全**:
- 不使用時斷開USB連接
- 將USB存放在安全位置
- 永不讓USB無人看管
- 考慮加密USB驅動器

**操作安全**:
- 僅使用受信任的計算機
- 優先使用離線/氣隙計算機
- 檢查監控 (攝像頭, 人員)
- 複製地址後清除剪貼板
- 敏感操作後重啟計算機

**密碼衛生**:
- 每個錢包使用唯一密碼
- 建議最少16個字符
- 對加密密碼使用密碼管理器
- 永不跨錢包重複使用密碼

### 測試策略

**添加大量資金之前**:

1. **測試錢包創建**:
   ```bash
   ./arcsign create
   # 寫下助記詞
   ```

2. **測試恢復**:
   ```bash
   ./arcsign restore
   # 驗證助記詞匹配
   ```

3. **測試地址派生**:
   ```bash
   ./arcsign derive
   # 在 m/44'/0'/0'/0/0 生成地址
   # 記下地址
   ```

4. **測試確定性**:
   ```bash
   ./arcsign derive
   # 再次生成相同路徑
   # 驗證地址相同
   ```

5. **測試小額**:
   - 發送 $10-50 到生成的地址
   - 在區塊鏈瀏覽器驗證接收
   - 在不同計算機上練習恢復

### 定期維護

**每月**:
- 測試錢包恢復
- 驗證USB驅動器完整性
- 檢查備份可讀性

**每年**:
- 從助記詞測試完整恢復
- 更新USB驅動器 (如果老化)
- 審查和更新備份

---

## 開發指南

### 開發設置

```bash
git clone https://github.com/yourusername/arcsign.git
cd arcsign
go mod download
go test ./tests/... -v
```

### 運行測試

```bash
# 運行所有測試
go test ./tests/... -v

# 僅單元測試
go test ./tests/unit/... -v

# 僅集成測試
go test ./tests/integration/... -v

# 帶覆蓋率
go test ./tests/... -cover

# ChainAdapter測試
cd src/chainadapter
make test-unit           # 72個測試
make test-contract       # 合約測試
```

### 添加新加密貨幣

架構支持輕鬆擴展新區塊鏈。示例工作流程:

**1. 在Address Service添加格式化器**:

```go
// internal/services/address/newcoin.go
func (s *AddressService) DeriveNewCoinAddress(
    key *hdkeychain.ExtendedKey,
) (string, error) {
    // 實現幣種特定的地址派生
    // 可以使用 secp256k1, Ed25519, sr25519 等
}
```

**2. 在Coin Registry註冊**:

```go
// internal/services/coinregistry/registry.go
r.addCoin(CoinMetadata{
    Symbol:        "NEW",
    Name:          "NewCoin",
    CoinType:      999,  // SLIP-44 幣種類型
    FormatterID:   "newcoin",
    MarketCapRank: 55,
    KeyType:       KeyTypeSecp256k1,
    Category:      ChainCategoryBase,
})
```

**3. 添加Switch Case**:

```go
// internal/services/address/service.go
case "newcoin":
    return s.DeriveNewCoinAddress(key)
```

**4. 添加綜合測試**:

```go
// tests/unit/newcoin_test.go
func TestDeriveNewCoinAddress_KnownVector(t *testing.T) {
    // 使用已知助記詞和預期地址測試
}

func TestDeriveNewCoinAddress_Format(t *testing.T) {
    // 測試地址格式驗證
}

func TestDeriveNewCoinAddress_Determinism(t *testing.T) {
    // 測試確定性派生
}
```

### 代碼質量

**提交前**:
- [ ] 無硬編碼密鑰
- [ ] 無敏感數據的調試日誌
- [ ] 正確的錯誤處理 (不暴露內部)
- [ ] 所有用戶輸入的輸入驗證
- [ ] 安全隨機數生成 (crypto/rand)
- [ ] 敏感數據的恆定時間比較
- [ ] 文件權限設置正確 (0600)
- [ ] 使用原子文件操作
- [ ] 使用後清除記憶體 (可能的情況下)
- [ ] 安全關鍵代碼的測試覆蓋

**發布前**:
- [ ] 所有測試通過 (72+ 測試)
- [ ] 安全審計完成
- [ ] 依賴漏洞掃描
- [ ] 第二開發者代碼審查
- [ ] 在多平台測試
- [ ] 文檔更新
- [ ] CHANGELOG更新
- [ ] 版本號遞增

### 依賴項

```go
// 核心加密
github.com/tyler-smith/go-bip39 v1.1.0
github.com/btcsuite/btcd v0.22.1
github.com/ethereum/go-ethereum v1.16.4
golang.org/x/crypto v0.43.0

// 多鏈支持
github.com/cosmos/cosmos-sdk v0.50.11       // Cosmos Bech32
github.com/vedhavyas/go-subkey v1.0.4        // Kusama sr25519
github.com/ChainSafe/go-schnorrkel v1.1.0    // sr25519 crypto
github.com/anyproto/go-slip10 v1.0.0         // Tezos SLIP-10
blockwatch.cc/tzgo v1.18.4                    // Tezos地址編碼
github.com/Zilliqa/gozilliqa-sdk v1.2.0      // Zilliqa Schnorr

// 工具
golang.org/x/term v0.36.0                    // 終端密碼輸入
github.com/SonarBeserk/gousbdrivedetector    // USB檢測 (Windows)
```

---

## 故障排除

### "未找到USB存儲設備"

**症狀**:
```
Step 1: Detecting USB storage...
❌ Error: No USB storage device found
```

**解決方案**:
1. 驗證USB已完全插入
2. 嘗試不同的USB端口
3. 檢查USB已格式化 (使用FAT32, exFAT或NTFS)
4. 在Linux上: 檢查 `/media/` 權限
5. 在Windows上: 以管理員身份運行
6. 嘗試不同的USB驅動器

### "錢包ID不正確"

**症狀**:
```
❌ Error loading wallet: wallet not found
```

**解決方案**:
1. 驗證您複製了完整的UUID
   - 格式: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - 示例: `3c3e0aba-91e1-44d4-8b29-ec066d5acf0b`
2. 檢查您使用的是正確的USB驅動器
3. 查看USB驅動器中的文件夾名稱 (每個都是錢包ID)
4. 錢包ID區分大小寫 (但通常是小寫)

### "超出速率限制"

**症狀**:
```
❌ Rate limit exceeded!
Too many failed attempts. Please wait 1 minute and try again.
```

**解決方案**:
1. 重試前等待60秒
2. 驗證您的密碼正確
3. 檢查CAPS LOCK未啟用
4. 先在文本編輯器中嘗試密碼 (以驗證輸入)
5. 1分鐘後: 成功登錄重置計數器

### "密碼錯誤"

**症狀**:
```
❌ Wrong password (attempt 1/3 failed)
```

**解決方案**:
1. 仔細檢查密碼正確
2. 驗證CAPS LOCK狀態
3. 嘗試慢慢輸入
4. 如果忘記:
   - 密碼無法恢復
   - 您需要助記詞來創建新錢包
   - 舊的加密助記詞將無法訪問

### 地址不匹配預期

**症狀**:
- 派生的地址與另一個錢包不匹配
- 預期地址 1..., 得到地址 1...

**可能原因**:

1. **錯誤的BIP39密碼**:
   - 精確驗證密碼 (區分大小寫)
   - 即使一個字符不同 = 不同的錢包

2. **錯誤的派生路徑**:
   - 檢查賬戶索引 (0, 1, 2, ...)
   - 檢查地址索引 (0, 1, 2, ...)
   - 檢查幣種類型 (Bitcoin=0, Ethereum=60)

3. **不同的標準**:
   - ArcSign使用BIP44: `m/44'/coin'/account'/0/index`
   - 一些錢包使用BIP49 (P2SH-SegWit) 或 BIP84 (Native SegWit)

**解決方案**:
- 使用完全相同的輸入 (密碼, 賬戶, 索引)
- 驗證其他錢包中的BIP44標準

### ChainAdapter錯誤

#### RPC連接失敗

**症狀**:
```
❌ Failed to build transaction: RPC connection failed
```

**解決方案**:
1. 檢查RPC端點可訪問
2. 驗證網絡連接
3. 檢查防火牆設置
4. 嘗試備用RPC端點
5. 檢查RPC認證憑證

#### 交易構建失敗

**Bitcoin - 資金不足**:
```
❌ Failed to build transaction: insufficient funds
```
- 檢查UTXO余額
- 確認有足夠資金支付金額+費用

**Ethereum - Nonce錯誤**:
```
❌ Failed to build transaction: nonce too low
```
- 等待待處理交易確認
- 手動指定正確的nonce

---

## 路線圖

### 已完成 (v0.3.0)

- [x] BIP39/BIP44 HD錢包實現
- [x] 54條區塊鏈地址派生
- [x] USB專用存儲與AES-256-GCM加密
- [x] ChainAdapter統一交易接口
- [x] Bitcoin & Ethereum交易構建/簽名/廣播
- [x] Prometheus可觀測指標支持
- [x] 7種簽名方案 (ECDSA, Ed25519, sr25519, Schnorr)
- [x] Layer 2, 區域鏈, Cosmos生態, 專業鏈支持
- [x] 300+自動化測試

### 進行中

- [ ] 額外的加密貨幣支持 (更多幣種)
- [ ] 多簽名錢包支持
- [ ] 硬件錢包集成 (Ledger, Trezor)
- [ ] GUI應用程序
- [ ] 移動應用 (iOS, Android)
- [ ] Shamir Secret Sharing助記詞備份

### 計劃中 (v0.4.0+)

**短期 (v0.4.0)**:
- [ ] 交易簽名功能 (更多鏈)
- [ ] 交易廣播
- [ ] 只讀錢包模式 (xpub)
- [ ] 地址簿功能
- [ ] 通過RPC檢查余額

**中期 (v0.5.0)**:
- [ ] 圖形用戶界面 (GUI)
- [ ] 硬件錢包集成 (Ledger, Trezor)
- [ ] 多簽名錢包支持
- [ ] 地址的QR碼生成
- [ ] 本地化 (多語言)

**長期 (v1.0.0)**:
- [ ] 移動應用程序 (iOS, Android)
- [ ] Shamir Secret Sharing備份
- [ ] 高級幣種控制
- [ ] 費用估算
- [ ] 完整的SPV節點集成

---

## 快速參考

### 命令

```bash
./arcsign create       # 創建新錢包
./arcsign restore      # 查看助記詞
./arcsign derive       # 生成地址
./arcsign generate-all # 生成所有54條鏈地址
./arcsign version      # 顯示版本
./arcsign help         # 顯示使用方法
```

### 幣種類型 (SLIP-44)

```
Bitcoin (BTC):      0
Ethereum (ETH):    60
Litecoin (LTC):     2
Dogecoin (DOGE):    3
Solana (SOL):     501
Cardano (ADA):   1815
Cosmos (ATOM):    118
Kusama (KSM):     434
Tezos (XTZ):     1729
Zilliqa (ZIL):    313
```

### 常見路徑

```
Bitcoin first:     m/44'/0'/0'/0/0
Bitcoin second:    m/44'/0'/0'/0/1
Ethereum first:    m/44'/60'/0'/0/0
Ethereum second:   m/44'/60'/0'/0/1
Bitcoin account 2: m/44'/0'/1'/0/0
```

### 文件權限

```
wallet.json:    0600 (僅所有者讀寫)
mnemonic.enc:   0600 (僅所有者讀寫)
audit.log:      0600 (僅所有者讀寫, 追加模式)
addresses/:     0700 (僅所有者訪問)
```

---

## 技術規格摘要

### 加密學

**加密**: AES-256-GCM (Galois/Counter Mode)
- 密鑰大小: 256位 (32字節)
- Nonce: 12字節 (每次加密隨機)
- 認證: 內置GCM標籤 (16字節)

**密鑰派生**: Argon2id (PHC獲勝者)
- 參數: 4次迭代, 256 MiB記憶體, 4線程
- 合規: OWASP密碼存儲備忘單
- 鹽值: 16字節 (每個錢包隨機)

### BIP標準

**BIP39**: 助記詞生成確定性密鑰
- 詞表: 英語 (2048個詞)
- 熵: 128位 (12詞) 或 256位 (24詞)
- PBKDF2-HMAC-SHA512用於種子生成

**BIP32**: 分層確定性錢包
- Secp256k1橢圓曲線
- HMAC-SHA512用於密鑰派生

**BIP44**: 確定性錢包的多賬戶層次結構
- 目的: 44' (硬化)
- 幣種類型: 0 (Bitcoin), 60 (Ethereum), 等

### 速率限制

- 每分鐘3次失敗的密碼嘗試
- 滑動窗口實現
- 成功認證後自動重置
- 所有嘗試的審計日誌

---

## 貢獻

歡迎貢獻! 在提交PR之前請閱讀我們的貢獻指南。

### 報告問題

- 安全漏洞: security@example.com
- Bug報告: GitHub Issues
- 功能請求: GitHub Issues

### 開發

- 語言: Go 1.21+
- 測試: `go test ./tests/... -v`
- 構建: `./build.sh` 或 `build.bat`
- 代碼風格: `gofmt`, `golint`

---

## 許可證

本項目根據MIT許可證授權 - 有關詳細信息, 請參閱 [LICENSE](LICENSE) 文件。

---

## 安全披露

如果您發現安全漏洞, 請發送電子郵件至 security@example.com。請勿打開公開issue。

---

## 致謝

### 開源庫

- [tyler-smith/go-bip39](https://github.com/tyler-smith/go-bip39) - BIP39實現
- [btcsuite/btcd](https://github.com/btcsuite/btcd) - Bitcoin庫
- [ethereum/go-ethereum](https://github.com/ethereum/go-ethereum) - Ethereum庫
- [golang/crypto](https://golang.org/x/crypto) - 加密原語

### 標準

- Bitcoin改進提案 (BIPs)
- OWASP密碼存儲備忘單
- NIST加密標準

### 社區

- Bitcoin和Ethereum開發者社區
- 開源貢獻者
- 安全研究人員

---

## 免責聲明

本軟件按"原樣"提供, 不提供任何明示或暗示的保證。作者不對任何資金損失負責。始終先用小額測試並妥善備份您的助記詞。

**⚠️ 重要**:
- 永不與任何人分享您的助記詞
- 發送資金前始終驗證地址
- 在存儲大量資金前測試恢復程序
- 在安全位置保存多份備份

---

**Made with ❤️ for the crypto community**

**Version**: 0.3.0
**Release Date**: 2025-10-17
**Go Version**: 1.24.4
**License**: MIT
**Repository**: https://github.com/yourusername/arcsign
