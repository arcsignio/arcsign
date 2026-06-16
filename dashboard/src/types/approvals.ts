/**
 * Token Approval types for Approvals management tab
 * Feature: Token Approvals Management (v1.3 Dashboard)
 */

export type RiskLevel = "red" | "yellow" | "green";

export interface ApprovalEntry {
  tokenAddress: string;    // ERC-20 token contract address
  tokenName: string;       // Token name
  tokenSymbol: string;     // Token symbol
  spender: string;         // Approved spender address
  allowance: string;       // Current allowance amount (decimal string)
  isUnlimited: boolean;    // True if allowance >= 2^128
  network: string;         // Internal Network ID
  networkLabel: string;    // Human-readable network name
  ownerAddress: string;    // The wallet address that granted approval

  // Security enrichment (filled by the Go backend, see internal/provider).
  spenderName?: string;    // Protocol name if a known spender, else ""
  spenderType?: string;    // "known:<category>" / "contract" / "eoa"
  isEOA?: boolean;         // Spender is an externally-owned account (scam signal)
  isMalicious?: boolean;   // Spender is on the embedded blocklist
  riskLevel?: RiskLevel;   // "red" / "yellow" / "green"
}

export interface TokenApprovalsResponse {
  approvals: ApprovalEntry[];
  totalCount: number;
}

export interface GetTokenApprovalsParams {
  walletId: string;
  password: string;
  usbPath: string;
  sessionToken?: string;
  appPassword?: string;
}
