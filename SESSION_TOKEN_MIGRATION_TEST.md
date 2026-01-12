# Session Token 遷移測試報告

## 📅 測試日期
2026-01-12

## ✅ 編譯測試結果

### Frontend
```bash
npm run build
```
**結果**: ✅ 成功
- TypeScript 編譯無錯誤
- Build time: ~1.57s
- 所有元件正常編譯

### Backend
```bash
make build-lib
```
**結果**: ✅ 成功
- Go 編譯無錯誤
- Shared library 成功建置: `dashboard/src-tauri/libarcsign.dylib`
- 所有 FFI 函數正常匯出

### Tauri 應用程式
```bash
npm run tauri:dev
```
**結果**: ✅ 成功啟動
- Go library 成功載入
- WebSocket server 運行正常
- 無啟動錯誤

---

## 🧪 功能測試清單

### 1. 登入與 Session 創建
- [ ] 輸入正確的 app password
- [ ] 驗證 console 顯示: `🔐 [SessionStore] Session created successfully`
- [ ] 檢查 React DevTools 確認 `appPassword` 不存在於 state
- [ ] 檢查 `sessionStore` 只有 token（非明文密碼）

### 2. 查詢餘額 (GetTokenBalances)
- [ ] 選擇任一錢包
- [ ] 驗證餘額成功載入
- [ ] 檢查 Network tab 確認請求包含 `sessionToken`
- [ ] 確認沒有 `appPassword` 參數

### 3. Send Transaction
- [ ] 點擊 Send 按鈕
- [ ] 輸入收款地址和金額
- [ ] 驗證 Gas Fee 估算成功（EstimateFee with sessionToken）
- [ ] 驗證交易建構成功（BuildTransaction with sessionToken）
- [ ] 簽署時要求輸入 **wallet password**（不是 app password）
- [ ] 驗證廣播成功（BroadcastTransaction with sessionToken）

### 4. Swap Transaction
- [ ] 點擊 Swap 按鈕
- [ ] 選擇源代幣和目標代幣
- [ ] 輸入數量
- [ ] 驗證 Quote 獲取成功（GetSwapQuote with sessionToken）
- [ ] 驗證代幣列表載入（GetSwapTokens with sessionToken）
- [ ] 如需 Approval，驗證授權交易流程
- [ ] 簽署時要求輸入 **wallet password**
- [ ] 驗證 Swap 交易成功

### 5. Staking Transaction
- [ ] 點擊 Staking 按鈕
- [ ] 選擇 staking 選項
- [ ] 輸入數量
- [ ] 驗證 Gas Fee 估算成功
- [ ] 驗證交易建構成功
- [ ] 簽署時要求輸入 **wallet password**
- [ ] 驗證交易廣播成功

### 6. Session 超時測試
#### Idle Timeout (2 小時)
- [ ] 登入後保持應用程式開啟但不操作
- [ ] 2 小時後執行任何操作
- [ ] 驗證系統要求重新登入
- [ ] 檢查 console 顯示: `🔴 [SessionStore] session expired due to inactivity`

#### Absolute Timeout (24 小時)
- [ ] 登入後持續使用應用程式
- [ ] 24 小時後執行任何操作
- [ ] 驗證系統要求重新登入
- [ ] 檢查 console 顯示: `🔴 [SessionStore] session has expired`

### 7. 安全檢查
- [ ] 打開 Chrome DevTools > Application > Local Storage
  - 確認沒有 `appPassword` 或 `sessionToken` 儲存
- [ ] 打開 React DevTools > Components
  - 檢查 `AppPasswordContext`: ❌ 無 `appPassword` field
  - 檢查 `sessionStore`: ✅ 只有 `token`（已加密）
- [ ] 檢查 Console Logs
  - Token 應顯示為 redacted: `abc12345...***`
  - 密碼應完全不出現在 console
- [ ] 檢查 Network Tab
  - 低風險操作請求: ✅ 包含 `sessionToken`
  - 低風險操作請求: ❌ 不包含 `appPassword`
  - 高風險操作（簽署）: ✅ 包含 `password`（wallet password）

---

## 🔒 安全架構驗證

### Frontend Zero Password Storage
- ✅ `AppPasswordContext` 移除 `appPassword` state
- ✅ `sessionStore` 使用 Zustand (memory-only)
- ✅ Token 儲存在記憶體，應用程式關閉即清除
- ✅ Console logs 使用 `redactToken()` 遮蔽敏感資料

### Backend HKDF + Pepper
- ✅ Session 不儲存明文密碼
- ✅ 使用 HKDF 從 token 派生加密金鑰
- ✅ Server pepper 作為 salt（64 字元隨機字串）
- ✅ Pepper 版本化支援金鑰輪換
- ✅ AES-256-GCM 加密 provider key
- ✅ Nonce 每次加密都使用 CSPRNG 產生

### Dual Timeout Mechanism
- ✅ 絕對超時: 24 小時（SessionMaxLifetime）
- ✅ 閒置超時: 2 小時（SessionIdleTimeout）
- ✅ 每次 API 呼叫更新 `LastUsed`
- ✅ 超時後自動撤銷 session

### Risk-Based Authentication
- ✅ 低風險操作: 使用 sessionToken
  - GetTokenBalances
  - BuildTransaction
  - EstimateFee
  - BroadcastTransaction
  - GetSwapQuote
  - GetSwapTokens
  - BuildSwapTransaction
  - CheckSwapAllowance
  - GetSwapApproval
  - QueryTransactionStatus

- ✅ 高風險操作: 要求 wallet password
  - SignTransaction（每次簽署都要求密碼）

---

## 📊 API 遷移完成度

### Frontend (TypeScript)
- ✅ SendTransaction (4 API calls)
- ✅ SwapTransaction (9 API calls)
- ✅ StakingTransaction (4 API calls)
- ✅ TypeScript interfaces updated
- **完成度**: 17/17 (100%)

### Backend (Go FFI)
- ✅ GetTokenBalances
- ✅ BuildTransaction
- ✅ SignTransaction
- ✅ BroadcastTransaction
- ✅ GetSwapQuote
- ✅ GetSwapTokens
- ✅ BuildSwapTransaction
- ✅ CheckSwapAllowance
- ✅ GetSwapApproval
- ✅ QueryTransactionStatus
- **完成度**: 10/10 (100%)

---

## 🚀 部署檢查清單

### 生產環境準備
- [ ] 更新 `serverPepper` 使用環境變數
  ```go
  pepper := os.Getenv("SESSION_PEPPER_V1")
  if pepper == "" {
      panic("SESSION_PEPPER_V1 not set")
  }
  ```
- [ ] 產生新的 pepper（至少 32 bytes）
  ```bash
  openssl rand -base64 32
  ```
- [ ] 配置金鑰管理系統（AWS KMS / HashiCorp Vault）
- [ ] 設置監控告警（session 創建/撤銷）
- [ ] 測試 pepper 輪換流程
- [ ] 更新文檔說明 session 超時政策

### 文檔更新
- [ ] 更新 README.md 標註 v0.5.0 session token 功能
- [ ] 更新 CHANGELOG.md
- [ ] 更新 API 文檔
- [ ] 更新安全文檔

### 版本控制
- [ ] 確認所有 commit 已推送
- [ ] 創建 v0.5.0 release tag
- [ ] 推送到 remote repository

---

## 📝 已知問題

### 無 (目前無已知問題)

---

## 🎯 測試結論

### 預期結果
- ✅ 所有交易功能正常運作
- ✅ 低風險操作使用 sessionToken
- ✅ 高風險操作（簽署）要求 wallet password
- ✅ 密碼完全不儲存在前端
- ✅ Session 超時機制正常運作
- ✅ 編譯無錯誤
- ✅ 應用程式可正常啟動

### 實際測試結果
- ✅ 編譯測試通過
- ✅ 應用程式啟動成功
- ⏳ 功能測試進行中（需要手動測試）

---

## 👤 測試人員簽名

**測試者**: _________________

**日期**: 2026-01-12

**備註**:
