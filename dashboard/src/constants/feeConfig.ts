/**
 * ArcSign Fee Configuration
 * Swap fee settings for the Pro membership system
 */

// Fee collection address on BSC (update with actual treasury address)
export const FEE_TREASURY_ADDRESS = '0x0000000000000000000000000000000000000000';

// BSC USDT contract address
export const BSC_USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

// Fee amount: 0.1 USDT (18 decimals)
export const SWAP_FEE_AMOUNT = '100000000000000000'; // 0.1 * 10^18

// Fee amount in human readable format
export const SWAP_FEE_DISPLAY = '0.1 USDT';

// Minimum balance required for fee payment (slightly higher to account for gas)
export const MIN_FEE_BALANCE = '100000000000000000'; // 0.1 USDT

// BSC Chain ID
export const BSC_CHAIN_ID = 56;

// ERC-20 Transfer function signature
// transfer(address,uint256) => 0xa9059cbb
export const ERC20_TRANSFER_SIGNATURE = '0xa9059cbb';

/**
 * Build USDT transfer data for fee payment
 * @param recipientAddress - Treasury address to receive fee
 * @param amount - Amount in wei (0.1 USDT = 100000000000000000)
 */
export function buildFeeTransferData(
  recipientAddress: string = FEE_TREASURY_ADDRESS,
  amount: string = SWAP_FEE_AMOUNT
): string {
  // Remove 0x prefix and pad address to 32 bytes
  const paddedAddress = recipientAddress.slice(2).toLowerCase().padStart(64, '0');

  // Pad amount to 32 bytes
  const paddedAmount = BigInt(amount).toString(16).padStart(64, '0');

  return `${ERC20_TRANSFER_SIGNATURE}${paddedAddress}${paddedAmount}`;
}

/**
 * Calculate if user has enough USDT for fee
 */
export function hasEnoughForFee(usdtBalance: string): boolean {
  return BigInt(usdtBalance) >= BigInt(MIN_FEE_BALANCE);
}

/**
 * Fee transaction configuration for BSC
 */
export interface FeeTransaction {
  to: string;      // USDT contract address
  data: string;    // Transfer call data
  value: string;   // 0 (ERC20 transfer, no native value)
  chainId: number;
}

/**
 * Build fee transaction object
 */
export function buildFeeTransaction(): FeeTransaction {
  return {
    to: BSC_USDT_ADDRESS,
    data: buildFeeTransferData(),
    value: '0',
    chainId: BSC_CHAIN_ID,
  };
}
