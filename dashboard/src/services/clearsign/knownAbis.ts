// Curated ABIs for clear-signing. viem decodeFunctionData matches by the 4-byte
// selector, so we only need the relevant function fragments. All offline.

import type { Abi } from "viem";

// ERC-20 / ERC-721 / ERC-1155 common functions.
export const erc20Abi = [
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "transferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
] as const satisfies Abi;

export const erc721Abi = [
  { type: "function", name: "setApprovalForAll", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
] as const satisfies Abi;

// Uniswap Permit2 — approve(token, spender, amount, expiration)
export const permit2Abi = [
  { type: "function", name: "approve", inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], outputs: [], stateMutability: "nonpayable" },
] as const satisfies Abi;

// Uniswap V2 / PancakeSwap V2 router — swap functions (shared interface).
export const uniV2RouterAbi = [
  { type: "function", name: "swapExactTokensForTokens", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ type: "uint256[]" }], stateMutability: "nonpayable" },
  { type: "function", name: "swapExactETHForTokens", inputs: [{ name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ type: "uint256[]" }], stateMutability: "payable" },
  { type: "function", name: "swapExactTokensForETH", inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }], outputs: [{ type: "uint256[]" }], stateMutability: "nonpayable" },
] as const satisfies Abi;

// Uniswap V3 / PancakeSwap V3 SwapRouter — exactInputSingle (struct) / exactInput (packed path).
export const uniV3RouterAbi = [
  { type: "function", name: "exactInputSingle", inputs: [{ name: "params", type: "tuple", components: [
    { name: "tokenIn", type: "address" }, { name: "tokenOut", type: "address" }, { name: "fee", type: "uint24" },
    { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" }, { name: "amountIn", type: "uint256" },
    { name: "amountOutMinimum", type: "uint256" }, { name: "sqrtPriceLimitX96", type: "uint160" },
  ] }], outputs: [{ name: "amountOut", type: "uint256" }], stateMutability: "payable" },
  { type: "function", name: "exactInput", inputs: [{ name: "params", type: "tuple", components: [
    { name: "path", type: "bytes" }, { name: "recipient", type: "address" }, { name: "deadline", type: "uint256" },
    { name: "amountIn", type: "uint256" }, { name: "amountOutMinimum", type: "uint256" },
  ] }], outputs: [{ name: "amountOut", type: "uint256" }], stateMutability: "payable" },
] as const satisfies Abi;

// The set of ABIs decodeCalldata tries, in order. Add more here to widen coverage.
export const KNOWN_ABIS: Abi[] = [erc20Abi, erc721Abi, permit2Abi, uniV2RouterAbi, uniV3RouterAbi];

// uint256 max — an "unlimited" approval amount.
export const MAX_UINT256 = (2n ** 256n) - 1n;
// Permit2 uses uint160 max as its "unlimited".
export const MAX_UINT160 = (2n ** 160n) - 1n;
