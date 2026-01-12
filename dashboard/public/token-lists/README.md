# Token Lists

This directory contains token lists used for the ArcSign wallet.

## Files

### CoinGecko Token Lists (Auto-generated)
- `ethereum.json` - Ethereum mainnet tokens
- `bsc.json` - BSC (Binance Smart Chain) tokens
- `polygon.json` - Polygon tokens
- `arbitrum.json` - Arbitrum tokens
- `optimism.json` - Optimism tokens
- `base.json` - Base tokens

These files are generated from CoinGecko's official token lists and updated periodically.

### Wrapped Tokens Whitelist (Manual)
- `wrapped-tokens-whitelist.json` - Official wrapped native tokens

This file contains well-known wrapped tokens that may not be in the CoinGecko lists or need explicit whitelisting.

## Wrapped Tokens Whitelist Format

```json
{
  "name": "Wrapped Tokens Whitelist",
  "description": "Official wrapped native tokens",
  "version": {
    "major": 1,
    "minor": 0,
    "patch": 0
  },
  "timestamp": "2026-01-12T00:00:00.000Z",
  "tokens": [
    {
      "chainId": 137,
      "address": "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
      "name": "Wrapped Matic",
      "symbol": "WMATIC",
      "decimals": 18,
      "logoURI": "https://..."
    }
  ]
}
```

### Supported Chain IDs

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| BSC | 56 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Optimism | 10 |
| Base | 8453 |
| Avalanche | 43114 |
| Fantom | 250 |

## Adding New Wrapped Tokens

To add a new wrapped token to the whitelist:

1. Open `wrapped-tokens-whitelist.json`
2. Add a new entry to the `tokens` array:
```json
{
  "chainId": <CHAIN_ID>,
  "address": "<CONTRACT_ADDRESS>",
  "name": "<TOKEN_NAME>",
  "symbol": "<SYMBOL>",
  "decimals": <DECIMALS>,
  "logoURI": "<LOGO_URL>"
}
```
3. Update the `timestamp` field
4. Increment the version number if needed

## Usage

The token lists are loaded automatically by the `useAllTokens()` hook in `/src/hooks/useTokenList.ts`.

The wrapped tokens whitelist is merged with CoinGecko lists to provide comprehensive token coverage.

## Security

Only add well-known, verified wrapped tokens to the whitelist. Each token should be:
- ✅ Official wrapped token contract
- ✅ Verified on blockchain explorer
- ✅ Widely used and recognized
- ❌ Do NOT add unverified or suspicious tokens

## Maintenance

- CoinGecko lists: Updated automatically
- Wrapped tokens whitelist: Manual updates as needed
- Review and update the whitelist quarterly
