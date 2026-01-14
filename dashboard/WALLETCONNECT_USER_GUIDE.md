# WalletConnect 使用指南

**更新日期**: 2026-01-14
**狀態**: Phase 1 - 基礎配對功能已實作

## 功能概述

ArcSign 現已整合 WalletConnect v2 協議，讓你可以安全地連接到去中心化應用程式（dApps）。

### 支援的鏈

- Ethereum (eip155:1)
- BNB Chain (eip155:56)
- Polygon (eip155:137)
- Arbitrum (eip155:42161)
- Optimism (eip155:10)
- Base (eip155:8453)

## 如何使用

### 1. 開啟 WalletConnect

1. 在 ArcSign 中解鎖你的錢包
2. 進入資產頁面（Wallet Detail）
3. 點擊右上角的 **More (⋯)** 按鈕
4. 選擇 **WalletConnect** 選項

### 2. 連接到 dApp

#### 方式 A: 貼上 URI

1. 在 dApp 網站上選擇「Connect Wallet」→「WalletConnect」
2. 複製顯示的 WalletConnect URI（通常以 `wc:` 開頭）
3. 在 ArcSign 的配對對話框中貼上 URI
4. 點擊「Connect」

#### 方式 B: 一鍵從剪貼簿讀取

1. 複製 dApp 提供的 WalletConnect URI
2. 在 ArcSign 配對對話框中點擊「Paste」按鈕
3. 系統會自動讀取剪貼簿內容
4. 點擊「Connect」

#### 方式 C: Deep Link（即將支援）

某些 dApp 可能提供「Open in Wallet」按鈕，點擊後會自動開啟 ArcSign 並發起配對。

### 3. 授權 Session

配對成功後，會顯示 Session 授權對話框：

- **dApp 資訊**: 名稱、圖標、URL
- **請求的鏈**: dApp 想要連接的區塊鏈
- **請求的方法**: dApp 需要的權限（簽署交易、消息等）
- **請求的事件**: dApp 想要監聽的事件

**重要**: 仔細檢查這些資訊，確保你信任該 dApp！

點擊：
- **Approve** - 授權連接
- **Reject** - 拒絕連接

### 4. 查看活躍的 Sessions

在 More 選單中，WalletConnect 選項會顯示：
- `0 active sessions` - 沒有連接
- `1 active session` - 1 個活躍連接
- `2 active sessions` - 2 個活躍連接

### 5. 管理 Sessions（即將推出）

未來版本將支援：
- 查看所有活躍 sessions 列表
- 查看每個 session 的詳細資訊
- 一鍵撤銷（disconnect）session

## 安全提示

### ✅ 安全實踐

1. **只連接信任的 dApp**
   - 檢查 dApp 的 URL 和名稱
   - 確保不是釣魚網站

2. **檢查權限請求**
   - 注意 dApp 請求的方法（methods）
   - 不要授權超出必要的權限

3. **定期清理 Sessions**
   - 不再使用的 dApp 應該撤銷連接
   - 減少安全風險

4. **每筆交易都需密碼**
   - WalletConnect 只負責通訊
   - 實際簽署交易時仍需輸入錢包密碼
   - 私鑰永不離開 USB

### ⚠️ 風險警告

- **釣魚攻擊**: 惡意 dApp 可能偽裝成正規服務
- **惡意交易**: 即使連接了 dApp，簽署前仍應仔細檢查交易內容
- **Session 劫持**: 如果 dApp 網站被入侵，攻擊者可能發送惡意請求

### 🔒 安全保障

ArcSign 提供多層安全保護：

1. **零密碼儲存**: 私鑰永不儲存在硬碟
2. **USB-Only**: 私鑰只存在於 USB
3. **每筆交易需密碼**: 即使 session 已授權，簽署仍需密碼
4. **Session 加密**: WalletConnect sessions 使用 Session Token 加密儲存
5. **完整性驗證**: HMAC 確保 session 資料未被竄改

## 測試 dApp

推薦使用以下 dApp 進行測試：

### 官方測試工具

- **WalletConnect Test dApp**: https://react-app.walletconnect.com/
  - 官方測試工具
  - 支援所有標準方法
  - 安全可靠

### 主流 DeFi 協議

- **Uniswap**: https://app.uniswap.org/
  - DEX 交易
  - 支援多鏈

- **PancakeSwap**: https://pancakeswap.finance/
  - BSC 上的 DEX
  - 測試 BSC 連接

### NFT 市場

- **OpenSea**: https://opensea.io/
  - NFT 交易平台
  - 測試 NFT 簽名

## 故障排除

### 配對失敗

**問題**: 貼上 URI 後顯示「Failed to connect」

**解決方法**:
1. 確保 URI 完整（以 `wc:` 開頭）
2. 檢查網路連接
3. 重新整理 dApp 頁面，獲取新的 URI
4. 確保 WalletConnect Project ID 已配置

### Session 授權對話框未出現

**問題**: 配對後沒有顯示授權對話框

**解決方法**:
1. 檢查瀏覽器 console 是否有錯誤
2. 確保應用已解鎖
3. 重新啟動 ArcSign

### dApp 顯示「Not connected」

**問題**: 授權後 dApp 仍顯示未連接

**解決方法**:
1. 重新整理 dApp 頁面
2. 在 dApp 上點擊「Disconnect」再重新連接
3. 檢查是否選擇了正確的鏈

## 開發資訊

### WalletConnect Project ID

應用使用的 Project ID: `b767ad845cb6833f80d1efa4c082605b`

註冊於: https://cloud.walletconnect.com/

### 技術架構

- **協議**: WalletConnect v2
- **Client**: @walletconnect/sign-client ^2.11.0
- **Relay**: wss://relay.walletconnect.com
- **存儲**: USB-only (加密 + HMAC)

### 已實作功能（Phase 1）

- ✅ Client 初始化
- ✅ Pairing Modal (URI 輸入)
- ✅ Session Approval Dialog
- ✅ Namespace 生成（支援 6 條 EVM 鏈）
- ✅ 基礎事件監聽
- ✅ UI 整合（More 選單）

### 待實作功能（Phase 2）

- ⏳ Session 持久化到 USB
- ⏳ App 重啟後恢復 sessions
- ⏳ eth_sendTransaction 處理
- ⏳ personal_sign 處理
- ⏳ eth_signTypedData_v4 處理
- ⏳ wallet_switchEthereumChain 處理
- ⏳ Active Sessions 管理 UI
- ⏳ RPC Passthrough (讀取類方法)

## 回報問題

如果遇到問題，請提供以下資訊：

1. 使用的 dApp URL
2. 錯誤訊息（如果有）
3. 瀏覽器 console 日誌
4. 重現步驟

在 GitHub 提交 issue: https://github.com/your-repo/arcsign/issues

---

**提示**: WalletConnect 是一個開放協議，任何 dApp 都可以請求連接。請務必謹慎檢查每個連接請求！
