# ArcSign - 完整項目規格書

**Secure Hierarchical Deterministic (HD) Wallet with USB-Only Storage**

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)]()
[![Go Version](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org/dl/)
[![Tests](https://img.shields.io/badge/tests-85%20passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-0.4.4-blue.svg)]()

## 目錄

- [項目概述](#項目概述)
- [核心功能](#核心功能)
- [Dashboard - 桌面應用程式](#dashboard---桌面應用程式)
- [快速開始](#快速開始)
- [ChainAdapter - 跨鏈交易接口](#chainadapter---跨鏈交易接口)
- [Token Swap - DEX 聚合器](#token-swap---dex-聚合器)
- [使用指南](#使用指南)
- [架構設計](#架構設計)
- [性能指標](#性能指標)
- [安全最佳實踐](#安全最佳實踐)
- [開發指南](#開發指南)
- [故障排除](#故障排除)
- [路線圖](#路線圖)

---

## 項目概述

ArcSign 是一個安全的加密貨幣錢包系統，實現了 BIP39/BIP44 標準進行安全密鑰管理。系統採用 **Dashboard (Tauri) → FFI → Go Shared Library** 架構，提供統一的跨鏈交易接口 (ChainAdapter) 和錢包管理功能。所有敏感數據專門存儲在 USB 驅動器上，永不存儲在計算機硬盤上，提供額外的安全防護層，防止惡意軟件和數據盜竊。

### 版本狀態

**當前版本**: v0.4.4 (2026-01-08)
**狀態**: ✅ 生產就緒
**測試覆蓋率**: 85/85 tests passing
- Bitcoin: 31/31 單元測試
- Ethereum: 33/33 單元測試
- Metrics: 8/8 單元測試
- Security: 13/13 單元測試
- Contract Tests: 11 個合約測試

### v0.4.4 新功能亮點

- 🔌 **Provider-Chain 架構** - 模組化多 Provider 設計，支援 Alchemy + NodeReal
- 🔀 **Internal Network ID** - 統一的 Canonical 網路格式，自動轉換 Provider 特定格式
- 🛠️ **Provider Adapter 模式** - `ToAlchemyNetwork()` / `FromAlchemyNetwork()` 轉換函數
- 📋 **Provider 能力定義** - 集中管理每個 Provider 支援的網路和功能
- 🔧 **Alchemy API 修復** - 修正 `internal` 類別僅支援 ETH/Polygon 的限制

### v0.4.3 功能

- 🔐 **進階記憶體保護** - XOR 三分片私鑰儲存，私鑰曝露時間從 ~50-100ms 降至 ~1-5ms
- 🛡️ **SecureSigner** - 零拷貝簽名設計，私鑰僅在簽名瞬間重組
- 🔒 **mlock 記憶體鎖定** - 敏感資料不會被 swap 到磁碟
- 🚫 **Core Dump 防護** - 自動禁用 core dump 防止記憶體洩漏
- 🧹 **SecureZero** - 防編譯器優化的安全記憶體清除

### v0.4.2 功能

- 📜 **Transaction History** - 多鏈交易歷史記錄查詢 (Alchemy + NodeReal)
- 🔗 **BSC 完整支援** - NodeReal BSCTrace API 整合，支援 BSC 交易歷史
- 🔧 **Provider Registry** - 支援 Alchemy、NodeReal、1inch 等多個 API Provider 管理
- ⛽ **動態 Gas Fee** - 根據鏈類型自動選擇 EIP-1559/Legacy/L2 Gas 策略
- 🌐 **免費 RPC Registry** - 統一管理所有鏈的免費公開 RPC 端點

### v0.4.1 功能

- 🖥️ **Dashboard 桌面應用程式** - Tauri 原生桌面應用，支援 macOS/Windows/Linux
- 💱 **Token Swap 多 Provider** - 支援 OpenOcean 和 KyberSwap DEX 聚合器，用戶可自由切換
- 📤 **Send Transaction** - 完整的交易發送流程 (Build → Sign → Broadcast)
- 📊 **資產總覽** - 即時顯示多鏈資產餘額和價值
- 🔐 **BIP39 Passphrase** - 支援第 25 個詞的進階安全功能
- ⏰ **自動鎖定** - 15 分鐘閒置自動鎖定，保護資產安全
- 🔌 **USB 可攜式應用** - 支援從 USB 直接執行，無需安裝

### 設計原則

1. **安全至上**: USB專用存儲、軍事級加密、記憶體困難KDF
2. **標準合規**: BIP39/BIP32/BIP44/SLIP-44完全遵循
3. **多鏈支持**: 54條區塊鏈，7種簽名方案
4. **用戶體驗**: 現代化 Dashboard UI、清晰的錯誤消息
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

#### 錢包數量限制與會員制度

ArcSign 採用 NFT 會員制度來管理錢包創建數量：

| 會員等級 | NFT 數量 | 錢包上限 | 公式 |
|---------|---------|---------|------|
| Free | 0 | 3 | 基礎限制 |
| Pro (1 NFT) | 1 | 8 | 3 + (1 × 5) |
| Pro (2 NFTs) | 2 | 13 | 3 + (2 × 5) |
| Pro (n NFTs) | n | 3 + (n × 5) | 每個 NFT 增加 5 個錢包 |

**Pro 會員福利**:
- ✓ 每個 NFT 增加 5 個錢包額度
- ✓ 優先技術支援
- ✓ 搶先體驗新功能
- ✓ 累積積分用於未來空投

**NFT 會員定價**: 30 USDT/年

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
- ✅ **自動鎖定** - 15分鐘閒置自動鎖定保護
- ✅ **XOR 分片儲存** - 私鑰以 3 份 XOR 分片形式存放，無連續明碼
- ✅ **mlock 記憶體鎖定** - 敏感資料不被 swap 到磁碟
- ✅ **Core Dump 禁用** - 防止崩潰時敏感資料洩漏
- ✅ **SecureZero** - 防編譯器優化的安全記憶體清除

---

## Dashboard - 桌面應用程式

**Version**: 1.0.0 | **Status**: ✅ Production Ready

ArcSign Dashboard 是一個基於 Tauri 的原生桌面應用程式，提供完整的錢包管理、資產查看、交易發送和代幣兌換功能。

### 技術架構

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard (Tauri)                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 React + TypeScript                       ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   ││
│  │  │ Wallet   │ │ Assets   │ │  Send    │ │  Swap    │   ││
│  │  │ Create   │ │ Overview │ │Transaction│ │Transaction│   ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                  │
│                            │ Tauri Commands                   │
│                            ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Rust Backend (src-tauri)                ││
│  │  - FFI Queue (單線程序列化)                              ││
│  │  - Wallet Commands                                       ││
│  │  - Transaction Commands                                  ││
│  │  - Swap Commands                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                  │
│                            │ FFI (C ABI)                      │
│                            ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Go Shared Library (libarcsign)              ││
│  │  - BIP39/BIP44 錢包管理                                  ││
│  │  - ChainAdapter 交易接口                                  ││
│  │  - OpenOcean/KyberSwap DEX 聚合器                        ││
│  │  - Alchemy/Infura RPC 整合                               ││
│  │  - Security Module (XOR分片/mlock/SecureZero)            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 主要功能

#### 1. 錢包管理
- **創建錢包**: 12/24 詞助記詞生成
- **匯入錢包**: 支援現有助記詞匯入
- **BIP39 Passphrase**: 可選第 25 詞進階保護
- **錢包列表**: 多錢包管理

#### 2. 資產總覽 (WalletDetail)
- **多鏈餘額**: 即時查詢 ETH、Polygon、Arbitrum、BSC 等鏈的資產
- **ERC-20 代幣**: 自動識別並顯示所有代幣餘額
- **USD 估值**: 整合 CoinGecko 價格 API
- **快速操作**: Send / Receive / Swap / History 按鈕

#### 3. 交易歷史 (TransactionHistory)
- **多鏈支援**: Ethereum、Polygon、Arbitrum、Optimism、Base、BSC
- **多 Provider 整合**: Alchemy (ETH/Polygon/Arbitrum/Optimism/Base) + NodeReal (BSC)
- **交易類型**: External、Internal、ERC-20、ERC-721 (NFT)、ERC-1155
- **區塊瀏覽器連結**: 一鍵跳轉至 Etherscan/BscScan/PolygonScan 等

#### 4. 發送交易 (SendTransaction)
- **多鏈支援**: Ethereum、Polygon、Arbitrum、Optimism、Base 等
- **EIP-1559**: 自動計算 gas 費用 (Fast/Normal/Slow)
- **安全流程**: Password → Sign → Broadcast
- **交易追蹤**: 即時狀態更新和區塊確認

#### 5. 代幣兌換 (SwapTransaction)
- **多 Provider 支援**: OpenOcean (推薦) 和 KyberSwap DEX 聚合器
- **一鍵切換**: 用戶可自由切換 Provider 比較報價
- **滑點控制**: 0.1% - 5% 可調整
- **報價預覽**: 兌換率、Price Impact、最小接收量
- **ERC-20 授權**: 自動處理 Approval 流程

#### 6. 安全功能
- **自動鎖定**: 15 分鐘閒置自動登出
- **密碼驗證**: 每筆交易需重新驗證
- **XOR 分片儲存**: 私鑰以 3 份 XOR 分片存放，無連續明碼
- **極短曝露時間**: 私鑰僅在簽名瞬間重組 (~1-5ms)，簽名後立即清除
- **mlock 記憶體鎖定**: 敏感資料不被 swap 到磁碟
- **Core Dump 禁用**: 自動禁用防止崩潰時資料洩漏
- **SecureZero**: 防編譯器優化的安全記憶體清除
- **截圖保護**: 可選的截圖防護功能

### 支援網路

| 網路 | Chain ID | 代幣查詢 | 交易發送 | Swap | 交易歷史 |
|------|----------|----------|----------|------|----------|
| Ethereum | eth-mainnet | ✅ | ✅ | ✅ | Alchemy |
| Polygon | polygon-mainnet | ✅ | ✅ | ✅ | Alchemy |
| Arbitrum | arb-mainnet | ✅ | ✅ | ✅ | Alchemy |
| Optimism | opt-mainnet | ✅ | ✅ | ✅ | Alchemy |
| Base | base-mainnet | ✅ | ✅ | ✅ | Alchemy |
| BSC | bnb-mainnet | ✅ | ✅ | ✅ | NodeReal |

### 快速開始

```bash
# 安裝依賴
cd dashboard
npm install

# 開發模式
npm run tauri dev

# 建構生產版本
npm run tauri build
```

### 建構 Go 共享庫

```bash
# macOS (ARM64)
make build-lib-macos

# macOS (AMD64)
CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 go build -buildmode=c-shared \
  -o dashboard/src-tauri/libarcsign_amd64.dylib ./internal/lib

# Windows
CGO_ENABLED=1 GOOS=windows GOARCH=amd64 go build -buildmode=c-shared \
  -o dashboard/src-tauri/libarcsign.dll ./internal/lib
```

---

## ChainAdapter - 跨鏈交易接口

**Version**: 1.0.0 | **Status**: Phase 9 Complete ✅

ChainAdapter 提供統一的介面來處理 Bitcoin 和 Ethereum 的交易操作，支援交易構建、簽名、廣播、狀態查詢和地址生成。

> **注意**: Bitcoin 交易在底層 Go Library 已完整實作 (31/31 單元測試通過)，但尚未整合到 Dashboard UI。目前 Dashboard 僅支援 EVM 鏈交易。Bitcoin Dashboard 整合計劃於 v0.5.0。

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

## Token Swap - DEX 聚合器

**Version**: 1.1.0 | **Status**: ✅ Production Ready

Token Swap 功能整合多個 DEX 聚合器 (OpenOcean 和 KyberSwap)，提供跨多個去中心化交易所的最佳價格路由。用戶可自由切換 Provider 比較報價。

### 功能特點

- **多 Provider 架構**: 支援 OpenOcean (推薦) 和 KyberSwap 兩個 DEX 聚合器
- **免費 API**: 兩個 Provider 都不需要 API Key 或 KYC 認證
- **最佳價格路由**: 自動比較 Uniswap、SushiSwap、Curve、PancakeSwap 等多個 DEX
- **滑點保護**: 可配置 0.1% - 5% 滑點容忍度
- **Price Impact 顯示**: 即時顯示價格影響百分比
- **Gas 優化**: 智能路由減少 gas 消耗
- **ERC-20 授權**: 自動檢測並處理代幣授權流程
- **Chain-Specific Token Registry**: 每條鏈獨立的 Token 列表

### 支援的 Provider

| Provider | API Key | 特點 |
| --- | --- | --- |
| OpenOcean | 不需要 ✅ | 支援更多鏈、Price Impact 即時顯示 |
| KyberSwap | 不需要 ✅ | 路由優化、Gas 估算準確 |

### 支援鏈

| 鏈 | Chain ID | OpenOcean | KyberSwap |
| --- | --- | --- | --- |
| Ethereum | 1 | ✅ | ✅ |
| Polygon | 137 | ✅ | ✅ |
| Arbitrum | 42161 | ✅ | ✅ |
| Optimism | 10 | ✅ | ✅ |
| Base | 8453 | ✅ | ✅ |
| BSC | 56 | ✅ | ✅ |
| Avalanche | 43114 | ✅ | ✅ |
| Fantom | 250 | ✅ | ✅ |

### API 介面

#### GetSwapQuote - 取得兌換報價

```go
// 輸入
{
  "chainId": "ethereum",
  "fromTokenAddress": "0xEeee...Eeee",  // ETH
  "toTokenAddress": "0xA0b8...4c2",     // USDC
  "amount": "1000000000000000000",       // 1 ETH in wei
  "fromAddress": "0x742d...Ebd",
  "slippage": 0.5
}

// 輸出
{
  "toAmount": "3500000000",              // 3500 USDC
  "estimatedGas": "150000",
  "protocols": [["UNISWAP_V3", "CURVE"]],
  "priceImpact": "0.05"
}
```

#### BuildSwapTransaction - 建構兌換交易

```go
// 輸出
{
  "to": "0x1111...1111",                 // 1inch Router
  "data": "0x...",                        // Calldata
  "value": "1000000000000000000",
  "gasLimit": "200000"
}
```

#### CheckSwapAllowance - 檢查代幣授權

```go
// 輸入
{
  "chainId": "ethereum",
  "tokenAddress": "0xA0b8...4c2",        // USDC
  "walletAddress": "0x742d...Ebd"
}

// 輸出
{
  "allowance": "0",
  "needsApproval": true
}
```

#### GetSwapApproval - 取得授權交易

```go
// 輸出
{
  "to": "0xA0b8...4c2",                  // Token Contract
  "data": "0x095ea7b3...",               // approve() calldata
  "value": "0"
}
```

### 使用流程

```
1. 選擇來源代幣 (fromToken)
   ↓
2. 選擇目標代幣 (toToken)
   ↓
3. 輸入兌換金額
   ↓
4. GetSwapQuote() - 取得報價
   ↓
5. CheckSwapAllowance() - 檢查授權
   ↓
6. [如需授權] GetSwapApproval() → Sign → Broadcast
   ↓
7. BuildSwapTransaction() - 建構交易
   ↓
8. SignTransaction() - 簽名
   ↓
9. BroadcastTransaction() - 廣播
   ↓
10. QueryTransactionStatus() - 追蹤狀態
```

### 安全考量

- **XOR 分片儲存**: 私鑰以 3 份 XOR 分片形式存放，記憶體中無連續明碼
- **極短曝露時間**: 私鑰僅在簽名瞬間重組 (~1-5ms)，簽名完成立即清除
- **mlock 記憶體鎖定**: 敏感資料使用 `SecureAlloc` 分配，不被 swap 到磁碟
- **SecureZero 清除**: 使用 `unsafe.Pointer` + `runtime.KeepAlive` 防止編譯器優化
- **Core Dump 禁用**: 應用啟動時自動禁用，防止崩潰時敏感資料洩漏
- **密碼驗證**: 每筆交易需要重新輸入錢包密碼
- **滑點保護**: 實際價格超過滑點容忍度時交易會失敗
- **合約驗證**: 僅與官方 DEX Router 合約互動 (OpenOcean/KyberSwap)

---

## 架構設計

### 整體項目架構

本項目採用 **Dashboard (Tauri) → FFI → Go Shared Library** 架構:

1. **Dashboard (Tauri)** - 前端用戶界面
2. **FFI (Foreign Function Interface)** - 橋接 Tauri 和 Go 庫
3. **Go Shared Library** - 包含錢包管理和 ChainAdapter 交易接口

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

### 錢包服務層 (Wallet Services)

錢包管理功能通過 Go Shared Library 提供，包含:

```
┌─────────────────────────────────────────────────────────────┐
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

### 項目結構

```
arcSignv2/
├── dashboard/                # Tauri 桌面應用程式
│   ├── src/                  # React + TypeScript 前端
│   │   ├── components/       # UI 元件
│   │   │   ├── WalletCreate.tsx
│   │   │   ├── WalletDetail.tsx
│   │   │   ├── SendTransaction.tsx
│   │   │   └── SwapTransaction.tsx
│   │   ├── pages/            # 頁面元件
│   │   │   └── Dashboard.tsx
│   │   ├── services/         # API 服務
│   │   │   └── tauri-api.ts
│   │   ├── stores/           # 狀態管理 (Zustand)
│   │   └── hooks/            # React Hooks
│   │
│   └── src-tauri/            # Rust 後端
│       ├── src/
│       │   ├── commands/     # Tauri Commands
│       │   │   ├── wallet.rs
│       │   │   ├── transaction.rs
│       │   │   └── swap.rs
│       │   └── ffi/          # Go FFI 綁定
│       │       ├── bindings.rs
│       │       └── queue.rs
│       ├── libarcsign.dylib  # Go 共享庫 (macOS)
│       └── libarcsign.dll    # Go 共享庫 (Windows)
│
├── internal/
│   ├── models/               # 數據模型
│   │   ├── models.go         # Wallet, Mnemonic
│   │   └── address.go        # DerivedAddress, AddressBook
│   │
│   ├── services/             # 業務邏輯
│   │   ├── address/          # 地址派生
│   │   ├── bip39service/     # 助記詞生成
│   │   ├── encryption/       # AES-GCM + Argon2id
│   │   ├── hdkey/            # BIP32/BIP44
│   │   ├── ratelimit/        # 速率限制
│   │   ├── storage/          # USB I/O
│   │   ├── wallet/           # 錢包管理
│   │   └── coinregistry/     # 幣種註冊表
│   │
│   ├── lib/                  # FFI 導出層
│   │   ├── exports.go        # C-ABI 導出函數
│   │   └── errors.go         # FFI 錯誤類型
│   │
│   ├── provider/             # 多 Provider 架構 (v0.4.4+)
│   │   ├── chains.go         # 核心: 網路定義、Provider 能力、路由
│   │   ├── alchemy_client.go # Alchemy API 適配器
│   │   ├── bsctrace_client.go# NodeReal BSCTrace API 適配器
│   │   ├── networks.go       # 鏈名稱到內部網路 ID 映射
│   │   ├── registry.go       # Provider 註冊表 (API Key 管理)
│   │   └── config.go         # Provider 配置加密存儲
│   │
│   ├── security/             # 記憶體保護模組 (v0.4.3+)
│   │   ├── memzero.go        # SecureZero, SecureAlloc, mlock
│   │   ├── secret_share.go   # XOR 三分片 (SplitSecret/Reconstruct)
│   │   ├── secure_signer.go  # SecureSigner (零拷貝簽名)
│   │   └── security_test.go  # 13 個安全測試
│   │
│   └── utils/                # 工具和驗證器
│
├── src/
│   ├── chainadapter/         # 跨鏈交易接口
│   │   ├── adapter.go        # ChainAdapter 接口
│   │   ├── bitcoin/          # Bitcoin 實現
│   │   ├── ethereum/         # Ethereum 實現 (EIP-1559)
│   │   ├── rpc/              # RPC 客戶端
│   │   ├── storage/          # 交易狀態存儲
│   │   └── metrics/          # Prometheus 指標
│   │
│   └── swap/                 # DEX 聚合器
│       ├── aggregator.go     # 聚合器接口 (多 Provider)
│       ├── openocean/        # OpenOcean 客戶端 (推薦)
│       │   ├── client.go
│       │   └── types.go
│       └── kyberswap/        # KyberSwap 客戶端
│           ├── client.go
│           └── types.go
│
└── tests/
    ├── unit/                 # 單元測試 (270+)
    └── integration/          # 集成測試 (30+)
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

#### 4. Provider Adapter 模式 - 多 Provider 網路映射

Provider Adapter 模式實現了統一的內部網路 ID 與各 Provider 特定格式之間的轉換：

```go
// 內部網路 ID (Internal Network ID) - 全系統統一使用的 Canonical 格式
const (
    NetworkArbitrumMainnet = "arbitrum-mainnet"  // 內部格式
    NetworkOptimismMainnet = "optimism-mainnet"  // 內部格式
    NetworkBnbMainnet      = "bnb-mainnet"
)

// Provider Adapter 介面
type ProviderNetworkAdapter interface {
    ToProviderNetwork(internalNetwork string) string    // 內部 → Provider 格式
    FromProviderNetwork(providerNetwork string) string  // Provider → 內部格式
    GetRPCEndpoint(internalNetwork string) string
    GetTransferCategories(internalNetwork string) []string
}

// Alchemy Adapter 實現
func ToAlchemyNetwork(internalNetwork string) string {
    switch internalNetwork {
    case NetworkArbitrumMainnet: return "arb-mainnet"   // Alchemy 格式
    case NetworkOptimismMainnet: return "opt-mainnet"   // Alchemy 格式
    default: return internalNetwork
    }
}

// Provider 路由
func GetProviderForNetwork(network string) string {
    normalized := NormalizeToInternalNetwork(network)
    if provider, ok := NetworkToProvider[normalized]; ok {
        return provider  // "alchemy" 或 "nodereal"
    }
    return ProviderAlchemy  // 預設
}
```

### Provider-Chain 架構

ArcSign 採用模組化的多 Provider 架構來處理不同區塊鏈的交易歷史和餘額查詢。

#### 架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                       應用層 (exports.go)                         │
│                                                                   │
│   GetTransactionHistory(network, address)                         │
│              │                                                    │
│              ▼                                                    │
│   ┌─────────────────────────────────────────┐                    │
│   │  GetProviderForNetwork(network)         │                    │
│   │  - 根據 Internal Network ID 選擇 Provider │                    │
│   └───────────────────┬─────────────────────┘                    │
│                       │                                           │
│         ┌─────────────┴─────────────┐                            │
│         ▼                           ▼                            │
│   ┌───────────┐               ┌───────────┐                      │
│   │  Alchemy  │               │  NodeReal │                      │
│   │ (Provider)│               │ (Provider)│                      │
│   └─────┬─────┘               └─────┬─────┘                      │
│         │                           │                            │
└─────────┼───────────────────────────┼────────────────────────────┘
          │                           │
┌─────────▼───────────────────────────▼────────────────────────────┐
│                    Provider 適配層 (chains.go)                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Internal Network ID (Canonical)                 │ │
│  │  eth-mainnet | polygon-mainnet | arbitrum-mainnet | ...      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│            ┌─────────────────┼─────────────────┐                 │
│            ▼                 ▼                 ▼                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ ToAlchemyNetwork│ │ToNodeRealNetwork│ │  (Future)       │    │
│  │  Adapter        │ │  Adapter        │ │  Adapters       │    │
│  │                 │ │                 │ │                 │    │
│  │ arb-mainnet    │ │ bsc-mainnet     │ │                 │    │
│  │ opt-mainnet    │ │                 │ │                 │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

#### Internal Network ID

系統使用統一的 **Internal Network ID** 作為 Canonical 格式：

| Internal Network ID  | 鏈名稱    | Alchemy 格式      | NodeReal 格式  |
| -------------------- | --------- | ----------------- | -------------- |
| `eth-mainnet`        | Ethereum  | `eth-mainnet`     | -              |
| `polygon-mainnet`    | Polygon   | `polygon-mainnet` | -              |
| `arbitrum-mainnet`   | Arbitrum  | `arb-mainnet`     | -              |
| `optimism-mainnet`   | Optimism  | `opt-mainnet`     | -              |
| `base-mainnet`       | Base      | `base-mainnet`    | -              |
| `bnb-mainnet`        | BNB Chain | -                 | `bsc-mainnet`  |

#### Provider 能力定義

每個 Provider 的支援網路和功能在 `chains.go` 中集中定義：

```go
var ProviderCapabilities = map[string]ProviderCapability{
    ProviderAlchemy: {
        SupportedNetworks: []string{
            NetworkEthMainnet, NetworkPolygonMainnet,
            NetworkArbitrumMainnet, NetworkOptimismMainnet, NetworkBaseMainnet,
        },
        // "internal" 交易類別只在 ETH/Polygon 主網支援
        InternalTransferNetworks: []string{
            NetworkEthMainnet, NetworkPolygonMainnet,
        },
        TransferCategories: []string{"external", "erc20", "erc721", "erc1155"},
    },
    ProviderNodeReal: {
        SupportedNetworks: []string{NetworkBnbMainnet},
        InternalTransferNetworks: []string{NetworkBnbMainnet},
        TransferCategories: []string{"external", "internal", "20", "721", "1155"},
    },
}
```

#### 添加新 Provider 的步驟

1. **在 `chains.go` 定義 Provider 常數和能力**：

   ```go
   const ProviderNewProvider = "newprovider"

   var ProviderCapabilities = map[string]ProviderCapability{
       ProviderNewProvider: {
           SupportedNetworks: []string{NetworkXxxMainnet},
           // ...
       },
   }
   ```

2. **在 `NetworkToProvider` 映射中註冊**：

   ```go
   var NetworkToProvider = map[string]string{
       NetworkXxxMainnet: ProviderNewProvider,
   }
   ```

3. **建立 Provider Client** (例如 `newprovider_client.go`)：

   ```go
   func (c *NewProviderClient) GetAssetTransfers(address string) ([]AssetTransfer, error) {
       // 實作 API 調用
   }
   ```

4. **在 `exports.go` 添加路由邏輯**：

   ```go
   case provider.ProviderNewProvider:
       // 調用新 Provider 的 client
   ```

### 數據流 (ChainAdapter SDK)

ChainAdapter 作為共享庫,以下數據流展示應用程序如何集成 SDK 進行交易操作:

#### Bitcoin 交易流程

```
應用程序
    ↓
bitcoinAdapter.Build(ctx, TransactionRequest)
    ↓
BitcoinAdapter (UTXO 選擇與交易構建)
    ├─→ RPCClient.Call("listunspent", from_address)
    │   └─→ Bitcoin Core RPC
    │       └─→ 返回 UTXO 列表 [{txid, vout, amount}...]
    │
    ├─→ 選擇 UTXOs (貪心算法, 優先大額UTXO)
    ├─→ 計算找零金額 (total_input - amount - fee)
    ├─→ 構建交易輸入/輸出
    ├─→ 生成簽名負載 (SigningPayload)
    └─→ metrics.RecordTransactionBuild("bitcoin", duration, success)
    ↓
返回 UnsignedTransaction
    ├─ SigningPayload: []byte (二進制簽名數據)
    ├─ HumanReadable: string (可審計的JSON格式)
    ├─ From/To/Amount/Fee
    └─ ID: 唯一交易標識符
    ↓
bitcoinAdapter.Sign(ctx, unsigned, signer)
    ↓
BitcoinAdapter (離線簽名)
    ├─→ 驗證 signer.GetAddress() == unsigned.From
    ├─→ ECDSA 簽名 (secp256k1)
    ├─→ 序列化簽名交易
    └─→ metrics.RecordTransactionSign("bitcoin", duration, success)
    ↓
返回 SignedTransaction
    ├─ Signature: []byte
    ├─ SerializedTx: []byte (可廣播的原始交易)
    ├─ TxHash: string
    ├─ SignedBy: address
    └─ UnsignedTx: *UnsignedTransaction (審計追蹤)
    ↓
bitcoinAdapter.Broadcast(ctx, signed)
    ↓
BitcoinAdapter (冪等廣播)
    ├─→ 檢查 TransactionStateStore.Get(txHash)
    │   └─→ 如果已存在且狀態非失敗,返回現有收據
    │
    ├─→ RPCClient.Call("sendrawtransaction", serializedTx)
    │   └─→ Bitcoin Core RPC
    │       └─→ 廣播到網絡,返回 txHash
    │
    ├─→ TransactionStateStore.Set(txHash, TxState{
    │       Status: "pending",
    │       RetryCount: 1,
    │       FirstSeen: now,
    │   })
    │
    └─→ metrics.RecordTransactionBroadcast("bitcoin", duration, success)
    ↓
返回 BroadcastReceipt {TxHash, Status, BroadcastedAt}
    ↓
bitcoinAdapter.QueryStatus(ctx, txHash) 或 SubscribeStatus(ctx, txHash)
    ↓
BitcoinAdapter (狀態監控)
    ├─→ RPCClient.Call("gettransaction", txHash)
    │   └─→ 返回 {confirmations: N, blockhash: "...", ...}
    │
    ├─→ 確定狀態:
    │   - confirmations = 0  → TxStatusPending
    │   - confirmations 1-5  → TxStatusConfirmed
    │   - confirmations >= 6 → TxStatusFinalized
    │
    └─→ TransactionStateStore.Set(txHash, updatedState)
    ↓
返回 TransactionStatus {
    TxHash, Status, Confirmations,
    BlockNumber, BlockHash, Timestamp
}
```

#### Ethereum 交易流程 (EIP-1559)

```
應用程序
    ↓
ethereumAdapter.Build(ctx, TransactionRequest)
    ↓
EthereumAdapter (Nonce 查詢與 Gas 估算)
    ├─→ RPCClient.Call("eth_getTransactionCount", from, "latest")
    │   └─→ Geth/Infura RPC → 返回 nonce: 5
    │
    ├─→ RPCClient.Call("eth_estimateGas", {from, to, value})
    │   └─→ 返回 gasLimit: 21000
    │
    ├─→ RPCClient.Call("eth_getBlockByNumber", "latest", false)
    │   └─→ 返回 baseFeePerGas: 50 Gwei
    │
    ├─→ RPCClient.Call("eth_maxPriorityFeePerGas")
    │   └─→ 返回 priorityFee: 1.5 Gwei
    │
    ├─→ 計算 EIP-1559 費用:
    │   - Fast:   priorityFee * 2.0 + baseFee
    │   - Normal: priorityFee * 1.0 + baseFee  (默認)
    │   - Slow:   priorityFee * 0.5 + baseFee
    │
    ├─→ 構建 EIP-1559 交易
    │   {chainId, nonce, to, value, gasLimit,
    │    maxFeePerGas, maxPriorityFeePerGas}
    │
    ├─→ 生成簽名負載 (RLP 編碼的交易哈希)
    └─→ metrics.RecordTransactionBuild("ethereum", duration, success)
    ↓
返回 UnsignedTransaction
    ├─ SigningPayload: []byte (Keccak256 哈希)
    ├─ HumanReadable: JSON {from, to, amount, nonce, gas}
    ├─ Nonce: *big.Int
    ├─ GasLimit/MaxFeePerGas/MaxPriorityFeePerGas
    └─ ID: 唯一交易標識符
    ↓
ethereumAdapter.Sign(ctx, unsigned, signer)
    ↓
EthereumAdapter (離線簽名)
    ├─→ 驗證 signer.GetAddress() == unsigned.From (checksummed)
    ├─→ ECDSA 簽名 (secp256k1, recoverable signature)
    ├─→ RLP 編碼簽名交易 (type 2: EIP-1559)
    └─→ metrics.RecordTransactionSign("ethereum", duration, success)
    ↓
返回 SignedTransaction
    ├─ Signature: []byte (r, s, v)
    ├─ SerializedTx: []byte (0x02 + RLP([chainId, nonce, ...]))
    ├─ TxHash: 0x... (Keccak256 哈希)
    ├─ SignedBy: 0x... (EIP-55 checksummed)
    └─ UnsignedTx: *UnsignedTransaction (審計追蹤)
    ↓
ethereumAdapter.Broadcast(ctx, signed)
    ↓
EthereumAdapter (冪等廣播)
    ├─→ 檢查 TransactionStateStore.Get(txHash)
    │   └─→ 如果已存在且狀態非失敗,返回現有收據
    │
    ├─→ RPCClient.Call("eth_sendRawTransaction", hexSerializedTx)
    │   └─→ Geth/Infura RPC
    │       └─→ 廣播到 mempool,返回 txHash
    │
    ├─→ TransactionStateStore.Set(txHash, TxState{
    │       Status: "pending",
    │       RetryCount: 1,
    │       FirstSeen: now,
    │   })
    │
    └─→ metrics.RecordTransactionBroadcast("ethereum", duration, success)
    ↓
返回 BroadcastReceipt {TxHash, Status, BroadcastedAt}
    ↓
ethereumAdapter.QueryStatus(ctx, txHash) 或 SubscribeStatus(ctx, txHash)
    ↓
EthereumAdapter (狀態監控)
    ├─→ RPCClient.Call("eth_getTransactionReceipt", txHash)
    │   └─→ 返回 {blockNumber, status, gasUsed, ...} 或 null
    │
    ├─→ RPCClient.Call("eth_blockNumber")
    │   └─→ 返回當前區塊高度
    │
    ├─→ 計算確認數 = currentBlock - txBlock
    │
    ├─→ 確定狀態:
    │   - receipt == null      → TxStatusPending
    │   - confirmations 1-11   → TxStatusConfirmed
    │   - confirmations >= 12  → TxStatusFinalized
    │
    └─→ TransactionStateStore.Set(txHash, updatedState)
    ↓
返回 TransactionStatus {
    TxHash, Status, Confirmations,
    BlockNumber, GasUsed, Success
}
```

**說明**:

1. **Build()**: 應用程序調用 SDK 構建交易,SDK 通過 RPC 查詢鏈狀態 (UTXO/nonce/gas),返回未簽名交易
2. **Sign()**: 離線簽名,無需網絡調用,驗證地址匹配後生成 ECDSA 簽名
3. **Broadcast()**: 冪等廣播到區塊鏈,存儲交易狀態供後續查詢
4. **QueryStatus()**: 實時查詢交易確認狀態,從 pending → confirmed → finalized

所有 RPC 調用均通過 `MetricsRPCClient` 包裝,自動記錄延遲和成功率指標

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

1. **測試錢包創建**: 通過Dashboard創建測試錢包並寫下助記詞
2. **測試恢復**: 驗證助記詞能夠正確恢復錢包
3. **測試地址派生**: 生成測試地址 (m/44'/0'/0'/0/0) 並記下
4. **測試確定性**: 多次生成相同路徑驗證地址一致性
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

### 已完成 (v0.4.1)

- [x] BIP39/BIP44 HD錢包實現
- [x] 54條區塊鏈地址派生
- [x] USB專用存儲與AES-256-GCM加密
- [x] ChainAdapter統一交易接口
- [x] Bitcoin & Ethereum交易構建/簽名/廣播
- [x] Prometheus可觀測指標支持
- [x] 7種簽名方案 (ECDSA, Ed25519, sr25519, Schnorr)
- [x] Layer 2, 區域鏈, Cosmos生態, 專業鏈支持
- [x] 300+自動化測試
- [x] **Dashboard 桌面應用程式 (Tauri)**
- [x] **Token Swap 多 Provider (OpenOcean + KyberSwap)**
- [x] **Send Transaction 完整流程**
- [x] **多鏈資產餘額查詢**
- [x] **BIP39 Passphrase 支援**
- [x] **自動閒置鎖定 (15分鐘)**
- [x] **USB 可攜式應用程式打包**
- [x] **Chain-Specific Token Registry**
- [x] **Transaction History** - 多鏈交易歷史 (Alchemy + NodeReal BSCTrace)
- [x] **Provider Registry** - 多 API Provider 管理 (Alchemy, NodeReal, 1inch)
- [x] **動態 Gas Fee 策略** - EIP-1559/Legacy/L2 自動選擇
- [x] **免費 RPC Registry** - 統一管理公開 RPC 端點

### 進行中

- [ ] NFT 資產顯示
- [ ] DeFi 協議整合 (Aave, Compound)
- [ ] Swap 手續費機制

### 計劃中 (v0.5.0+)

**短期 (v0.5.0)**:
- [ ] **Bitcoin Dashboard 整合** - 將底層 BTC 交易功能整合到 Dashboard UI (FFI + UTXO 選擇 UI)
- [ ] 硬件錢包集成 (Ledger, Trezor)
- [ ] 多簽名錢包支持
- [ ] 地址的QR碼生成
- [ ] 本地化 (多語言)
- [ ] Windows/Linux 打包發布

**中期 (v0.6.0)**:
- [ ] 移動應用程序 (iOS, Android)
- [ ] WalletConnect v2 整合
- [ ] dApp 瀏覽器
- [ ] 跨鏈橋接 (Bridge)

**長期 (v1.0.0)**:
- [ ] Shamir Secret Sharing備份
- [ ] 社交恢復錢包
- [ ] 完整的SPV節點集成
- [ ] 企業級多人管理

---

## 快速參考

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

### 記憶體保護 (v0.4.3+)

**XOR 三分片儲存**:
```
Secret = Share1 ⊕ Share2 ⊕ Share3

記憶體佈局:
┌─────────────────────────────────────────────────────────────┐
│  share1: [mlock'd 隨機位元組, 32 bytes]                      │
│  share2: [mlock'd 隨機位元組, 32 bytes]                      │
│  share3: [mlock'd XOR 結果, 32 bytes]                       │
│  privateKey: [已清零 - 全為 0x00]                            │
├─────────────────────────────────────────────────────────────┤
│  簽名期間 (~1-5ms):                                          │
│  reconstructed = share1 ⊕ share2 ⊕ share3                  │
│  → 簽名 → defer SecureZero(reconstructed)                   │
└─────────────────────────────────────────────────────────────┘
```

**SecureZero 實現**:
```go
func SecureZero(b []byte) {
    ptr := unsafe.Pointer(&b[0])
    for i := range b {
        *(*byte)(unsafe.Pointer(uintptr(ptr) + uintptr(i))) = 0
    }
    runtime.KeepAlive(b)  // 防止 GC 優化
    runtime.Gosched()      // 記憶體屏障
}
```

**安全保證**:
- ✅ 私鑰不以連續明碼形式長時間存在記憶體
- ✅ 明碼私鑰僅在簽名瞬間短暫重組 (~1-5ms)
- ✅ 一般 heap scan / crash dump 無法直接取得私鑰
- ✅ Core dump 已禁用、敏感記憶體已盡力避免 swap
- ✅ 記憶體清除不會被編譯器優化掉

---

## 技術支援

### 報告問題

- 安全漏洞: security@arcsign.io
- 技術支援: support@arcsign.io
- 功能建議: feedback@arcsign.io

### 開發技術

- 語言: Go 1.21+ (共享庫), Rust 1.75+ (Tauri), TypeScript 5.0+ (前端)
- 測試: 72+ 單元測試覆蓋核心功能
- 代碼風格: `gofmt`, `golint`

---

## 許可證

本軟體為專有軟體 (Proprietary Software)。未經授權不得複製、修改或分發。

---

## 安全披露

如果您發現安全漏洞, 請發送電子郵件至 security@arcsign.io。請勿公開披露。

---

## 致謝

### 第三方函式庫

- go-bip39 - BIP39 助記詞實現
- btcsuite/btcd - Bitcoin 協議庫
- go-ethereum - Ethereum 協議庫
- golang/crypto - 加密原語

### 遵循標準

- Bitcoin 改進提案 (BIPs)
- OWASP 密碼存儲備忘單
- NIST 加密標準

### 感謝

- Bitcoin 和 Ethereum 開發者社區
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

**Version**: 0.4.3
**Release Date**: 2025-12-29
**Go Version**: 1.25.0
**Rust Version**: 1.75+
**Node Version**: 18+
**License**: Proprietary
**Website**: https://arcsign.io
