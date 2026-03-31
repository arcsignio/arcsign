/**
 * ArcSign Referral Service
 *
 * Reads referral contract state via BSC public RPC (eth_call).
 * Write operations (registerCode, setReferrer) are done via executeTransaction in the UI.
 */

import {
  ACTIVE_NETWORK,
  GET_CODE_SELECTOR,
  GET_REFERRER_SELECTOR,
  GET_REFERRAL_COUNT_SELECTOR,
  RESOLVE_CODE_SELECTOR,
} from '../constants/contracts';

// BSC public RPC endpoints (fallback chain)
const BSC_RPC_URLS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc-dataseed1.ninicoin.io/',
];

export interface ReferralInfo {
  code: number;           // 0 = not registered
  hasReferrer: boolean;
  referrerAddress: string; // '0x0...' if none
  referrerCode: number;    // 0 if none
  referralCount: number;
}

/**
 * Encode an address as ABI uint256 (left-padded to 32 bytes)
 */
function encodeAddress(address: string): string {
  return address.toLowerCase().replace('0x', '').padStart(64, '0');
}

/**
 * Encode a uint32 as ABI uint256 (left-padded to 32 bytes)
 */
function encodeUint32(value: number): string {
  return value.toString(16).padStart(64, '0');
}

/**
 * Decode a hex string as uint32
 */
function decodeUint32(hex: string): number {
  const clean = hex.replace('0x', '');
  if (!clean || clean === '0'.repeat(64)) return 0;
  return parseInt(clean, 16);
}

/**
 * Decode an address from ABI-encoded bytes (last 20 bytes of 32-byte word)
 */
function decodeAddress(hex: string): string {
  const clean = hex.replace('0x', '');
  if (!clean || clean === '0'.repeat(64)) return '0x' + '0'.repeat(40);
  return '0x' + clean.slice(24);
}

/**
 * Make an eth_call to BSC RPC with fallback
 */
async function ethCall(to: string, data: string): Promise<string> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [{ to, data }, 'latest'],
  });

  for (const rpcUrl of BSC_RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) continue;

      const json = await response.json();
      if (json.error) {
        console.warn(`[referral] RPC error from ${rpcUrl}:`, json.error);
        continue;
      }
      return json.result as string;
    } catch (err) {
      console.warn(`[referral] RPC failed for ${rpcUrl}:`, err);
      continue;
    }
  }

  throw new Error('All BSC RPC endpoints failed');
}

/**
 * Get referral info for an address from the on-chain contract
 */
export async function getReferralInfo(address: string): Promise<ReferralInfo> {
  const contractAddress = ACTIVE_NETWORK.referralContract;

  // Guard: skip RPC calls if contract not yet deployed
  if (contractAddress === '0x' + '0'.repeat(40)) {
    return { code: 0, hasReferrer: false, referrerAddress: '0x' + '0'.repeat(40), referrerCode: 0, referralCount: 0 };
  }

  const encodedAddr = encodeAddress(address);

  // Parallel queries: getCode, getReferrer, getReferralCount
  const [codeResult, referrerResult, countResult] = await Promise.all([
    ethCall(contractAddress, GET_CODE_SELECTOR + encodedAddr),
    ethCall(contractAddress, GET_REFERRER_SELECTOR + encodedAddr),
    ethCall(contractAddress, GET_REFERRAL_COUNT_SELECTOR + encodedAddr),
  ]);

  const code = decodeUint32(codeResult);

  // getReferrer returns (address, uint32) — two 32-byte words
  const referrerHex = referrerResult.replace('0x', '');
  const referrerAddress = decodeAddress('0x' + referrerHex.slice(0, 64));
  const referrerCode = decodeUint32('0x' + referrerHex.slice(64, 128));
  const hasReferrer = referrerAddress !== '0x' + '0'.repeat(40);

  const referralCount = decodeUint32(countResult);

  return {
    code,
    hasReferrer,
    referrerAddress,
    referrerCode,
    referralCount,
  };
}

/**
 * Resolve a referral code to an address
 */
export async function resolveReferralCode(code: number): Promise<string> {
  const contractAddress = ACTIVE_NETWORK.referralContract;

  // Guard: return zero address if contract not yet deployed
  if (contractAddress === '0x' + '0'.repeat(40)) {
    return '0x' + '0'.repeat(40);
  }

  const result = await ethCall(contractAddress, RESOLVE_CODE_SELECTOR + encodeUint32(code));
  return decodeAddress(result);
}

/**
 * Build registerCode() calldata (no arguments)
 */
export function buildRegisterCodeCalldata(): string {
  // registerCode() has no parameters, just the 4-byte selector
  return '0x5992491f';
}

/**
 * Build setReferrer(uint32 code) calldata
 */
export function buildSetReferrerCalldata(code: number): string {
  return '0xee1be6a0' + encodeUint32(code);
}
