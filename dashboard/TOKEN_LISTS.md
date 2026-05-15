# Token Lists Integration Guide

## 概述

本系統使用 **CoinGecko Token Lists** 作為代幣資訊的來源,包含代幣地址、圖示、名稱、小數位數等完整資訊。

## 已下載的 Token Lists

位置: `/dashboard/public/token-lists/`

| 檔案            | 來源                                                      | 鏈                             | 代幣數量 |
| --------------- | --------------------------------------------------------- | ------------------------------ | -------- |
| `ethereum.json` | https://tokens.coingecko.com/uniswap/all.json             | Ethereum (Chain ID: 1)         | ~1000+   |
| `arbitrum.json` | https://tokens.coingecko.com/arbitrum-one/all.json        | Arbitrum One (Chain ID: 42161) | ~200+    |
| `polygon.json`  | https://tokens.coingecko.com/polygon-pos/all.json         | Polygon (Chain ID: 137)        | ~200+    |
| `optimism.json` | https://tokens.coingecko.com/optimistic-ethereum/all.json | Optimism (Chain ID: 10)        | ~50+     |
| `bsc.json`      | https://tokens.coingecko.com/binance-smart-chain/all.json | BSC (Chain ID: 56)             | ~700+    |

## Token List 格式

每個 JSON 文件包含:

```json
{
  "name": "CoinGecko",
  "timestamp": "2025-12-15T00:00:00.000Z",
  "version": {
    "major": 1,
    "minor": 0,
    "patch": 0
  },
  "tokens": [
    {
      "chainId": 1,
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "name": "USD Coin",
      "symbol": "USDC",
      "decimals": 6,
      "logoURI": "https://assets.coingecko.com/coins/images/6319/small/usdc.png"
    }
    // ... 更多代幣
  ]
}
```

## 使用方式

### 1. 在組件中使用 Hook

```typescript
import {
  usePriorityTokens,
  useTopTokens,
  useTokenSearch,
} from "@/hooks/useTokenList";

// 載入優先顯示的代幣(USDT, USDC, ETH 等)
const { tokens, isLoading } = usePriorityTokens();

// 載入特定鏈的前 20 個代幣
const { tokens } = useTopTokens("ethereum", 20);

// 搜尋代幣
const { tokens } = useTokenSearch("USDC");
```

### 2. 直接使用 Service

```typescript
import {
  getTokensForChain,
  searchTokenBySymbol,
  findTokenByAddress,
} from "@/services/tokenList";

// 獲取所有 Ethereum 代幣
const ethTokens = await getTokensForChain("ethereum");

// 搜尋 USDT 在所有鏈上
const usdtTokens = await searchTokenBySymbol("USDT");

// 查找特定地址的代幣資訊
const token = await findTokenByAddress("0xA0b86991...", "ethereum");
```

## 更新 Token Lists

### 方法 1: 手動更新

```bash
cd /path/to/arcsign/dashboard/public/token-lists

# 更新 Ethereum
curl -o ethereum.json https://tokens.coingecko.com/uniswap/all.json

# 更新 Arbitrum
curl -o arbitrum.json https://tokens.coingecko.com/arbitrum-one/all.json

# 更新 Polygon
curl -o polygon.json https://tokens.coingecko.com/polygon-pos/all.json

# 更新 Optimism
curl -o optimism.json https://tokens.coingecko.com/optimistic-ethereum/all.json

# 更新 BSC
curl -o bsc.json https://tokens.coingecko.com/binance-smart-chain/all.json
```

### 方法 2: 使用腳本自動更新

創建 `scripts/update-token-lists.sh`:

```bash
#!/bin/bash

TOKEN_LISTS_DIR="./dashboard/public/token-lists"

echo "Updating token lists..."

curl -o "$TOKEN_LISTS_DIR/ethereum.json" \
  https://tokens.coingecko.com/uniswap/all.json

curl -o "$TOKEN_LISTS_DIR/arbitrum.json" \
  https://tokens.coingecko.com/arbitrum-one/all.json

curl -o "$TOKEN_LISTS_DIR/polygon.json" \
  https://tokens.coingecko.com/polygon-pos/all.json

curl -o "$TOKEN_LISTS_DIR/optimism.json" \
  https://tokens.coingecko.com/optimistic-ethereum/all.json

curl -o "$TOKEN_LISTS_DIR/bsc.json" \
  https://tokens.coingecko.com/binance-smart-chain/all.json

echo "Token lists updated successfully!"
```

執行:

```bash
chmod +x scripts/update-token-lists.sh
./scripts/update-token-lists.sh
```

### 建議更新頻率

- **開發階段**: 每週更新一次
- **生產環境**: 每天或每週更新
- **關鍵更新**: 當有新的主要代幣上市時

## 新增其他鏈

要支援新的區塊鏈,例如 Base:

### 1. 下載 Token List

```bash
curl -o public/token-lists/base.json \
  https://tokens.coingecko.com/base/all.json
```

### 2. 更新 `tokenList.ts` 配置

```typescript
export const CHAIN_CONFIG = {
  // ... 現有配置
  base: {
    id: 8453,
    name: "Base",
    file: "/token-lists/base.json",
    coingeckoId: "base",
  },
} as const;
```

### 3. 清除快取

```typescript
import { clearCache } from "@/services/tokenList";
clearCache(); // 重新載入所有 token lists
```

## 可用的 CoinGecko Token List URLs

| 鏈           | URL                                                       |
| ------------ | --------------------------------------------------------- |
| Ethereum     | https://tokens.coingecko.com/uniswap/all.json             |
| Arbitrum One | https://tokens.coingecko.com/arbitrum-one/all.json        |
| Polygon PoS  | https://tokens.coingecko.com/polygon-pos/all.json         |
| Optimism     | https://tokens.coingecko.com/optimistic-ethereum/all.json |
| BSC          | https://tokens.coingecko.com/binance-smart-chain/all.json |
| Avalanche    | https://tokens.coingecko.com/avalanche/all.json           |
| Fantom       | https://tokens.coingecko.com/fantom/all.json              |
| Base         | https://tokens.coingecko.com/base/all.json                |
| zkSync Era   | https://tokens.coingecko.com/zksync/all.json              |
| Celo         | https://tokens.coingecko.com/celo/all.json                |

## 優先代幣列表

在 `commonTokens.ts` 中定義的 `PRIORITY_TOKEN_SYMBOLS` 會自動顯示,即使餘額為 0:

- **穩定幣**: USDT, USDC, DAI, BUSD
- **原生/包裝代幣**: ETH, WETH, BTC, WBTC, BNB, WBNB, MATIC, WMATIC
- **頂級 DeFi**: UNI, AAVE, LINK, CRV, MKR, SNX, COMP, SUSHI
- **Layer 2**: OP, ARB
- **交易所**: OKB

修改此列表以自訂預設顯示的代幣。

## 效能優化

### 快取機制

- Token Lists 在記憶體中快取
- 避免重複下載
- 使用 `clearCache()` 強制重新載入

### 懶加載

- 只在需要時載入特定鏈的資料
- React Hook 自動管理載入狀態

### 圖片優化

- Token logos 使用 CDN (CoinGecko Assets)
- 自動 fallback 到 emoji
- 瀏覽器快取圖片

## 故障排除

### Token List 載入失敗

檢查文件是否存在:

```bash
ls -lh dashboard/public/token-lists/
```

### 代幣資訊不正確

重新下載最新的 token list:

```bash
curl -o public/token-lists/ethereum.json \
  https://tokens.coingecko.com/uniswap/all.json
```

### 快取問題

清除瀏覽器快取或使用:

```typescript
import { clearCache } from "@/services/tokenList";
clearCache();
```

## 授權

- **CoinGecko Token Lists**: 免費使用,遵守 [CoinGecko Terms](https://www.coingecko.com/en/terms)
- **代幣圖示**: 來自 CoinGecko Assets CDN
- **代幣地址**: 公開區塊鏈資料

## 參考資源

- [CoinGecko Token Lists](https://tokenlists.org/)
- [Token Lists Standard (Uniswap)](https://tokenlists.org/)
- [CoinGecko API](https://www.coingecko.com/en/api)
