/**
 * WalletConnect Shared Validators
 * Feature: Common validation and parsing utilities for WC handlers
 * Created: 2026-01-15
 *
 * Purpose: Eliminate duplicate validation logic across handlers
 */

import { formatAmount, toDecimalString } from "@/utils/formatAmount";

/**
 * Check if a string is a valid Ethereum address
 * Format: 0x followed by 40 hex characters
 */
export function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Decode hex message to UTF-8 string if valid
 * Returns original string if not decodable
 */
export function decodeHexMessage(hex: string): string {
  if (!hex.startsWith('0x')) {
    return hex;
  }

  try {
    const bytes = hex.slice(2).match(/.{2}/g);
    if (!bytes) return hex;

    const decoded = bytes
      .map(byte => String.fromCharCode(parseInt(byte, 16)))
      .join('');

    // Check if result is printable ASCII/UTF-8
    if (/^[\x20-\x7E\u00A0-\uFFFF\n\r\t]*$/.test(decoded)) {
      return decoded;
    }
    return hex; // Return original if not printable
  } catch {
    return hex;
  }
}

/**
 * Parse JSON result from Tauri/Go FFI
 * Handles both direct objects and JSON string responses
 */
export function parseJsonResult<T>(result: unknown): T {
  if (typeof result === 'string') {
    try {
      return JSON.parse(result) as T;
    } catch {
      throw new Error(result);
    }
  }
  return result as T;
}

/**
 * Extract signature from FFI result
 * Handles various response formats from Go layer
 */
export function extractSignature(result: unknown): string {
  const parsed = parseJsonResult<{ signature?: string }>(result);

  if (parsed && typeof parsed === 'object' && 'signature' in parsed && parsed.signature) {
    return parsed.signature;
  }

  throw new Error('No signature in response');
}

/**
 * Format value from wei to display string.
 *
 * This string sits in the approval prompt a user reads before signing, so an
 * unreadable value is returned unchanged rather than as "0 ETH" — a confident
 * zero for something we could not parse is worse than showing the raw text.
 */
export function formatWeiValue(value?: string, symbol = 'ETH'): string {
  if (!value || value === '0x0' || value === '0x') {
    return `0 ${symbol}`;
  }

  try {
    // Throws for anything BigInt cannot read; that is the passthrough case.
    BigInt(value);
  } catch {
    return value;
  }

  return `${formatAmount(toDecimalString(value, 18))} ${symbol}`;
}

/**
 * Get native token symbol for chain
 */
export function getNativeSymbol(chainId: number): string {
  const symbols: Record<number, string> = {
    1: 'ETH',      // Ethereum
    56: 'BNB',     // BSC
    137: 'MATIC',  // Polygon
    42161: 'ETH',  // Arbitrum
    10: 'ETH',     // Optimism
    8453: 'ETH',   // Base
    43114: 'AVAX', // Avalanche C-Chain
  };
  return symbols[chainId] || 'ETH';
}

/**
 * Convert chain ID to chain string for backend
 */
export function getChainString(chainId: number): string {
  const chainStrings: Record<number, string> = {
    1: 'ethereum',
    56: 'bsc',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
    43114: 'avalanche',
  };
  return chainStrings[chainId] || 'ethereum';
}
