# 🛡️ Scam Token Filter - 詐騙代幣過濾功能

**日期**: 2026-01-12
**版本**: v0.5.1 (Feature)
**狀態**: ✅ 已完成並編譯

---

## 📋 功能概述

自動識別並過濾錢包資產列表中的詐騙代幣，保護使用者免受釣魚攻擊和欺詐代幣的影響。

### 問題背景

使用者在資產頁面會看到詐騙代幣，例如：
```
t.me/s/US_POOL | claim until 15.01.26
✅ CIRCLE TOKEN DISTRIBUTION
```

這些代幣通常包含：
- Telegram/Discord URL
- 虛假的 airdrop 聲稱
- 緊急性戰術（"limited time", "claim until"）
- 表情符號（✅、🎁、💰）

---

## 🏗️ 架構設計

### 核心模組

#### `dashboard/src/utils/scamTokenFilter.ts` - **新增**

**主要功能**：

1. **Pattern Matching** - 識別可疑模式
   - URL patterns (telegram, discord, bit.ly)
   - Fake claims/airdrops
   - Impersonation patterns
   - Urgency tactics
   - Distribution/giveaway scams

2. **Scam Score Calculation** (0-100)
   ```typescript
   - 100: Blacklisted (社群回報)
   - 60+: Name contains scam patterns
   - 50+: Symbol contains scam patterns
   - 30+: Contains emojis
   - 20+: Name too long (>50 chars)
   - 15+: Symbol too long (>10 chars)
   - 10+: Dust amount (<0.0001) + unverified
   ```

3. **Risk Level Classification**
   - **High Risk (50+)**: Filtered by default
   - **Medium Risk (30-49)**: Show with warning
   - **Low Risk (0-29)**: Display normally

4. **Whitelist** - 永不過濾的合法代幣
   ```typescript
   ETH, WETH, BTC, WBTC, USDT, USDC, DAI, BNB, MATIC, AVAX,
   LINK, UNI, AAVE, CRV, SUSHI, CAKE, DOT, ADA, etc.
   ```

5. **Blacklist** - 已確認的詐騙代幣地址
   ```typescript
   // Maintainable Set<string> for confirmed scam addresses
   // Example: '0x123...abc'
   ```

---

## 🎯 整合至 WalletDetail 元件

### 修改檔案

#### 1. `dashboard/src/components/WalletDetail.tsx`

**新增狀態**：
```typescript
const [showScamTokens, setShowScamTokens] = useState(false);
const [scamFilterThreshold] = useState(50); // Default: 50+
```

**修改 `displayTokens` useMemo**：
- 在處理代幣列表前先過濾詐騙代幣
- 只有當 `showScamTokens = true` 時才顯示被過濾的代幣
- 記錄過濾結果到 console

**新增 UI 控制項**：
- 🛡️ 按鈕顯示被過濾的詐騙代幣數量
- 點擊切換顯示/隱藏詐騙代幣
- 視覺提示：黃色背景（當 showScamTokens = true）

**計算過濾數量**：
```typescript
const filteredScamCount = useMemo(() => {
  const tokensAsTokenInfo: TokenInfo[] = tokens.map(t => ({
    symbol: t.tokenSymbol,
    name: t.tokenName,
    contractAddress: t.tokenAddress,
    balance: t.balance,
    verified: false,
  }));

  const { scams } = filterScamTokens(tokensAsTokenInfo, scamFilterThreshold);
  return scams.length;
}, [tokens, scamFilterThreshold]);
```

#### 2. 翻譯檔案更新

**中文** (`dashboard/src/locales/zh-TW/common.json`):
```json
{
  "walletDetail": {
    "hideScamTokens": "隱藏詐騙代幣",
    "showScamTokens": "顯示 {{count}} 個被過濾的可疑代幣"
  }
}
```

**英文** (`dashboard/src/locales/en/common.json`):
```json
{
  "walletDetail": {
    "hideScamTokens": "Hide scam tokens",
    "showScamTokens": "Show {{count}} filtered suspicious tokens"
  }
}
```

---

## 📊 過濾演算法範例

### 範例 1：明顯的詐騙代幣

**輸入**：
```typescript
{
  symbol: "CLAIM",
  name: "t.me/s/US_POOL | claim until 15.01.26",
  contractAddress: "0xabc...",
  balance: "0.00001",
  verified: false
}
```

**計算**：
- Name contains URL pattern (`t.me/`): +60
- Name contains urgency (`until`): +45
- Name too long (>50 chars): +20
- Total: **125 → capped at 100**

**結果**: 🔴 **High Risk - Filtered by default**

---

### 範例 2：表情符號詐騙

**輸入**：
```typescript
{
  symbol: "✅ TOKEN",
  name: "✅ CIRCLE TOKEN DISTRIBUTION",
  contractAddress: "0xdef...",
  balance: "1000",
  verified: false
}
```

**計算**：
- Symbol contains emoji: +30
- Name contains emoji: +30
- Name contains scam pattern (`distribution`): +60
- Total: **120 → capped at 100**

**結果**: 🔴 **High Risk - Filtered by default**

---

### 範例 3：合法代幣（ETH）

**輸入**：
```typescript
{
  symbol: "ETH",
  name: "Ethereum",
  contractAddress: "0x000...000",
  balance: "1.5",
  verified: true
}
```

**計算**：
- Whitelist check: **Immediate return 0**

**結果**: 🟢 **Low Risk - Always displayed**

---

## 🎨 UI 設計

### Scam Filter Button

**預設狀態**（無詐騙代幣）：
- 不顯示按鈕

**有詐騙代幣時**：
- 🛡️ 圖示 + 數字徽章
- 淡灰色邊框（未啟用）
- 懸停：淺灰色背景

**顯示詐騙代幣時** (`showScamTokens = true`):
- 🛡️ 圖示 + 數字徽章
- 黃色背景 (`#fef3c7`)
- 黃色邊框 (`#fbbf24`)
- 懸停：更深黃色背景

**位置**：在 Refresh (🔄) 按鈕和 Network Settings (🌐) 按鈕之間

---

## 🔍 Console 日誌

### 正常過濾

```
🔄 Processing tokens: 25 tokens
🚨 Filtered 2 scam tokens: [
  {
    symbol: "CLAIM",
    name: "t.me/s/US_POOL | claim until 15.01.26",
    score: 100,
    reasons: [
      "代幣名稱包含可疑內容（URL、claim、airdrop 等）",
      "代幣名稱過長（可能包含釣魚訊息）",
      "未經驗證的代幣"
    ]
  },
  ...
]
⚠️ 1 tokens with warnings: [...]
🛡️ Scam filter: 2 blocked, 1 warnings, filtered
📊 Final displayTokens: 23 tokens
```

### 顯示詐騙代幣時

```
🔄 Processing tokens: 25 tokens
🚨 Filtered 2 scam tokens: [...]
🛡️ Scam filter: 2 blocked, 1 warnings, showing all
📊 Final displayTokens: 25 tokens
```

---

## 📝 使用方式

### 使用者流程

1. **解鎖錢包並載入資產**
2. **自動過濾**：詐騙代幣自動被隱藏
3. **查看過濾數量**：如果有被過濾的代幣，會看到 🛡️ 按鈕和數字
4. **選擇性檢視**：點擊 🛡️ 按鈕可切換顯示/隱藏被過濾的代幣
5. **識別風險**：被顯示的詐騙代幣可能有視覺標記（未來可增強）

---

## 🚀 未來增強計劃

### 短期 (v0.5.2)

1. **視覺標記**：為 Medium Risk 代幣添加警告圖示
2. **詳細資訊**：點擊代幣顯示 scam score 和 reasons
3. **社群回報**：添加「Report as Scam」按鈕

### 中期 (v0.6.0)

4. **後端同步**：將 blacklist 同步到後端 API
5. **動態更新**：定期從社群數據庫更新 blacklist
6. **使用者設定**：允許調整 threshold (30/50/70)

### 長期 (v1.0.0)

7. **機器學習**：使用 ML 模型提升檢測準確度
8. **鏈上分析**：整合合約程式碼分析
9. **社群評分**：眾包評分系統

---

## 🧪 測試建議

### 手動測試

1. **無詐騙代幣**
   - 確認 🛡️ 按鈕不顯示

2. **有詐騙代幣**
   - 確認 🛡️ 按鈕顯示正確數量
   - 確認詐騙代幣預設隱藏
   - 確認點擊按鈕可切換顯示

3. **合法代幣（ETH, USDT）**
   - 確認永遠不被過濾

4. **邊界情況**
   - 代幣名稱包含 "claim" 但不是詐騙
   - 代幣符號包含表情符號但是合法項目

### 自動化測試（建議）

```typescript
describe('Scam Token Filter', () => {
  it('should filter tokens with URL patterns', () => {
    const token = { name: 't.me/scam', symbol: 'SCAM', ... };
    expect(calculateScamScore(token)).toBeGreaterThan(50);
  });

  it('should never filter whitelisted tokens', () => {
    const token = { symbol: 'ETH', name: 'Ethereum', ... };
    expect(calculateScamScore(token)).toBe(0);
  });

  it('should filter tokens with emojis', () => {
    const token = { name: '✅ DISTRIBUTION', symbol: '✅', ... };
    expect(calculateScamScore(token)).toBeGreaterThan(50);
  });
});
```

---

## 📚 相關文檔

- [scamTokenFilter.ts](dashboard/src/utils/scamTokenFilter.ts) - 核心過濾邏輯
- [WalletDetail.tsx](dashboard/src/components/WalletDetail.tsx) - UI 整合
- [SECURITY_VERIFICATION_COMPLETE.md](SECURITY_VERIFICATION_COMPLETE.md) - 安全檢驗報告

---

## ✅ 完成狀態

- ✅ 核心過濾邏輯實作
- ✅ Pattern matching 規則定義
- ✅ UI 整合（WalletDetail 元件）
- ✅ 翻譯檔案更新（中文/英文）
- ✅ Frontend 編譯成功
- ⏳ 手動測試（待使用者執行）
- ⏳ 社群 blacklist 同步（未來）

---

**實作完成日期**: 2026-01-12
**編譯狀態**: ✅ 成功 (2.08s)
**下一步**: 使用者手動測試並提供反饋

🛡️ **Scam Token Filter - Protecting Users from Fraudulent Tokens** 🛡️
