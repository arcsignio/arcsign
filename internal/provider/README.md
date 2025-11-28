# Provider Registry System

區塊鏈數據提供商抽象層，支援多種 API 服務商（Alchemy、Infura、QuickNode等）的統一管理。

## 架構概覽

```
provider/
├── interface.go       # BlockchainProvider 統一介面
├── config.go          # 配置存儲（加密）
├── registry.go        # Provider 註冊中心
├── alchemy/
│   ├── alchemy.go    # Alchemy 實作
│   └── init.go       # 自動註冊
└── README.md         # 本文檔
```

## 核心組件

### 1. BlockchainProvider Interface

統一的區塊鏈數據查詢介面，所有 Provider 都必須實作：

```go
type BlockchainProvider interface {
    // 帳戶與餘額
    GetBalance(ctx, chainID, address) (*big.Int, error)
    GetTokenBalance(ctx, chainID, address, token) (*big.Int, error)
    GetTransactionCount(ctx, chainID, address) (uint64, error)

    // 費用估算
    EstimateGas(ctx, chainID, from, to, value, data) (uint64, error)
    GetBaseFee(ctx, chainID) (*big.Int, error)
    GetFeeHistory(ctx, chainID, blockCount) (*big.Int, error)
    EstimateBitcoinFee(ctx, chainID, targetBlocks) (int64, error)

    // 交易操作
    SendRawTransaction(ctx, chainID, rawTx) (string, error)
    GetTransactionByHash(ctx, chainID, txHash) (*TransactionInfo, error)
    GetTransactionReceipt(ctx, chainID, txHash) (*TransactionReceipt, error)

    // 區塊與網路資訊
    GetBlockNumber(ctx, chainID) (uint64, error)
    GetBlock(ctx, chainID, identifier) (*BlockInfo, error)

    // UTXO 操作（Bitcoin）
    ListUnspent(ctx, chainID, address) ([]*UTXO, error)
    GetRawTransaction(ctx, chainID, txHash, verbose) (*BitcoinTransaction, error)

    // 健康檢查
    HealthCheck(ctx) error
    Close() error
}
```

### 2. ProviderConfig

Provider 配置結構，支援加密存儲：

```go
type ProviderConfig struct {
    ProviderType   string    // "alchemy", "infura", "quicknode"
    APIKey         string    // API 密鑰（加密存儲）
    ChainID        string    // 區塊鏈標識
    NetworkID      string    // 網路標識（mainnet, sepolia等）
    CustomEndpoint string    // 自定義端點（可選）
    Priority       int       // 優先級（數字越大越優先）
    Enabled        bool      // 是否啟用
    CreatedAt      time.Time
    UpdatedAt      time.Time
}
```

### 3. ProviderRegistry

Provider 註冊與實例管理：

```go
// 註冊 Provider 工廠函數
registry.RegisterProvider("alchemy", func(config *ProviderConfig) (BlockchainProvider, error) {
    return NewAlchemyProvider(config)
})

// 獲取或創建 Provider 實例（自動緩存）
provider, err := registry.GetProvider(config)

// 自動選擇最佳 Provider（帶健康檢查）
provider, err := registry.GetProviderForChain(ctx, "ethereum", configStore)

// 自動 Fallback（嘗試所有 Provider）
provider, err := registry.GetProviderWithFallback(ctx, "ethereum", configStore)
```

## 使用範例

### 1. 配置 Provider（FFI 調用）

```json
{
  "providerType": "alchemy",
  "apiKey": "your-alchemy-api-key",
  "chainId": "ethereum",
  "networkId": "mainnet",
  "priority": 100,
  "enabled": true,
  "password": "wallet-password",
  "usbPath": "/path/to/usb"
}
```

調用 FFI 方法：
```
SetProviderConfig(paramsJSON)
```

### 2. 查詢餘額

```go
// 獲取 Provider
provider, err := registry.GetProviderForChain(ctx, "ethereum", configStore)
if err != nil {
    return err
}

// 查詢餘額
balance, err := provider.GetBalance(ctx, "ethereum", "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")
if err != nil {
    return err
}

fmt.Printf("Balance: %s wei\n", balance.String())
```

### 3. 費用估算

```go
provider, err := registry.GetProviderForChain(ctx, "ethereum", configStore)
if err != nil {
    return err
}

gasEstimate, err := provider.EstimateGas(ctx, "ethereum", from, to, amount, data)
if err != nil {
    return err
}

baseFee, err := provider.GetBaseFee(ctx, "ethereum")
if err != nil {
    return err
}

priorityFee, err := provider.GetFeeHistory(ctx, "ethereum", 10)
if err != nil {
    return err
}
```

### 4. 多 Provider Fallback

```go
// 自動嘗試所有已配置的 Provider（按優先級）
provider, err := registry.GetProviderWithFallback(ctx, "ethereum", configStore)
if err != nil {
    // 所有 Provider 都失敗
    return fmt.Errorf("all providers unhealthy: %w", err)
}

// 使用 Provider
balance, err := provider.GetBalance(ctx, "ethereum", address)
```

## 安全性設計

### 1. API Key 加密存儲

- 使用 AES-256-GCM 加密（與 wallet 相同的加密機制）
- 使用使用者錢包密碼作為加密密鑰
- 配置檔案存儲在 USB 上：`/usb/provider_config.enc`

### 2. 記憶體安全

- API Key 使用後立即清除
- 配置載入到記憶體時保持加密
- 僅在必要時解密

### 3. 權限控制

- 設定 API Key 需要錢包密碼
- 讀取配置需要錢包密碼
- 前端無法直接訪問 API Key

## 擴展新 Provider

### 1. 實作 BlockchainProvider 介面

```go
package infura

import "github.com/arcsign/chainadapter/provider"

type InfuraProvider struct {
    apiKey     string
    httpClient *http.Client
    // ...
}

func NewInfuraProvider(config *provider.ProviderConfig) (provider.BlockchainProvider, error) {
    return &InfuraProvider{
        apiKey: config.APIKey,
        // ...
    }, nil
}

// 實作所有必要方法
func (i *InfuraProvider) GetBalance(ctx context.Context, chainID, address string) (*big.Int, error) {
    // ...
}
```

### 2. 註冊 Provider

```go
// infura/init.go
package infura

import "github.com/arcsign/chainadapter/provider"

func init() {
    provider.RegisterProvider("infura", func(config *provider.ProviderConfig) (provider.BlockchainProvider, error) {
        return NewInfuraProvider(config)
    })
}
```

### 3. 使用新 Provider

```go
// 只需在 main.go 中 import
import _ "github.com/arcsign/chainadapter/provider/infura"

// Provider 會自動註冊，使用者可以通過 FFI 配置
```

## FFI API 方法

### SetProviderConfig
設定 Provider 配置

**輸入：**
```json
{
  "providerType": "alchemy",
  "apiKey": "xxx",
  "chainId": "ethereum",
  "networkId": "mainnet",
  "priority": 100,
  "enabled": true,
  "password": "wallet-password",
  "usbPath": "/path/to/usb"
}
```

**輸出：**
```json
{
  "success": true,
  "data": {
    "providerType": "alchemy",
    "chainId": "ethereum",
    "configured": true,
    "configuredAt": "2025-11-27T10:00:00Z"
  }
}
```

### GetProviderConfig
獲取 Provider 配置

**輸入：**
```json
{
  "chainId": "ethereum",
  "providerType": "alchemy",  // 可選
  "password": "wallet-password",
  "usbPath": "/path/to/usb"
}
```

**輸出：**
```json
{
  "success": true,
  "data": {
    "providerType": "alchemy",
    "chainId": "ethereum",
    "networkId": "mainnet",
    "priority": 100,
    "enabled": true,
    "hasApiKey": true,
    "createdAt": "2025-11-27T09:00:00Z",
    "updatedAt": "2025-11-27T10:00:00Z"
  }
}
```

### ListProviderConfigs
列出所有 Provider 配置

**輸入：**
```json
{
  "chainId": "ethereum",  // 可選
  "password": "wallet-password",
  "usbPath": "/path/to/usb"
}
```

**輸出：**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "providerType": "alchemy",
        "chainId": "ethereum",
        "priority": 100,
        "enabled": true
      }
    ],
    "count": 1
  }
}
```

### DeleteProviderConfig
刪除 Provider 配置

**輸入：**
```json
{
  "chainId": "ethereum",
  "providerType": "alchemy",
  "password": "wallet-password",
  "usbPath": "/path/to/usb"
}
```

**輸出：**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "deletedAt": "2025-11-27T10:05:00Z"
  }
}
```

## 支援的 Provider

### Alchemy
- **支援鏈：** Ethereum, Polygon, Arbitrum, Optimism, Base
- **網路：** Mainnet, Sepolia, Goerli, Mumbai, etc.
- **功能：** 完整 EVM 支援

### 未來擴展
- **Infura**：Ethereum, IPFS
- **QuickNode**：多鏈支援
- **自建節點**：完全自主控制

## 最佳實踐

1. **配置多個 Provider**：為每條鏈配置主要和備用 Provider
2. **設定優先級**：主要 Provider 設高優先級（如 100），備用設低優先級（如 50）
3. **定期健康檢查**：使用 `HealthCheck()` 驗證 Provider 可用性
4. **監控 API 使用**：注意 API 速率限制和配額
5. **安全存儲 API Key**：始終使用加密存儲，不要硬編碼

## 故障排除

### Provider 不健康
- 檢查 API Key 是否有效
- 檢查網路連接
- 檢查 API 服務商是否有故障
- 嘗試切換到備用 Provider

### 配置載入失敗
- 確認錢包密碼正確
- 確認配置檔案存在且未損壞
- 檢查 USB 存取權限

### API 速率限制
- 升級 API 方案
- 配置多個 Provider 分散請求
- 實作請求快取機制
