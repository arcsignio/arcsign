/**
 * Shared type definitions for the swap feature.
 *
 * ToToken is the destination-token shape used across the swap flow:
 * useSwapFlow, SwapConfirm, and SwapQuoteView all carry this exact shape.
 *
 * NOTE: TokenPicker's DestToken (address/symbol/name/decimals/logoURI?/balance?)
 * is a distinct shape (has `balance?` instead of `network?`) and is intentionally
 * kept in TokenPicker.tsx.
 */

export interface ToToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  network?: string;
}
