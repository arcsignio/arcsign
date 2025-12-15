# Common Tokens Integration

## 概述

此模組整合了常見加密貨幣代幣的公開資料,即使餘額為 0 也會顯示在錢包中,模仿 OKX Wallet 的使用者體驗。

## 資料來源

### 1. 代幣合約地址

- **來源**: 各區塊鏈官方文檔和 Etherscan
- **驗證**: 所有地址均為 checksummed 格式
- **支援鏈**: Ethereum, Polygon, Arbitrum, Optimism, BSC, Bitcoin

### 2. 代幣圖示

- **主要來源**: [CoinGecko Assets](https://www.coingecko.com/)
  - 免費、公開、高品質的代幣圖示
  - 標準 URL 格式: `https://assets.coingecko.com/coins/images/{id}/small/{name}.png`
  - 無需 API key
- **備用方案**: Emoji 圖示
  - 當圖片載入失敗時自動切換
  - 定義於 `TOKEN_EMOJI_FALLBACKS`

### 3. 價格資料(未來整合)

- **推薦來源**: CoinGecko API (免費層)
  - 每分鐘 10-50 次請求
  - 提供即時價格、市值、24h 變化
  - API 文檔: https://www.coingecko.com/en/api

## 已整合的代幣

### Stablecoins 穩定幣

- **USDT** (Tether): Ethereum, Polygon, Arbitrum
- **USDC** (USD Coin): Ethereum, Polygon, Arbitrum

### Layer 1 原生代幣

- **ETH** (Ethereum): Ethereum, Arbitrum
- **BTC** (Bitcoin): Bitcoin mainnet
- **BNB** (BNB Chain): BSC

### Wrapped Tokens 包裝代幣

- **WETH** (Wrapped Ether): Ethereum, Polygon
- **WBTC** (Wrapped Bitcoin): Ethereum

### DeFi 協議代幣

- **UNI** (Uniswap): Ethereum
- **AAVE** (Aave): Ethereum

### Layer 2 代幣

- **MATIC** (Polygon): Ethereum, Polygon
- **OP** (Optimism): Optimism
- **ARB** (Arbitrum): Arbitrum One

### Exchange 交易所代幣

- **OKB** (OKX): Ethereum

## 使用方式

### 1. 在組件中引入

```typescript
import {
  COMMON_TOKENS,
  getTokenEmoji,
  CHAIN_IDS,
} from "@/constants/commonTokens";
```

### 2. 合併使用者代幣與常見代幣

```typescript
const displayTokens = useMemo(() => {
  const tokenMap = new Map<string, TokenBalance>();

  // 先添加使用者實際持有的代幣
  tokens.forEach((token) => {
    const key = `${token.network}-${token.tokenSymbol}`;
    tokenMap.set(key, token);
  });

  // 添加常見代幣(如果不存在)
  COMMON_TOKENS.forEach((commonToken) => {
    const chainData = commonToken.chains[CHAIN_IDS.ETHEREUM];
    if (chainData) {
      const key = `eth-mainnet-${commonToken.symbol}`;
      if (!tokenMap.has(key)) {
        tokenMap.set(key, {
          // ... 創建零餘額的代幣條目
        });
      }
    }
  });

  return Array.from(tokenMap.values());
}, [tokens]);
```

### 3. 圖示載入錯誤處理

```typescript
<img
  src={token.tokenLogo}
  onError={(e) => {
    // 載入失敗時切換到 emoji
    const parent = e.target.parentElement;
    parent.innerHTML = getTokenEmoji(token.tokenSymbol);
  }}
/>
```

## 擴展指南

### 新增代幣

在 `commonTokens.ts` 的 `COMMON_TOKENS` 陣列中新增:

```typescript
{
  symbol: 'NEW',
  name: 'New Token',
  decimals: 18,
  logo: 'https://assets.coingecko.com/coins/images/xxx/small/new.png',
  category: 'defi',
  coingeckoId: 'new-token',
  chains: {
    'eth-mainnet': {
      address: '0x...', // Checksummed address
      chainName: 'Ethereum'
    }
  }
}
```

### 新增 Emoji 備用方案

在 `TOKEN_EMOJI_FALLBACKS` 中新增:

```typescript
'NEW': '🆕',
```

### 支援新的區塊鏈

1. 在 `CHAIN_IDS` 中添加鏈 ID
2. 在相關代幣的 `chains` 物件中添加該鏈的資料

## 最佳實踐

### 1. 代幣顯示優先順序

- 有餘額的代幣優先顯示
- 按 USD 價值排序(高到低)
- 零餘額代幣顯示為半透明(opacity: 0.6)

### 2. 效能優化

- 使用 `useMemo` 快取代幣列表
- 延遲載入圖片
- 避免不必要的重新渲染

### 3. 使用者體驗

- Hover 時完全顯示零餘額代幣
- 清楚標示代幣名稱和餘額
- 提供視覺回饋(動畫、顏色變化)

## 未來整合計劃

### 1. 即時價格 API

```typescript
// 使用 CoinGecko API
const fetchPrices = async (tokenIds: string[]) => {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds.join(
      ","
    )}&vs_currencies=usd`
  );
  return response.json();
};
```

### 2. 代幣搜尋功能

- 按名稱/符號搜尋
- 按分類篩選
- 隱藏零餘額代幣選項

### 3. 自訂代幣列表

- 使用者可以新增自訂代幣
- 儲存在本地配置
- 與常見代幣合併顯示

## 授權與版權

- **代幣地址**: 公開區塊鏈資料,無版權限制
- **CoinGecko 圖示**: 免費使用,需遵守 [CoinGecko Terms](https://www.coingecko.com/en/terms)
- **Emoji**: Unicode 標準,無版權限制

## 參考資源

- [CoinGecko API Documentation](https://www.coingecko.com/en/api/documentation)
- [Ethereum Token Standards](https://ethereum.org/en/developers/docs/standards/tokens/)
- [Token Lists (Uniswap)](https://tokenlists.org/)
- [Etherscan Token Tracker](https://etherscan.io/tokens)
