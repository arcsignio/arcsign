# Provider Registry System - Frontend Integration Guide

## 概述

Provider Registry System 已經完全整合到 Dashboard 前端。使用者可以通過 UI 介面管理區塊鏈 API 服務商（Alchemy、Infura 等）的 API Key。

## 已完成的功能

### 1. **Rust FFI Bindings** ✅
- 新增 4 個 FFI 方法的類型定義
- 載入並緩存函數符號
- 實作安全的記憶體管理

**檔案：** `src-tauri/src/ffi/bindings.rs`

```rust
// 新增的 FFI 方法
- SetProviderConfig
- GetProviderConfig
- ListProviderConfigs
- DeleteProviderConfig
```

### 2. **Tauri Commands** ✅
- 創建 4 個 Tauri command
- 實作參數序列化與錯誤處理
- 整合到 WalletQueue 以確保線程安全

**檔案：** `src-tauri/src/commands/provider.rs`

```rust
#[tauri::command]
pub async fn set_provider_config(...)
pub async fn get_provider_config(...)
pub async fn list_provider_configs(...)
pub async fn delete_provider_config(...)
```

### 3. **TypeScript API Client** ✅
- 類型安全的 API 封裝
- 錯誤處理
- 常數定義（Provider Types、Chain IDs、Network IDs）

**檔案：** `src/api/provider.ts`

### 4. **React UI 組件** ✅
- 完整的 Provider 配置介面
- 表單驗證
- 列表顯示與刪除功能
- 響應式設計

**檔案：** `src/components/ProviderSettings.tsx`

## 使用方式

### 在 Dashboard 中集成 ProviderSettings 組件

```tsx
import { ProviderSettings } from './components/ProviderSettings';

function Dashboard() {
  const usbPath = '/path/to/usb'; // 從 USB 偵測獲取
  const password = 'user-password'; // 從解鎖錢包獲取

  return (
    <div>
      <h1>Settings</h1>
      <ProviderSettings usbPath={usbPath} password={password} />
    </div>
  );
}
```

### API 使用範例

```typescript
import {
  setProviderConfig,
  listProviderConfigs,
  deleteProviderConfig,
  PROVIDER_TYPES,
  CHAIN_IDS,
} from './api/provider';

// 新增 Provider 配置
await setProviderConfig({
  providerType: PROVIDER_TYPES.ALCHEMY,
  apiKey: 'your-alchemy-api-key',
  chainId: CHAIN_IDS.ETHEREUM,
  networkId: 'mainnet',
  priority: 100,
  enabled: true,
  password: 'wallet-password',
  usbPath: '/path/to/usb',
});

// 列出所有 Provider
const providers = await listProviderConfigs(null, password, usbPath);

// 刪除 Provider
await deleteProviderConfig(
  CHAIN_IDS.ETHEREUM,
  PROVIDER_TYPES.ALCHEMY,
  password,
  usbPath
);
```

## 功能特性

### 1. **安全性**
- ✅ API Key 使用 AES-256-GCM 加密存儲
- ✅ 需要錢包密碼才能訪問配置
- ✅ 記憶體中自動清除敏感資料
- ✅ 配置文件存儲在 USB 上

### 2. **多 Provider 支援**
- ✅ 支援多個 Provider 並存
- ✅ 優先級控制（0-999）
- ✅ 啟用/停用開關
- ✅ 自動 Fallback 機制

### 3. **多鏈支援**
- ✅ Ethereum (mainnet, sepolia, goerli)
- ✅ Polygon (mainnet, mumbai)
- ✅ Arbitrum (mainnet, sepolia)
- ✅ Optimism (mainnet, sepolia)
- ✅ Base (mainnet, sepolia)

### 4. **Provider 類型**
- ✅ Alchemy (已實作)
- ⏳ Infura (準備中)
- ⏳ QuickNode (準備中)

## 檔案結構

```
dashboard/
├── src/
│   ├── api/
│   │   └── provider.ts           # TypeScript API client
│   └── components/
│       └── ProviderSettings.tsx  # React UI 組件
└── src-tauri/
    └── src/
        ├── commands/
        │   ├── mod.rs
        │   └── provider.rs       # Tauri commands
        ├── ffi/
        │   └── bindings.rs       # FFI bindings
        └── main.rs               # Command 註冊
```

## 開發注意事項

### 1. **編譯前準備**
確保 Go 後端已編譯並包含新的 FFI 方法：

```bash
cd /Users/jnr350/Desktop/Yansiang/arcSignv2
go build -buildmode=c-shared -o dashboard/src-tauri/libarcsign.dylib internal/lib/exports.go
```

### 2. **測試前準備**
- 確保有有效的 USB 路徑
- 確保有解鎖的錢包（需要密碼）
- 準備好要測試的 API Key（建議使用測試網）

### 3. **錯誤處理**
所有 API 調用都應該包含錯誤處理：

```typescript
try {
  await setProviderConfig(config);
  // 成功處理
} catch (error) {
  console.error('Failed to set provider config:', error);
  // 顯示錯誤訊息給使用者
}
```

## 未來擴展

### 階段 2: 新增更多 Provider
```typescript
// Infura 支援
await setProviderConfig({
  providerType: 'infura',
  apiKey: 'your-infura-project-id',
  // ...
});

// QuickNode 支援
await setProviderConfig({
  providerType: 'quicknode',
  customEndpoint: 'https://your-endpoint.quiknode.pro/xxx',
  // ...
});
```

### 階段 3: 進階功能
- Provider 健康檢查指示器
- API 使用量監控
- 自動切換故障 Provider
- 批量導入/導出配置

## 測試流程

### 1. **UI 測試**
1. 啟動 Dashboard
2. 導航到 Provider Settings 頁面
3. 點擊 "Add Provider"
4. 填寫表單：
   - Provider Type: Alchemy
   - Chain: Ethereum
   - Network: Sepolia
   - API Key: [你的測試 API Key]
   - Priority: 100
5. 提交表單
6. 確認 Provider 出現在列表中

### 2. **功能測試**
```typescript
// 測試腳本範例
async function testProviderSystem() {
  const testConfig = {
    providerType: 'alchemy',
    apiKey: 'test-key',
    chainId: 'ethereum',
    networkId: 'sepolia',
    priority: 100,
    enabled: true,
    password: 'test-password',
    usbPath: '/test/usb',
  };

  // 1. 新增配置
  await setProviderConfig(testConfig);
  console.log('✓ Provider added');

  // 2. 列出配置
  const providers = await listProviderConfigs(null, password, usbPath);
  console.log('✓ Providers listed:', providers.length);

  // 3. 刪除配置
  await deleteProviderConfig('ethereum', 'alchemy', password, usbPath);
  console.log('✓ Provider deleted');
}
```

## 故障排除

### 問題 1: FFI 方法未找到
**症狀：** `SetProviderConfig symbol not found`

**解決方案：**
1. 確認 Go 後端已重新編譯
2. 檢查 `internal/lib/exports.go` 是否包含新方法
3. 確認 `//export` 註釋存在

### 問題 2: 配置無法保存
**症狀：** 提交表單後無錯誤但配置未保存

**解決方案：**
1. 檢查 USB 路徑是否有效
2. 確認密碼正確
3. 檢查 USB 空間是否足夠
4. 查看後端日誌

### 問題 3: API Key 驗證失敗
**症狀：** `Invalid API key` 錯誤

**解決方案：**
1. 確認 API Key 格式正確
2. Alchemy API Key 應至少 20 字符
3. Infura Project ID 應為 32 字符 hex
4. QuickNode 需要提供 custom endpoint

## 相關文件

- [Provider Registry System 後端文檔](../src/chainadapter/provider/README.md)
- [FFI API 規格](../specs/006-chain-adapter/contracts/ffi-api.md)
- [安全性設計](../docs/security.md)

## 支援

如有問題或建議，請參考：
- GitHub Issues: https://github.com/arcsign/arcsignv2/issues
- 開發文檔: `/docs`
