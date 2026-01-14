# 🚀 ArcSign v0.5.1 MVP 發布前測試清單

**版本**: v0.5.1
**發布日期**: 2026-01-12
**測試者**: ___________
**測試環境**: macOS (Apple Silicon)

---

## 📋 測試總覽

### 必須通過項目
- [ ] 所有核心功能測試通過
- [ ] 所有安全功能測試通過
- [ ] 所有新功能 (v0.5.1) 測試通過
- [ ] 沒有阻塞性 Bug
- [ ] 沒有安全漏洞

### 可選項目（未來改進）
- [ ] 效能優化建議
- [ ] UI/UX 改進建議
- [ ] 文檔更新建議

---

## 🎯 核心功能測試

### 1. 錢包管理

#### 1.1 建立新錢包
- [ ] **前置條件**：插入 USB 隨身碟
- [ ] 點擊「Create Wallet」按鈕
- [ ] 輸入錢包名稱（例如：Test Wallet）
- [ ] 輸入強密碼（至少 8 字元）
- [ ] 確認密碼輸入正確
- [ ] ✅ 成功建立錢包
- [ ] ✅ 顯示 12 個助記詞
- [ ] ✅ 要求使用者確認已備份
- [ ] ✅ 錢包檔案儲存在 USB 上（檢查 USB 目錄）

**驗證點**：
```bash
# 檢查 USB 上的錢包檔案
ls -la /Volumes/YOUR_USB/.arcsign/wallets/
# 應該看到 wallet.json 和 addresses.json
```

#### 1.2 匯入現有錢包
- [ ] 點擊「Import Wallet」
- [ ] 輸入測試助記詞（使用上一步的 12 個詞）
- [ ] 輸入錢包名稱（例如：Imported Wallet）
- [ ] 設定密碼
- [ ] ✅ 成功匯入
- [ ] ✅ 地址與原始錢包相同

**測試助記詞範例**（僅供測試，不要存入真實資產）：
```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

#### 1.3 BIP39 Passphrase 支援
- [ ] 建立新錢包時勾選「Use Passphrase」
- [ ] 輸入 passphrase（例如：test123）
- [ ] ✅ 成功建立
- [ ] ✅ 地址與無 passphrase 的錢包不同
- [ ] 嘗試不輸入 passphrase 解鎖
- [ ] ✅ 解鎖失敗（正確行為）
- [ ] 輸入正確 passphrase 解鎖
- [ ] ✅ 解鎖成功

---

### 2. 錢包解鎖與安全

#### 2.1 密碼驗證
- [ ] 選擇一個錢包
- [ ] 輸入**錯誤密碼**
- [ ] ✅ 顯示「密碼錯誤」提示
- [ ] ✅ 無法解鎖
- [ ] 輸入**正確密碼**
- [ ] ✅ 成功解鎖
- [ ] ✅ 顯示資產列表

#### 2.2 Session Token 機制（v0.5.1 新功能）
- [ ] 成功解鎖錢包後
- [ ] 開啟 DevTools Console (Cmd+Option+I)
- [ ] 檢查 Console 日誌
- [ ] ✅ 看到「🔐 Creating wallet session token...」
- [ ] ✅ 看到「✅ Wallet session created successfully」
- [ ] ✅ **沒有看到密碼被記錄**
- [ ] 開啟 DevTools Application 面板
- [ ] 檢查 Session Storage
- [ ] ✅ **確認沒有 `appPassword` 鍵**（安全修復）
- [ ] 檢查 Local Storage
- [ ] ✅ **確認沒有密碼儲存**

**關鍵安全驗證**：
```javascript
// 在 Console 執行（應返回 null）
sessionStorage.getItem('appPassword')  // ✅ 應該是 null
localStorage.getItem('appPassword')    // ✅ 應該是 null
```

#### 2.3 自動鎖定
- [ ] 成功解鎖錢包
- [ ] 等待 **15 分鐘**不操作（可改設定為 1 分鐘測試）
- [ ] ✅ 自動登出
- [ ] ✅ 回到密碼輸入畫面
- [ ] ✅ Console 顯示「Session expired」訊息

**快速測試**（修改 timeout）：
```typescript
// 可暫時修改 src/contexts/AppPasswordContext.tsx
// IDLE_TIMEOUT = 15 * 60 * 1000; // 改為
IDLE_TIMEOUT = 1 * 60 * 1000; // 1 分鐘
```

---

### 3. 多鏈資產顯示

#### 3.1 載入資產餘額
- [ ] 成功解鎖錢包
- [ ] ✅ 自動載入多鏈餘額
- [ ] ✅ 顯示總 USD 價值
- [ ] ✅ 每條鏈分別顯示

**支援的鏈**：
- [ ] Ethereum (ETH)
- [ ] BSC (BNB)
- [ ] Polygon (MATIC)
- [ ] Arbitrum (ETH)
- [ ] Optimism (ETH)
- [ ] Base (ETH)

#### 3.2 代幣列表延遲載入（v0.5.1 新功能）
- [ ] 開啟錢包頁面（**尚未解鎖**）
- [ ] 開啟 DevTools Network 面板
- [ ] ✅ **確認沒有 token-lists JSON 請求**
- [ ] 輸入密碼解鎖
- [ ] ✅ **現在才看到 token-lists 請求**
- [ ] Console 顯示：
  ```
  🛡️ Starting token list loading (wallet unlocked)...
  🛡️ Attempting to load wrapped tokens whitelist...
  ```

**效能驗證**：
- 解鎖前載入時間：< 200ms ✅
- 解鎖後載入時間：可接受（包含 token lists）

---

### 4. 詐騙代幣過濾（v0.5.1 核心新功能）

#### 4.1 白名單過濾機制
- [ ] 解鎖錢包
- [ ] 檢查 Console 日誌
- [ ] ✅ 看到「🛡️ Loaded XXXXX known tokens (CoinGecko + wrapped tokens whitelist)」
- [ ] ✅ 數字應該 > 11,000

#### 4.2 詐騙代幣自動隱藏
**前置條件**：需要有測試詐騙代幣（或模擬）

如果錢包中有未知代幣：
- [ ] ✅ 預設**不顯示**未知代幣
- [ ] ✅ 看到 🛡️ 按鈕顯示數量（例如：🛡️ 3）
- [ ] Console 顯示：
  ```
  🚫 Hiding unknown token: [TOKEN_NAME] ([ADDRESS])
  🛡️ Whitelist filter: X unknown tokens hidden
  ```

#### 4.3 手動顯示未知代幣
- [ ] 點擊 🛡️ 按鈕
- [ ] ✅ 按鈕變為黃色背景（警告色）
- [ ] ✅ 未知代幣現在顯示出來
- [ ] ✅ Console 顯示「⚠️ Showing unknown token (user enabled)」
- [ ] 再次點擊 🛡️ 按鈕
- [ ] ✅ 未知代幣重新隱藏

#### 4.4 合法代幣正常顯示
**測試合法代幣**（應該永遠顯示）：
- [ ] ETH (Ethereum 原生代幣)
- [ ] USDT (Ethereum)
- [ ] USDC (Ethereum)
- [ ] WETH (Wrapped Ether) - 各鏈
- [ ] WMATIC (Wrapped Matic - Polygon)
- [ ] WBNB (Wrapped BNB - BSC)

**驗證**：
- [ ] ✅ 這些代幣**不會被過濾**
- [ ] ✅ 不計入 🛡️ 按鈕的數量
- [ ] Console **不顯示** 🚫 訊息

#### 4.5 Swap 頁面過濾（v0.5.1 修復）
- [ ] 進入 Swap 交易頁面
- [ ] 點擊「選擇代幣」下拉選單
- [ ] ✅ **只顯示白名單內的代幣**
- [ ] ✅ 詐騙代幣**不在選項中**
- [ ] ✅ 合法代幣（USDT, USDC 等）正常顯示

**重要**：這修復了之前 Swap 繞過過濾的 Bug

---

### 5. Token Swap 功能

#### 5.1 選擇代幣對
- [ ] 點擊「Swap」按鈕
- [ ] 選擇 Source Token（例如：ETH）
- [ ] 選擇 Destination Token（例如：USDT）
- [ ] ✅ 成功選擇代幣對

#### 5.2 獲取報價
- [ ] 輸入金額（例如：0.1 ETH）
- [ ] ✅ 自動獲取 1inch 報價
- [ ] ✅ 顯示兌換率
- [ ] ✅ 顯示預估到帳金額
- [ ] ✅ 顯示 Gas Fee
- [ ] ✅ 顯示價格影響 (Price Impact)

#### 5.3 授權檢查（ERC20 代幣）
如果 Source Token 不是 ETH：
- [ ] ✅ 檢查 Allowance
- [ ] 如果需要授權，顯示「Approve」按鈕
- [ ] 點擊 Approve
- [ ] 輸入錢包密碼
- [ ] ✅ 成功授權
- [ ] ✅ 「Approve」按鈕變為「Swap」

#### 5.4 執行 Swap
- [ ] 點擊「Swap」按鈕
- [ ] 檢查交易詳情
- [ ] 輸入錢包密碼
- [ ] ✅ 成功簽署交易
- [ ] ✅ 交易廣播到鏈上
- [ ] ✅ 顯示交易 Hash
- [ ] ✅ 可點擊連結到區塊鏈瀏覽器

---

### 6. Send 交易功能

#### 6.1 發送原生代幣
- [ ] 點擊「Send」按鈕
- [ ] 選擇 ETH（或其他原生代幣）
- [ ] 輸入接收地址（測試地址）
- [ ] 輸入金額
- [ ] ✅ 自動估算 Gas Fee
- [ ] 輸入錢包密碼
- [ ] ✅ 成功發送
- [ ] ✅ 顯示交易 Hash

#### 6.2 發送 ERC20 代幣
- [ ] 選擇 USDT（或其他 ERC20）
- [ ] 輸入接收地址
- [ ] 輸入金額
- [ ] ✅ Gas Fee 估算正確
- [ ] 輸入密碼
- [ ] ✅ 成功發送

#### 6.3 Send 頁面過濾（v0.5.1 修復）
- [ ] 點擊代幣選擇下拉選單
- [ ] ✅ **只顯示白名單內的代幣**
- [ ] ✅ 詐騙代幣不在選項中

---

### 7. Liquid Staking（如有餘額）

#### 7.1 ETH Staking
- [ ] 選擇 Ethereum 錢包（需有 ETH）
- [ ] 點擊「Stake」按鈕
- [ ] 選擇 Staking 協議（Lido）
- [ ] 輸入 Stake 金額
- [ ] ✅ 顯示預估 APY
- [ ] ✅ 顯示會收到的 stETH
- [ ] 輸入密碼確認
- [ ] ✅ 成功 Stake

#### 7.2 BNB Staking
- [ ] 選擇 BSC 錢包（需有 BNB）
- [ ] 點擊「Stake」
- [ ] 選擇 Staking 協議
- [ ] ✅ 流程與 ETH 類似

---

### 8. 交易歷史

#### 8.1 查看歷史記錄
- [ ] 解鎖錢包
- [ ] 點擊「History」或交易歷史頁籤
- [ ] ✅ 顯示多鏈交易記錄
- [ ] ✅ 包含：ERC-20 轉帳、ETH 轉帳、Swap 交易

#### 8.2 交易詳情
- [ ] 點擊一筆交易
- [ ] ✅ 顯示完整詳情（From, To, Value, Gas, Status）
- [ ] ✅ 可點擊連結到區塊鏈瀏覽器

---

## 🔐 安全功能測試

### 9. 零密碼儲存驗證（v0.5.1 核心安全功能）

#### 9.1 密碼不儲存在 React State
- [ ] 解鎖錢包
- [ ] 開啟 React DevTools
- [ ] 檢查 `AppPasswordContext` state
- [ ] ✅ **確認沒有 `appPassword` 欄位**
- [ ] 檢查 `WalletDetail` component state
- [ ] ✅ **確認沒有 `passwordRef` 儲存密碼**

#### 9.2 密碼不儲存在 Browser Storage
```javascript
// 在 DevTools Console 執行
// 檢查 sessionStorage
Object.keys(sessionStorage).forEach(key => {
  console.log(key, sessionStorage.getItem(key));
});

// 檢查 localStorage
Object.keys(localStorage).forEach(key => {
  console.log(key, localStorage.getItem(key));
});
```
- [ ] ✅ **沒有任何密碼相關的值**

#### 9.3 Session Token 有效期
- [ ] 解鎖錢包
- [ ] 記錄當前時間
- [ ] 等待 **15 分鐘**
- [ ] 嘗試執行任何操作（刷新餘額、Swap 等）
- [ ] ✅ 顯示「Session expired」
- [ ] ✅ 要求重新輸入密碼

#### 9.4 密碼只在簽署時使用
- [ ] 執行一筆 Swap 交易
- [ ] 觀察 Console 日誌
- [ ] ✅ 查詢操作使用 `sessionToken`
- [ ] ✅ 簽署交易時才要求密碼
- [ ] ✅ 簽署後密碼立即清除

**Console 日誌範例**：
```
🔐 Creating wallet session token...
✅ Wallet session created successfully
🚀 Starting getTokenBalances request... (使用 sessionToken)
🔐 Please enter password to sign transaction (要求密碼)
✅ Transaction signed, password cleared (密碼清除)
```

---

### 10. USB 離線存儲

#### 10.1 錢包檔案位置驗證
```bash
# 檢查錢包檔案在 USB 上
ls -la /Volumes/YOUR_USB/.arcsign/wallets/

# 應該看到：
# wallet.json - 加密的錢包資料
# addresses.json - 地址簿
```
- [ ] ✅ 錢包檔案存在 USB 上
- [ ] ✅ **不在電腦硬碟上**

#### 10.2 拔掉 USB 測試
- [ ] 在錢包解鎖狀態
- [ ] 拔掉 USB
- [ ] 嘗試執行交易
- [ ] ✅ 顯示錯誤（無法讀取 USB）
- [ ] 插回 USB
- [ ] ✅ 恢復正常

---

## 🎨 UI/UX 測試

### 11. 使用者介面

#### 11.1 Landing Page
- [ ] 開啟 `landing-page/index.html`
- [ ] ✅ 統計數字顯示：85+ 測試, 11K+ 白名單代幣
- [ ] ✅ 新功能卡片顯示：
  - 🛡️ 詐騙代幣過濾（v0.5.1）
  - 🔑 零密碼儲存架構（v0.5.1）
- [ ] 點擊「Download for macOS (Apple Silicon)」
- [ ] ✅ 開始下載 DMG 檔案

#### 11.2 Dashboard UI
- [ ] ✅ 所有按鈕可點擊
- [ ] ✅ 沒有 UI 錯位
- [ ] ✅ 載入動畫正常
- [ ] ✅ 錯誤訊息清楚易懂

#### 11.3 多語言支援
- [ ] 切換到英文
- [ ] ✅ 所有文字正確翻譯
- [ ] ✅ 新功能文字有翻譯：
  - "Hide unknown tokens"
  - "Show X unknown tokens"
- [ ] 切換回中文
- [ ] ✅ 正確顯示中文

---

## 📊 效能測試

### 12. 載入效能

#### 12.1 初始載入
- [ ] 關閉應用程式
- [ ] 重新開啟
- [ ] 記錄載入時間
- [ ] ✅ < 3 秒到可互動狀態

#### 12.2 錢包解鎖速度
- [ ] 輸入密碼
- [ ] 點擊解鎖
- [ ] 記錄時間
- [ ] ✅ < 2 秒顯示資產

#### 12.3 代幣列表載入（延遲載入優化）
- [ ] 解鎖前：不載入（已驗證）
- [ ] 解鎖後：開始載入
- [ ] 記錄載入時間
- [ ] ✅ < 5 秒完成（包含 11,000+ 代幣）

---

## 🐛 已知問題檢查

### 13. 已修復的 Bug 驗證

#### 13.1 Session 密碼跳過問題（已修復）
- [ ] ✅ 確認每次解鎖都要求密碼
- [ ] ✅ 沒有跳過密碼的情況

#### 13.2 Swap 資產不顯示（已修復）
- [ ] Swap 頁面
- [ ] ✅ Arbitrum 資產顯示
- [ ] ✅ Optimism 資產顯示

#### 13.3 L2 Gas 費過高（已修復）
- [ ] 在 Arbitrum 執行 Swap
- [ ] ✅ Gas Fee 合理（不是 100x）
- [ ] 在 Optimism 執行 Swap
- [ ] ✅ Gas Fee 合理

#### 13.4 Wrapped Tokens 被過濾（已修復）
- [ ] 檢查 Polygon 錢包
- [ ] ✅ WMATIC 正常顯示（不被過濾）
- [ ] ✅ WETH 正常顯示（不被過濾）

---

## 🧪 邊界條件測試

### 14. 錯誤處理

#### 14.1 網路錯誤
- [ ] 斷開網路連線
- [ ] 嘗試刷新餘額
- [ ] ✅ 顯示友善的錯誤訊息
- [ ] ✅ 不 crash

#### 14.2 無效輸入
- [ ] 輸入無效地址（Send 頁面）
- [ ] ✅ 顯示驗證錯誤
- [ ] 輸入超過餘額的金額
- [ ] ✅ 顯示「餘額不足」

#### 14.3 USB 移除
- [ ] 交易進行中移除 USB
- [ ] ✅ 顯示錯誤
- [ ] ✅ 不遺失資料

---

## 📝 文檔檢查

### 15. 文檔完整性

- [ ] README.md 更新到 v0.5.1
- [ ] CHANGELOG.md 記錄所有新功能
- [ ] WHITELIST_TOKEN_FILTER.md 完整
- [ ] TOKEN_LIST_LOADING_TIMING_FIX.md 完整
- [ ] CROSS_PLATFORM_BUILD.md 完整
- [ ] Landing page 文案正確

---

## ✅ 發布前最終檢查

### 16. 版本資訊

- [ ] `dashboard/package.json` version: `1.0.0` 或更新
- [ ] `dashboard/src-tauri/tauri.conf.json` version 正確
- [ ] `dashboard/src-tauri/Cargo.toml` version 正確
- [ ] Git tag 建立：`v0.5.1`

### 17. 建置輸出

- [ ] 執行完整建置：
  ```bash
  cd dashboard
  npm run build
  cd src-tauri
  cargo build --release
  ```
- [ ] ✅ 無編譯錯誤
- [ ] ✅ 無編譯警告（或已知可忽略）
- [ ] DMG 檔案生成成功
- [ ] DMG 大小合理（~57MB）

### 18. 下載功能

- [ ] 執行 `./scripts/prepare-downloads.sh`
- [ ] ✅ DMG 複製到 `landing-page/downloads/`
- [ ] ✅ SHA256SUMS 生成
- [ ] Landing page 下載連結可用

### 19. Git 狀態

- [ ] 所有更改已 commit
- [ ] 無未追蹤的重要檔案
- [ ] 準備好推送到 GitHub

---

## 🎯 測試結果總結

### 通過的測試（✅）
總計：_____ / _____

### 發現的問題
| 嚴重性 | 問題描述 | 影響 | 狀態 |
|--------|---------|------|------|
| 🔴 Critical |  |  |  |
| 🟡 Minor |  |  |  |
| 🔵 Enhancement |  |  |  |

### 測試環境資訊
- **作業系統**: macOS _____
- **晶片**: Apple Silicon / Intel
- **USB 隨身碟**: 品牌 _____, 容量 _____
- **網路**: WiFi / 以太網路
- **測試日期**: _____
- **測試時長**: _____ 小時

---

## 🚀 發布決策

### 阻塞性問題
- [ ] 無阻塞性問題（可發布）
- [ ] 有阻塞性問題（需修復後才能發布）

### 發布建議
- [ ] **立即發布** - 所有測試通過，可公開發布
- [ ] **Beta 發布** - 大部分測試通過，內部測試
- [ ] **延後發布** - 需修復重大問題

---

## 📌 測試者簽名

**測試者**: ___________________
**簽名**: ___________________
**日期**: ___________________

---

## 📚 附錄

### A. 測試工具

**推薦工具**：
- Chrome DevTools (檢查 Console, Network, Application)
- React DevTools (檢查 Component State)
- Blockchain Explorer (驗證交易)

### B. 測試資料

**測試網路**（可選）：
- Ethereum Sepolia（測試網）
- BSC Testnet（測試網）

**測試代幣**：
- 使用 Faucet 獲取測試代幣
- **不要在主網測試大額交易**

### C. 快速修復指南

**如果遇到問題**：
1. 檢查 Console 日誌
2. 檢查 USB 連接
3. 重啟應用程式
4. 清除瀏覽器快取（如果是 web 版本）
5. 查看 `TROUBLESHOOTING.md`（如果有）

---

**祝測試順利！** 🎉

如有問題，請記錄詳細的錯誤訊息、Console 日誌和復現步驟。
