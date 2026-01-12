# Session Token 手動測試指南

## 📋 測試前準備

### 1. 確認應用程式正在運行
應用程式已啟動在開發模式（PID: 88907）

### 2. 開啟開發者工具
- 在應用程式視窗按 `Cmd+Opt+I` (macOS) 或 `Ctrl+Shift+I` (Windows/Linux)
- 確保以下 tabs 已開啟：
  - **Console** - 查看日誌訊息
  - **Network** - 監控 API 請求
  - **Application** > Local Storage - 檢查儲存內容

### 3. 安裝 React DevTools（如尚未安裝）
- Chrome Extension: React Developer Tools
- 用於檢查 React 元件 state

---

## 🧪 測試流程

### 測試 1：登入與 Session 創建 ✅

**目標**：驗證 session token 正確創建，密碼不被儲存

**步驟**：
1. 開啟應用程式
2. 輸入 USB 設備路徑
3. 輸入 App Password
4. 點擊「解鎖」或「登入」

**驗證點**：

✅ **Console 日誌檢查**：
```
🔐 [SessionStore] Session created successfully (token stored in memory only)
```

✅ **React DevTools 檢查**：
- 打開 React DevTools > Components
- 找到 `AppPasswordContext`
- **確認**: 無 `appPassword` field（❌ 不應存在）
- 找到使用 `useSessionStore` 的元件
- **確認**: 只有 `token` field，值類似 `abc12345...***`（已遮蔽）

✅ **Local Storage 檢查**：
- 打開 DevTools > Application > Local Storage
- **確認**: 無 `appPassword` 或 `sessionToken` 條目

❌ **不應該出現**：
- 密碼明文
- 完整的 token（應被 redacted）

---

### 測試 2：查詢餘額 (GetTokenBalances) ✅

**目標**：驗證餘額查詢使用 sessionToken，不使用 appPassword

**步驟**：
1. 登入成功後
2. 選擇任一錢包
3. 等待餘額載入

**驗證點**：

✅ **Console 日誌檢查**：
```
Loading balances for wallet: {walletId}
Balance loaded successfully
```

✅ **Network Tab 檢查**：
- 打開 DevTools > Network
- 找到 `GetTokenBalances` 請求（或類似名稱）
- 點擊該請求 > Payload/Request
- **確認**:
  - ✅ 包含 `sessionToken` 參數
  - ❌ **不包含** `appPassword` 參數

✅ **功能驗證**：
- 餘額正確顯示
- 支援的鏈（Ethereum, Arbitrum, Optimism, BSC, Polygon）都能查詢

---

### 測試 3：Send Transaction 流程 ✅

**目標**：驗證整個交易流程使用 sessionToken，只有簽署時要求密碼

**步驟**：
1. 在錢包詳情頁點擊 **Send** 按鈕
2. 輸入接收地址（可使用測試地址）
3. 輸入金額（小額測試）
4. 查看 Gas Fee 估算
5. 點擊「確認」
6. 輸入 **Wallet Password**（注意：是 wallet password，不是 app password）
7. 確認交易

**驗證點**：

✅ **EstimateFee - Network Tab**：
- 找到 `EstimateFee` 請求
- **確認**:
  - ✅ 包含 `sessionToken`
  - ❌ 不包含 `appPassword`

✅ **BuildTransaction - Network Tab**：
- 找到 `BuildTransaction` 請求
- **確認**:
  - ✅ 包含 `sessionToken`
  - ❌ 不包含 `appPassword`

✅ **SignTransaction - Network Tab**：
- 找到 `SignTransaction` 請求
- **確認**:
  - ✅ 包含 `password`（這是 wallet password）
  - ✅ 可選包含 `sessionToken`
  - ❌ 不包含 `appPassword`

✅ **密碼輸入對話框**：
- 簽署時應彈出密碼輸入框
- 標題應明確說明是「Wallet Password」
- 輸入後立即用於簽署，不儲存

✅ **BroadcastTransaction - Network Tab**：
- 找到 `BroadcastTransaction` 請求
- **確認**:
  - ✅ 包含 `sessionToken`
  - ❌ 不包含 `appPassword`

✅ **Console 日誌**：
```
Building transaction...
Estimating gas...
Transaction signed successfully
Transaction broadcasted: 0x...
```

---

### 測試 4：Swap Transaction 流程 ✅

**目標**：驗證 Swap 流程的所有 API 都使用 sessionToken

**步驟**：
1. 點擊 **Swap** 按鈕
2. 選擇源代幣（例如 ETH）
3. 選擇目標代幣（例如 USDC）
4. 輸入兌換金額
5. 查看報價
6. 如需授權（Approval），先執行授權交易
7. 執行 Swap 交易

**驗證點**：

✅ **GetSwapTokens - Network Tab**：
- 找到 `GetSwapTokens` 請求
- **確認**:
  - ✅ 包含 `sessionToken`
  - ❌ 不包含 `appPassword`

✅ **GetSwapQuote - Network Tab**：
- 找到 `GetSwapQuote` 請求
- **確認**:
  - ✅ 包含 `sessionToken`
  - ❌ 不包含 `appPassword`

✅ **CheckSwapAllowance - Network Tab**（如適用）：
- **確認**:
  - ✅ 包含 `sessionToken`

✅ **GetSwapApproval - Network Tab**（如需授權）：
- **確認**:
  - ✅ 包含 `sessionToken`

✅ **BuildSwapTransaction - Network Tab**：
- **確認**:
  - ✅ 包含 `sessionToken`

✅ **SignTransaction**：
- 彈出密碼輸入框（Wallet Password）
- 不儲存密碼

✅ **BroadcastTransaction**：
- 使用 `sessionToken`

---

### 測試 5：Staking Transaction 流程 ✅

**目標**：驗證 Staking 流程使用 sessionToken

**步驟**：
1. 點擊 **Staking** 按鈕
2. 選擇 Staking 提供者（Lido, Rocket Pool 等）
3. 輸入 Staking 金額
4. 確認交易

**驗證點**：

✅ **EstimateFee**：使用 `sessionToken`
✅ **BuildTransaction**：使用 `sessionToken`
✅ **SignTransaction**：要求 Wallet Password
✅ **BroadcastTransaction**：使用 `sessionToken`

---

### 測試 6：QueryTransactionStatus ✅

**目標**：驗證交易狀態查詢使用 sessionToken

**步驟**：
1. 完成任一交易後
2. 點擊「查看交易」或類似按鈕
3. 查看交易狀態

**驗證點**：

✅ **Network Tab**：
- 找到 `QueryTransactionStatus` 請求
- **確認**:
  - ✅ 包含 `sessionToken`
  - ❌ 不包含 `appPassword`

---

### 測試 7：Session 超時測試 ⏰

#### 7a. Idle Timeout (2 小時)

**目標**：驗證閒置 2 小時後 session 過期

**步驟**：
1. 登入成功
2. 保持應用程式開啟，但**不執行任何操作**
3. 等待 2 小時
4. 嘗試執行任何操作（例如查詢餘額）

**驗證點**：

✅ **預期行為**：
- 操作失敗
- 系統要求重新登入

✅ **Console 日誌**：
```
🔴 [SessionStore] session expired due to inactivity
Session expired. Please log in again.
```

**快速測試方法（開發環境）**：
- 暫時修改 `internal/app/session.go` 中的 `SessionIdleTimeout` 為 `1 * time.Minute`
- 重新編譯並測試

#### 7b. Absolute Timeout (24 小時)

**目標**：驗證絕對超時 24 小時

**步驟**：
1. 登入成功
2. 持續使用應用程式（保持活躍）
3. 24 小時後執行任何操作

**驗證點**：

✅ **Console 日誌**：
```
🔴 [SessionStore] session has expired
```

**快速測試方法（開發環境）**：
- 暫時修改 `internal/app/session.go` 中的 `SessionMaxLifetime` 為 `2 * time.Minute`
- 重新編譯並測試

---

### 測試 8：安全檢查 🔒

**目標**：確認沒有密碼洩漏

#### 8a. Local Storage 檢查

**步驟**：
1. 打開 DevTools > Application > Local Storage
2. 查看所有儲存的 keys

**驗證點**：
❌ **不應存在**：
- `appPassword`
- `sessionToken`
- 任何明文密碼

#### 8b. React DevTools 檢查

**步驟**：
1. 打開 React DevTools > Components
2. 搜尋 `AppPasswordContext`
3. 搜尋 `sessionStore`

**驗證點**：

❌ `AppPasswordContext`:
- 不應有 `appPassword` field

✅ `sessionStore`:
- 只有 `token` field
- Token 值應被遮蔽（例如 `abc12345...***`）

#### 8c. Console 日誌檢查

**驗證點**：

✅ **正確的日誌格式**：
```
🔐 [SessionStore] Token validated: abc12345...***
```

❌ **不應出現**：
- 完整的 token
- 明文密碼
- `appPassword: "..."`

#### 8d. Network 請求檢查

**驗證點**：

✅ **低風險操作**（GetTokenBalances, BuildTransaction, EstimateFee 等）：
- 包含 `sessionToken`
- 不包含 `appPassword`

✅ **高風險操作**（SignTransaction）：
- 包含 `password`（wallet password，臨時傳遞）
- 可選包含 `sessionToken`
- 不包含 `appPassword`

---

## ✅ 測試完成標準

所有以下項目都應該 ✅：

- [ ] 登入成功創建 session token
- [ ] 密碼不儲存在 React state
- [ ] 密碼不儲存在 localStorage
- [ ] Console 日誌正確遮蔽 token
- [ ] GetTokenBalances 使用 sessionToken
- [ ] Send Transaction 完整流程成功
- [ ] Swap Transaction 完整流程成功
- [ ] Staking Transaction 完整流程成功
- [ ] QueryTransactionStatus 使用 sessionToken
- [ ] SignTransaction 每次都要求 wallet password
- [ ] Session 閒置 2 小時後過期
- [ ] Session 24 小時後絕對過期
- [ ] Network 請求不包含 appPassword
- [ ] React DevTools 無 appPassword
- [ ] Local Storage 無敏感資料

---

## 🐛 如果發現問題

### 問題回報格式

```
**測試項目**: [例如：測試 2 - 查詢餘額]

**問題描述**: [具體描述問題]

**重現步驟**:
1. ...
2. ...

**預期行為**: [應該發生什麼]

**實際行為**: [實際發生什麼]

**Console 錯誤**: [貼上相關錯誤訊息]

**Network 請求**: [貼上相關請求 payload]

**截圖**: [如適用]
```

### 常見問題處理

#### 問題 1：Session Token 不存在
**症狀**: 操作失敗，提示 "authentication required"

**檢查**:
1. 確認已成功登入
2. 檢查 `useSessionStore` 的 `token` 是否存在
3. 檢查 session 是否過期

#### 問題 2：密碼仍然被儲存
**症狀**: React DevTools 中看到 `appPassword`

**檢查**:
1. 確認 `AppPasswordContext.tsx` 已移除 `appPassword` state
2. 確認元件不使用 `appPassword`

#### 問題 3：API 請求包含 appPassword
**症狀**: Network Tab 中看到 `appPassword` 參數

**檢查**:
1. 確認呼叫 API 時傳遞 `sessionToken` 而非 `appPassword`
2. 檢查 `tauri-api.ts` 中的參數定義

---

## 📊 測試報告模板

測試完成後，請更新 [SESSION_TOKEN_MIGRATION_TEST.md](SESSION_TOKEN_MIGRATION_TEST.md) 的「功能測試清單」部分，將所有 `[ ]` 改為 `[x]`。

**測試人員簽名**：
- 測試者：___________
- 日期：2026-01-12
- 測試版本：v0.5.0-rc
- 測試環境：[macOS / Windows / Linux]

**備註**：
- [記錄任何特殊發現或建議]

---

## 🚀 測試通過後的下一步

1. **文檔更新**
   - 更新 README.md（標註 v0.5.0 session token 功能）
   - 更新 CHANGELOG.md
   - 更新 SECURITY_ARCHITECTURE.md

2. **生產環境準備**
   - 將 `serverPepper` 改用環境變數
   - 產生生產用的 pepper（至少 32 bytes）
   - 配置金鑰管理系統（AWS KMS / HashiCorp Vault）

3. **版本發布**
   - 創建 v0.5.0 release tag
   - 推送到 remote repository
   - 建置生產版本

---

**祝測試順利！** 🎉

如有任何問題，請參考：
- [SESSION_TOKEN_MIGRATION_TEST.md](SESSION_TOKEN_MIGRATION_TEST.md) - 測試報告
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) - 安全架構文檔
